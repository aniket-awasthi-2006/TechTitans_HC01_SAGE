import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { requireRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || 'doctor';

    const users = await User.find({ role }).select('-password').lean();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('[Users GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['reception']);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    await connectDB();
    const { name, email, password, role, specialization } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const user = await User.create({ name, email, password, role, specialization });
    const userObj = user.toObject();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safeUser } = userObj as typeof userObj & { password: string };

    return NextResponse.json({ user: safeUser }, { status: 201 });
  } catch (error) {
    console.error('[Users POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
