const router=require("express").Router();
const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const {requireAuth}=require("../middleware/auth");
const User=require("../models/User");
const PasswordReset=require("../models/PasswordReset");
const {sendEmail}=require("../services/email");
const rateLimit=require("express-rate-limit");
const resetLimiter=rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:true,legacyHeaders:false,message:{error:"Too many reset attempts. Try again later."}});
router.patch("/profile",requireAuth,async(req,res,next)=>{
 try{
  const allowed=["fullName","phone","county","town","occupation","skills","experience","bio","organization"];
  const update={}; for(const k of allowed) if(req.body[k]!==undefined) update[k]=req.body[k];
  if(update.fullName && String(update.fullName).length>100)return res.status(400).json({error:"Name is too long."});
  const user=await User.findByIdAndUpdate(req.session.userId,{$set:update},{new:true,runValidators:true}).select("-passwordHash -idNumber");
  res.json({user,message:"Profile updated."});
 }catch(e){next(e);}
});
router.post("/password/forgot",resetLimiter,async(req,res,next)=>{
 try{
  const email=String(req.body.email||"").toLowerCase().trim(); const user=await User.findOne({email});
  // Identical response prevents account enumeration.
  if(user){await PasswordReset.deleteMany({user:user._id});const raw=crypto.randomBytes(32).toString("hex"),tokenHash=crypto.createHash("sha256").update(raw).digest("hex");await PasswordReset.create({user:user._id,tokenHash,expiresAt:new Date(Date.now()+30*60*1000)});const link=`${process.env.APP_URL}/reset-password.html?token=${raw}`;await sendEmail({to:user.email,subject:"Reset your Verified Workers password",text:`Use this link within 30 minutes to reset your password: ${link}\nIf you did not request this, ignore this email.`});}
  res.json({message:"If an account matches that email and email delivery is configured, password reset instructions will be sent."});
 }catch(e){next(e);}
});
router.post("/password/reset",resetLimiter,async(req,res,next)=>{
 try{
  const token=String(req.body.token||""),password=String(req.body.password||"");if(password.length<8)return res.status(400).json({error:"Password must be at least 8 characters."});
  const tokenHash=crypto.createHash("sha256").update(token).digest("hex");const record=await PasswordReset.findOne({tokenHash,expiresAt:{$gt:new Date()}});if(!record)return res.status(400).json({error:"This reset link is invalid or expired."});
  const user=await User.findById(record.user);if(!user)return res.status(400).json({error:"Account not found."});user.passwordHash=await bcrypt.hash(password,12);await user.save();await PasswordReset.deleteMany({user:user._id});res.json({message:"Password reset successful. You can now sign in."});
 }catch(e){next(e);}
});
module.exports=router;
