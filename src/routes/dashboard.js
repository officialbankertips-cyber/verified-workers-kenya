const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const User = require("../models/User");
const Job = require("../models/Job");
const Payment = require("../models/Payment");
const Application = require("../models/Application");

router.get("/summary", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (user.role === "admin") {
      const [users, workers, employers, agencies, pendingVerification, payments, jobs] = await Promise.all([
        User.countDocuments(), User.countDocuments({ role: "worker" }), User.countDocuments({ role: "employer" }),
        User.countDocuments({ role: "agency" }), User.countDocuments({ verificationStatus: "pending" }),
        Payment.countDocuments({ status: "paid" }), Job.countDocuments()
      ]);
      return res.json({ user, stats: { users, workers, employers, agencies, pendingVerification, payments, jobs } });
    }
    const jobs = user.role === "worker" ? await Job.find({ status: "published" }).sort({ createdAt: -1 }).limit(8) : await Job.find({ employer: user._id }).sort({ createdAt: -1 }).limit(8);
    res.json({ user, jobs });
  } catch (e) { next(e); }
});

router.post("/jobs", requireAuth, requireRole("employer", "agency"), async (req, res, next) => {
  try {
    const account = await User.findById(req.session.userId);
    if (!account || account.paymentStatus !== "paid") return res.status(402).json({ error: "Complete the Ksh 199 registration payment before posting vacancies." });
    const { title, category, county, description, employmentType, salary } = req.body;
    if (!title || !description) return res.status(400).json({ error: "Job title and description are required." });
    const job = await Job.create({ employer: req.session.userId, title, category, county, description, employmentType, salary, status: "pending" });
    res.status(201).json({ job, message: "Job submitted for admin review." });
  } catch (e) { next(e); }
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const users = await User.find().select("fullName email phone role county town occupation skills experience bio organization profileImage paymentStatus registrationPaidAt verificationStatus documents isActive createdAt").sort({ createdAt: -1 }).limit(1000).lean();
    res.json({ users });
  } catch (e) { next(e); }
});

router.patch("/admin/users/:id/verification", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!["pending", "verified", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid verification status." });
    const existing = await User.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "User not found." });
    if (status === "verified" && existing.paymentStatus !== "paid") {
      return res.status(400).json({ error: "The registration payment must be confirmed before account verification." });
    }
    if (status === "verified" && (!existing.documents.length || !existing.documents.every(d => d.status === "approved"))) {
      return res.status(400).json({ error: "Approve all submitted documents before marking this account verified." });
    }
    existing.verificationStatus = status;
    await existing.save();
    const user = await User.findById(existing._id).select("-passwordHash -idNumber");
    res.json({ user });
  } catch (e) { next(e); }
});

router.get("/admin/jobs", requireAuth, requireRole("admin"), async(req,res,next)=>{
  try { const jobs=await Job.find().populate("employer","fullName email organization").sort({createdAt:-1}).limit(300); res.json({jobs}); } catch(e){next(e);}
});
router.patch("/admin/documents/:userId/:index", requireAuth, requireRole("admin"), async(req,res,next)=>{
  try {
    const status=req.body.status; if(!["approved","rejected","pending"].includes(status))return res.status(400).json({error:"Invalid document status."});
    const user=await User.findById(req.params.userId); const i=Number(req.params.index); if(!user||!Number.isInteger(i)||i<0||i>=user.documents.length)return res.status(404).json({error:"Document not found."});
    user.documents[i].status=status;
    const allApproved=user.documents.length>0&&user.documents.every(d=>d.status==="approved");
    if(status==="rejected")user.verificationStatus="rejected"; else if(allApproved)user.verificationStatus="verified"; else user.verificationStatus="pending";
    await user.save(); res.json({user:user.toObject({transform:(doc,ret)=>{delete ret.passwordHash;delete ret.idNumber;return ret;}})});
  }catch(e){next(e);}
});
router.post("/admin/jobs", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { title, category, county, description, employmentType, salary, status } = req.body;
    if (!String(title || "").trim() || !String(description || "").trim()) {
      return res.status(400).json({ error: "Job title and description are required." });
    }
    const initialStatus = status === "published" ? "published" : "pending";
    const job = await Job.create({
      employer: req.session.userId,
      title: String(title).trim(), category: String(category || "").trim(),
      county: String(county || "").trim(), description: String(description).trim(),
      employmentType, salary: String(salary || "Negotiable").trim(), status: initialStatus
    });
    res.status(201).json({ job, message: initialStatus === "published" ? "Job published successfully." : "Job saved as pending review." });
  } catch (e) { next(e); }
});

router.patch("/admin/jobs/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!["published", "rejected", "closed"].includes(status)) return res.status(400).json({ error: "Invalid job status." });
    const job = await Job.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!job) return res.status(404).json({ error: "Job not found." });
    res.json({ job });
  } catch (e) { next(e); }
});
module.exports = router;
