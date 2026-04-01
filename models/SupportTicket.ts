import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISupportTicket extends Document {
  userRole: 'patient' | 'doctor' | 'reception';
  complaint: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  status: 'new' | 'in-progress' | 'resolved';
  source: 'login-chatbot';
  metadata?: {
    userAgent?: string;
    ip?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    userRole: {
      type: String,
      enum: ['patient', 'doctor', 'reception'],
      required: true,
    },
    complaint: { type: String, required: true, trim: true, minlength: 5, maxlength: 5000 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 30 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    status: {
      type: String,
      enum: ['new', 'in-progress', 'resolved'],
      default: 'new',
    },
    source: {
      type: String,
      enum: ['login-chatbot'],
      default: 'login-chatbot',
    },
    metadata: {
      userAgent: { type: String, trim: true },
      ip: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ userRole: 1, createdAt: -1 });

const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

export default SupportTicket;
