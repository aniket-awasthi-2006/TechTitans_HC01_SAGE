import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IToken extends Document {
  tokenNumber: number;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  patientName: string;
  patientAge: number;
  patientPhone?: string;
  vitals?: {
    bp?: string;
    temp?: string;
    pulse?: string;
    weight?: string;
    spo2?: string;
  };
  symptoms: string;
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
  calledAt?: Date;
  completedAt?: Date;
  date: string; // YYYY-MM-DD
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema = new Schema<IToken>(
  {
    tokenNumber: { type: Number, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientName: { type: String, required: true },
    patientAge: { type: Number, required: true },
    patientPhone: { type: String },
    vitals: {
      bp: String,
      temp: String,
      pulse: String,
      weight: String,
      spo2: String,
    },
    symptoms: { type: String, required: true },
    status: {
      type: String,
      enum: ['waiting', 'in-progress', 'done', 'cancelled'],
      default: 'waiting',
    },
    calledAt: { type: Date },
    completedAt: { type: Date },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

// Index for fast queue queries
TokenSchema.index({ doctorId: 1, date: 1, status: 1 });

const Token: Model<IToken> = mongoose.models.Token || mongoose.model<IToken>('Token', TokenSchema);
export default Token;
