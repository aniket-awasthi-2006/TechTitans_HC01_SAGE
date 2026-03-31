import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs');

export async function POST(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    await connectDB();

    // Clear existing users
    await User.deleteMany({});

    // Hash passwords manually (insertMany bypasses pre-save hooks)
    const hash = (pw: string) => bcrypt.hash(pw, 12);

    const users = await Promise.all([
      User.create({ name: 'Reception Staff', email: 'reception@hospital.com', password: await hash('password123'), role: 'reception' }),
      User.create({ name: 'Dr. Priya Sharma', email: 'doctor@hospital.com', password: await hash('password123'), role: 'doctor', specialization: 'General Medicine' }),
      User.create({ name: 'Dr. Rohan Mehta', email: 'doctor2@hospital.com', password: await hash('password123'), role: 'doctor', specialization: 'Cardiology' }),
      User.create({ name: 'Patient Demo', email: 'patient@hospital.com', password: await hash('password123'), role: 'patient' }),
    ]);

    return NextResponse.json({
      message: `Seeded ${users.length} users successfully`,
      credentials: [
        { role: 'reception', email: 'reception@hospital.com', password: 'password123' },
        { role: 'doctor', email: 'doctor@hospital.com', password: 'password123' },
        { role: 'doctor2', email: 'doctor2@hospital.com', password: 'password123' },
        { role: 'patient', email: 'patient@hospital.com', password: 'password123' },
      ],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Seed Error]', msg);
    // Return the actual error message so we can diagnose
    return NextResponse.json({ error: 'Seed failed', detail: msg }, { status: 500 });
  }
}
