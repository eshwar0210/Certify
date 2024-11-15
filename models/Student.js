const mongoose = require('mongoose');

// Define the schema for the Student
const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true // Ensure email is unique
  },
  rollNumber: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  accountAddress: {
    type: String,
    // required: true  // Store the student's blockchain account address
  }
});

// Create a model based on the schema
const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
