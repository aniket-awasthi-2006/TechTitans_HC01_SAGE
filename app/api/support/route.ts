import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import SupportTicket from '@/models/SupportTicket';

interface SupportPayload {
  userRole?: string;
  complaint?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = (await req.json()) as SupportPayload;

    const userRole = String(body.userRole || '').trim();
    const complaint = String(body.complaint || '').trim();
    const contactName = String(body.contactName || '').trim();
    const contactPhone = String(body.contactPhone || '').trim();
    const contactEmail = String(body.contactEmail || '').trim().toLowerCase();

    if (!['patient', 'doctor', 'reception'].includes(userRole)) {
      return NextResponse.json({ error: 'Please choose a valid role.' }, { status: 400 });
    }
    if (!complaint || complaint.length < 10) {
      return NextResponse.json({ error: 'Please describe your issue in more detail.' }, { status: 400 });
    }
    if (!contactName) {
      return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 });
    }
    if (!contactPhone) {
      return NextResponse.json({ error: 'Contact phone is required.' }, { status: 400 });
    }
    if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const ticket = await SupportTicket.create({
      userRole,
      complaint,
      contactName,
      contactPhone,
      contactEmail: contactEmail || undefined,
      status: 'new',
      source: 'login-chatbot',
      metadata: {
        userAgent: req.headers.get('user-agent') || undefined,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      },
    });

    return NextResponse.json(
      {
        success: true,
        ticketId: ticket._id.toString(),
        message: 'Support request created successfully.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Support POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
