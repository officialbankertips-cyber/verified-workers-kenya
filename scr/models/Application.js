const mongoose = require("mongoose");
const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  coverLetter: { type: String, maxlength: 3000, default: "" },
  status: { type: String, enum: ["submitted", "reviewing", "shortlisted", "rejected", "hired", "withdrawn"], default: "submitted" },
  employerNote: { type: String, maxlength: 1500, default: "" }
}, { timestamps: true });
applicationSchema.index({ job: 1, worker: 1 }, { unique: true });
module.exports = mongoose.model("Application", applicationSchema);
