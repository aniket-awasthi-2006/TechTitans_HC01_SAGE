import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Token from '@/models/Token';
import { getTokenFromRequest } from '@/lib/auth';
import { format } from 'date-fns';
import { Server as SocketIOServer } from 'socket.io';

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
      // Patients see all today's tokens (for queue snapshot). Client handles display.
    } else if (doctorId) {
      query.doctorId = doctorId;
    }

    const tokens = await Token.find(query)
      .populate('doctorId', 'name specialization')
      .sort({ tokenNumber: 1 })
      .lean();

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
      symptoms, doctorId,
      patientAge, patientGender, patientPhone, vitals,
      // Family member fields
      forSelf = true,
      familyName, familyRelationship,
    } = body;

    // Determine patient name based on self vs family
    const isSelf = forSelf !== false;
    const patientName     = isSelf ? user.name : (familyName || '').trim();
    const relationship    = isSelf ? 'self' : (familyRelationship || 'other');
    const bookedById      = user.id;
    // patientId is the account ID — only set for self
    const patientId       = isSelf ? user.id : undefined;

    if (!patientName) {
      return NextResponse.json({ error: 'Family member name is required' }, { status: 400 });
    }
    if (!symptoms || !doctorId) {
      return NextResponse.json({ error: 'symptoms and doctorId are required' }, { status: 400 });
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    // Duplicate check:
    // For self: block if the same account has an active (waiting/in-progress) token
    // For family: block if same name + same booked-by + active today
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
        // Prevent same family member from being added twice in same day and still active
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
      patientPhone,
      relationship,
      vitals,
      symptoms,
      doctorId,
      date: today,
      status: 'waiting',
    });

    const populatedToken = await Token.findById(token._id)
      .populate('doctorId', 'name specialization')
      .lean();

    const io = getIO();
    if (io) {
      io.emit('token_created', populatedToken);
      io.emit('queue_updated', { date: today });
    }

    return NextResponse.json({ token: populatedToken }, { status: 201 });
  } catch (error) {
    console.error('[Tokens POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
