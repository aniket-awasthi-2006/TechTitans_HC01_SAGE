import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Token from '@/models/Token';
import Consultation from '@/models/Consultation';
import { format } from 'date-fns';

// Public endpoint — no auth required — used by the TV display board
export async function GET() {
  try {
    await connectDB();
    const today = format(new Date(), 'yyyy-MM-dd');

    const tokens = await Token.find({ date: today })
      .populate('doctorId', 'name specialization')
      .sort({ tokenNumber: 1 })
      .lean();

    // Calculate avg consultation duration for wait-time estimates
    const consultations = await Consultation.find({ date: today }).lean();
    const durations = consultations.map((c) => c.duration).filter(Boolean);
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 10;

    return NextResponse.json({ tokens, avgDuration });
  } catch (error) {
    console.error('[Display GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
