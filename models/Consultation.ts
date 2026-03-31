import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IConsultation extends Document {
  tokenId: mongoose.Types.ObjectId;
  patientId?: mongoose.Types.ObjectId;   // the patient's own user ID (only for self-bookings)
  bookedById: mongoose.Types.ObjectId;   // who booked the token — always set (for family too)
  doctorId: mongoose.Types.ObjectId;
  patientName: string;
  doctorName: string;
  relationship?: string;                  // 'self' | 'spouse' | 'parent' | 'child' | 'sibling' | 'other'
  patientGender?: string;
  diagnosis: string;
  prescription: string;
  notes?: string;
  duration: number; // minutes
  date: string;     // YYYY-MM-DD
  createdAt: Date;
}

const ConsultationSchema = new Schema<IConsultation>(
  {
    tokenId:      { type: Schema.Types.ObjectId, ref: 'Token', required: true },
    patientId:    { type: Schema.Types.ObjectId, ref: 'User' },
    bookedById:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientName:  { type: String, required: true },
    doctorName:   { type: String, required: true },
    relationship: { type: String, default: 'self' },
    patientGender:{ type: String },
    diagnosis:    { type: String, required: true },
    prescription: { type: String, required: true },
    notes:        { type: String },
    duration:     { type: Number, default: 10 },
    date:         { type: String, required: true },
  },
  { timestamps: true }
);

// Index for patient lookup — by bookedById covers both self and family
ConsultationSchema.index({ bookedById: 1, date: -1 });
ConsultationSchema.index({ doctorId: 1, date: -1 });

const Consultation: Model<IConsultation> =
  mongoose.models.Consultation || mongoose.model<IConsultation>('Consultation', ConsultationSchema);
export default Consultation;
