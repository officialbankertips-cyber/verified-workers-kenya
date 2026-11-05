const mongoose=require("mongoose");
module.exports=mongoose.model("PasswordReset",new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},tokenHash:{type:String,required:true,unique:true},expiresAt:{type:Date,required:true,expires:0}},{timestamps:true}));
