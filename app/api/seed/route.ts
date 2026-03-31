import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs');

export async function POST(_req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    await connectDB();

    // Clear existing users
    await User.deleteMany({});

    // Pre-hash passwords BEFORE creating users.
    // User.create triggers the pre-save hook which hashes again — so we use
    // insertMany with { skipValidation: false } OR bypass the hook by setting
    // the already-hashed password directly after bypassing hooks.
    // Best fix: use Model.create but with raw pre-hashed pwd and skip the hook
    // by using insertMany (which does NOT trigger pre-save hooks).
    const hash = (pw: string) => bcrypt.hash(pw, 12);

    const usersData = [
      { name: 'Reception Staff',  email: 'reception@hospital.com', password: await hash('password123'), role: 'reception' },
      { name: 'Dr. Priya Sharma', email: 'doctor@hospital.com',    password: await hash('password123'), role: 'doctor',    specialization: 'General Medicine' },
      { name: 'Dr. Rohan Mehta',  email: 'doctor2@hospital.com',   password: await hash('password123'), role: 'doctor',    specialization: 'Cardiology' },
      { name: 'Patient Demo',     email: 'patient@hospital.com',   password: await hash('password123'), role: 'patient' },
    ];

    // insertMany skips pre-save hooks → passwords stay single-hashed ✅
    const users = await User.insertMany(usersData, { lean: true });

    return NextResponse.json({
      message: `Seeded ${users.length} users successfully`,
      credentials: [
        { role: 'reception', email: 'reception@hospital.com', password: 'password123' },
        { role: 'doctor',    email: 'doctor@hospital.com',    password: 'password123' },
        { role: 'doctor2',   email: 'doctor2@hospital.com',   password: 'password123' },
        { role: 'patient',   email: 'patient@hospital.com',   password: 'password123' },
      ],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Seed Error]', msg);
    return NextResponse.json({ error: 'Seed failed', detail: msg }, { status: 500 });
  }
}
