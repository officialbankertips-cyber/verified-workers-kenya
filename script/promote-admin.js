require("dotenv").config();
const mongoose=require("mongoose");
const User=require("../src/models/User");
(async()=>{
  if(!process.env.MONGODB_URI||!process.env.ADMIN_EMAIL)throw new Error("Set MONGODB_URI and ADMIN_EMAIL in the environment.");
  await mongoose.connect(process.env.MONGODB_URI);
  const user=await User.findOneAndUpdate({email:process.env.ADMIN_EMAIL.toLowerCase().trim()},{$set:{role:"admin"}},{new:true});
  if(!user)throw new Error("No account found for ADMIN_EMAIL. Register the account first, then run this script.");
  console.log(`Promoted ${user.email} to admin. No password was changed.`);
  await mongoose.disconnect();
})().catch(async e=>{console.error(e.message);try{await mongoose.disconnect()}catch{}process.exit(1)});
