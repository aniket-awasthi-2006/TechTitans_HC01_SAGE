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
    if (!['reception', 'doctor'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { patientName, patientAge, patientPhone, vitals, symptoms, doctorId } = body;

    if (!patientName || !patientAge || !symptoms || !doctorId) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    // Get next token number for today
    const lastToken = await Token.findOne({ date: today }).sort({ tokenNumber: -1 });
    const tokenNumber = (lastToken?.tokenNumber || 0) + 1;

    const token = await Token.create({
      tokenNumber,
      patientName,
      patientAge,
      patientPhone,
      vitals,
      symptoms,
      doctorId,
      date: today,
      status: 'waiting',
    });

    const populatedToken = await Token.findById(token._id)
      .populate('doctorId', 'name specialization')
      .lean();

    // Emit socket event
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
