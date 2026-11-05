const router=require("express").Router();
const multer=require("multer");
const crypto=require("crypto");
const {S3Client,PutObjectCommand,GetObjectCommand}=require("@aws-sdk/client-s3");
const {getSignedUrl}=require("@aws-sdk/s3-request-presigner");
const {requireAuth,requireRole}=require("../middleware/auth");
const User=require("../models/User");
const allowedTypes={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png"};
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter:(req,file,cb)=>allowedTypes[file.mimetype]?cb(null,true):cb(new Error("Only PDF, JPG and PNG files are accepted."))});
function client(){
  if(!process.env.S3_BUCKET||!process.env.S3_REGION||!process.env.S3_ACCESS_KEY_ID||!process.env.S3_SECRET_ACCESS_KEY) throw new Error("Private document storage is not configured yet.");
  return new S3Client({region:process.env.S3_REGION,endpoint:process.env.S3_ENDPOINT,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
}
router.post("/upload",requireAuth,upload.single("document"),async(req,res,next)=>{
  try{
    if(!req.file)return res.status(400).json({error:"Choose a document to upload."});
    const type=String(req.body.type||""); if(!["national_id","cv","certificate","other"].includes(type))return res.status(400).json({error:"Choose a valid document type."});
    const s3=client(), key=`private/${req.session.userId}/${crypto.randomUUID()}.${allowedTypes[req.file.mimetype]}`;
    await s3.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:req.file.buffer,ContentType:req.file.mimetype,Metadata:{owner:req.session.userId,documenttype:type}}));
    const user=await User.findById(req.session.userId);
    user.documents.push({name:type,path:key,mimetype:req.file.mimetype,size:req.file.size,status:"pending"}); user.verificationStatus="pending"; await user.save();
    res.status(201).json({message:"Document uploaded securely and submitted for review.",document:{name:type,status:"pending"}});
  }catch(e){next(e);}
});
router.get("/:userId/:index",requireAuth,async(req,res,next)=>{
  try{
    if(req.session.role!=="admin"&&req.session.userId!==req.params.userId)return res.status(403).json({error:"You cannot access another user's private documents."});
    const user=await User.findById(req.params.userId); const index=Number(req.params.index);
    if(!user||!Number.isInteger(index)||index<0||index>=user.documents.length)return res.status(404).json({error:"Document not found."});
    const key=user.documents[index].path; if(!key||!key.startsWith(`private/${user._id}/`))return res.status(404).json({error:"Document unavailable."});
    const url=await getSignedUrl(client(),new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}),{expiresIn:90}); res.json({url,expiresIn:90});
  }catch(e){next(e);}
});
module.exports=router;
