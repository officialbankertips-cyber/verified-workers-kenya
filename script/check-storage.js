require("dotenv").config();
const crypto = require("crypto");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

async function main() {
  const required = ["S3_BUCKET", "S3_REGION", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing storage environment variables: ${missing.join(", ")}`);
  const endpoint = new URL(process.env.S3_ENDPOINT);
  if (endpoint.protocol !== "https:") throw new Error("S3_ENDPOINT must use HTTPS.");
  const s3 = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  const key = `private/health-check/${Date.now()}-${crypto.randomUUID()}.txt`;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: "Verified Workers Kenya R2 connectivity check",
      ContentType: "text/plain",
    }));
    console.log("R2 upload check passed.");
  } finally {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
      console.log("Temporary test object deleted.");
    } catch (error) {
      console.error("Could not delete the temporary test object:", error.message);
      throw error;
    }
    s3.destroy();
  }
}

main().catch((error) => {
  console.error("R2 storage check failed:", error.message);
  process.exitCode = 1;
});
