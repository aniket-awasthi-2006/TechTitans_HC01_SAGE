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
    const patientId    = searchParams.get('patientId');
    const doctorIdParam = searchParams.get('doctorId');

    let query: Record<string, unknown> = {};

    if (user.role === 'doctor') {
      // Doctor sees all consultations they personally completed
      query.doctorId = user.id;

    } else if (user.role === 'patient') {
      // Patient sees their own AND all family members they booked for.
      // bookedById is always the logged-in patient's account ID.
      query = {
        $or: [
          { bookedById: user.id },  // includes self + family members
          { patientId:  user.id },  // legacy records before bookedById was added
        ],
      };

    } else {
      // Reception — can filter by patientId or doctorId
      if (patientId)     query.patientId = patientId;
      if (doctorIdParam) query.doctorId  = doctorIdParam;
    }

    const consultations = await Consultation.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Calculate average consultation duration for wait-time estimation
    const durations = consultations.map((c) => c.duration).filter(Boolean);
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 10;

    return NextResponse.json({ consultations, avgDuration });
  } catch (error) {
    console.error('[Consultations GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
