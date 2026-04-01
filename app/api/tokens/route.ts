import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Token from '@/models/Token';
import User from '@/models/User';
import { getTokenFromRequest } from '@/lib/auth';
import { format } from 'date-fns';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import { sortQueueForDoctor } from '@/lib/queue-sort';
import { sendWaitWindowNotifications } from '@/lib/queue-notifications';

function getIO(): SocketIOServer | undefined {
  return (global as { io?: SocketIOServer }).io;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = getTokenFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
    const doctorId = searchParams.get('doctorId');

    const query: Record<string, unknown> = { date };

    if (user.role === 'doctor') {
      query.doctorId = user.id;
    } else if (user.role === 'patient') {
      // Patients see all today's tokens (queue snapshot). Client handles display.
    } else if (doctorId) {
      query.doctorId = doctorId;
    }

    const rawTokens = await Token.find(query)
      .populate({ path: 'doctorId', select: 'name specialization', strictPopulate: false })
      .populate({ path: 'bookedById', select: 'name email phone', strictPopulate: false })
      .sort({ tokenNumber: 1 })
      .lean();

    const tokens = user.role === 'doctor' ? sortQueueForDoctor(rawTokens) : rawTokens;

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('[Tokens GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = getTokenFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['reception', 'doctor', 'patient'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      doctorId,
      patientAge, patientGender, patientPhone, vitals,
      // Family member fields
      forSelf = true,
      familyName, familyRelationship,
      // Reception supplies the registered patient account ID when linking a token
      bookedById: bodyBookedById,
      // Walk-in patient name when no registered patient is selected
      patientName: bodyPatientName,
    } = body;

    const isSelf = forSelf !== false;

    let linkedPatientName = '';
    if (bodyBookedById && mongoose.Types.ObjectId.isValid(bodyBookedById)) {
      const linkedPatient = await User.findById(bodyBookedById)
        .select('name role')
        .lean();
      linkedPatientName = linkedPatient?.role === 'patient' ? linkedPatient.name?.trim() || '' : '';
    }

    // Resolve patient name
    const walkInPatientName = (bodyPatientName || '').trim();
    const patientName = isSelf
      ? (walkInPatientName || linkedPatientName || (user.role === 'patient' ? user.name : ''))
      : (familyName || '').trim();

    const relationship = isSelf ? 'self' : (familyRelationship || 'other');

    // bookedById: only set when a real patient account is involved.
    // - Patient booking for self/family: their own account ID
    // - Reception linking to a registered patient: the selected patient's ID
    // - Reception walk-in (no patient selected): leave undefined (no link)
    let bookedById: string | undefined;
    if (bodyBookedById && mongoose.Types.ObjectId.isValid(bodyBookedById)) {
      bookedById = bodyBookedById;          // reception selected a registered patient
    } else if (user.role === 'patient') {
      bookedById = user.id;                 // patient booking for themselves/family
    }
    // else: receptionist walk-in — no bookedById stored

    // patientId = registered account ID — set for self-bookings tied to an account
    const patientId = isSelf
      ? (bodyBookedById && mongoose.Types.ObjectId.isValid(bodyBookedById)
          ? bodyBookedById
          : (user.role === 'patient' ? user.id : undefined))
      : undefined;

    if (!patientName) {
      return NextResponse.json(
        { error: isSelf ? 'Patient name is required' : 'Family member name is required' },
        { status: 400 }
      );
    }
    if (user.role === 'reception' && !String(patientPhone || '').trim()) {
      return NextResponse.json({ error: 'Patient phone is required for reception token creation' }, { status: 400 });
    }
    if (!doctorId) {
      return NextResponse.json({ error: 'doctorId is required' }, { status: 400 });
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    // Duplicate check (patient role only)
    if (user.role === 'patient') {
      if (isSelf) {
        const existing = await Token.findOne({
          bookedById: user.id,
          relationship: 'self',
          date: today,
          status: { $in: ['waiting', 'in-progress'] },
        });
        if (existing) {
          return NextResponse.json({ error: 'You are already in the queue. You can re-join after your consultation is complete.' }, { status: 409 });
        }
      } else {
        const existing = await Token.findOne({
          bookedById: user.id,
          patientName: { $regex: new RegExp(`^${patientName}$`, 'i') },
          date: today,
          status: { $in: ['waiting', 'in-progress'] },
        });
        if (existing) {
          return NextResponse.json({ error: `${patientName} is already in the queue.` }, { status: 409 });
        }
      }
    }

    // Get next token number for today
    const lastToken = await Token.findOne({ date: today }).sort({ tokenNumber: -1 });
    const tokenNumber = (lastToken?.tokenNumber || 0) + 1;

    const token = await Token.create({
      tokenNumber,
      patientId,
      bookedById,
      patientName,
      patientAge: patientAge || 0,
      patientGender: patientGender || 'other',
      patientPhone: patientPhone?.trim(),
      relationship,
      vitals,
      doctorId,
      date: today,
      status: 'waiting',
    });

    const populatedToken = await Token.findById(token._id)
      .populate({ path: 'doctorId', select: 'name specialization', strictPopulate: false })
      .populate({ path: 'bookedById', select: 'name email phone', strictPopulate: false })
      .lean();

    const io = getIO();
    if (io) {
      io.emit('token_created', populatedToken);
      io.emit('queue_updated', { date: today });
    }

    try {
      await sendWaitWindowNotifications(today, String(doctorId));
    } catch (notifyError) {
      console.error('[Tokens POST Notifications]', notifyError);
    }

    return NextResponse.json({ token: populatedToken }, { status: 201 });
  } catch (error) {
    console.error('[Tokens POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
