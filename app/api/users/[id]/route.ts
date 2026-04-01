import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Token from '@/models/Token';
import { getTokenFromRequest } from '@/lib/auth';
import { Server as SocketIOServer } from 'socket.io';
import { format } from 'date-fns';

function getIO(): SocketIOServer | undefined {
  return (global as { io?: SocketIOServer }).io;
}

type Params = { id: string };

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    await connectDB();
    const user = getTokenFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'reception') {
      return NextResponse.json({ error: 'Forbidden — reception only' }, { status: 403 });
    }

    const { id } = await params;
    const { isAvailable } = await req.json();

    const doctor = await User.findByIdAndUpdate(
      id,
      { isAvailable },
      { new: true }
    ).select('name specialization isAvailable role');

    if (!doctor || doctor.role !== 'doctor') {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    // Count waiting patients for this doctor (so the client can display a warning)
    const today = format(new Date(), 'yyyy-MM-dd');
    const waitingCount = await Token.countDocuments({
      doctorId: id,
      date: today,
      status: 'waiting',
    });

    // Emit real-time event so all portals update instantly
    const io = getIO();
    if (io) {
      io.emit('doctor_availability_changed', {
        doctorId: id,
        isAvailable,
        doctorName: doctor.name,
        waitingCount,
      });
    }

    return NextResponse.json({ user: doctor, waitingCount });
  } catch (error) {
    console.error('[User PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
