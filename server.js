require('dotenv').config();
const express = require('express');

const WhatsAppService = require('./services/whatsappService');
const AIService = require('./services/aiService');
const AppointmentService = require('./services/appointmentService');
const ConversationService = require('./services/conversationService');

const database = require('./config/database');

// Create instances of services
const whatsappService = new WhatsAppService();
const aiService = new AIService();
const appointmentService = new AppointmentService();
const conversationService = new ConversationService();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
database.connect();

// WhatsApp Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const { body } = req;
    
    // Validate incoming request
    if (!body || !body.Body || !body.From) {
      console.error('Invalid webhook request:', body);
      return res.status(400).send('Bad Request: Missing required fields');
    }
    
    const message = body.Body;
    const sender = body.From;
    
    console.log(`Received message from ${sender}: ${message}`);
    
    // Process incoming message using conversation service
    const response = await conversationService.processMessage(sender, message);
    console.log(`Generated response: ${response}`);
    
    // Send response back to WhatsApp
    await whatsappService.sendMessage(sender, response);
    console.log(`Response sent to ${sender}`);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Try to send an error message to the user if possible
    try {
      if (req.body && req.body.From) {
        await whatsappService.sendMessage(
          req.body.From, 
          'Sorry, I encountered an error processing your request. Please try again later.'
        );
      }
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
    
    res.status(500).send('Internal Server Error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Service is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});