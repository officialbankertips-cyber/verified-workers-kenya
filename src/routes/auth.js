const router = require("express").Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const rateLimit = require("express-rate-limit");
const authLimiter = rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{error:"Too many authentication attempts. Try again later."}});

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { role, fullName, email, phone, password, county, town, occupation, organization } = req.body;
    if (!["worker", "employer", "agency"].includes(role)) return res.status(400).json({ error: "Choose a valid account type." });
    if (!fullName || !email || !phone || !password || password.length < 8) return res.status(400).json({ error: "Complete all required fields. Password must be at least 8 characters." });
    if (!req.body.termsAccepted || !req.body.privacyConsent) return res.status(400).json({ error: "You must accept the Terms of Service and Privacy Notice." });
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ error: "An account with this email already exists." });
    const user = await User.create({
      role, fullName, email: normalizedEmail, phone, county, town, occupation, organization,
      passwordHash: await bcrypt.hash(password, 12),
      paymentStatus: "unpaid",
      privacyConsentAt: req.body.privacyConsent ? new Date() : undefined,
      termsAcceptedAt: req.body.termsAccepted ? new Date() : undefined
    });
    req.session.regenerate((sessionError) => {
      if (sessionError) return next(sessionError);
      req.session.userId = user._id.toString();
      req.session.role = user.role;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.status(201).json({ message: "Account created. Complete the Ksh 199 registration payment to activate paid features.", user: safeUser(user) });
      });
    });
  } catch (e) { next(e); }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const user = await User.findOne({ email });
    // Older or manually-created admin records may not have passwordHash.
    // Treat those as invalid credentials instead of passing undefined to bcrypt.
    if (!user || typeof user.passwordHash !== "string" || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password. If this is an administrator account, run the admin setup command to repair its password." });
    }
    const passwordMatches = await bcrypt.compare(String(req.body.password || ""), user.passwordHash);
    if (!passwordMatches) return res.status(401).json({ error: "Invalid email or password." });
    if (!user.isActive) return res.status(403).json({ error: "This account has been suspended. Contact support." });
    req.session.regenerate((sessionError) => {
      if (sessionError) return next(sessionError);
      req.session.userId = user._id.toString();
      req.session.role = user.role;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ user: safeUser(user) });
      });
    });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res, next) => req.session.destroy((err) => {
  if (err) return next(err);
  res.clearCookie("vw.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.json({ message: "Signed out." });
}));
router.get("/me", async (req, res, next) => {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const user = await User.findById(req.session.userId);
    res.json({ user: user ? safeUser(user) : null });
  } catch (e) { next(e); }
});

function safeUser(u) {
  return { id: u._id, role: u.role, fullName: u.fullName, email: u.email, phone: u.phone, county: u.county, town: u.town, occupation: u.occupation, organization: u.organization, paymentStatus: u.paymentStatus, verificationStatus: u.verificationStatus, skills: u.skills, experience: u.experience, bio: u.bio, documents: u.documents };
}
module.exports = router;
