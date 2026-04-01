import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Token from '@/models/Token';
import Consultation from '@/models/Consultation';
import User from '@/models/User';
import { format } from 'date-fns';
import { sortQueueForDoctor } from '@/lib/queue-sort';
import mongoose from 'mongoose';

// Public endpoint — no auth required — used by the TV display board
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const today = format(new Date(), 'yyyy-MM-dd');
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get('doctorId') || '';

    if (doctorId && !mongoose.Types.ObjectId.isValid(doctorId)) {
      return NextResponse.json({ error: 'Invalid doctorId' }, { status: 400 });
    }

    let doctor: { _id: mongoose.Types.ObjectId; name: string; specialization?: string; isAvailable?: boolean } | null = null;
    if (doctorId) {
      doctor = await User.findOne({ _id: doctorId, role: 'doctor' })
        .select('name specialization isAvailable')
        .lean();
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
      }
    }

    const tokenQuery: Record<string, unknown> = { date: today };
    if (doctorId) tokenQuery.doctorId = doctorId;

    const rawTokens = await Token.find(tokenQuery)
      .populate('doctorId', 'name specialization')
      .sort({ tokenNumber: 1 })
      .lean();
    const tokens = sortQueueForDoctor(rawTokens);

    // Calculate avg consultation duration for wait-time estimates
    const consultQuery: Record<string, unknown> = { date: today };
    if (doctorId) consultQuery.doctorId = doctorId;
    const consultations = await Consultation.find(consultQuery).lean();
    const durations = consultations.map((c) => c.duration).filter(Boolean);
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 10;

    return NextResponse.json({ tokens, avgDuration, doctor });
  } catch (error) {
    console.error('[Display GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
