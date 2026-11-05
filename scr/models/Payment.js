const mongoose = require("mongoose");
const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true, default: 199 },
  phone: { type: String, required: true },
  status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  provider: { type: String, enum: ["optimapay", "legacy"], default: "optimapay" },
  providerTransactionId: String,
  merchantRequestId: String,
  checkoutRequestId: { type: String, index: true, sparse: true, unique: true },
  mpesaReceiptNumber: String,
  resultDescription: String,
  callbackPayload: mongoose.Schema.Types.Mixed
}, { timestamps: true });
module.exports = mongoose.model("Payment", paymentSchema);
