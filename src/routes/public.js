const router = require("express").Router();
const Job = require("../models/Job");
const User = require("../models/User");

router.get("/jobs", async (req, res, next) => {
  try {
    const jobs = await Job.find({ status: "published" }).select("title category county description employmentType salary createdAt").sort({ createdAt: -1 }).limit(50);
    res.json({ jobs });
  } catch (e) { next(e); }
});
router.get("/workers", async (req, res, next) => {
  try {
    const filter = { role: "worker", paymentStatus: "paid", verificationStatus: "verified", isActive: true };
    const safePattern = value => String(value).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (req.query.county) filter.county = new RegExp(safePattern(req.query.county), "i");
    if (req.query.skill) filter.skills = new RegExp(safePattern(req.query.skill), "i");
    const workers = await User.find(filter).select("fullName county town occupation skills experience bio verificationStatus").limit(60);
    res.json({ workers });
  } catch (e) { next(e); }
});
module.exports = router;
