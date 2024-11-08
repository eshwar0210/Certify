// import Tx from ethereumjs-tx
// import Web3 from web3
// import Accounts from web3-eth-accounts
var Tx = require('ethereumjs-tx')
const Web3 = require('web3')
var Accounts = require('web3-eth-accounts');
const express = require("express");
const bodyParser = require("body-parser");
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const web3 = new Web3('HTTP://127.0.0.1:7545');
var accounts = new Accounts('HTTP://127.0.0.1:7545');
const contractABI = require('./build/contracts/cert.json').abi;

const coa = '0x1AdccfF126449350606433CeF739bA3bEC0f94C6';
var contract = new web3.eth.Contract(contractABI, coa);


// See list of available contract methods

// console.log(contract.methods);

let adminad = "0";
let institutead = "0";

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
      institute: instituteName , // Institute's name
      address : address
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

app.get("/adminlogin", function (req, res) {
  res.render("adminlogin");
});

app.get("/admin/:id", function (req, res) {
  var id = req.params.id;
  web3.eth.getAccounts().then(function (result) {
    if (id == result[0]) {
      adminad = id;
      return res.render("admin", { id: id });
    }
    res.render("errorPage", {error : "Admin credentials invalid"})
  });

});

app.post("/adminlogin", function (req, res) {
  return res.redirect("/admin/" + req.body.address);
});

app.get("/addinstitute", function (req, res) {
  res.render("addinstitute", { account: "NULL" });
});
app.post("/addinstitute", function (req, res) {
  // See the body of request
  // console.log(req.body);

  // Ensure courses is an array
  let courses = [];
  if (typeof req.body.courses === 'string') {
    courses = req.body.courses.split(',').map(course => course.trim());
  } else if (Array.isArray(req.body.courses)) {
    courses = req.body.courses; // Already an array, no changes needed
  }

  // Create a new account with a passphrase
  const passphrase = process.env.PASSPHRASE;  // Ensure this is defined in your .env file

  web3.eth.personal.newAccount(passphrase).then((instituteadrress) => {
    // console.log("institute :", instituteadrress);

    // Get all accounts and set up transaction
    web3.eth.getAccounts().then(function (result) {
      const senderAccount = result[0];
      const hash = result[result.length - 1];
      // console.log("Institute account hash:", hash);

      // Dynamically fetch gas price and send transaction
      web3.eth.getGasPrice().then((gasPrice) => {
        contract.methods.addInstitute(hash, req.body.name, req.body.acr, req.body.webl, courses)  // Pass array here
          .send({
            from: senderAccount,
            gas: 6721975,
            maxFeePerGas: gasPrice
          })
          .then(() => {
            res.render("addinstitute", { account: hash });
          })
          .catch(err => {
            console.error("An error occurred:", err);
            res.status(500).send("An error occurred while adding the institute.");
          });
      }).catch(gasErr => {
        console.error("Failed to fetch gas price:", gasErr);
        res.status(500).send("Failed to fetch gas price.");
      });
    }).catch(accountErr => {
      console.error("Failed to fetch accounts:", accountErr);
      res.status(500).send("Failed to fetch accounts.");
    });
  }).catch(newAccountErr => {
    console.error("Failed to create new account:", newAccountErr);
    res.status(500).send("Failed to create new account.");
  });
});

app.get("/viewinstitute", function (req, res) {
  contract.methods.viewAllInstitutes().call(function (err, resu) {
    if (err)
      console.log(err);
    // console.log(resu);
    res.render("viewinstitute", { inst: resu });
  });
});

app.get("/removeinstitute", function (req, res) {
  res.render("removeinstitute");
});

app.post("/removeinstitute", function (req, res) {
  const id = req.body.username;
  web3.eth.getAccounts().then(function (result) {
    contract.methods.deleteInstitute(id)
      .send({ from: result[0], gas: 6721975 }) // Removed gasPrice here
      .then(() => res.redirect("/admin/" + adminad))
      .catch(err => {
        console.error("Transaction Error:", err);
        res.status(500).send("Error processing transaction");
      });
  });
});


app.get("/institutelogin", function (req, res) {
  res.render("institutelogin");
});

app.get("/institute/:id", function (req, res) {
  var id = req.params.id;
  institutead = id;
  console.log(institutead);
  res.render("institute", { id: id });
});

app.post("/institutelogin", function (req, res) {
  return res.redirect("/institute/" + req.body.username);
});

app.listen(process.env.PORT || 3000, function () {
  console.log("Server started on port 3000");
});

app.get("/updateinstitute", function (req, res) {
  res.render("updateinstitute");
})

app.post("/updateinstitute", function (req, res) {
  // console.log(req.body);
  let courses = [];
  if (typeof req.body.courses === 'string') {
    courses = req.body.courses.split(',').map(course => course.trim());
  } else if (Array.isArray(req.body.courses)) {
    courses = req.body.courses; // Already an array, no changes needed
  }
  contract.methods.updateInstitute(institutead, req.body.name, req.body.acr, req.body.webl, courses)
    .send({ from: institutead, gasPrice: 1, gas: 6721975 }, function (err) {
      if (err)
        console.log(err);
    });
  res.render("institute", { id: institutead });
});

app.get("/addstudent", function (req, res) {
  res.render("addstudent", { account: "NULL" });
});

app.post("/addstudent", function (req, res) {
  const name = req.body.name;
  // console.log(name);
  const passphrase = process.env.PASSPHRASE;  // Ensure this is set in your .env file

  // Create a new account with the passphrase
  web3.eth.personal.newAccount(passphrase).then((studentAccount) => {
    console.log("Student account:", studentAccount);

    // Get all accounts and prepare transaction
    web3.eth.getAccounts().then(function (result) {
      const senderAccount = result[0];
      const studentAccountHash = result[result.length - 1];

      console.log("Student account hash:", studentAccountHash);

      // Dynamically fetch gas price and send transaction
      web3.eth.getGasPrice().then((gasPrice) => {
        contract.methods.addStudent(studentAccountHash, name)
          .send({
            from: senderAccount,
            gas: 6721975,
            maxFeePerGas: gasPrice
          })
          .then(() => {
            res.render("addstudent", { account: studentAccountHash });
          })
          .catch(err => {
            console.error("An error occurred:", err);
            res.status(500).send("An error occurred while adding the student.");
          });
      }).catch(gasErr => {
        console.error("Failed to fetch gas price:", gasErr);
        res.status(500).send("Failed to fetch gas price.");
      });
    }).catch(accountErr => {
      console.error("Failed to fetch accounts:", accountErr);
      res.status(500).send("Failed to fetch accounts.");
    });
  }).catch(newAccountErr => {
    console.error("Failed to create new account:", newAccountErr);
    res.status(500).send("Failed to create new account.");
  });
});



app.get("/gencertificate", function (req, res) {
  res.render("gencertificate", { account: "NULL" });
})
// console.log("Current institute address " , institutead);

app.post("/gencertificate", function (req, res) {
  const passphrase = process.env.PASSPHRASE; // Replace with your chosen passphrase

  web3.eth.personal.newAccount(passphrase)
    .then(function (account) {
      console.log("Generated account:", account);

      web3.eth.getAccounts().then(function (accounts) {
        const adminAccount = accounts[0]; // Default account to send from

        web3.eth.getGasPrice().then(function (gasPrice) {
          const adjustedGasPrice = web3.utils.toBN(gasPrice).add(web3.utils.toBN(1000000000)); // Adding buffer to base fee

          contract.methods.issueCertificate(account, institutead, req.body.studad, req.body.course, req.body.dur)
            .send({ from: adminAccount, gasPrice: adjustedGasPrice, gas: 6721975 })
            .then(function (receipt) {
              console.log("Transaction successful:", receipt);
              res.render("gencertificate", { account: account });
            })
            .catch(function (err) {
              console.error("Transaction error:", err);
              res.status(500).send("Transaction failed.");
            });
        }).catch(function (err) {
          console.error("Failed to fetch gas price:", err);
          res.status(500).send("Could not fetch gas price.");
        });
      }).catch(function (err) {
        console.error("Failed to get accounts:", err);
        res.status(500).send("Could not fetch accounts.");
      });
    })
    .catch(function (err) {
      console.error("Failed to create new account:", err);
      res.status(500).send("Account creation failed.");
    });
});




app.get("/remcertificate", function (req, res) {
  res.render("remcertificate");
});

app.post("/remcertificate", function (req, res) {
  var add = req.body.addr;

  contract.methods.revCertificate(add).call(function (err, resu) {
    if (err)
      console.log(err);
    return res.redirect("/institute/" + instad);
  });
});


app.get("/studentlogin", function (req, res) {
  res.render("studentlogin");
});

app.get("/student/:id", function (req, res) {
  var id = req.params.id;

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


app.post("/studentlogin", function (req, res) {
  return res.redirect("/student/" + req.body.address);
});


app.get("/test", function (req, res) {
  res.render("student");
})
