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
    if (!body || !body.From) {
      console.error('Invalid webhook request:', body);
      return res.status(400).send('Bad Request: Missing required fields');
    }
    
    const sender = body.From;
    let response;
    
    // Check if this is a media message
    if (body.NumMedia && parseInt(body.NumMedia) > 0) {
      // Handle media message
      const mediaType = body.MediaContentType0 ? body.MediaContentType0.split('/')[0] : 'unknown';
      const mediaUrl = body.MediaUrl0;
      const caption = body.Body || ''; // Caption or empty string
      
      console.log(`Received media message from ${sender}: ${mediaType} - ${mediaUrl}`);
      
      // Process media message
      response = await conversationService.processMessage(sender, caption, mediaUrl, mediaType);
    } else if (body.Latitude && body.Longitude) {
      // Handle location message
      const locationData = {
        latitude: body.Latitude,
        longitude: body.Longitude
      };
      
      console.log(`Received location from ${sender}: ${locationData.latitude}, ${locationData.longitude}`);
      
      // Process location as a special type of media message
      response = await conversationService.processMessage(sender, '', locationData, 'location');
    } else if (body.Body) {
      // Handle text message
      const message = body.Body;
      console.log(`Received text message from ${sender}: ${message}`);
      
      // Process text message
      response = await conversationService.processMessage(sender, message);
    } else {
      console.error('Unrecognized message format:', body);
      return res.status(400).send('Bad Request: Unrecognized message format');
    }
    
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
          ''
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