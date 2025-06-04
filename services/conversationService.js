// services/conversationService.js
const mongoose = require('mongoose');
const Property = require('../models/Property');
const AIService = require('./aiService');
const WhatsAppService = require('./whatsappService');
const AppointmentService = require('./appointmentService');

// Define Conversation Schema
const conversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  state: { 
    type: String, 
    enum: ['welcome', 'location', 'budget', 'bhk', 'property_match', 'schedule_visit', 'collect_info', 'completed'],
    default: 'welcome'
  },
  preferences: {
    location: { type: String },
    budget: {
      min: { type: Number },
      max: { type: Number }
    },
    bhk: { type: Number },
  },
  matchedProperties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  selectedProperty: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  userInfo: {
    name: { type: String },
    phone: { type: String },
    preferredTime: { type: Date }
  },
  lastMessageTimestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Create Conversation Model if it doesn't exist
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

class ConversationService {
  constructor() {
    this.aiService = new AIService();
    this.whatsappService = new WhatsAppService();
    this.appointmentService = new AppointmentService();
  }

  async processMessage(sender, message) {
    try {
      // Get or create conversation for this user
      let conversation = await this.getOrCreateConversation(sender);
      
      // Process message based on current conversation state
      const response = await this.handleConversationState(conversation, message);
      
      // Update conversation last message timestamp
      conversation.lastMessageTimestamp = new Date();
      await conversation.save();
      
      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return 'Sorry, I encountered an error. Please try again later.';
    }
  }

  async getOrCreateConversation(userId) {
    try {
      // Find existing conversation
      let conversation = await Conversation.findOne({ userId });
      
      // Create new conversation if not exists
      if (!conversation) {
        conversation = new Conversation({
          userId,
          state: 'welcome',
          preferences: {}
        });
        await conversation.save();
      }
      
      return conversation;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      throw error;
    }
  }

  async handleConversationState(conversation, message) {
    const state = conversation.state;
    let response;
    
    switch (state) {
      case 'welcome':
        response = await this.handleWelcomeState(conversation, message);
        break;
      case 'location':
        response = await this.handleLocationState(conversation, message);
        break;
      case 'budget':
        response = await this.handleBudgetState(conversation, message);
        break;
      case 'bhk':
        response = await this.handleBHKState(conversation, message);
        break;
      case 'property_match':
        response = await this.handlePropertyMatchState(conversation, message);
        break;
      case 'schedule_visit':
        response = await this.handleScheduleVisitState(conversation, message);
        break;
      case 'collect_info':
        response = await this.handleCollectInfoState(conversation, message);
        break;
      case 'completed':
        response = await this.handleCompletedState(conversation, message);
        break;
      default:
        response = 'I\'m not sure how to respond to that. Let\'s start over.';
        conversation.state = 'welcome';
        await conversation.save();
    }
    
    return response;
  }

  async handleWelcomeState(conversation, message) {
    // Move to location state
    conversation.state = 'location';
    await conversation.save();
    
    // Provide location options as a numbered list
    return 'Welcome to Malpure Group! 🏠\n\nI\'m here to help you find your dream property. To get started, please select a location you\'re interested in:\n\n1. Nashik\n2. Mumbai\n3. Pune\n4. Other\n\n\nReply with just the number (1-4) to select your preferred location.';

  }

  async handleLocationState(conversation, message) {
    // Define location options
    const locationOptions = [
      'Nashik',
      'Mumbai',
      'Pune',
      'Other'
    ];
    
    // Check if this is the first message or an invalid selection
    if (!message.match(/^[1-4]$/) || message === '4') {
      if (message === '4' || message.toLowerCase() === 'other') {
        return 'Please type the name of the location you\'re interested in.';
      }
      
      // Show location options again
      return 'Please select a valid location option by replying with a number from 1 to 3:\n\n' +
             '1. Nashik\n2. Mumbai\n3. Pune\n4. Other';
    }
    
    // Process location selection
    const locationIndex = parseInt(message) - 1;
    const selectedLocation = locationOptions[locationIndex];
    
    // Save location preference
    conversation.preferences.location = selectedLocation;
    conversation.state = 'budget';
    await conversation.save();
    
    // Present budget options
    return `Great! You've selected ${selectedLocation}. Now, please select your budget range:\n\n` +
           '1. Under ₹50 Lakhs\n' +
           '2. ₹50 Lakhs - ₹1 Crore\n' +
           '3. ₹1 Crore - ₹2 Crore\n' +
           '4. ₹2 Crore - ₹5 Crore\n' +
           '5. Above ₹5 Crore\n\n' +
           'Reply with just the number (1-5) to select your budget range.';
  }

  async handleBudgetState(conversation, message) {
    // Define budget ranges
    const budgetRanges = [
      { min: 0, max: 5000000 },            // Under ₹50 Lakhs
      { min: 5000000, max: 10000000 },     // ₹50 Lakhs - ₹1 Crore
      { min: 10000000, max: 20000000 },    // ₹1 Crore - ₹2 Crore
      { min: 20000000, max: 50000000 },    // ₹2 Crore - ₹5 Crore
      { min: 50000000, max: 1000000000 }   // Above ₹5 Crore
    ];
    
    // Check if this is a valid budget selection
    if (!message.match(/^[1-5]$/)) {
      // Show budget options again
      return `Please select a valid budget option by replying with a number from 1 to 5:\n\n` +
             '1. Under ₹50 Lakhs\n' +
             '2. ₹50 Lakhs - ₹1 Crore\n' +
             '3. ₹1 Crore - ₹2 Crore\n' +
             '4. ₹2 Crore - ₹5 Crore\n' +
             '5. Above ₹5 Crore';
    }
    
    // Process budget selection
    const budgetIndex = parseInt(message) - 1;
    const selectedBudget = budgetRanges[budgetIndex];
    
    // Save budget preference
    conversation.preferences.budget = selectedBudget;
    conversation.state = 'bhk';
    await conversation.save();
    
    // Present BHK options as a numbered list
    return 'Great! Now, please select the number of bedrooms (BHK) you\'re looking for:\n\n1. 1 BHK\n2. 2 BHK\n3. 3 BHK\n4. 4 BHK\n5. 5+ BHK\n\nReply with just the number (1-5) to select your preference.';
  }

  async handleBHKState(conversation, message) {
    // Check if this is the first time in BHK state (no previous message)
    if (message.trim().toLowerCase() === 'bhk options' || !message.match(/^[1-5]$/)) {
      // Present BHK options as a numbered list
      return 'Please select the number of bedrooms (BHK) you\'re looking for:\n\n1. 1 BHK\n2. 2 BHK\n3. 3 BHK\n4. 4 BHK\n5. 5+ BHK\n\nReply with just the number (1-5) to select your preference.'
    }
    
    // User has selected a BHK option (1-5)
    const bhkChoice = parseInt(message.trim());
    
    if (isNaN(bhkChoice) || bhkChoice < 1 || bhkChoice > 5) {
      return 'Please select a valid option by replying with a number from 1 to 5.'
    }
    
    // Map the selection to actual BHK value (for 5, we'll use 5 as a minimum)
    const bhkValue = bhkChoice === 5 ? 5 : bhkChoice;
    
    // Save BHK preference
    conversation.preferences.bhk = bhkValue;
    conversation.state = 'property_match';
    await conversation.save();
    
    // Find matching properties
    const matchedProperties = await this.findMatchingProperties(conversation.preferences);
    
    // Save matched properties (even if empty)
    conversation.matchedProperties = matchedProperties.map(p => p._id);
    await conversation.save();
    
    // Generate property match response
    return this.generatePropertyMatchResponse(matchedProperties, conversation.preferences);
  }

  async findMatchingProperties(preferences) {
    try {
      // Create query criteria based on user preferences
      const criteria = {
        availability: 'available'
      };
      
      // Add location criteria if provided
      if (preferences.location) {
        criteria.location = { $regex: new RegExp(preferences.location, 'i') };
      }
      
      // Add budget criteria if provided
      if (preferences.budget && preferences.budget.min && preferences.budget.max) {
        criteria.price = { $gte: preferences.budget.min, $lte: preferences.budget.max };
      } else if (preferences.budget && preferences.budget.min) {
        criteria.price = { $gte: preferences.budget.min };
      } else if (preferences.budget && preferences.budget.max) {
        criteria.price = { $lte: preferences.budget.max };
      }
      
      // Add BHK criteria if provided
      if (preferences.bhk) {
        criteria.bedrooms = preferences.bhk;
      }
      
      // Query the database for matching properties
      const properties = await Property.find(criteria).limit(5);
      console.log(`Found ${properties.length} matching properties for criteria:`, criteria);
      
      return properties;
    } catch (error) {
      console.error('Error finding matching properties:', error);
      return [];
    }
  }

  generatePropertyMatchResponse(properties, preferences) {
    // Handle case when no properties are found
    if (!properties || properties.length === 0) {
      return `I couldn't find any properties matching your criteria. Would you like to try with different preferences? Reply 'restart' to begin a new search.`;
    }
    
    // Format each property for display
    const propertyList = properties.map((prop, index) => {
      return `${index + 1}. ${prop.title}\n   📍 ${prop.location}\n   💰 ₹${prop.price.toLocaleString('en-IN')}\n   🏠 ${prop.bedrooms}BHK, ${prop.area.value} ${prop.area.unit}`;
    }).join('\n\n');
    
    // Format budget display
    const minBudget = preferences.budget && preferences.budget.min ? `₹${preferences.budget.min.toLocaleString('en-IN')}` : 'Not specified';
    const maxBudget = preferences.budget && preferences.budget.max ? `₹${preferences.budget.max.toLocaleString('en-IN')}` : 'Not specified';
    
    return `🏠 *Found ${properties.length} properties matching your criteria!*\n\n` +
           `Location: ${preferences.location || 'Not specified'}\n` +
           `Budget: ${minBudget} - ${maxBudget}\n` +
           `BHK: ${preferences.bhk || 'Not specified'}\n\n` +
           `${propertyList}\n\n` +
           `Reply with the property number to see more details and images.`;
  }

  async handlePropertyMatchState(conversation, message) {
    // Check if user selected a property by number
    const propertyIndex = parseInt(message.trim()) - 1;
    
    // Populate matched properties
    await conversation.populate('matchedProperties');
    
    // Check if there are any matched properties
    if (conversation.matchedProperties.length === 0) {
      // No properties found, restart the conversation
      conversation.state = 'welcome';
      await conversation.save();
      return this.handleWelcomeState(conversation, message);
    }
    
    if (isNaN(propertyIndex) || propertyIndex < 0 || propertyIndex >= conversation.matchedProperties.length) {
      return `Please reply with a valid property number between 1 and ${conversation.matchedProperties.length}.`;
    }
    
    // Set selected property
    conversation.selectedProperty = conversation.matchedProperties[propertyIndex];
    conversation.state = 'schedule_visit';
    await conversation.save();
    
    // Get property details
    const property = await Property.findById(conversation.selectedProperty);
    
    // Format property details using the property's formatDetails method
    let propertyDetails = property.formatDetails();
    
    // Add a prompt with clear options
    propertyDetails += '\n\nOptions:\n' +
                      '1. Schedule a site visit\n' +
                      '2. Go back to property list\n\n' +
                      'Reply with the number of your choice (1-2).';
    
    // In a real implementation, you would send property images here
    // For now, we'll just return the formatted details
    return propertyDetails;
  }

  async handleScheduleVisitState(conversation, message) {
    // Check if this is the first message in this state
    if (!message.match(/^[1-2]$/)) {
      // Present clear Yes/No options
      return 'Would you like to schedule a site visit for this property?\n\n' +
             '1. Yes, schedule a visit\n' +
             '2. No, go back to property list\n\n' +
             'Reply with 1 for Yes or 2 for No.';
    }
    
    // Process user selection
    const userChoice = parseInt(message.trim());
    
    if (userChoice === 2) {
      // User doesn't want to schedule a visit
      conversation.state = 'property_match';
      await conversation.save();
      
      return 'No problem! You can continue browsing properties. Reply with a property number to see details, or type "restart" to start a new search.';
    }
    
    // User wants to schedule a visit
    conversation.state = 'collect_info';
    await conversation.save();
    
    return 'Great! To schedule a site visit, I need a few details from you.\n\n' +
           'Please provide your full name, phone number, and preferred date/time for the visit in this format:\n\n' +
           'Name: John Doe\n' +
           'Phone: 9876543210\n' +
           'Time: Tomorrow at 2 PM';
  }

  async handleCollectInfoState(conversation, message) {
    // Check if we have partial information already
    const userInfo = conversation.userInfo || {};
    
    // If we don't have a name yet
    if (!userInfo.name) {
      // Get property details for personalized greeting
      const property = await Property.findById(conversation.selectedProperty);
      const propertyName = property ? property.title : 'this property';
      
      // Check if this is the first message
      if (message.toLowerCase().includes('name:') || message.match(/^[a-zA-Z\s]+$/)) {
        // Extract name
        const name = message.includes('name:') ? 
          message.split('name:')[1].trim() : 
          message.trim();
        
        // Save name
        conversation.userInfo = { ...userInfo, name };
        await conversation.save();
        
        // Ask for phone number with personalized message
        return `Thanks, ${name}! 😊 We're excited to arrange your visit to ${propertyName}. \n\nPlease provide your phone number so our agent can contact you to confirm the details.`;
      } else {
        // Ask for name with personalized message
        return `Great choice! To schedule your visit to view this exclusive property in ${property ? property.location : 'our portfolio'}, I'll need a few details.\n\nPlease provide your full name.`;
      }
    }
    
    // If we have name but no phone
    if (!userInfo.phone) {
      // Check if this looks like a phone number
      if (message.match(/^[0-9+\s-]{10,15}$/) || message.toLowerCase().includes('phone:')) {
        // Extract phone
        const phone = message.includes('phone:') ? 
          message.split('phone:')[1].trim() : 
          message.trim().replace(/[\s-]/g, '');
        
        // Save phone
        conversation.userInfo = { ...userInfo, phone };
        await conversation.save();
        
        // Ask for preferred time with personalized options
        const property = await Property.findById(conversation.selectedProperty);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        
        // Format dates for display
        const tomorrowDate = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
        const dayAfterDate = dayAfter.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
        
        return `Perfect, ${userInfo.name}! 📱\n\n` +
               `When would you like to visit ${property ? property.title : 'the property'}? Please select your preferred time:\n\n` +
               `1. ${tomorrowDate} - Morning (10:00 AM)\n` +
               `2. ${tomorrowDate} - Afternoon (2:00 PM)\n` +
               `3. ${tomorrowDate} - Evening (5:00 PM)\n` +
               `4. ${dayAfterDate} - Morning (10:00 AM)\n` +
               `5. ${dayAfterDate} - Afternoon (2:00 PM)\n\n` +
               `Reply with the number of your preferred time slot (1-5).`;
      } else {
        // Ask for phone again with more helpful message
        return `I need a valid phone number to schedule your visit. Please provide a 10-15 digit phone number (e.g., 9876543210 or +91 98765 43210).`;
      }
    }
    
    // If we have name and phone but no time
    if (!userInfo.preferredTime) {
      // Check if this is a valid time selection
      if (message.match(/^[1-5]$/)) {
        // Process time selection
        const timeChoice = parseInt(message.trim());
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        
        let preferredTime;
        switch(timeChoice) {
          case 1: // Tomorrow morning
            preferredTime = new Date(tomorrow.setHours(10, 0, 0, 0));
            break;
          case 2: // Tomorrow afternoon
            preferredTime = new Date(tomorrow.setHours(14, 0, 0, 0));
            break;
          case 3: // Tomorrow evening
            preferredTime = new Date(tomorrow.setHours(17, 0, 0, 0));
            break;
          case 4: // Day after morning
            preferredTime = new Date(dayAfter.setHours(10, 0, 0, 0));
            break;
          case 5: // Day after afternoon
            preferredTime = new Date(dayAfter.setHours(14, 0, 0, 0));
            break;
          default:
            return `Please select a valid time option (1-5).`;
        }
        
        // Save time
        conversation.userInfo = { ...userInfo, preferredTime };
        
        // Ask for any special requirements
        return `Great choice! 📅\n\n` +
               `Do you have any special requirements or questions for your visit? For example:\n\n` +
               `1. No special requirements\n` +
               `2. Need information about financing options\n` +
               `3. Interested in nearby amenities\n` +
               `4. Want to discuss renovation possibilities\n` +
               `5. Other (please specify)\n\n` +
               `Reply with the number of your choice (1-5).`;
      } else {
        // Ask for time selection again
        const property = await Property.findById(conversation.selectedProperty);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        
        // Format dates for display
        const tomorrowDate = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
        const dayAfterDate = dayAfter.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
        
        return `Please select a valid time option by replying with a number from 1 to 5:\n\n` +
               `1. ${tomorrowDate} - Morning (10:00 AM)\n` +
               `2. ${tomorrowDate} - Afternoon (2:00 PM)\n` +
               `3. ${tomorrowDate} - Evening (5:00 PM)\n` +
               `4. ${dayAfterDate} - Morning (10:00 AM)\n` +
               `5. ${dayAfterDate} - Afternoon (2:00 PM)`;
      }
    }
    
    // If we have name, phone, time but no special requirements
    if (!userInfo.specialRequirements) {
      // Check if this is a valid selection or custom message
      if (message.match(/^[1-5]$/)) {
        const requirementChoice = parseInt(message.trim());
        let specialRequirements = '';
        
        switch(requirementChoice) {
          case 1:
            specialRequirements = 'No special requirements';
            break;
          case 2:
            specialRequirements = 'Needs information about financing options';
            break;
          case 3:
            specialRequirements = 'Interested in nearby amenities';
            break;
          case 4:
            specialRequirements = 'Wants to discuss renovation possibilities';
            break;
          case 5:
            // For 'Other', we'll ask them to specify
            return `Please briefly describe your specific requirements or questions:`;
          default:
            return `Please select a valid option (1-5).`;
        }
        
        // Save special requirements and complete the process
        conversation.userInfo = { ...userInfo, specialRequirements };
        conversation.state = 'completed';
        await conversation.save();
        
        // Create appointment in database
        await this.createAppointment(conversation);
        
        // Generate confirmation with enhanced details
        return this.generateEnhancedConfirmation(conversation);
      } else if (message.length > 0) {
        // User provided custom requirements (after selecting option 5)
        conversation.userInfo = { ...userInfo, specialRequirements: message.trim() };
        conversation.state = 'completed';
        await conversation.save();
        
        // Create appointment in database
        await this.createAppointment(conversation);
        
        // Generate confirmation with enhanced details
        return this.generateEnhancedConfirmation(conversation);
      } else {
        // Invalid input for special requirements
        return `Please select an option (1-5) or provide your specific requirements:`;
      }
    }
    
    // This should not happen, but just in case
    return `I'm not sure what information you're providing. Let's start over with your appointment details.\n\n` +
           `Please provide your full name.`;
  }
  
  // Generate enhanced confirmation message
  async generateEnhancedConfirmation(conversation) {
    try {
      // Get property details
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        throw new Error('Property not found');
      }
      
      // Format the date for display
      const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
      const formattedTime = conversation.userInfo.preferredTime.toLocaleDateString('en-US', options);
      
      // Get agent details
      const agent = property.agent;
      
      // Create a personalized confirmation message
      let confirmationMessage = `✅ *Booking Confirmed with Malpure Group!*\n\n`;
      
      // Add personalized greeting
      confirmationMessage += `Dear ${conversation.userInfo.name},\n\n`;
      
      // Add appointment details
      confirmationMessage += `Your visit to see *${property.title}* has been scheduled for *${formattedTime}*.\n\n`;
      
      // Add property details
      confirmationMessage += `*Property Details:*\n`;
      confirmationMessage += `📍 ${property.location}\n`;
      confirmationMessage += `💰 ₹${property.price.toLocaleString('en-IN')}\n`;
      confirmationMessage += `🏢 ${property.type.charAt(0).toUpperCase() + property.type.slice(1)}\n`;
      confirmationMessage += `🛏️ ${property.bedrooms} Bedroom${property.bedrooms > 1 ? 's' : ''}\n`;
      confirmationMessage += `🚿 ${property.bathrooms} Bathroom${property.bathrooms > 1 ? 's' : ''}\n`;
      confirmationMessage += `📐 ${property.area.value} ${property.area.unit}\n\n`;
      
      // Add agent details
      confirmationMessage += `*Your Dedicated Agent:*\n`;
      confirmationMessage += `👤 ${agent.name}\n`;
      confirmationMessage += `📱 ${agent.phone}\n\n`;
      
      // Add special requirements if any
      if (conversation.userInfo.specialRequirements && 
          conversation.userInfo.specialRequirements !== 'No special requirements') {
        confirmationMessage += `*Special Requirements:*\n`;
        confirmationMessage += `✏️ ${conversation.userInfo.specialRequirements}\n\n`;
      }
      
      // Add next steps
      confirmationMessage += `Our agent will contact you at ${conversation.userInfo.phone} shortly to confirm the details.\n\n`;
      
      // Add what's next options
      confirmationMessage += `*What would you like to do next?*\n\n`;
      confirmationMessage += `1. Start a new property search\n`;
      confirmationMessage += `2. View appointment details\n`;
      confirmationMessage += `3. End conversation\n\n`;
      confirmationMessage += `Reply with the number of your choice (1-3).`;
      
      return confirmationMessage;
    } catch (error) {
      console.error('Error generating enhanced confirmation:', error);
      
      // Fallback to basic confirmation if there's an error
      return `✅ *Booking Confirmed!*\n\n` +
             `Thank you, ${conversation.userInfo.name}! Your property visit has been scheduled for ${conversation.userInfo.preferredTime}.\n\n` +
             `Our agent will contact you at ${conversation.userInfo.phone} shortly to confirm the details.\n\n` +
             `What would you like to do next?\n\n` +
             `1. Start a new property search\n` +
             `2. View appointment details\n` +
             `3. End conversation\n\n` +
             `Reply with the number of your choice (1-3).`;
    }
  }

  async createAppointment(conversation) {
    try {
      // Get property details
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        throw new Error('Property not found');
      }
      
      // Get agent details from property
      const assignedAgent = property.agent;
      
      // Format date for notes
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      const formattedDate = conversation.userInfo.preferredTime.toLocaleDateString('en-US', options);
      
      // Create detailed notes with user preferences
      let detailedNotes = `Appointment scheduled via Malpure Group WhatsApp bot\n`;
      detailedNotes += `Property: ${property.title} (${property.type}, ${property.bedrooms}BHK)\n`;
      detailedNotes += `Location: ${property.location}\n`;
      detailedNotes += `Price: ₹${property.price.toLocaleString('en-IN')}\n`;
      
      // Add user preferences if available
      if (conversation.preferences) {
        if (conversation.preferences.budget) {
          detailedNotes += `User budget range: ₹${conversation.preferences.budget.min}-${conversation.preferences.budget.max}\n`;
        }
        if (conversation.preferences.location) {
          detailedNotes += `User preferred location: ${conversation.preferences.location}\n`;
        }
        if (conversation.preferences.bhk) {
          detailedNotes += `User preferred BHK: ${conversation.preferences.bhk}\n`;
        }
      }
      
      // Add any special requirements if mentioned
      if (conversation.userInfo.specialRequirements) {
        detailedNotes += `Special requirements: ${conversation.userInfo.specialRequirements}\n`;
      }
      
      // Create appointment with enhanced data
      const appointmentData = {
        propertyId: conversation.selectedProperty,
        userId: conversation.userId,
        dateTime: conversation.userInfo.preferredTime,
        userPhone: conversation.userInfo.phone,
        userName: conversation.userInfo.name,
        notes: detailedNotes,
        // Add additional fields for better tracking
        source: 'whatsapp_bot',
        assignedAgentName: assignedAgent.name,
        assignedAgentPhone: assignedAgent.phone,
        propertyTitle: property.title,
        propertyLocation: property.location,
        propertyPrice: property.price,
        propertyType: property.type,
        propertyBedrooms: property.bedrooms
      };
      
      // Create the appointment
      const appointmentId = await this.appointmentService.createAppointment(appointmentData);
      console.log(`Created appointment with ID: ${appointmentId}`);
      
      // Store appointment ID in conversation for future reference
      conversation.appointmentId = appointmentId;
      await conversation.save();
      
      // In a production implementation, notify the sales team
      this.notifySalesTeam(appointmentData, appointmentId, property);
      
      // Schedule appointment reminder (24 hours before)
      this.scheduleAppointmentReminder(conversation, property, appointmentId);
      
      return appointmentId;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }
  
  // Method to notify sales team about new appointment
  notifySalesTeam(appointmentData, appointmentId, property) {
    try {
      // Log the notification (in production, this would send an email, SMS, or update a CRM)
      console.log(`[MALPURE GROUP SALES NOTIFICATION] New appointment created:`);
      console.log(`- Appointment ID: ${appointmentId}`);
      console.log(`- Property: ${property.title} (${property._id})`);
      console.log(`- Client: ${appointmentData.userName} (${appointmentData.userPhone})`);
      console.log(`- Date/Time: ${appointmentData.dateTime}`);
      console.log(`- Assigned Agent: ${appointmentData.assignedAgentName} (${appointmentData.assignedAgentPhone})`);
      
      // Add special requirements if any
      if (appointmentData.notes && appointmentData.notes.includes('Special requirements')) {
        console.log(`- Special Requirements: ${appointmentData.notes.split('Special requirements:')[1].split('\n')[0].trim()}`);
      }
      
      // Add priority flag for high-value properties
      if (property.price > 10000000) { // 1 crore+
        console.log(`- [HIGH PRIORITY] Premium property (₹${property.price.toLocaleString('en-IN')})`);
      }
      
      // In production, implement actual notification logic here
      // Example: send email to sales team, update CRM, send SMS to agent, etc.
      
      // Simulate sending personalized WhatsApp notification to agent
      this.simulateAgentNotification(appointmentData, property);
      
      // Schedule follow-up task for sales team
      this.scheduleFollowUpTask(appointmentData, property, appointmentId);
    } catch (error) {
      console.error('Error notifying sales team:', error);
      // Don't throw error here to prevent blocking the main flow
    }
  }
  
  // Simulate sending a personalized WhatsApp notification to the agent
  simulateAgentNotification(appointmentData, property) {
    const agentMessage = `🔔 *New Malpure Group Appointment*\n\n` +
                         `Dear ${appointmentData.assignedAgentName},\n\n` +
                         `You have a new property viewing appointment:\n\n` +
                         `👤 Client: ${appointmentData.userName}\n` +
                         `📱 Phone: ${appointmentData.userPhone}\n` +
                         `🏠 Property: ${property.title}\n` +
                         `📍 Location: ${property.location}\n` +
                         `📅 Date/Time: ${appointmentData.dateTime.toLocaleString()}\n\n` +
                         `Please contact the client within the next 2 hours to confirm the appointment details.\n\n` +
                         `Thank you,\n` +
                         `Malpure Group Management`;
    
    console.log(`[AGENT NOTIFICATION] Would send to ${appointmentData.assignedAgentPhone}:\n${agentMessage}`);
  }
  
  // Schedule a follow-up task for the sales team
  scheduleFollowUpTask(appointmentData, property, appointmentId) {
    // Calculate follow-up time (2 hours after appointment creation)
    const followUpTime = new Date();
    followUpTime.setHours(followUpTime.getHours() + 2);
    
    const followUpTask = {
      type: 'appointment_confirmation_check',
      appointmentId: appointmentId,
      clientName: appointmentData.userName,
      clientPhone: appointmentData.userPhone,
      propertyId: property._id,
      propertyTitle: property.title,
      agentName: appointmentData.assignedAgentName,
      agentPhone: appointmentData.assignedAgentPhone,
      scheduledTime: followUpTime,
      status: 'pending',
      description: `Check if agent has contacted client to confirm appointment details`
    };
    
    console.log(`[FOLLOW-UP TASK] Scheduled for ${followUpTime.toLocaleString()}:\n`, followUpTask);
    
    // In production, this would be stored in a database and processed by a task scheduler
  }
  
  // Method to schedule appointment reminders
  scheduleAppointmentReminder(conversation, property, appointmentId) {
    try {
      const appointmentTime = new Date(conversation.userInfo.preferredTime);
      const currentTime = new Date();
      
      // Define reminder schedule (hours before appointment)
      const reminderSchedule = [
        { hours: 24, type: 'day_before' },
        { hours: 3, type: 'few_hours_before' },
        { hours: 1, type: 'one_hour_before' }
      ];
      
      // Schedule each reminder if it's in the future
      reminderSchedule.forEach(reminder => {
        const reminderTime = new Date(appointmentTime);
        reminderTime.setHours(reminderTime.getHours() - reminder.hours);
        
        if (reminderTime > currentTime) {
          const timeUntilReminder = reminderTime.getTime() - currentTime.getTime();
          const hoursUntil = Math.round(timeUntilReminder/3600000);
          
          console.log(`[MALPURE GROUP] Scheduling ${reminder.type} reminder for ${reminderTime.toLocaleString()} (in ${hoursUntil} hours)`);
          
          // Create the reminder with personalized message
          this.createPersonalizedReminder(conversation, property, appointmentId, reminder.type, reminderTime);
        }
      });
      
      // Also schedule a post-appointment follow-up
      const followUpTime = new Date(appointmentTime);
      followUpTime.setHours(followUpTime.getHours() + 3); // 3 hours after appointment
      
      if (followUpTime > currentTime) {
        console.log(`[MALPURE GROUP] Scheduling post-visit feedback request for ${followUpTime.toLocaleString()}`);
        this.createPersonalizedReminder(conversation, property, appointmentId, 'post_visit', followUpTime);
      }
    } catch (error) {
      console.error('Error scheduling reminders:', error);
      // Don't throw error here to prevent blocking the main flow
    }
  }
  
  // Create personalized reminder message based on reminder type
  createPersonalizedReminder(conversation, property, appointmentId, reminderType, scheduledTime) {
    const userName = conversation.userInfo.name;
    const userPhone = conversation.userInfo.phone;
    const propertyTitle = property.title;
    const propertyLocation = property.location;
    const appointmentTime = conversation.userInfo.preferredTime.toLocaleString();
    const agentName = property.agent.name;
    
    let reminderMessage = '';
    
    switch (reminderType) {
      case 'day_before':
        reminderMessage = `🔔 *Appointment Reminder from Malpure Group*\n\n` +
                         `Hello ${userName},\n\n` +
                         `This is a friendly reminder that you have an appointment tomorrow to visit ${propertyTitle} at ${appointmentTime}.\n\n` +
                         `📍 Location: ${propertyLocation}\n` +
                         `👤 Your agent: ${agentName}\n\n` +
                         `Please remember to bring your ID proof. If you need to reschedule, please reply to this message.\n\n` +
                         `We look forward to showing you this property!\n\n` +
                         `Warm regards,\n` +
                         `Malpure Group`;
        break;
      
      case 'few_hours_before':
        reminderMessage = `🔔 *Your Property Visit Today - Malpure Group*\n\n` +
                         `Hello ${userName},\n\n` +
                         `Your appointment to visit ${propertyTitle} is scheduled for today at ${appointmentTime} (in about 3 hours).\n\n` +
                         `Your agent ${agentName} is preparing to meet you at the property. Please let us know if you're on your way or if you need directions.\n\n` +
                         `We're excited to show you this property!\n\n` +
                         `Malpure Group`;
        break;
      
      case 'one_hour_before':
        reminderMessage = `🔔 *Your Property Visit - 1 Hour Reminder*\n\n` +
                         `Hello ${userName},\n\n` +
                         `Your appointment at ${propertyTitle} is coming up in 1 hour.\n\n` +
                         `Your agent ${agentName} is ready to meet you at the property. If you're running late or need assistance finding the location, please let us know.\n\n` +
                         `See you soon!\n\n` +
                         `Malpure Group`;
        break;
      
      case 'post_visit':
        reminderMessage = `👋 *How was your property visit?*\n\n` +
                         `Hello ${userName},\n\n` +
                         `Thank you for visiting ${propertyTitle} with Malpure Group today.\n\n` +
                         `We'd love to hear your thoughts about the property and your experience with us.\n\n` +
                         `Did the property meet your expectations? Would you like to see more similar properties?\n\n` +
                         `Your feedback helps us serve you better.\n\n` +
                         `Warm regards,\n` +
                         `Malpure Group`;
        break;
    }
    
    // Create reminder object (in production, this would be stored in a database)
    const reminder = {
      type: reminderType,
      appointmentId: appointmentId,
      userPhone: userPhone,
      userName: userName,
      propertyId: property._id,
      propertyTitle: propertyTitle,
      scheduledTime: scheduledTime,
      message: reminderMessage,
      status: 'scheduled'
    };
    
    console.log(`[REMINDER CREATED] ${reminderType} for ${scheduledTime.toLocaleString()}`);
    
    // In production, this would be stored in a database and processed by a task scheduler
    return reminder;
  }

  async handleCompletedState(conversation, message) {
    // Check if this is the first message or an invalid selection
    if (!message.match(/^[1-5]$/)) {
      // Get property details
      const property = await Property.findById(conversation.selectedProperty);
      const propertyName = property ? property.title : 'the property';
      
      // Format the date for display
      const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
      const formattedTime = conversation.userInfo.preferredTime.toLocaleDateString('en-US', options);
      
      // Show enhanced options menu
      return `Your appointment to visit ${propertyName} has been confirmed for ${formattedTime}.\n\n` +
             `What would you like to do next?\n\n` +
             `1. Start a new property search\n` +
             `2. View appointment details\n` +
             `3. View similar properties\n` +
             `4. Request property documents\n` +
             `5. End conversation\n\n` +
             `Reply with the number of your choice (1-5).`;
    }
    
    // Process user selection
    const userChoice = parseInt(message.trim());
    
    if (userChoice === 1) {
      // User wants to restart
      conversation.state = 'welcome';
      conversation.preferences = {};
      conversation.matchedProperties = [];
      // Keep the appointment ID for reference
      const appointmentId = conversation.appointmentId;
      conversation.selectedProperty = null;
      conversation.userInfo = {};
      // Store previous appointment ID for reference
      conversation.previousAppointments = conversation.previousAppointments || [];
      if (appointmentId) {
        conversation.previousAppointments.push(appointmentId);
      }
      await conversation.save();
      
      return this.handleWelcomeState(conversation, message);
    } else if (userChoice === 2) {
      // User wants to view appointment details
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        return `Sorry, I couldn't find the property details. Let's start a new search.\n\n` +
               `1. Start a new property search\n` +
               `5. End conversation\n\n` +
               `Reply with the number of your choice.`;
      }
      
      // Format the date for display
      const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
      const formattedTime = conversation.userInfo.preferredTime.toLocaleDateString('en-US', options);
      
      // Get agent details
      const agent = property.agent;
      
      // Create detailed appointment view
      let detailsMessage = `📋 *Your Appointment with Malpure Group*\n\n`;
      
      // Add appointment details
      detailsMessage += `🏠 *Property:* ${property.title}\n`;
      detailsMessage += `📍 *Location:* ${property.location}\n`;
      detailsMessage += `💰 *Price:* ₹${property.price.toLocaleString('en-IN')}\n`;
      detailsMessage += `📅 *Date/Time:* ${formattedTime}\n\n`;
      
      // Add visitor details
      detailsMessage += `👤 *Visitor Details:*\n`;
      detailsMessage += `Name: ${conversation.userInfo.name}\n`;
      detailsMessage += `Phone: ${conversation.userInfo.phone}\n\n`;
      
      // Add agent details
      detailsMessage += `🧑‍💼 *Your Dedicated Agent:*\n`;
      detailsMessage += `Name: ${agent.name}\n`;
      detailsMessage += `Phone: ${agent.phone}\n`;
      if (agent.email) {
        detailsMessage += `Email: ${agent.email}\n`;
      }
      detailsMessage += `\n`;
      
      // Add special requirements if any
      if (conversation.userInfo.specialRequirements && 
          conversation.userInfo.specialRequirements !== 'No special requirements') {
        detailsMessage += `✏️ *Special Requirements:*\n`;
        detailsMessage += `${conversation.userInfo.specialRequirements}\n\n`;
      }
      
      // Add what to bring
      detailsMessage += `📝 *What to Bring:*\n`;
      detailsMessage += `- ID proof (Aadhar/PAN/Passport)\n`;
      detailsMessage += `- Phone with this WhatsApp number\n`;
      
      // Add options
      detailsMessage += `\nWhat would you like to do next?\n\n`;
      detailsMessage += `1. Start a new property search\n`;
      detailsMessage += `3. View similar properties\n`;
      detailsMessage += `4. Request property documents\n`;
      detailsMessage += `5. End conversation\n\n`;
      detailsMessage += `Reply with the number of your choice (1, 3-5).`;
      
      return detailsMessage;
    } else if (userChoice === 3) {
      // User wants to view similar properties
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        return `Sorry, I couldn't find the property to show similar options. Let's start a new search.\n\n` +
               `1. Start a new property search\n` +
               `5. End conversation\n\n` +
               `Reply with the number of your choice.`;
      }
      
      // Find similar properties
      const similarProperties = await Property.findSimilar(property);
      
      if (!similarProperties || similarProperties.length === 0) {
        return `I couldn't find any similar properties at this time. Would you like to:\n\n` +
               `1. Start a new property search\n` +
               `2. View appointment details\n` +
               `5. End conversation\n\n` +
               `Reply with the number of your choice.`;
      }
      
      // Format similar properties list
      let similarPropertiesMessage = `🏠 *Similar Properties You Might Like*\n\n`;
      
      similarProperties.forEach((prop, index) => {
        similarPropertiesMessage += prop.formatForList(index) + '\n\n';
      });
      
      similarPropertiesMessage += `Would you like to schedule a visit to any of these properties as well?\n\n`;
      similarPropertiesMessage += `1. Start a new property search\n`;
      similarPropertiesMessage += `2. View appointment details\n`;
      similarPropertiesMessage += `5. End conversation\n\n`;
      similarPropertiesMessage += `Reply with the number of your choice.`;
      
      return similarPropertiesMessage;
    } else if (userChoice === 4) {
      // User wants to request property documents
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        return `Sorry, I couldn't find the property to provide documents. Let's start a new search.\n\n` +
               `1. Start a new property search\n` +
               `5. End conversation\n\n` +
               `Reply with the number of your choice.`;
      }
      
      // Simulate document request
      return `📄 *Document Request Confirmed*\n\n` +
             `We've received your request for documents related to ${property.title}.\n\n` +
             `Our team will send the following documents to you shortly:\n` +
             `- Property brochure\n` +
             `- Floor plans\n` +
             `- Amenities list\n` +
             `- Location advantages\n` +
             `- Payment plans\n\n` +
             `These will be sent to you via WhatsApp or email. Is there a specific document you're most interested in?\n\n` +
             `1. Start a new property search\n` +
             `2. View appointment details\n` +
             `5. End conversation\n\n` +
             `Reply with the number of your choice.`;
    } else {
      // User wants to end conversation
      return `Thank you for choosing Malpure Group for your property search! 🙏\n\n` +
             `Your property viewing has been scheduled, and our agent will contact you shortly.\n\n` +
             `If you have any questions about your appointment or would like to search for more properties in the future, just message us again.\n\n` +
             `We look forward to helping you find your dream property! 🏡✨\n\n` +
             `Have a great day! 👋`;
    }
  }
}

module.exports = ConversationService;