import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

// Demo users — work without MongoDB (hardcoded fallback)
const DEMO_USERS = [
  { id: 'demo-reception-001', name: 'Reception Staff', email: 'reception@hospital.com', password: 'password123', role: 'reception' as const },
  { id: 'demo-doctor-001', name: 'Dr. Priya Sharma', email: 'doctor@hospital.com', password: 'password123', role: 'doctor' as const, specialization: 'General Medicine' },
  { id: 'demo-doctor-002', name: 'Dr. Rohan Mehta', email: 'doctor2@hospital.com', password: 'password123', role: 'doctor' as const, specialization: 'Cardiology' },
  { id: 'demo-patient-001', name: 'Patient Demo', email: 'patient@hospital.com', password: 'password123', role: 'patient' as const },
];

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Try MongoDB first
    let user = null;
    try {
      const connectDB = (await import('@/lib/db')).default;
      const User = (await import('@/models/User')).default;
      await connectDB();
      const dbUser = await User.findOne({ email: email.toLowerCase() });
      if (dbUser) {
        const isValid = await dbUser.comparePassword(password);
        if (isValid) {
          user = { id: dbUser._id.toString(), email: dbUser.email, role: dbUser.role, name: dbUser.name };
        }
      }
    } catch {
      // MongoDB unavailable — fall through to demo mode
      console.log('[Auth] MongoDB unavailable, trying demo mode');
    }

    // Demo mode fallback (works without MongoDB)
    if (!user) {
      const demo = DEMO_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (demo) {
        user = { id: demo.id, email: demo.email, role: demo.role, name: demo.name };
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signToken(user);

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('[Auth Login]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
