const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

const ContactSchema = new mongoose.Schema({
  name: String,
  email: String,
  mobile: String,
  message: String
});

const Contact = mongoose.model('Contact', ContactSchema);

mongoose.connect(process.env.MONGODB_URI);

app.post('/api/contact', async (req, res) => {
  const { name, email, mobile, message } = req.body;

  const newContact = new Contact({ name, email, mobile, message });
  await newContact.save();

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = message;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseMessage = await response.text();

    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    let mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Generated Message',
      text: responseMessage
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).send('Error sending email');
      } else {
        console.log('Email sent:', info.response);
      }
    });

    const accId = "AC5a172b72bc34b787d5aa2f7c4c1b59dc";
    const authToken = "ce06554ff06f117da41ae49bf154276e";
    const client = twilio(accId, authToken);

    console.log("hi");

    client.messages.create({
      from: 'whatsapp:+14155238886',
      body: responseMessage,
      to: `whatsapp:+91${mobile}`
    }).then(message => {
      console.log('WhatsApp message sent:', message.sid);
      res.status(200).send('Message saved, email sent, and WhatsApp message sent');
    }).catch(error => {
      console.error('Error sending WhatsApp message:', error);
      res.status(500).send('Error sending WhatsApp message');
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error processing request');
  }
});

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
