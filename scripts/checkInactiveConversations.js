// scripts/checkInactiveConversations.js
require('dotenv').config();
const mongoose = require('mongoose');
const WhatsAppService = require('../services/whatsappService');
const Helpers = require('../utils/helpers');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  checkInactiveConversations();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Get Conversation model
const Conversation = mongoose.model('Conversation');

// Initialize WhatsApp service
const whatsappService = new WhatsAppService();

async function checkInactiveConversations() {
  try {
    console.log('Checking for inactive conversations...');
    
    // Calculate timestamp for inactivity threshold (24 hours)
    const inactivityThreshold = new Date();
    inactivityThreshold.setHours(inactivityThreshold.getHours() - 24);
    
    // Find conversations with lastActivityTimestamp older than threshold
    // and not already marked as inactive
    const inactiveConversations = await Conversation.find({
      lastActivityTimestamp: { $lt: inactivityThreshold },
      isInactive: false
    });
    
    console.log(`Found ${inactiveConversations.length} inactive conversations`);
    
    // Process each inactive conversation
    for (const conversation of inactiveConversations) {
      try {
        // Mark as inactive
        conversation.isInactive = true;
        await conversation.save();
        
        // Send inactivity message
        const message = getInactivityMessage(conversation.language);
        await whatsappService.sendMessage(conversation.userId, message);
        
        console.log(`Sent inactivity message to ${conversation.userId}`);
      } catch (error) {
        console.error(`Error processing inactive conversation ${conversation.userId}:`, error);
      }
    }
    
    console.log('Inactive conversation check completed');
    process.exit(0);
  } catch (error) {
    console.error('Error checking inactive conversations:', error);
    process.exit(1);
  }
}

// Helper function to get inactivity message
function getInactivityMessage(language) {
  if (language === "marathi") {
    return "आपण काही वेळ निष्क्रिय आहात. आपली संभाषण सत्र आता बंद केली जाईल. जेव्हा आपण तयार असाल तेव्हा नवीन संभाषण सुरू करण्यासाठी 'Hi' टाइप करा.";
  }
  return "You have been inactive for a while. Your conversation session will now be closed. Type 'Hi' to start a new conversation when you're ready.";
}