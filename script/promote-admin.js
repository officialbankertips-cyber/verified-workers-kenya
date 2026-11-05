require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");

(async () => {
  const email = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD || "");
  const phone = String(process.env.ADMIN_PHONE || "").trim();
  const fullName = String(process.env.ADMIN_NAME || "Platform Administrator").trim();

  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Set a valid ADMIN_EMAIL.");
  if (password.length < 8) throw new Error("Set ADMIN_PASSWORD to a password of at least 8 characters.");

  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await User.findOne({ email });
  if (!existing && !phone) {
    throw new Error("ADMIN_PHONE is required when creating a new admin account. Add it to Render Environment and run this command again.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const update = {
    $set: {
      role: "admin",
      passwordHash,
      isActive: true,
      fullName
    },
    $setOnInsert: {
      email,
      phone,
      paymentStatus: "paid",
      verificationStatus: "verified"
    }
  };

  const admin = await User.findOneAndUpdate(
    { email },
    update,
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  console.log(`Admin account is ready for ${admin.email}.`);
  console.log("Sign in using ADMIN_EMAIL and ADMIN_PASSWORD. The password is stored as a bcrypt hash.");
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error("Admin setup failed:", error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
