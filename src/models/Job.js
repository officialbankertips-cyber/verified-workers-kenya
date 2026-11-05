const mongoose = require("mongoose");
const jobSchema = new mongoose.Schema({
  employer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, default: "" },
  county: { type: String, default: "" },
  description: { type: String, required: true, maxlength: 5000 },
  employmentType: { type: String, enum: ["Full-time", "Part-time", "Contract", "Temporary", "Casual"], default: "Full-time" },
  salary: { type: String, default: "Negotiable" },
  status: { type: String, enum: ["pending", "published", "closed", "rejected"], default: "pending" }
}, { timestamps: true });
module.exports = mongoose.model("Job", jobSchema);
