import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { name, email, phone, password, role } = await req.json();

    // Patient registration: phone + password (no email required)
    // Staff registration: email + password
    const isPatientPhoneReg = !email && phone;

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (!isPatientPhoneReg && !email) {
      return NextResponse.json({ error: 'Email is required for staff accounts' }, { status: 400 });
    }

    // Check uniqueness
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
    }
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return NextResponse.json({ error: 'Phone number already registered' }, { status: 409 });
      }
    }

    const allowedRoles = ['patient', 'reception', 'doctor'];
    const userRole = allowedRoles.includes(role) ? role : 'patient';

    const user = await User.create({
      name,
      ...(email ? { email: email.toLowerCase() } : {}),
      ...(phone ? { phone } : {}),
      password,
      role: userRole,
    });

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email || '',
      role: user.role,
      name: user.name,
    };
    const token = signToken(tokenPayload);

    return NextResponse.json(
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email || null,
          phone: user.phone || null,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Auth Register]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
