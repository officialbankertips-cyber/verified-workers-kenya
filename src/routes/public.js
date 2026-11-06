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
    // Show every active worker profile in the public directory. The blue badge
    // is a payment badge only; it is not a claim of identity/document approval.
    const filter = { role: "worker", isActive: true };
    const safePattern = value => String(value).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (req.query.county) filter.county = new RegExp(safePattern(req.query.county), "i");
    if (req.query.skill) filter.skills = new RegExp(safePattern(req.query.skill), "i");
    const records = await User.find(filter).select("fullName county town occupation skills experience bio profileImage paymentStatus createdAt").sort({ createdAt: -1 }).limit(100);
    const workers = records.map(user => ({
      _id: user._id, fullName: user.fullName, county: user.county, town: user.town,
      occupation: user.occupation, skills: user.skills, experience: user.experience,
      bio: user.bio, profileImage: user.profileImage,
      isPaid: user.paymentStatus === "paid", createdAt: user.createdAt
    }));
    res.json({ workers });
  } catch (e) { next(e); }
});
module.exports = router;
