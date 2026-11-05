const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { stkPush, checkStatus, listTransactions, normalizeKenyanPhone } = require("../services/optimapay");
const rateLimit = require("express-rate-limit");
const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: "Too many payment attempts. Try again later." } });
const statusLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

function activateIfVerified(payment, result) {
  const providerStatus = String(result.status || "").toLowerCase();
  if (providerStatus === "failed") {
    payment.status = "failed";
    payment.resultDescription = result.message || "Optimapay reports that the payment failed.";
    return { activated: false, failed: true };
  }
  if (providerStatus !== "completed") {
    payment.status = "pending";
    payment.resultDescription = result.message || "Awaiting Optimapay payment confirmation.";
    return { activated: false, failed: false };
  }

  const amount = Number(result.amount);
  const expectedPhone = normalizeKenyanPhone(payment.phone);
  const returnedPhone = result.phone ? normalizeKenyanPhone(result.phone) : null;
  const receipt = result.transaction_code || result.mpesa_receipt || result.receipt || result.transaction_id;
  if (amount !== Number(payment.amount) || (returnedPhone && returnedPhone !== expectedPhone) || !receipt) {
    payment.resultDescription = "Optimapay reported completion, but amount, phone or receipt did not match. Manual review required.";
    return { activated: false, failed: false, review: true };
  }

  payment.status = "paid";
  payment.mpesaReceiptNumber = String(receipt);
  payment.providerTransactionId = String(result.transaction_id || result.transaction_code || "");
  payment.resultDescription = "Payment independently verified with Optimapay.";
  return { activated: true, failed: false };
}

async function syncPayment(payment) {
  const result = await checkStatus(payment.checkoutRequestId);
  const outcome = activateIfVerified(payment, result);
  await payment.save();
  if (outcome.activated) {
    const user = await User.findById(payment.user);
    if (user && user.paymentStatus !== "paid") {
      user.paymentStatus = "paid";
      user.registrationPaidAt = new Date();
      await user.save();
    }
  }
  return { result, outcome };
}

// Keep the existing frontend route stable; the payment provider is Optimapay.
router.post("/mpesa/stk-push", requireAuth, paymentLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: "Account not found." });
    if (user.paymentStatus === "paid") return res.json({ message: "Registration already paid." });
    const phone = normalizeKenyanPhone(req.body.phone || user.phone);
    const payment = await Payment.create({ user: user._id, amount: 199, phone, provider: "optimapay", status: "pending" });
    try {
      const result = await stkPush({ phone, amount: payment.amount, reference: `VW${payment._id.toString().slice(-8)}`, description: "Verified Workers Kenya registration" });
      if (!result.checkout_request_id) throw new Error(result.message || "Optimapay did not return a checkout request ID.");
      payment.checkoutRequestId = String(result.checkout_request_id);
      payment.merchantRequestId = result.merchant_request_id ? String(result.merchant_request_id) : undefined;
      payment.providerTransactionId = result.transaction_id ? String(result.transaction_id) : undefined;
      await payment.save();
      return res.json({ message: result.message || "M-Pesa prompt sent. Enter your PIN, then wait while we verify your payment.", paymentId: payment._id, checkoutRequestId: payment.checkoutRequestId, status: result.status || "pending" });
    } catch (err) {
      payment.status = "failed";
      payment.resultDescription = err.message;
      await payment.save();
      throw err;
    }
  } catch (e) { next(e); }
});

// Authenticated customer polling. A browser cannot mark an account paid by itself.
router.get("/:id/status", requireAuth, statusLimiter, async (req, res, next) => {
  try {
    const query = req.session.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, user: req.session.userId };
    const payment = await Payment.findOne(query);
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    if (payment.status === "pending" && payment.checkoutRequestId) {
      try { await syncPayment(payment); }
      catch (err) { console.error("Optimapay status check failed:", err.message); }
    }
    const fresh = await Payment.findById(payment._id).select("status amount phone mpesaReceiptNumber resultDescription");
    const user = await User.findById(payment.user).select("paymentStatus");
    res.json({ payment: fresh, accountPaymentStatus: user?.paymentStatus || "unpaid" });
  } catch (e) { next(e); }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const query = req.session.role === "admin" ? {} : { user: req.session.userId };
    const payments = await Payment.find(query).select("amount phone status mpesaReceiptNumber resultDescription provider createdAt").populate("user", "fullName email").sort({ createdAt: -1 }).limit(300);
    res.json({ payments });
  } catch (e) { next(e); }
});

router.post("/admin/:id/reconcile", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    if (payment.status === "paid") return res.json({ message: "Payment is already confirmed." });
    if (!payment.checkoutRequestId) return res.status(400).json({ error: "No Optimapay checkout reference is available." });
    const { outcome } = await syncPayment(payment);
    if (!outcome.activated) return res.status(409).json({ error: payment.resultDescription || "Optimapay has not confirmed a matching successful payment." });
    res.json({ message: "Payment verified with Optimapay and account registration activated." });
  } catch (e) { next(e); }
});

router.get("/admin/provider-transactions", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const result = await listTransactions(page, limit);
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/admin/summary", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const [paid, pending, failed, revenue] = await Promise.all([
      Payment.countDocuments({ status: "paid" }), Payment.countDocuments({ status: "pending" }), Payment.countDocuments({ status: "failed" }),
      Payment.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$amount" } } }])
    ]);
    res.json({ paid, pending, failed, revenue: revenue[0]?.total || 0 });
  } catch (e) { next(e); }
});
module.exports = router;
