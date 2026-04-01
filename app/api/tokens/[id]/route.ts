import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Token from '@/models/Token';
import Consultation from '@/models/Consultation';
import { getTokenFromRequest } from '@/lib/auth';
import { format } from 'date-fns';
import { Server as SocketIOServer } from 'socket.io';

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
    const { status, diagnosis, prescription, notes, duration, isPriority } = body;

    const token = await Token.findById(id);
    if (!token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });

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

      // Create consultation record
      if (diagnosis && prescription) {
        await Consultation.create({
          tokenId:      token._id,
          patientId:    token.patientId,
          bookedById:   token.bookedById || token.patientId,
          doctorId:     token.doctorId,
          patientName:  token.patientName,
          doctorName:   user.name,
          relationship: (token as { relationship?: string }).relationship || 'self',
          patientGender:(token as { patientGender?: string }).patientGender,
          diagnosis,
          prescription,
          notes,
          duration: duration || 10,
          date: format(new Date(), 'yyyy-MM-dd'),
        });
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
