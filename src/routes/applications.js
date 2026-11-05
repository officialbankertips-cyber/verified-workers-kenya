const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const { sendEmail } = require("../services/email");

router.post("/jobs/:jobId/apply", requireAuth, requireRole("worker"), async (req,res,next)=>{
  try {
    const worker = await User.findById(req.session.userId);
    if (!worker || worker.paymentStatus !== "paid") return res.status(402).json({error:"Complete the Ksh 199 registration payment before applying."});
    const job = await Job.findOne({_id:req.params.jobId,status:"published"}).populate("employer","fullName email organization");
    if (!job) return res.status(404).json({error:"This vacancy is no longer available."});
    const application = await Application.create({job:job._id,worker:worker._id,coverLetter:String(req.body.coverLetter||"").trim()});
    if (job.employer?.email) sendEmail({to:job.employer.email,subject:"New job application received",text:`${worker.fullName} has applied for ${job.title}. Sign in to your Verified Workers dashboard to review the application.`}).catch(()=>{});
    res.status(201).json({application,message:"Your application has been submitted."});
  } catch(e) { if(e.code===11000) return res.status(409).json({error:"You have already applied for this job."}); next(e); }
});

router.get("/applications", requireAuth, async (req,res,next)=>{
  try {
    const user = await User.findById(req.session.userId);
    let query = {};
    if (user.role === "worker") query.worker = user._id;
    else if (user.role === "employer" || user.role === "agency") {
      const ownedJobs = await Job.find({employer:user._id}).distinct("_id"); query.job = {$in:ownedJobs};
    } else if (user.role !== "admin") return res.status(403).json({error:"Not authorized."});
    const applications = await Application.find(query).populate("job","title county employmentType").populate("worker","fullName email phone county town occupation skills experience verificationStatus").sort({createdAt:-1}).limit(300);
    res.json({applications});
  } catch(e) { next(e); }
});

router.patch("/applications/:id/status", requireAuth, requireRole("employer","agency","admin"), async (req,res,next)=>{
  try {
    const allowed=["reviewing","shortlisted","rejected","hired"];
    if(!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid application status."});
    const application=await Application.findById(req.params.id).populate("job");
    if(!application) return res.status(404).json({error:"Application not found."});
    if(req.session.role!=="admin" && String(application.job.employer)!==req.session.userId) return res.status(403).json({error:"You cannot manage applications for another employer."});
    application.status=req.body.status; application.employerNote=String(req.body.employerNote||"").slice(0,1500); await application.save();
    res.json({application,message:"Application status updated."});
  } catch(e) { next(e); }
});
module.exports=router;
