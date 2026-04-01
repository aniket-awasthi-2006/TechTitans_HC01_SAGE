import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Token from '@/models/Token';
import Consultation from '@/models/Consultation';
import { getTokenFromRequest } from '@/lib/auth';
import { format } from 'date-fns';
import { Server as SocketIOServer } from 'socket.io';
import { sendCancellationNotifications, sendWaitWindowNotifications } from '@/lib/queue-notifications';
import mongoose from 'mongoose';

function getIO(): SocketIOServer | undefined {
  return (global as { io?: SocketIOServer }).io;
}

type Params = { id: string };

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    await connectDB();
    const user = getTokenFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const {
      status, diagnosis, prescription, notes, duration, isPriority,
      patientName, patientAge, patientGender, patientPhone, relationship, doctorId, vitals,
    } = body;

    const token = await Token.findById(id);
    if (!token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    const previousDoctorId = token.doctorId?.toString?.() || '';

    const hasEditableFieldUpdate =
      typeof patientName !== 'undefined' ||
      typeof patientAge !== 'undefined' ||
      typeof patientGender !== 'undefined' ||
      typeof patientPhone !== 'undefined' ||
      typeof relationship !== 'undefined' ||
      typeof doctorId !== 'undefined' ||
      typeof vitals !== 'undefined';

    if (hasEditableFieldUpdate) {
      if (user.role !== 'reception') {
        return NextResponse.json({ error: 'Only reception can edit patient token details.' }, { status: 403 });
      }
      if (token.status !== 'waiting') {
        return NextResponse.json(
          { error: 'Patient details can only be edited before being called.' },
          { status: 409 }
        );
      }

      if (typeof patientName !== 'undefined') {
        const nextName = String(patientName || '').trim();
        if (!nextName) return NextResponse.json({ error: 'Patient name is required.' }, { status: 400 });
        token.patientName = nextName;
      }

      if (typeof patientAge !== 'undefined') {
        const nextAge = Number(patientAge);
        if (!Number.isFinite(nextAge) || nextAge < 0) {
          return NextResponse.json({ error: 'Patient age must be a valid number.' }, { status: 400 });
        }
        token.patientAge = nextAge;
      }

      if (typeof patientGender !== 'undefined') {
        if (!['male', 'female', 'other'].includes(String(patientGender))) {
          return NextResponse.json({ error: 'Invalid patient gender.' }, { status: 400 });
        }
        token.patientGender = patientGender;
      }

      if (typeof patientPhone !== 'undefined') {
        const nextPhone = String(patientPhone || '').trim();
        if (!nextPhone) {
          return NextResponse.json({ error: 'Patient phone is required.' }, { status: 400 });
        }
        token.patientPhone = nextPhone;
      }

      if (typeof relationship !== 'undefined') {
        if (!['self', 'spouse', 'parent', 'child', 'sibling', 'other'].includes(String(relationship))) {
          return NextResponse.json({ error: 'Invalid relationship.' }, { status: 400 });
        }
        token.relationship = relationship;
      }

      if (typeof doctorId !== 'undefined') {
        if (!mongoose.Types.ObjectId.isValid(String(doctorId))) {
          return NextResponse.json({ error: 'Invalid doctor ID.' }, { status: 400 });
        }
        token.doctorId = doctorId;
      }

      if (typeof vitals !== 'undefined') {
        const safeVitals = typeof vitals === 'object' && vitals ? vitals : {};
        token.vitals = {
          bp: String((safeVitals as { bp?: string }).bp || '').trim(),
          temp: String((safeVitals as { temp?: string }).temp || '').trim(),
          pulse: String((safeVitals as { pulse?: string }).pulse || '').trim(),
          weight: String((safeVitals as { weight?: string }).weight || '').trim(),
          spo2: String((safeVitals as { spo2?: string }).spo2 || '').trim(),
        };
      }
    }

    if (typeof isPriority === 'boolean') {
      if (user.role !== 'reception') {
        return NextResponse.json({ error: 'Only reception can set patient priority' }, { status: 403 });
      }
      if (token.status !== 'waiting') {
        return NextResponse.json({ error: 'Only waiting patients can be marked as priority' }, { status: 409 });
      }
      token.isPriority = isPriority;
      token.priorityMarkedAt = isPriority ? new Date() : undefined;
    }

    // Patients may only cancel their OWN waiting tokens
    if (user.role === 'patient') {
      const isOwner =
        token.bookedById?.toString() === user.id ||
        token.patientId?.toString() === user.id;
      if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (status === 'cancelled' && token.status !== 'waiting') {
        return NextResponse.json(
          { error: 'You can only leave the queue before being called.' },
          { status: 409 }
        );
      }
    }

    if (status === 'done') {
      if (user.role !== 'doctor') {
        return NextResponse.json(
          { error: 'Only doctors can mark a consultation as done.' },
          { status: 403 }
        );
      }
      if (token.status !== 'in-progress') {
        return NextResponse.json(
          { error: 'Only in-progress patients can be marked as done.' },
          { status: 409 }
        );
      }
      if (!String(diagnosis || '').trim() || !String(prescription || '').trim()) {
        return NextResponse.json(
          { error: 'Diagnosis and prescription are required to complete consultation.' },
          { status: 400 }
        );
      }
    }

    if (status === 'in-progress') {
      if (user.role !== 'doctor') {
        return NextResponse.json(
          { error: 'Only doctors can call the next patient.' },
          { status: 403 }
        );
      }
      if (token.status !== 'waiting') {
        return NextResponse.json(
          { error: 'Only waiting patients can be called.' },
          { status: 409 }
        );
      }
    }

    const previousStatus = token.status;
    token.status = status || token.status;

    if (status === 'in-progress') {
      token.calledAt = new Date();
    }

    if (status && status !== 'waiting') {
      token.isPriority = false;
      token.priorityMarkedAt = undefined;
    }

    if (status === 'done') {
      token.completedAt = new Date();
      const fallbackBookedById = token.bookedById || token.patientId || token.doctorId;

      try {
        await Consultation.create({
          tokenId:      token._id,
          patientId:    token.patientId,
          // Keep non-empty for compatibility with older running model instances
          // that may still enforce bookedById as required.
          bookedById:   fallbackBookedById,
          doctorId:     token.doctorId,
          patientName:  token.patientName,
          doctorName:   user.name,
          relationship: (token as { relationship?: string }).relationship || 'self',
          patientGender:(token as { patientGender?: string }).patientGender,
          diagnosis:    String(diagnosis).trim(),
          prescription: String(prescription).trim(),
          notes,
          duration: duration || 10,
          date: format(new Date(), 'yyyy-MM-dd'),
        });
      } catch (consultationError) {
        console.error('[Consultation CREATE]', consultationError);
        return NextResponse.json(
          { error: 'Failed to save consultation details. Please try again.' },
          { status: 500 }
        );
      }
    }

    await token.save();

    const updatedToken = await Token.findById(id)
      .populate({ path: 'doctorId', select: 'name specialization', strictPopulate: false })
      .populate({ path: 'bookedById', select: 'name email phone', strictPopulate: false })
      .lean();

    // Emit socket events
    const io = getIO();
    if (io) {
      io.emit('token_updated', updatedToken);
      if (status === 'in-progress') {
        io.emit('doctor_called_next', { token: updatedToken, doctorName: user.name });
      }
      if (status === 'done' || status === 'cancelled') {
        io.emit('consultation_completed', { tokenId: id, doctorId: user.id });
      }
      io.emit('queue_updated', { date: token.date, previousStatus });
      io.emit('wait_time_updated', { date: token.date });
    }

    try {
      const currentDoctorId = token.doctorId?.toString?.() || '';
      if (status === 'cancelled' && previousStatus !== 'cancelled' && currentDoctorId) {
        await sendCancellationNotifications({
          actorRole: user.role,
          date: token.date,
          doctorId: currentDoctorId,
          previousStatus,
          token: {
            _id: id,
            patientName: token.patientName,
            patientId: token.patientId,
            bookedById: token.bookedById,
          },
        });
      }
      if (previousDoctorId && previousDoctorId !== currentDoctorId) {
        await sendWaitWindowNotifications(token.date, previousDoctorId);
      }
      if (currentDoctorId) {
        await sendWaitWindowNotifications(token.date, currentDoctorId);
      }
    } catch (notifyError) {
      console.error('[Token PATCH Notifications]', notifyError);
    }

    return NextResponse.json({ token: updatedToken });
  } catch (error) {
    console.error('[Token PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    await connectDB();
    const user = getTokenFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const token = await Token.findById(id)
      .populate({ path: 'doctorId', select: 'name specialization', strictPopulate: false })
      .populate({ path: 'bookedById', select: 'name email phone', strictPopulate: false })
      .lean();

    if (!token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    return NextResponse.json({ token });
  } catch (error) {
    console.error('[Token GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
