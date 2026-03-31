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
    const { status, diagnosis, prescription, notes, duration } = await req.json();

    const token = await Token.findById(id);
    if (!token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });

    const previousStatus = token.status;
    token.status = status || token.status;

    if (status === 'in-progress') {
      token.calledAt = new Date();
    }

    if (status === 'done') {
      token.completedAt = new Date();

      // Create consultation record
      if (diagnosis && prescription) {
        await Consultation.create({
          tokenId:      token._id,
          patientId:    token.patientId,          // undefined for family members — that's OK
          bookedById:   token.bookedById || token.patientId,  // always set
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

    const updatedToken = await Token.findById(id).populate('doctorId', 'name specialization').lean();

    // Emit socket events
    const io = getIO();
    if (io) {
      io.emit('token_updated', updatedToken);
      if (status === 'in-progress') {
        io.emit('doctor_called_next', { token: updatedToken, doctorName: user.name });
      }
      if (status === 'done') {
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
    const token = await Token.findById(id).populate('doctorId', 'name specialization').lean();

    if (!token) return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    return NextResponse.json({ token });
  } catch (error) {
    console.error('[Token GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
