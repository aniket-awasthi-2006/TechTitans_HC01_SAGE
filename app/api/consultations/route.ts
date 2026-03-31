import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Consultation from '@/models/Consultation';
import { getTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = getTokenFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const patientName = searchParams.get('patientName');
    const doctorId = searchParams.get('doctorId');

    const query: Record<string, unknown> = {};

    if (user.role === 'doctor') {
      query.doctorId = user.id;
    } else if (doctorId) {
      query.doctorId = doctorId;
    }

    if (patientName) {
      query.patientName = { $regex: patientName, $options: 'i' };
    }

    const consultations = await Consultation.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Calculate average duration for wait time engine
    const durations = consultations.map((c) => c.duration);
    const avgDuration =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 10;

    return NextResponse.json({ consultations, avgDuration });
  } catch (error) {
    console.error('[Consultations GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
