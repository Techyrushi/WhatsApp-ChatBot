require('dotenv').config();
const express = require('express');

const WhatsAppService = require('./services/whatsappService');
const AIService = require('./services/aiService');
const AppointmentService = require('./services/appointmentService');

const database = require('./config/database');

// Create instances of services
const whatsappService = new WhatsAppService();
const aiService = new AIService();
const appointmentService = new AppointmentService();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
database.connect();

// WhatsApp Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const { body } = req;
    const message = body.Body;
    const sender = body.From;

    // Process incoming message using AI
    const aiResponse = await aiService.generateResponse(message);

    // Send response back to WhatsApp
    await whatsappService.sendMessage(sender, aiResponse);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});