import mongoose, { Schema, Document, Model } from 'mongoose';
// Use require to avoid bcryptjs v3 type incompatibilities
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs');

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'patient' | 'reception' | 'doctor';
  hospitalId?: string;
  specialization?: string;
  isAvailable?: boolean;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['patient', 'reception', 'doctor'],
      default: 'patient',
    },
    hospitalId: { type: String },
    specialization: { type: String },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Mongoose v9: async pre hooks don't need next()
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
