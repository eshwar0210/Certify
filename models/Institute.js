const mongoose = require("mongoose");

const instituteSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  accountAddress: { type: String, required: true },
  name: { type: String, required: true },
  acr: { type: String },
  webl: { type: String },
  courses: [{ type: String }],
});

const Institute = mongoose.model("Institute", instituteSchema);
module.exports = Institute;
