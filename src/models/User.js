const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ["worker", "employer", "agency", "admin"], required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  county: { type: String, default: "" },
  town: { type: String, default: "" },
  occupation: { type: String, default: "" },
  skills: [{ type: String, trim: true }],
  experience: { type: String, default: "" },
  bio: { type: String, maxlength: 2000, default: "" },
  organization: { type: String, default: "" },
  idNumber: { type: String, select: false, default: "" },
  profileImage: { type: String, default: "" },
  documents: [{ name: String, path: String, mimetype: String, size: Number, status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" } }],
  privacyConsentAt: Date,
  termsAcceptedAt: Date,
  paymentStatus: { type: String, enum: ["unpaid", "pending", "paid"], default: "unpaid" },
  registrationPaidAt: Date,
  verificationStatus: { type: String, enum: ["unsubmitted", "pending", "verified", "rejected"], default: "unsubmitted" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
