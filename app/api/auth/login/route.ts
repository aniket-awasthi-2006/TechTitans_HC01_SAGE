import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

// Demo users — fallback without MongoDB
const DEMO_USERS = [
  { id: 'demo-reception-001', name: 'Reception Staff',   email: 'reception@hospital.com', phone: null, password: 'password123', role: 'reception' as const },
  { id: 'demo-doctor-001',    name: 'Dr. Priya Sharma',  email: 'doctor@hospital.com',    phone: null, password: 'password123', role: 'doctor'    as const, specialization: 'General Medicine' },
  { id: 'demo-doctor-002',    name: 'Dr. Rohan Mehta',   email: 'doctor2@hospital.com',   phone: null, password: 'password123', role: 'doctor'    as const, specialization: 'Cardiology' },
  { id: 'demo-patient-001',   name: 'Patient Demo',       email: 'patient@hospital.com',   phone: null, password: 'password123', role: 'patient'   as const },
];

export async function POST(req: NextRequest) {
  try {
    // Accept either { email, password } or { phone, password }
    const body = await req.json();
    const { password } = body;
    const email: string | undefined = body.email;
    const phone: string | undefined = body.phone;

    if ((!email && !phone) || !password) {
      return NextResponse.json({ error: 'Phone/email and password are required' }, { status: 400 });
    }

    let user: { id: string; name: string; email: string; role: 'patient' | 'reception' | 'doctor' } | null = null;

    // Try MongoDB
    try {
      const connectDB = (await import('@/lib/db')).default;
      const User = (await import('@/models/User')).default;
      await connectDB();

      // Look up by phone (patients) or email (staff)
      const query = phone
        ? { phone }
        : { email: email!.toLowerCase() };

      const dbUser = await User.findOne(query);
      if (dbUser) {
        const isValid = await dbUser.comparePassword(password);
        if (isValid) {
          user = {
            id: dbUser._id.toString(),
            email: dbUser.email || dbUser.phone || '',
            role: dbUser.role,
            name: dbUser.name,
          };
        }
      }
    } catch {
      console.log('[Auth] MongoDB unavailable, trying demo mode');
    }

    // Demo fallback (email only)
    if (!user && email) {
      const demo = DEMO_USERS.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (demo) {
        user = { id: demo.id, email: demo.email, role: demo.role, name: demo.name };
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: phone ? 'Invalid phone number or password' : 'Invalid email or password' },
        { status: 401 }
      );
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
