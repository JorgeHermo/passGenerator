require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { GoogleAuth } = require('google-auth-library');
const { DemoGeneric } = require('./demo-generic');
const app = express();

app.use(express.json());

// Load the service account credentials from a file (ensure this path is correct)
const credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Initialize the GoogleAuth library with the credentials
const auth = new GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
});

let demo = new DemoGeneric(); // Instance of DemoGeneric class

// Function to generate JWT
function generateJwt(objectDetails) {
    const claims = {
        iss: credentials.client_email,
        aud: 'google',
        origins: [],
        typ: 'savetowallet',
        payload: {
            genericObjects: [objectDetails]
        }
    };
    // Sign the JWT with the service account's private key
    return jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });
}
// Function to create a 'Save to Google Wallet' URL
function createSaveToWalletUrl(jwt) {
    console.log('AQUI el JWT', jwt)
    return `https://pay.google.com/gp/v/save/${jwt}`;
}

const issuerId = process.env.ISSUER_ID;

// Endpoint to create a class
app.post('/create-class', (req, res) => {
    const classSuffix = req.body.classSuffix; // Get classSuffix from the request body

    demo.createClass(issuerId, classSuffix)
        .then(classId => {
            res.status(200).json({
                message: 'Class created successfully!',
                classId: classId
            });
        })
        .catch(error => {
            console.error('Error creating class:', error);
            res.status(500).send('Error creating class.');
        });
});

// Endpoint to receive a POST request with the email in the body
app.post('/send-pass', (req, res) => {
    const userEmail = req.body.email;
    const classSuffix = req.body.classSuffix;
    const objectSuffix = `${Date.now()}`;
    const objectId = `${issuerId}.${classSuffix}.${objectSuffix}`;

    demo.createObject(issuerId, classSuffix, objectSuffix)
        .then(objectDetails => {
            const jwtToken = generateJwt(objectDetails);
            const saveToWalletUrl = createSaveToWalletUrl(jwtToken);
            sendSaveToWalletEmail(userEmail, saveToWalletUrl);
        })
        .then(() => {
            res.status(200).send('Pass sent to email successfully.');
        })
        .catch((error) => {
            console.error('Error creating or sending pass object:', error);
            res.status(500).send('Error sending pass to email.');
        });
});

// Function to send email with the 'Save to Google Wallet' link
function sendSaveToWalletEmail(to, saveToWalletUrl) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: 'Your Google Wallet Pass',
        html: `<p>Click <a href="${saveToWalletUrl}">here</a> to save your pass to Google Wallet.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.error('Error sending email:', error);
        }
        console.log('Email sent:', info.response);
    });
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
