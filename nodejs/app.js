require('dotenv').config();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { GoogleAuth } = require('google-auth-library');
const { DemoEventTicket } = require('./demo-eventticket');

// Load the service account credentials from a file (ensure this path is correct)
const credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Initialize the GoogleAuth library with the credentials
const auth = new GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
});

let demo = new DemoEventTicket();

// Function to generate JWT
function generateJwt(objectId) {
    const claims = {
        iss: credentials.client_email,
        aud: 'https://walletobjects.googleapis.com/google/payments/inapp/item/v1/save',
        typ: 'savetowallet',
        origins: ['http://localhost:3000'], // This line is added
        payload: {
            eventTicketObjects: [
                {
                    id: objectId
                }
            ]
        }
    };
    console.log("ISS HERE", claims.iss)
    // Sign the JWT with the service account's private key
    return jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });
}

// Function to create a 'Save to Google Wallet' URL
function createSaveToWalletUrl(jwt) {
    return `https://pay.google.com/gp/v/save/${jwt}`;
}

const issuerId = process.env.ISSUER_ID;
const classSuffix = process.env.CLASS_SUFFIX; // This is constant in your case.

// Define a unique object ID for the pass object. This should be unique for each user.
// We'll use Date.now() to generate a unique suffix for the object.
const objectSuffix = `${Date.now()}`;

// The objectId is a combination of issuerId, classSuffix, and objectSuffix
const objectId = `${issuerId}.${classSuffix}.${objectSuffix}`;

// Define the details for the pass object.
// Include all required fields according to your pass class structure.
let objectDetails = {
    id: objectId,
    classId: `${issuerId}.${classSuffix}`,
    state: 'ACTIVE',
    barcode: {
        type: "qrCode",
        value: "1234567890",
        alternateText: "1234567890"
    },
    eventName: {
        defaultValue: {
            language: "en",
            value: "Fiesta"
        }
    },
    seatInfo: {
        defaultValue: {
            language: "en",
            value: "Seat 42"
        }
    },
    // ... Other fields based on your pass class definition
};

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
        subject: 'Your Event Ticket',
        html: `<p>Click <a href="${saveToWalletUrl}">here</a> to save your event ticket to Google Wallet.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.error('Error sending email:', error);
        }
        console.log('Email sent:', info.response);
    });
}

// Call the method to create the pass object
demo.createObject(issuerId, classSuffix, objectSuffix)
    .then((response) => {
        const jwtToken = generateJwt(objectId);
        const saveToWalletUrl = createSaveToWalletUrl(jwtToken);
        sendSaveToWalletEmail('jhermotorrado@gmail.com', saveToWalletUrl);
    })
    .catch((error) => {
        console.error('Error creating pass object:', error);
    });
