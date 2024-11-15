// import Tx from ethereumjs-tx
// import Web3 from web3
// import Accounts from web3-eth-accounts

var Tx = require('ethereumjs-tx')
const Web3 = require('web3')
var Accounts = require('web3-eth-accounts');

// express lib
const express = require("express");

// body json parser lib

const bodyParser = require("body-parser");

// dotenv lib 
require('dotenv').config();


// mongoose for mongo connection and bcrypt for encrypting password\
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");


const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const web3 = new Web3('HTTP://127.0.0.1:7545');
var accounts = new Accounts('HTTP://127.0.0.1:7545');
const contractABI = require('./build/contracts/cert.json').abi;

// change this cert deployed address after running truffle compile
const coa = '0x1DBbDaf221714B3F9c73ccDc559cAb722444fC1D';
var contract = new web3.eth.Contract(contractABI, coa);

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1); // Exit process with failure
  }
};


// Call connectDB function
connectDB();


let adminad = "0";
let institutead = "0";

// models
const Institute = require("./models/Institute");
const Student = require('./models/Student');


app.get("/", function (req, res) {
  res.render("home");
});


app.get("/viewcertificate/:add", async function (req, res) {
  try {
    const address = req.params.add;  // Fetch the Ethereum address from URL parameter

    // Call the contract method `viewCertificate` with the address as a parameter
    const result = await contract.methods.viewCertificate(address).call();

    // Log the result to check the returned data from the smart contract
    // console.log("Student Address: ", result['stud']);
    // console.log("Institute Address: ", result['inst']);
    // console.log("Course: ", result['course']);
    // console.log("Duration: ", result['duration']);

    // Fetch the student name and institute name using the address
    const studentName = await contract.methods.getStudentName(result['stud']).call();
    const instituteName = await contract.methods.getInstituteName(result['inst']).call();

    // Check if the data exists, else show an error page
    if (!studentName || !instituteName || !result['course'] || !result['duration']) {
      return res.render("errorPage", { error: "Could not retrieve certificate details. Please check the address and try again." });
    }

    // Render the certificate view with the data received from the contract
    res.render("viewcertificate", {
      name: studentName,          // Student's name
      course: result['course'],   // Course name
      duration: result['duration'], // Duration of the course
      institute: instituteName, // Institute's name
      address: address
    });

  } catch (err) {
    // console.log(err);
    return res.render("errorPage", { error: "Invalid certificate ID" });
  }
});



app.post("/", function (req, res) {
  var add = req.body.addr;
  res.redirect("/viewcertificate/" + add);
})



app.get('/studentsignup', (req, res) => {
  res.render('studentsignup');  // Render the sign-up page
});



app.get("/addinstitute", function (req, res) {
  res.render("addinstitute", { account: "NULL" });
});



app.post("/addinstitute", function (req, res) {
  let courses = [];
  if (typeof req.body.courses === "string") {
    courses = req.body.courses.split(",").map((course) => course.trim());
  } else if (Array.isArray(req.body.courses)) {
    courses = req.body.courses;
  }

  const passphrase = process.env.PASSPHRASE; // Ensure this is defined in your .env file

  web3.eth.personal
    .newAccount(passphrase)
    .then((instituteAddress) => {
      web3.eth.getAccounts().then((accounts) => {
        const senderAccount = accounts[0];

        web3.eth.getGasPrice().then((gasPrice) => {
          // Call the blockchain contract method
          contract.methods
            .addInstitute(
              instituteAddress,
              req.body.name,
              req.body.acr,
              req.body.webl,
              courses
            )
            .send({
              from: senderAccount,
              gas: 6721975,
              maxFeePerGas: gasPrice,
            })
            .then(() => {
              // Hash the password
              bcrypt.hash(req.body.password, 10, (err, hashedPassword) => {
                if (err) {
                  console.error("Failed to hash password:", err);
                  return res.status(500).send("Error hashing password.");
                }

                // Save institute details in MongoDB
                const newInstitute = new Institute({
                  email: req.body.email,
                  password: hashedPassword, // Save the hashed password
                  accountAddress: instituteAddress,
                  name: req.body.name,
                  acronym: req.body.acr,
                  website: req.body.webl,
                  courses: courses,
                });

                newInstitute
                  .save()
                  .then(() => {
                    // Render the 'viewinstitute' page with the institute address
                    res.status(201).render("viewaddress", {
                      address: instituteAddress,
                    });
                  })
                  .catch((dbErr) => {
                    console.error(
                      "Failed to save institute in MongoDB:",
                      dbErr
                    );
                    res
                      .status(500)
                      .send("Failed to save institute in MongoDB.");
                  });
              });
            })
            .catch((contractErr) => {
              console.error(
                "An error occurred while interacting with the contract:",
                contractErr
              );
              res
                .status(500)
                .send("Failed to add the institute to the blockchain.");
            });
        });
      });
    })
    .catch((newAccountErr) => {
      console.error("Failed to create new Ethereum account:", newAccountErr);
      res.status(500).send("Failed to create new Ethereum account.");
    });
});


app.get("/institutelogin", function (req, res) {
  res.render("institutelogin");
});

// Route to handle the login form submission (email and password)
app.post("/institutelogin", function (req, res) {
  const { email, password } = req.body; // Get email and password from the form

  // Find the institute by email
  Institute.findOne({ email: email })
    .then((institute) => {
      if (!institute) {
        return res.status(400).send("Institute not found.");
      }

      // Compare the entered password with the stored hashed password
      bcrypt.compare(password, institute.password, (err, isMatch) => {
        if (err) {
          return res.status(500).send("Error during password comparison.");
        }

        if (!isMatch) {
          return res.status(400).send("Invalid password.");
        }

        // If the password is correct, get the account address
        const accountAddress = institute.accountAddress;

        // Redirect to the institute page with the account address
        res.redirect(`/institute/${accountAddress}`);
      });
    })
    .catch((err) => {
      console.error("Error fetching institute:", err);
      res.status(500).send("Internal server error.");
    });
});

// Route to render the institute dashboard page after login
app.get("/institute/:id", function (req, res) {
  const accountAddress = req.params.id;
  console.log(accountAddress);
  // Render the institute page with the account address and other details
  res.render("institute", { "id": accountAddress });

});




app.get("/addstudent", function (req, res) {
  console.log("IN add student", req.query.instituteAddress)
  res.render("addstudent", { id: req.query.instituteAddress });
});

app.post("/addstudent", async function (req, res) {
  const name = req.body.name;
  const email = req.body.email;
  console.log("Received request:", req.body);
  const add = req.body.instituteAddress;
  try {
    // Find the student by email
    const student = await Student.findOne({ email: email });

    if (!student) {
      // If student doesn't exist in the database, return an error
      return res.status(404).send("Student not found.");
    }

    console.log("Found student, using existing account:", student.accountAddress);

    // If student exists, use the existing account address
    const studentAccountHash = student.accountAddress;

    // If account does not exist, create a new one
    if (!studentAccountHash) {
      // Create a new account if not present in the database
      const newAccount = await web3.eth.personal.newAccount(process.env.PASSPHRASE);
      console.log("Created new student account:", newAccount);

      // Save the new account address in the database
      student.accountAddress = newAccount;
      await student.save();

      // Proceed with the transaction using the new account
      sendTransaction(newAccount, name, add, res);
    } else {
      // Proceed with the transaction using the existing account
      sendTransaction(studentAccountHash, name, add, res);
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("An error occurred.");
  }
});

async function sendTransaction(studentAccountHash, name, add, res) {
  try {
    // Get the sender account (use the first account from Ganache)
    const result = await web3.eth.getAccounts();
    const senderAccount = result[0];

    // Dynamically fetch gas price and send transaction
    const gasPrice = await web3.eth.getGasPrice();
    await contract.methods.addStudent(studentAccountHash, name)
      .send({
        from: senderAccount,
        gas: 6721975,
        maxFeePerGas: gasPrice
      });

    res.render("succesPage", { instituteadd : add ,message: "Account creation successful!", address: studentAccountHash });
  } catch (err) {
    console.error("An error occurred:", err);
    res.status(500).send("An error occurred while adding the student.");
  }
}

app.post('/studentsignup', async (req, res) => {
  const { name, email, rollNumber, password } = req.body;

  try {
    // Check if the email is already registered
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(400).send('Email is already registered');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new Student document
    const newStudent = new Student({
      name,
      email,
      rollNumber,
      password: hashedPassword,
    });

    // Save the student to the database
    await newStudent.save();

    // Redirect to the login page
    res.redirect('/studentlogin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error signing up. Please try again.');
  }
});




app.get("/gencertificate", function (req, res) {
  console.log("Institute Address:", req.query.instituteAddress);  // Debugging log
  res.render("gencertificate", { id: req.query.instituteAddress });
});


app.post("/gencertificate", async function (req, res) {
  const passphrase = process.env.PASSPHRASE; // Replace with your chosen passphrase

  console.log(req.body);
  const { email, course, dur } = req.body;
  const institutead = req.body.instituteAddress;
  console.log(req.body);
  try {
    // Clean up the 'dur' value by trimming spaces and checking if it's a valid number
    

    // Find the student by email
    const student = await Student.findOne({ email: email });

    if (!student) {
      return res.status(404).send("Student not found.");
    }

    const studentAddress = student.accountAddress;

    // Create a new account
    const account = await web3.eth.personal.newAccount(passphrase);
    console.log("Generated account:", account);

    // Get the admin account
    const accounts = await web3.eth.getAccounts();
    const adminAccount = accounts[0]; // Default account to send from

    // Get the gas price and add buffer
    const gasPrice = await web3.eth.getGasPrice();
    const adjustedGasPrice = web3.utils.toBN(gasPrice).add(web3.utils.toBN("1000000000")); // Adding buffer to base fee

    // Issue the certificate
    const receipt = await contract.methods
      .issueCertificate(account, institutead, studentAddress , course, dur)
      .send({ from: adminAccount, gasPrice: adjustedGasPrice, gas: 6721975 });

    console.log("Transaction successful:", receipt);
    res.render("succesPage2", { instituteadd : institutead ,message: "Certificate creation successful!", address: account });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).send("An error occurred.");
  }
});



app.get("/studentlogin", function (req, res) {
  res.render("studentlogin");
});

app.get("/student/:id", function (req, res) {
  var id = req.params.id;
  console.log("here id is ", id);
  // Assuming the contract is already initialized and set up with web3.js
  contract.methods.getStudentName(id).call()
    .then(function (studentName) {
      console.log("Student Name:", studentName); // Check if the student name is fetched properly

      // Now fetch the student's certificates
      return contract.methods.viewStudCert(id).call()
        .then(function (certificates) {
          console.log("Certificates:", certificates); // Check certificates data structure

          // Process each certificate, converting institute address to name
          const promises = certificates.map(cert => {
            console.log("Institute Address in Certificate:", cert.inst); // Log the institute address

            return contract.methods.getInstituteName(cert.inst).call()
              .then(function (instituteName) {
                console.log("Institute Name for Address", cert.inst, ":", instituteName); // Log the institute name

                // Create a new certificate object with updated institute name
                const updatedCert = {
                  certad: cert[0], // Use the raw certificate values
                  stud: cert[1],
                  inst: instituteName,  // Update institute with the name
                  course: cert[3],
                  duration: cert[4],
                  del: cert[5],
                };

                console.log("Updated Certificate:", updatedCert); // Log the updated certificate with the name

                return updatedCert;
              });
          });

          // Wait for all the promises to resolve and then render the page
          return Promise.all(promises).then(function (certificatesWithNames) {
            console.log("All Certificates with Names:", certificatesWithNames); // Final log of certificates with names
            // Send the student name and the modified certificates to the frontend
            res.render("student", { id: id, studentName: studentName, certificates: certificatesWithNames });
          });
        });
    })
    .catch(function (err) {
      console.error(err);
      res.status(500).send("Error fetching student or certificates");
    });
});



app.post('/studentlogin', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the student by email
    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(404).send('No account found with that email.');
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, student.password);

    if (!isPasswordValid) {
      return res.status(401).send('Invalid email or password.');
    }

    // Check if account address exists
    if (student.accountAddress) {
      return res.redirect(`/student/${student.accountAddress}`);
    } else {
      // Render a view showing no address message
      return res.render('noAddress', { name: student.name });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred. Please try again later.');
  }
});


app.get('/logout', (req, res) => {

  res.redirect('/');

});

app.get("/test", function (req, res) {
  res.render("student");
})


app.listen(process.env.PORT || 3000, function () {
  console.log("Server started on port 3000");
}); 