import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConsultation extends Document {
  tokenId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  patientName: string;
  doctorName: string;
  diagnosis: string;
  prescription: string;
  notes?: string;
  duration: number; // minutes
  date: string; // YYYY-MM-DD
  createdAt: Date;
}

const ConsultationSchema = new Schema<IConsultation>(
  {
    tokenId: { type: Schema.Types.ObjectId, ref: 'Token', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientName: { type: String, required: true },
    doctorName: { type: String, required: true },
    diagnosis: { type: String, required: true },
    prescription: { type: String, required: true },
    notes: { type: String },
    duration: { type: Number, default: 10 },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

const Consultation: Model<IConsultation> =
  mongoose.models.Consultation || mongoose.model<IConsultation>('Consultation', ConsultationSchema);
export default Consultation;
