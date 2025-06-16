// services/conversationService.js
const path = require('path');
const fs = require('fs');
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
    enum: ['language_selection', 'welcome', 'location', 'budget', 'bhk', 'property_match', 'schedule_visit', 'collect_info', 'completed'],
    default: 'language_selection'
  },
  language: { type: String, enum: ['english', 'marathi'], default: 'english' },
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
    preferredTime: { type: Date },
    specialRequirements: { type: String },
    awaitingSpecialRequirements: { type: Boolean, default: false }
  },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
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

  // Add this at the top of the file with other utility functions
  async convertMarathiToArabicNumerals(input) {
    const marathiToArabic = {
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
      '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };

    if (typeof input === 'string') {
      return input.split('').map(char => marathiToArabic[char] || char).join('');
    }
    return input;
  }

  async processMessage(sender, message, mediaUrl = null, mediaType = null) {
    try {
      // Get or create conversation for this user
      let conversation = await this.getOrCreateConversation(sender);

      let response;

      // Check if this is a media message
      if (mediaUrl && mediaType) {
        // Process media message
        response = await this.handleMediaMessage(conversation, mediaUrl, mediaType, message);
      } else {
        // Process text message based on current conversation state
        response = await this.handleConversationState(conversation, message);
      }

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
          state: 'language_selection',
          language: 'english',
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

  async handleMediaMessage(conversation, mediaUrl, mediaType, caption = '') {
    try {
      console.log(`Processing ${mediaType} message with URL: ${mediaUrl}`);

      // Process caption if provided
      let textContext = '';
      if (caption && caption.trim().length > 0) {
        console.log(`Media caption: ${caption}`);
        textContext = `with caption: "${caption}"`;
      }

      // Different handling based on media type
      switch (mediaType) {
        case 'image':
          return await this.handleImageMessage(conversation, mediaUrl, caption);
        case 'document':
          return await this.handleDocumentMessage(conversation, mediaUrl, caption);
        case 'audio':
          return await this.handleAudioMessage(conversation, mediaUrl);
        case 'video':
          return await this.handleVideoMessage(conversation, mediaUrl, caption);
        case 'location':
          return await this.handleLocationMessage(conversation, mediaUrl);
        default:
          return this.getUnsupportedMediaTypeMessage(conversation.language);
      }
    } catch (error) {
      console.error('Error handling media message:', error);
      return this.getMediaProcessingErrorMessage(conversation.language);
    }
  }

  async handleImageMessage(conversation, imageUrl, caption) {
    // Use AI to analyze the image
    try {
      console.log(`Analyzing image for conversation state: ${conversation.state}`);

      // For property search states, the user might be sending property images to analyze
      if (['welcome', 'location', 'budget', 'bhk', 'property_match'].includes(conversation.state)) {
        // Use AI to analyze the property image
        const imageAnalysis = await this.aiService.analyzePropertyImage(imageUrl);
        console.log('Image analysis result:', JSON.stringify(imageAnalysis));

        if (imageAnalysis && imageAnalysis.isProperty && imageAnalysis.confidence > 0.5) {
          // Extract property features from the image
          const propertyFeatures = imageAnalysis.features || {};
          let updatedPreferences = false;

          // Update user preferences based on image analysis
          if (propertyFeatures.location) {
            conversation.preferences.location = propertyFeatures.location;
            updatedPreferences = true;
          }

          if (propertyFeatures.bhk) {
            conversation.preferences.bhk = propertyFeatures.bhk;
            updatedPreferences = true;
          }

          // Add property type if available
          if (propertyFeatures.type && !conversation.preferences.type) {
            conversation.preferences.type = propertyFeatures.type;
            updatedPreferences = true;
          }

          // Add amenities if available
          if (propertyFeatures.amenities && propertyFeatures.amenities.length > 0) {
            conversation.preferences.amenities = propertyFeatures.amenities;
            updatedPreferences = true;
          }

          await conversation.save();

          // Process caption as additional context if provided
          let captionContext = '';
          if (caption && caption.trim().length > 0) {
            // Extract any additional preferences from caption
            const captionPreferences = await this.aiService.extractUserPreferences(caption);
            if (Object.keys(captionPreferences).length > 0) {
              // Update preferences with caption information
              conversation.preferences = { ...conversation.preferences, ...captionPreferences };
              await conversation.save();
              captionContext = ' and your text description';
            }
          }

          // Determine next steps based on conversation state
          if (conversation.state === 'welcome' || conversation.state === 'location') {
            if (propertyFeatures.location) {
              conversation.state = 'budget';
              await conversation.save();

              // Provide response based on extracted features
              if (conversation.language === 'marathi') {
                return `मी आपल्या प्रतिमेचे${captionContext} विश्लेषण केले आहे. मला दिसते की आपण ${propertyFeatures.location} मध्ये ${propertyFeatures.type || 'प्रॉपर्टी'} शोधत आहात. ${this.getBudgetPromptMessage(conversation.language)}`;
              }

              return `I've analyzed your image${captionContext}. I see you're looking for a property in ${propertyFeatures.location}. ${this.getBudgetPromptMessage('english')}`;
            }
          }

          // For other states, provide detailed analysis
          const amenitiesText = propertyFeatures.amenities && propertyFeatures.amenities.length > 0 ?
            `with amenities like ${propertyFeatures.amenities.slice(0, 3).join(', ')}` : '';

          if (conversation.language === 'marathi') {
            return `मी आपल्या प्रतिमेचे${captionContext} विश्लेषण केले आहे. मला दिसते की आपण ${propertyFeatures.bhk || ''}BHK ${propertyFeatures.type || ''} ${propertyFeatures.location || ''} मध्ये शोधत आहात ${amenitiesText ? 'जिथे ' + amenitiesText + ' सुविधा आहेत' : ''}. आपल्या प्राधान्यांची पुष्टी करण्यासाठी कृपया 'होय' टाइप करा किंवा अधिक तपशील प्रदान करा.`;
          }

          return `I've analyzed your image${captionContext}. I see you're looking for a ${propertyFeatures.bhk || ''}BHK ${propertyFeatures.type || ''} in ${propertyFeatures.location || ''} ${amenitiesText}. ${propertyFeatures.quality ? 'It appears to be a ' + propertyFeatures.quality + ' property.' : ''} Please type 'yes' to confirm these preferences or provide more details.`;
        } else {
          // Image doesn't appear to be a property or low confidence
          if (conversation.language === 'marathi') {
            return 'मला क्षमा करा, पण ही प्रतिमा स्पष्टपणे मालमत्ता दर्शवत नाही. कृपया एक स्पष्ट मालमत्ता प्रतिमा पाठवा किंवा आपल्या प्राधान्यांचे वर्णन करा.';
          }

          return 'I\'m sorry, but this image doesn\'t clearly show a property. Please send a clear property image or describe your preferences.';
        }
      }

      // For document collection state, user might be sending ID proof or documents
      if (conversation.state === 'collect_info') {
        // Try to extract information from the image if it's a document
        const documentAnalysis = await this.aiService.analyzeDocumentImage(imageUrl);

        // Check if we extracted any useful information
        if (documentAnalysis && documentAnalysis.includes('personal information')) {
          // Document contains personal information, acknowledge receipt
          if (conversation.language === 'marathi') {
            return 'आपला दस्तऐवज प्राप्त झाला आहे. आम्ही आपल्या गोपनीयतेचा आदर करतो. कृपया आपले नाव, फोन नंबर आणि भेटीसाठी इच्छित वेळ प्रदान करा.';
          }

          return 'I\'ve received your document. We respect your privacy. Please provide your name, phone number, and preferred time for the visit.';
        }

        // Generic document acknowledgment
        if (conversation.language === 'marathi') {
          return 'आपला दस्तऐवज प्राप्त झाला आहे. कृपया आपले नाव, फोन नंबर आणि भेटीसाठी इच्छित वेळ प्रदान करा.';
        }

        return 'I\'ve received your document. Please provide your name, phone number, and preferred time for the visit.';
      }

      // Generic response for other states
      if (conversation.language === 'marathi') {
        return 'मी आपली प्रतिमा प्राप्त केली आहे. कृपया आपल्या प्राधान्यांबद्दल अधिक माहिती द्या.';
      }

      return 'I\'ve received your image. Please provide more information about your preferences.';
    } catch (error) {
      console.error('Error analyzing image:', error);
      if (conversation.language === 'marathi') {
        return 'क्षमस्व, मला आपली प्रतिमा प्रक्रिया करताना त्रुटी आली. कृपया टेक्स्ट संदेश पाठवून पुन्हा प्रयत्न करा.';
      }
      return 'Sorry, I encountered an error processing your image. Please try again with a text message.';
    }
  }

  async handleDocumentMessage(conversation, documentUrl, caption) {
    try {
      // Use AI to analyze the document
      const documentText = await this.aiService.analyzeDocumentImage(documentUrl);
      console.log('Document analysis result:', documentText.substring(0, 100) + '...');

      // For collect_info state, try to extract user information
      if (conversation.state === 'collect_info') {
        // Check if document contains personal information
        if (documentText.toLowerCase().includes('personal information') ||
          documentText.toLowerCase().includes('id') ||
          documentText.toLowerCase().includes('identification')) {
          // Document contains personal information
          if (conversation.language === 'marathi') {
            return 'आपला दस्तऐवज प्राप्त झाला आहे. आम्ही आपल्या गोपनीयतेचा आदर करतो. कृपया आपले नाव, फोन नंबर आणि भेटीसाठी इच्छित वेळ प्रदान करा.';
          }

          return 'I\'ve received your document containing personal information. We respect your privacy. Please provide your name, phone number, and preferred time for the visit in a text message.';
        }

        // Try to extract property-related information
        if (documentText.toLowerCase().includes('property') ||
          documentText.toLowerCase().includes('real estate') ||
          documentText.toLowerCase().includes('agreement')) {
          if (conversation.language === 'marathi') {
            return 'आपला मालमत्ता दस्तऐवज प्राप्त झाला आहे. आम्ही त्याचे विश्लेषण करू आणि लवकरच आपल्याला अधिक माहिती देऊ. तोपर्यंत, कृपया आपले नाव, फोन नंबर आणि भेटीसाठी इच्छित वेळ प्रदान करा.';
          }

          return 'I\'ve received your property document. We\'ll analyze it and get back to you with more information soon. In the meantime, please provide your name, phone number, and preferred time for the visit.';
        }
      }

      // Generic response for other states
      if (conversation.language === 'marathi') {
        return 'आपला दस्तऐवज प्राप्त झाला आहे. आम्ही लवकरच त्याचे विश्लेषण करू.';
      }

      return 'I\'ve received your document. We\'ll analyze it shortly.';
    } catch (error) {
      console.error('Error analyzing document:', error);
      if (conversation.language === 'marathi') {
        return 'क्षमस्व, मला आपला दस्तऐवज प्रक्रिया करताना त्रुटी आली. कृपया टेक्स्ट संदेश पाठवून पुन्हा प्रयत्न करा.';
      }
      return 'Sorry, I encountered an error processing your document. Please try again with a text message.';
    }
  }

  async handleAudioMessage(conversation, audioUrl) {
    try {
      // Attempt to transcribe audio (placeholder for now)
      const transcription = await this.aiService.transcribeAudio(audioUrl);
      console.log('Audio transcription result:', transcription);

      // If transcription is implemented in the future, process the text
      if (transcription && transcription !== 'Audio transcription not yet implemented') {
        // Process the transcribed text as a regular message
        return await this.handleConversationState(conversation, transcription);
      }

      // Default response if transcription is not available
      if (conversation.language === 'marathi') {
        return 'आपला ऑडिओ संदेश प्राप्त झाला आहे. सध्या, मी ऑडिओ प्रक्रिया करू शकत नाही. कृपया आपल्या प्राधान्यांबद्दल टेक्स्ट संदेश पाठवा.';
      }

      return 'I\'ve received your audio message. Currently, I cannot process audio. Please send a text message about your preferences.';
    } catch (error) {
      console.error('Error processing audio:', error);
      if (conversation.language === 'marathi') {
        return 'क्षमस्व, मला आपला ऑडिओ प्रक्रिया करताना त्रुटी आली. कृपया टेक्स्ट संदेश पाठवून पुन्हा प्रयत्न करा.';
      }
      return 'Sorry, I encountered an error processing your audio. Please try again with a text message.';
    }
  }

  async handleVideoMessage(conversation, videoUrl, caption) {
    try {
      // For now, we'll use a placeholder for video analysis
      // In a real implementation, we would extract a thumbnail and analyze it
      const thumbnailUrl = videoUrl; // In a real implementation, this would be a thumbnail extraction

      // Use AI to analyze the video (via thumbnail)
      const videoAnalysis = await this.aiService.analyzePropertyVideo(videoUrl, thumbnailUrl);
      console.log('Video analysis result:', JSON.stringify(videoAnalysis));

      if (videoAnalysis && videoAnalysis.isProperty && videoAnalysis.confidence > 0.5) {
        // Extract property features from the video analysis
        const propertyFeatures = videoAnalysis.features || {};

        // Update user preferences based on video analysis
        if (propertyFeatures.location) {
          conversation.preferences.location = propertyFeatures.location;
        }

        if (propertyFeatures.bhk) {
          conversation.preferences.bhk = propertyFeatures.bhk;
        }

        await conversation.save();

        // Provide response based on extracted features
        if (conversation.language === 'marathi') {
          return `मी आपल्या व्हिडिओचे विश्लेषण केले आहे. मला दिसते की आपण ${propertyFeatures.bhk || ''}BHK ${propertyFeatures.type || ''} ${propertyFeatures.location || ''} मध्ये शोधत आहात. आपल्या प्राधान्यांची पुष्टी करण्यासाठी कृपया 'होय' टाइप करा किंवा अधिक तपशील प्रदान करा.`;
        }

        return `I've analyzed your video. I see you're looking for a ${propertyFeatures.bhk || ''}BHK ${propertyFeatures.type || ''} in ${propertyFeatures.location || ''}. Please type 'yes' to confirm these preferences or provide more details.`;
      }

      // Generic response if video analysis doesn't yield property information
      if (conversation.language === 'marathi') {
        return 'आपला व्हिडिओ प्राप्त झाला आहे. कृपया आपल्या प्राधान्यांबद्दल अधिक माहिती द्या.';
      }

      return 'I\'ve received your video. Please provide more information about your property preferences in a text message.';
    } catch (error) {
      console.error('Error analyzing video:', error);
      if (conversation.language === 'marathi') {
        return 'क्षमस्व, मला आपला व्हिडिओ प्रक्रिया करताना त्रुटी आली. कृपया टेक्स्ट संदेश पाठवून पुन्हा प्रयत्न करा.';
      }
      return 'Sorry, I encountered an error processing your video. Please try again with a text message.';
    }
  }

  async handleLocationMessage(conversation, locationData) {
    try {
      // Extract location data
      const { latitude, longitude } = locationData;
      console.log(`Processing location: ${latitude}, ${longitude}`);

      // Use AI to get location name from coordinates
      const locationInfo = await this.aiService.extractLocationFromCoordinates(latitude, longitude);
      const locationName = locationInfo.name || 'Detected Location';
      const locationDescription = locationInfo.description || '';

      console.log(`Location identified as: ${locationName}`);

      // Update user preferences
      conversation.preferences.location = locationName;
      await conversation.save();

      // If we're in the location state, move to budget state
      if (conversation.state === 'location') {
        conversation.state = 'budget';
        await conversation.save();

        if (conversation.language === 'marathi') {
          return `मी आपले स्थान नोंदवले आहे: ${locationName}. ${locationDescription ? '(' + locationDescription + ')' : ''} ${this.getBudgetPromptMessage(conversation.language)}`;
        }

        return `I've recorded your location: ${locationName}. ${locationDescription ? '(' + locationDescription + ')' : ''} ${this.getBudgetPromptMessage('english')}`;
      }

      // Otherwise just acknowledge the location
      if (conversation.language === 'marathi') {
        return `मी आपले स्थान नोंदवले आहे: ${locationName}. ${locationDescription ? '(' + locationDescription + ')' : ''} कृपया आपल्या इतर प्राधान्यांबद्दल माहिती द्या.`;
      }

      return `I've recorded your location: ${locationName}. ${locationDescription ? '(' + locationDescription + ')' : ''} Please provide information about your other preferences.`;
    } catch (error) {
      console.error('Error processing location:', error);
      if (conversation.language === 'marathi') {
        return 'क्षमस्व, मला आपले स्थान प्रक्रिया करताना त्रुटी आली. कृपया स्थानाचे नाव टाइप करा.';
      }
      return 'Sorry, I encountered an error processing your location. Please type the location name.';
    }
  }

  getUnsupportedMediaTypeMessage(language) {
    if (language === 'marathi') {
      return 'क्षमस्व, मी या प्रकारच्या मीडिया प्रकाराचे समर्थन करत नाही. कृपया टेक्स्ट संदेश, प्रतिमा किंवा स्थान पाठवा.';
    }

    return 'Sorry, I don\'t support this type of media. Please send text messages, images, or locations.';
  }

  getMediaProcessingErrorMessage(language) {
    if (language === 'marathi') {
      return 'क्षमस्व, मला आपला मीडिया प्रक्रिया करताना त्रुटी आली. कृपया टेक्स्ट संदेश पाठवून पुन्हा प्रयत्न करा.';
    }

    return 'Sorry, I encountered an error processing your media. Please try again with a text message.';
  }

  async handleConversationState(conversation, message) {
    // Check for global commands first
    if (message.toLowerCase() === 'change language' || message.toLowerCase() === 'भाषा बदला') {
      conversation.state = 'language_selection';
      await conversation.save();
      return 'Welcome to Malpure Group! 🏠\n\nPlease select your preferred language:\n\n1. English\n2. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.';
    }

    if (message.toLowerCase() === 'restart' || message.toLowerCase() === 'पुन्हा सुरू करा' || message.toLowerCase() === 'start over' || message.toLowerCase() === 'new search') {
      conversation.state = 'welcome';
      conversation.preferences = {};
      conversation.matchedProperties = [];
      conversation.selectedProperty = null;
      await conversation.save();
      return this.getWelcomeMessage(conversation.language);
    }

    if (message.toLowerCase() === 'help' || message.toLowerCase() === 'मदत') {
      return this.getHelpMessage(conversation.language, conversation.state);
    }

    // Check for conversation timeout
    const now = new Date();
    const lastMessageTime = conversation.lastMessageTimestamp || now;
    const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60);

    // If more than 24 hours since last message, reset to welcome
    if (hoursSinceLastMessage > 24) {
      conversation.state = 'welcome';
      conversation.preferences = {};
      await conversation.save();
      return this.getWelcomeMessage(conversation.language);
    }

    const state = conversation.state;
    let response;

    switch (state) {
      case 'language_selection':
        response = await this.handleLanguageSelectionState(conversation, message);
        break;
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
        conversation.state = 'language_selection';
        await conversation.save();
    }

    return response;
  }

  async handleLanguageSelectionState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check if this is the first message or an invalid selection
    if (message && message.match(/^[1-2]$/)) {
      // Process language selection
      const languageChoice = parseInt(message);

      if (languageChoice === 1) {
        conversation.language = 'english';
      } else if (languageChoice === 2) {
        conversation.language = 'marathi';
      }

      // Move to welcome state
      conversation.state = 'welcome';
      await conversation.save();

      // Return welcome message in selected language
      return this.getWelcomeMessage(conversation.language);
    }

    // First message or invalid selection, ask for language preference
    return 'Welcome to Malpure Group! 🏠\n\nPlease select your preferred language:\n\n1. English\n2. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.';
  }

  getWelcomeMessage(language) {
    if (language === 'marathi') {
      return 'मालपुरे ग्रुपमध्ये आपले स्वागत आहे! 🏠\n\nमी आपल्याला आपले स्वप्नातील घर शोधण्यास मदत करण्यासाठी येथे आहे. सुरू करण्यासाठी, कृपया आपण फक्त क्रमांक (१) सह उत्तर द्या.';
    }

    // Default to English
    return 'Welcome to Malpure Group! 🏠\n\nI\'m here to help you find your dream property. To get started, Please reply with just the number (1) to continue.';
  }

  async handleWelcomeState(conversation, message) {
    // Move to location state
    conversation.state = 'location';
    await conversation.save();

    // Provide location options in the selected language
    return this.getLocationOptionsMessage(conversation.language);
  }

  getLocationOptionsMessage(language) {
    if (language === 'marathi') {
      return 'कृपया आपण स्वारस्य असलेले स्थान निवडा:\n\n१. नाशिक\n२. मुंबई\n३. पुणे\n४. इतर\n\n\nआपले पसंतीचे स्थान निवडण्यासाठी फक्त क्रमांक (१-४) सह उत्तर द्या.';
    }

    // Default to English
    return 'Please select a location you\'re interested in:\n\n1. Nashik\n2. Mumbai\n3. Pune\n4. Other\n\n\nReply with just the number (1-4) to select your preferred location.';
  }

  async handleLocationState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Define location options
    const locationOptions = [
      'Nashik',
      'Mumbai',
      'Pune',
      'Other'
    ];

    // Check if this is the first message or an invalid selection
    if (!message.match(/^[1-4]$/) || message === '4') {
      if (message === '4' || message.toLowerCase() === 'other' ||
        message.toLowerCase() === 'इतर') { // Added Marathi word for 'other'
        return this.getTypeLocationMessage(conversation.language);
      }

      // Show location options again
      return this.getLocationOptionsMessage(conversation.language);
    }

    // Process location selection
    const locationIndex = parseInt(message) - 1;
    const selectedLocation = locationOptions[locationIndex];

    // Save location preference
    conversation.preferences.location = selectedLocation;
    conversation.state = 'budget';
    await conversation.save();

    // Present budget options
    return this.getBudgetOptionsMessage(conversation.language, selectedLocation);
  }

  getTypeLocationMessage(language) {
    if (language === 'marathi') {
      return 'कृपया आपण स्वारस्य असलेल्या स्थानाचे नाव टाइप करा.';
    }

    // Default to English
    return 'Please type the name of the location you\'re interested in.';
  }

  getBudgetOptionsMessage(language, selectedLocation) {
    if (language === 'marathi') {
      const locationNames = {
        'Nashik': 'नाशिक',
        'Mumbai': 'मुंबई',
        'Pune': 'पुणे',
        'Other': 'इतर'
      };

      const marathiLocation = locationNames[selectedLocation] || selectedLocation;

      return `उत्तम! आपण ${marathiLocation} निवडले आहे. आता, कृपया आपली बजेट श्रेणी निवडा:\n\n` +
        '१. ₹५० लाखांपेक्षा कमी\n' +
        '२. ₹५० लाख - ₹१ कोटी\n' +
        '३. ₹१ कोटी - ₹२ कोटी\n' +
        '४. ₹२ कोटी - ₹५ कोटी\n' +
        '५. ₹५ कोटीपेक्षा जास्त\n\n' +
        'आपली बजेट श्रेणी निवडण्यासाठी फक्त क्रमांक (१-५) सह उत्तर द्या.';
    }

    // Default to English
    return `Great! You've selected ${selectedLocation}. Now, please select your budget range:\n\n` +
      '1. Under ₹50 Lakhs\n' +
      '2. ₹50 Lakhs - ₹1 Crore\n' +
      '3. ₹1 Crore - ₹2 Crore\n' +
      '4. ₹2 Crore - ₹5 Crore\n' +
      '5. Above ₹5 Crore\n\n' +
      'Reply with just the number (1-5) to select your budget range.';
  }

  async handleBudgetState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
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
      return this.getInvalidBudgetMessage(conversation.language);
    }

    // Process budget selection
    const budgetIndex = parseInt(message) - 1;
    const selectedBudget = budgetRanges[budgetIndex];

    // Save budget preference
    conversation.preferences.budget = selectedBudget;
    conversation.state = 'bhk';
    await conversation.save();

    // Present BHK options as a numbered list
    return this.getBHKOptionsMessage(conversation.language);
  }

  getInvalidBudgetMessage(language) {
    if (language === 'marathi') {
      return 'कृपया वैध बजेट पर्याय निवडा (१-५).';
    }

    // Default to English
    return 'Please select a valid budget option (1-5).';
  }

  getBHKOptionsMessage(language) {
    if (language === 'marathi') {
      return 'उत्तम! आता, कृपया आपण शोधत असलेल्या बेडरूमची संख्या (BHK) निवडा:\n\n१. 1 BHK\n२. 2 BHK\n३. 3 BHK\n४. 4 BHK\n५. 5+ BHK\n\nआपली पसंती निवडण्यासाठी फक्त क्रमांक (१-५) सह उत्तर द्या.';
    }

    // Default to English
    return 'Great! Now, please select the number of bedrooms (BHK) you\'re looking for:\n\n1. 1 BHK\n2. 2 BHK\n3. 3 BHK\n4. 4 BHK\n5. 5+ BHK\n\nReply with just the number (1-5) to select your preference.';
  }

  async handleBHKState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check if this is a valid BHK selection
    if (!message.match(/^[1-5]$/) &&
      message.toLowerCase() !== 'bhk options' &&
      message.toLowerCase() !== 'बीएचके पर्याय') { // Added Marathi for 'bhk options'
      // Show BHK options again
      return this.getInvalidBHKOptionMessage(conversation.language);
    }

    // If user asks for BHK options again
    if (message.toLowerCase() === 'bhk options' ||
      message.toLowerCase() === 'बीएचके पर्याय') {
      return this.getBHKOptionsMessage(conversation.language);
    }

    // Process BHK selection
    const bhkValue = parseInt(message);

    // Save BHK preference
    conversation.preferences.bhk = bhkValue;
    conversation.state = 'property_match';
    await conversation.save();

    // Find matching properties
    const matchingProperties = await this.findMatchingProperties(conversation.preferences);

    // Save matched properties to conversation
    conversation.matchedProperties = matchingProperties.map(p => p._id);
    await conversation.save();

    // Generate property match response
    return this.generatePropertyMatchResponse(conversation, matchingProperties, conversation.language);
  }

  getInvalidBHKOptionMessage(language) {
    if (language === 'marathi') {
      return 'कृपया वैध BHK पर्याय निवडा (1-5).';
    }

    // Default to English
    return 'Please select a valid BHK option (1-5).';
  }

  async findMatchingProperties(preferences) {
    try {
      // Build query based on preferences
      const query = {};

      // Add location filter if provided
      if (preferences.location && preferences.location !== 'Other') {
        query.location = { $regex: new RegExp(preferences.location, 'i') };
      }

      // Add budget filter if provided
      if (preferences.budget) {
        query.price = {
          $gte: preferences.budget.min,
          $lte: preferences.budget.max
        };
      }

      // Add BHK filter if provided
      if (preferences.bhk) {
        // For 5+ BHK, search for 5 or more
        if (preferences.bhk === 5) {
          query.bedrooms = { $gte: 5 };
        } else {
          query.bedrooms = preferences.bhk;
        }
      }

      // Find matching properties
      const properties = await Property.find(query)
        .sort({ isPromoted: -1, price: 1 })
        .limit(5);

      return properties;
    } catch (error) {
      console.error('Error finding matching properties:', error);
      return [];
    }
  }

  async generatePropertyMatchResponse(conversation, properties, language) {
    // Get user preferences for display
    const preferences = conversation.preferences;

    // Format budget for display
    const minBudget = preferences.budget ?
      `₹${(preferences.budget.min / 100000).toFixed(2)} Lakhs` : 'Not specified';
    const maxBudget = preferences.budget ?
      `₹${(preferences.budget.max / 100000).toFixed(2)} Lakhs` : 'Not specified';

    // Handle no matching properties
    if (!properties || properties.length === 0) {
      if (language === 'marathi') {
        return `मला आपल्या निकषांशी जुळणारी कोणतीही मालमत्ता सापडली नाही. आपण वेगळ्या प्राधान्यांसह प्रयत्न करू इच्छिता? नवीन शोध सुरू करण्यासाठी 'restart' किंवा 'पुन्हा सुरू करा' उत्तर द्या.`;
      }
      return `I couldn't find any properties matching your criteria. Would you like to try with different preferences? Reply 'restart' to begin a new search.`;
    }

    // Format properties for display
    const propertyList = properties.map((property, index) =>
      property.formatForList(index + 1) // index + 1 because we want to start from 1, not 0
    ).join('\n\n');

    if (language === 'marathi') {
      return `🏠 *आपल्या निकषांशी जुळणाऱ्या ${properties.length} मालमत्ता सापडल्या!*\n\n` +
        `स्थान: ${preferences.location || 'निर्दिष्ट नाही'}\n` +
        `बजेट: ${minBudget} - ${maxBudget}\n` +
        `बेडरूम: ${preferences.bhk || 'निर्दिष्ट नाही'} BHK\n\n` +
        `${propertyList}\n\n` +
        `अधिक माहितीसाठी मालमत्तेचा क्रमांक टाइप करा (1-${properties.length}).`;
    }

    // Default to English
    return `🏠 *Found ${properties.length} properties matching your criteria!*\n\n` +
      `Location: ${preferences.location || 'Not specified'}\n` +
      `Budget: ${minBudget} - ${maxBudget}\n` +
      `Bedrooms: ${preferences.bhk || 'Not specified'} BHK\n\n` +
      `${propertyList}\n\n` +
      `Type the property number (1-${properties.length}) for more information.`;
  }

  async handlePropertyMatchState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check if user wants to restart
    if (message.toLowerCase() === 'restart' ||
      message.toLowerCase() === 'पुन्हा सुरू करा') { // Added Marathi for 'restart'
      // Reset conversation to welcome state
      conversation.state = 'welcome';
      conversation.preferences = {};
      conversation.matchedProperties = [];
      conversation.selectedProperty = null;
      await conversation.save();

      // Return welcome message
      return this.getWelcomeMessage(conversation.language);
    }

    // Check if user has selected a property
    const propertyNumber = parseInt(message);
    if (isNaN(propertyNumber) ||
      propertyNumber < 1 ||
      propertyNumber > conversation.matchedProperties.length) {
      // Invalid property selection
      if (conversation.language === 'marathi') {
        return `कृपया वैध मालमत्ता क्रमांक निवडा (1-${conversation.matchedProperties.length}).`;
      }
      return `Please select a valid property number (1-${conversation.matchedProperties.length}).`;
    }

    // Get selected property
    const selectedPropertyId = conversation.matchedProperties[propertyNumber - 1];
    const property = await Property.findById(selectedPropertyId);

    if (!property) {
      if (conversation.language === 'marathi') {
        return 'माफ करा, निवडलेली मालमत्ता आढळली नाही. कृपया दुसरी मालमत्ता निवडा.';
      }
      return 'Sorry, the selected property was not found. Please select another property.';
    }

    // Save selected property
    conversation.selectedProperty = selectedPropertyId;
    conversation.state = 'schedule_visit';
    await conversation.save();

    // Format property details
    const propertyDetails = property.formatDetails(conversation.language);

    // Add options for scheduling a visit
    if (conversation.language === 'marathi') {
      return `${propertyDetails}\n\n` +
        `काय करू इच्छिता?\n\n` +
        `१. या मालमत्तेला भेट देण्यासाठी वेळ ठरवा\n` +
        `२. मालमत्ता यादीकडे परत जा\n\n` +
        `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (१-२).`;
    }

    return `${propertyDetails}\n\n` +
      `What would you like to do?\n\n` +
      `1. Schedule a visit to this property\n` +
      `2. Go back to property list\n\n` +
      `Reply with the number of your choice (1-2).`;
  }

  async handleScheduleVisitState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check user's choice
    if (message === '1') {
      // User wants to schedule a visit
      conversation.state = 'collect_info';
      conversation.userInfo = {}; // Initialize user info
      await conversation.save();

      // Ask for user's name
      if (conversation.language === 'marathi') {
        return 'उत्तम! आपल्या भेटीची व्यवस्था करण्यासाठी, आम्हाला काही माहिती हवी आहे.\n\nकृपया आपले पूर्ण नाव प्रदान करा.';
      }
      return 'Great! To arrange your visit, we need some information.\n\nPlease provide your full name.';
    } else if (message === '2') {
      // User wants to go back to property list
      conversation.state = 'property_match';
      conversation.selectedProperty = null;
      await conversation.save();

      // Show property list again
      const properties = await Property.find({
        _id: { $in: conversation.matchedProperties }
      });

      return this.generatePropertyMatchResponse(conversation, properties, conversation.language);
    } else {
      // Invalid choice
      if (conversation.language === 'marathi') {
        return 'कृपया वैध पर्याय निवडा (१-२).';
      }
      return 'Please select a valid option (1-2).';
    }
  }

  async handleCollectInfoState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    const userInfo = conversation.userInfo || {};

    // If we don't have name yet
    if (!userInfo.name) {
      // Save name
      conversation.userInfo = { ...userInfo, name: message.trim() };
      await conversation.save();

      // Ask for phone number
      if (conversation.language === 'marathi') {
        return 'धन्यवाद! कृपया आपला संपर्क क्रमांक प्रदान करा.';
      }
      return 'Thank you! Please provide your contact number.';
    }

    if (!userInfo.phone) {

      // Check if message contains a phone number (now handles both formats)
      const phoneMatch = message.match(/\d{10}/);
      let phoneNumber = null;

      // Check for Marathi format with prefix
      if (message.includes('फोन:') || message.includes('Phone:')) {
        const parts = message.split(/फोन:|Phone:/);
        if (parts.length > 1) {
          const potentialPhone = parts[1].trim().match(/\d{10}/);
          if (potentialPhone) {
            phoneNumber = potentialPhone[0];
          }
        }
      } else if (phoneMatch) {
        phoneNumber = phoneMatch[0];
      }

      if (!phoneNumber) {
        // Invalid phone number
        if (conversation.language === 'marathi') {
          return 'कृपया वैध 10-अंकी फोन नंबर प्रदान करा (उदा. ९८७६५४३२१० किंवा 9876543210).';
        }
        return 'Please provide a valid 10-digit phone number (e.g. ९८७६५४३२१० or 9876543210).';
      }

      // Save phone number
      conversation.userInfo = { ...userInfo, phone: phoneNumber };
      await conversation.save();

      // Ask for preferred time
      if (conversation.language === 'marathi') {
        return 'धन्यवाद! कृपया आपली पसंतीची भेटीची तारीख आणि वेळ प्रदान करा (उदा. "Tomorrow at 2 PM" किंवा "Saturday at 11 AM").';
      }
      return 'Thank you! Please provide your preferred date and time for the visit (e.g., "Tomorrow at 2 PM" or "Saturday at 11 AM").';
    }

    // If we have name and phone but no preferred time
    if (!userInfo.preferredTime) {
      // Extract date and time from user message
      const Helpers = require('../utils/helpers');
      const extractedDate = Helpers.extractDate(message);
      const extractedTime = Helpers.extractTime(message);

      // If user didn't provide date or time, ask again
      if (!extractedDate || !extractedTime) {
        if (conversation.language === 'marathi') {
          return 'कृपया भेटीसाठी तारीख आणि वेळ स्पष्टपणे नमूद करा (उदा. "Tomorrow at 2 PM" किंवा "Saturday at 11 AM").';
        }
        return 'Please specify a clear date and time for your visit (e.g., "Tomorrow at 2 PM" or "Saturday at 11 AM").';
      }

      // Parse the date and time (simplified version - in a real app, use a date parsing library)
      let preferredDate = new Date();

      // Handle common date patterns
      if (extractedDate.toLowerCase().includes('tomorrow')) {
        preferredDate.setDate(preferredDate.getDate() + 1);
      } else if (extractedDate.toLowerCase().includes('next week')) {
        preferredDate.setDate(preferredDate.getDate() + 7);
      } else if (extractedDate.toLowerCase().match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)) {
        // Simple weekday handling - in a real app, use a more robust solution
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = preferredDate.getDay();
        const targetDay = weekdays.indexOf(extractedDate.toLowerCase().match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)[0]);
        let daysToAdd = targetDay - today;
        if (daysToAdd <= 0) daysToAdd += 7; // Next week if day has passed
        preferredDate.setDate(preferredDate.getDate() + daysToAdd);
      }

      // Handle time patterns
      if (extractedTime) {
        const hourMatch = extractedTime.match(/(\d{1,2})/);
        let hour = parseInt(hourMatch[0]);

        // Handle AM/PM
        if (extractedTime.toLowerCase().includes('pm') && hour < 12) {
          hour += 12;
        } else if (extractedTime.toLowerCase().includes('am') && hour === 12) {
          hour = 0;
        }

        // Set the hour
        preferredDate.setHours(hour);

        // Handle minutes if present
        const minuteMatch = extractedTime.match(/:([0-5][0-9])/);
        if (minuteMatch) {
          preferredDate.setMinutes(parseInt(minuteMatch[1]));
        } else {
          preferredDate.setMinutes(0);
        }
      }

      // Format the time for display
      const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
      const formattedTime = preferredDate.toLocaleDateString(
        conversation.language === 'marathi' ? 'mr-IN' : 'en-US',
        options
      );

      // Save preferred time
      conversation.userInfo = { ...userInfo, preferredTime: preferredDate };
      await conversation.save();

      // Ask for special requirements
      if (conversation.language === 'marathi') {
        return `छान! 📅 आपली भेट ${formattedTime} साठी निश्चित केली गेली आहे.\n\n` +
          `आपल्या भेटीसाठी आपल्याकडे काही विशेष आवश्यकता किंवा प्रश्न आहेत का? उदाहरणार्थ:\n\n` +
          `१. कोणत्याही विशेष आवश्यकता नाहीत\n` +
          `२. वित्तपुरवठा पर्यायांबद्दल माहिती हवी आहे\n` +
          `३. जवळपासच्या सुविधांमध्ये स्वारस्य आहे\n` +
          `४. नूतनीकरण शक्यतांबद्दल चर्चा करू इच्छिता\n` +
          `५. इतर (कृपया निर्दिष्ट करा)\n\n` +
          `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (१-५).`;
      }

      return `Great! 📅 Your visit has been scheduled for ${formattedTime}.\n\n` +
        `Do you have any special requirements or questions for your visit? For example:\n\n` +
        `1. No special requirements\n` +
        `2. Need information about financing options\n` +
        `3. Interested in nearby amenities\n` +
        `4. Want to discuss renovation possibilities\n` +
        `5. Other (please specify)\n\n` +
        `Reply with the number of your choice (1-5).`;
    }

    // If we have name, phone, time but no special requirements
    if (!userInfo.specialRequirements) {
      // Check if this is a valid selection or custom message
      if (message.match(/^[1-5]$/)) {
        const requirementChoice = parseInt(message.trim());
        let specialRequirements = '';

        if (conversation.language === 'marathi') {
          switch (requirementChoice) {
            case 1:
              specialRequirements = 'कोणत्याही विशेष आवश्यकता नाहीत';
              break;
            case 2:
              specialRequirements = 'वित्तपुरवठा पर्यायांबद्दल माहिती हवी आहे';
              break;
            case 3:
              specialRequirements = 'जवळपासच्या सुविधांमध्ये स्वारस्य आहे';
              break;
            case 4:
              specialRequirements = 'नूतनीकरण शक्यतांबद्दल चर्चा करू इच्छिता';
              break;
            case 5:
              // For 'Other', we'll ask for specifics
              conversation.userInfo = { ...userInfo, awaitingSpecialRequirements: true };
              await conversation.save();
              return 'कृपया आपल्या विशेष आवश्यकता किंवा प्रश्न तपशीलवार सांगा.';
          }
        } else {
          switch (requirementChoice) {
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
              conversation.userInfo = { ...userInfo, awaitingSpecialRequirements: true };
              await conversation.save();
              return `Please briefly describe your specific requirements or questions:`;
            default:
              return `Please select a valid option (1-5).`;
          }
        }

        // Save special requirements and complete the process
        conversation.userInfo = { ...userInfo, specialRequirements };
        conversation.state = 'completed';
        await conversation.save();

        // Create appointment in database
        await this.createAppointment(conversation);

        // Generate confirmation with enhanced details
        return this.generateEnhancedConfirmation(conversation, conversation.language);
      } else if (message.length > 0) {
        // User provided custom requirements (after selecting option 5)
        conversation.userInfo = { ...userInfo, specialRequirements: message.trim() };
        conversation.state = 'completed';
        await conversation.save();

        // Create appointment in database
        await this.createAppointment(conversation);

        // Generate confirmation with enhanced details
        return this.generateEnhancedConfirmation(conversation, conversation.language);
      } else {
        // Invalid input for special requirements
        if (conversation.language === 'marathi') {
          return `कृपया एक पर्याय (१-५) निवडा किंवा आपल्या विशिष्ट आवश्यकता प्रदान करा:`;
        }
        return `Please select an option (1-5) or provide your specific requirements:`;
      }
    }

    // This should not happen, but just in case
    if (conversation.language === 'marathi') {
      return `मला खात्री नाही की आपण कोणती माहिती देत आहात. आपल्या अपॉइंटमेंट तपशीलांसह पुन्हा सुरू करूया.\n\n` +
        `कृपया आपले पूर्ण नाव प्रदान करा.`;
    }
    return `I'm not sure what information you're providing. Let's start over with your appointment details.\n\n` +
      `Please provide your full name.`;
  }

  // Generate enhanced confirmation message
  async generateEnhancedConfirmation(conversation, language = 'english') {
    try {
      // Get property details
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        throw new Error('Property not found');
      }

      // Format the date for display
      const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
      const formattedTime = conversation.userInfo.preferredTime.toLocaleDateString(
        language === 'marathi' ? 'mr-IN' : 'en-US',
        options
      );

      // Get agent details
      const agent = property.agent;

      // Create a personalized confirmation message
      let confirmationMessage = '';

      if (language === 'marathi') {
        // Marathi confirmation message
        confirmationMessage = `✅ *मालपुरे ग्रुपसह बुकिंग कन्फर्म झाले!*\n\n`;

        // Add personalized greeting
        confirmationMessage += `प्रिय ${conversation.userInfo.name},\n\n`;

        // Add appointment details
        confirmationMessage += `*${property.title}* पाहण्यासाठी आपली भेट *${formattedTime}* साठी निश्चित केली गेली आहे.\n\n`;

        // Add property details
        confirmationMessage += `*मालमत्ता तपशील:*\n`;
        confirmationMessage += `📍 ${property.location}\n`;
        confirmationMessage += `💰 ₹${property.price.toLocaleString('en-IN')}\n`;

        // Translate property type to Marathi
        let propertyType = '';
        switch (property.type.toLowerCase()) {
          case 'apartment':
            propertyType = 'अपार्टमेंट';
            break;
          case 'villa':
            propertyType = 'विला';
            break;
          case 'house':
            propertyType = 'घर';
            break;
          case 'plot':
            propertyType = 'प्लॉट';
            break;
          default:
            propertyType = property.type;
        }

        confirmationMessage += `🏢 ${propertyType}\n`;
        confirmationMessage += `🛏️ ${property.bedrooms} बेडरूम\n`;
        confirmationMessage += `🚿 ${property.bathrooms} बाथरूम\n`;
        confirmationMessage += `📐 ${property.area.value} ${property.area.unit}\n\n`;

        // Add agent details
        confirmationMessage += `*आपला समर्पित एजंट:*\n`;
        confirmationMessage += `👤 ${agent.name}\n`;
        confirmationMessage += `📱 ${agent.phone}\n\n`;

        // Add special requirements if any
        if (conversation.userInfo.specialRequirements &&
          conversation.userInfo.specialRequirements !== 'कोणत्याही विशेष आवश्यकता नाहीत') {
          confirmationMessage += `*विशेष आवश्यकता:*\n`;
          confirmationMessage += `✏️ ${conversation.userInfo.specialRequirements}\n\n`;
        }

        // Add next steps
        confirmationMessage += `आमचा एजंट तपशील पुष्टी करण्यासाठी लवकरच ${conversation.userInfo.phone} वर संपर्क साधेल.\n\n`;

        // Add what's next options
        confirmationMessage += `*आपण पुढे काय करू इच्छिता?*\n\n`;
        confirmationMessage += `१. नवीन मालमत्ता शोध सुरू करा\n`;
        confirmationMessage += `२. अपॉइंटमेंट तपशील पहा\n`;
        confirmationMessage += `३. संभाषण संपवा\n\n`;
        confirmationMessage += `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (१-३).`;
      } else {
        // English confirmation message
        confirmationMessage = `✅ *Booking Confirmed with Malpure Group!*\n\n`;

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
      }

      return confirmationMessage;
    } catch (error) {
      console.error('Error generating confirmation:', error);
      if (language === 'marathi') {
        return 'माफ करा, पुष्टीकरण संदेश तयार करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.';
      }
      return 'Sorry, there was an error generating the confirmation message. Please try again.';
    }
  }

  async createAppointment(conversation) {
    try {
      // Create appointment using appointment service
      const appointment = await this.appointmentService.createAppointment({
        userId: conversation.userId,
        propertyId: conversation.selectedProperty,
        name: conversation.userInfo.name,
        phone: conversation.userInfo.phone,
        preferredTime: conversation.userInfo.preferredTime,
        specialRequirements: conversation.userInfo.specialRequirements || 'None',
        status: 'scheduled'
      });

      // Store appointment ID in conversation for reference
      conversation.appointmentId = appointment._id;
      await conversation.save();

      return true;
    } catch (error) {
      console.error('Error creating appointment:', error);
      return false;
    }
  }

  // Provide context-aware help messages based on conversation state
  getHelpMessage(language, state) {
    if (language === 'marathi') {
      // Marathi help messages
      switch (state) {
        case 'language_selection':
          return 'आपण भाषा निवडत आहात. कृपया 1 (इंग्रजी) किंवा 2 (मराठी) निवडा.';
        case 'welcome':
          return 'आपले स्वागत आहे! पुढे जाण्यासाठी 1 टाइप करा.';
        case 'location':
          return 'आपण स्थान निवडत आहात. कृपया 1-4 मधील एक क्रमांक निवडा किंवा "restart" टाइप करा.';
        case 'budget':
          return 'आपण बजेट श्रेणी निवडत आहात. कृपया 1-5 मधील एक क्रमांक निवडा.';
        case 'bhk':
          return 'आपण बेडरूमची संख्या निवडत आहात. कृपया 1-5 मधील एक क्रमांक निवडा.';
        case 'property_match':
          return 'आपण मालमत्ता पाहत आहात. अधिक माहितीसाठी मालमत्ता क्रमांक निवडा किंवा "restart" टाइप करा.';
        case 'schedule_visit':
          return 'आपण भेट ठरवत आहात. भेट ठरवण्यासाठी 1 निवडा किंवा मालमत्ता यादीकडे परत जाण्यासाठी 2 निवडा.';
        case 'collect_info':
          return 'आपण भेटीसाठी माहिती प्रदान करत आहात. कृपया विनंती केलेली माहिती प्रदान करा.';
        case 'completed':
          return 'आपली भेट ठरली आहे. नवीन शोध सुरू करण्यासाठी 1, अपॉइंटमेंट तपशील पाहण्यासाठी 2, किंवा संभाषण संपवण्यासाठी 3 टाइप करा.';
        default:
          return 'मदतीसाठी, आपण "restart" टाइप करू शकता किंवा "भाषा बदला" टाइप करून भाषा बदलू शकता.';
      }
    } else {
      // English help messages
      switch (state) {
        case 'language_selection':
          return 'You are selecting a language. Please choose 1 (English) or 2 (Marathi).';
        case 'welcome':
          return 'Welcome! Type 1 to continue.';
        case 'location':
          return 'You are selecting a location. Please choose a number from 1-4 or type "restart".';
        case 'budget':
          return 'You are selecting a budget range. Please choose a number from 1-5.';
        case 'bhk':
          return 'You are selecting the number of bedrooms. Please choose a number from 1-5.';
        case 'property_match':
          return 'You are viewing properties. Select a property number for more details or type "restart".';
        case 'schedule_visit':
          return 'You are scheduling a visit. Choose 1 to schedule a visit or 2 to go back to the property list.';
        case 'collect_info':
          return 'You are providing information for your visit. Please provide the requested information.';
        case 'completed':
          return 'Your visit has been scheduled. Type 1 to start a new search, 2 to view appointment details, or 3 to end the conversation.';
        default:
          return 'For help, you can type "restart" at any time or "change language" to switch languages.';
      }
    }
  }

  async handleCompletedState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check user's choice for next steps
    if (message === '1') {
      // User wants to start a new property search
      conversation.state = 'welcome';
      conversation.preferences = {};
      conversation.matchedProperties = [];
      conversation.selectedProperty = null;
      conversation.userInfo = {};
      // Keep the appointmentId for reference
      await conversation.save();

      // Return welcome message
      return this.getWelcomeMessage(conversation.language);
    } else if (message === '2') {
      // User wants to view appointment details
      let appointment;
      let property;

      // Try to get appointment details from stored appointmentId
      if (conversation.appointmentId) {
        try {
          appointment = await this.appointmentService.getAppointment(conversation.appointmentId);
          property = appointment.propertyId; // This is populated by the getAppointment method
        } catch (error) {
          console.error('Error retrieving appointment:', error);
          // Fall back to using the selectedProperty if appointment retrieval fails
        }
      }

      // If appointment not found, fall back to using the conversation data
      if (!property) {
        property = await Property.findById(conversation.selectedProperty);
      }

      if (!property) {
        if (conversation.language === 'marathi') {
          return 'माफ करा, अपॉइंटमेंट तपशील आढळले नाहीत. नवीन शोध सुरू करण्यासाठी १ टाइप करा.';
        }
        return 'Sorry, appointment details not found. Type 1 to start a new search.';
      }

      // Get the date/time - either from appointment or from conversation
      const dateTime = appointment ? appointment.dateTime : conversation.userInfo.preferredTime;

      // Format the date for display
      const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
      const formattedTime = dateTime.toLocaleDateString(
        conversation.language === 'marathi' ? 'mr-IN' : 'en-US',
        options
      );

      // Get appointment status if available
      const status = appointment ? appointment.status : 'scheduled';
      const statusText = conversation.language === 'marathi'
        ? this.getAppointmentStatusInMarathi(status)
        : this.getAppointmentStatusInEnglish(status);

      if (conversation.language === 'marathi') {
        return `📅 *अपॉइंटमेंट तपशील*\n\n` +
          `मालमत्ता: ${property.title}\n` +
          `स्थान: ${property.location}\n` +
          `तारीख/वेळ: ${formattedTime}\n` +
          `स्थिती: ${statusText}\n` +
          `संदर्भ क्र.: ${conversation.appointmentId || 'उपलब्ध नाही'}\n\n` +
          `आम्ही आपल्याला पुढील दस्तऐवज पाठवू:\n` +
          `- मालमत्ता ब्रोशर\n` +
          `- फ्लोअर प्लॅन\n` +
          `- स्थान फायदे\n` +
          `- पेमेंट प्लॅन\n\n` +
          `हे आपल्याला WhatsApp किंवा ईमेल द्वारे पाठवले जातील. आपल्याला कोणत्या विशिष्ट दस्तऐवजामध्ये सर्वाधिक स्वारस्य आहे?\n\n` +
          `१. नवीन मालमत्ता शोध सुरू करा\n` +
          `२. अपॉइंटमेंट तपशील पहा\n` +
          `३. संभाषण संपवा\n\n` +
          `आपल्या निवडीच्या क्रमांकासह उत्तर द्या.`;
      }

      return `📅 *Appointment Details*\n\n` +
        `Property: ${property.title}\n` +
        `Location: ${property.location}\n` +
        `Date/Time: ${formattedTime}\n` +
        `Status: ${statusText}\n` +
        `Reference #: ${conversation.appointmentId || 'Not available'}\n\n` +
        `We'll be sending you the following documents:\n` +
        `- Property brochure\n` +
        `- Floor plans\n` +
        `- Location advantages\n` +
        `- Payment plans\n\n` +
        `These will be sent to you via WhatsApp or email. Is there a specific document you're most interested in?\n\n` +
        `1. Start a new property search\n` +
        `2. View appointment details\n` +
        `3. End conversation\n\n` +
        `Reply with the number of your choice.`;
    } else if (message.toLowerCase() === 'change language' || message.toLowerCase() === 'भाषा बदला') {
      // User wants to change language
      conversation.state = 'language_selection';
      await conversation.save();
      return 'Welcome to Malpure Group! 🏠\n\nPlease select your preferred language:\n\n1. English\n2. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.';
    } else {
      // User wants to end conversation
      if (conversation.language === 'marathi') {
        return `मालपुरे ग्रुप निवडल्याबद्दल धन्यवाद! 🙏\n\n` +
          `आपली मालमत्ता पाहण्याची व्यवस्था केली गेली आहे, आणि आमचा एजंट लवकरच आपल्याशी संपर्क साधेल.\n\n` +
          `आपल्याकडे आपल्या अपॉइंटमेंटबद्दल काही प्रश्न असल्यास किंवा भविष्यात अधिक मालमत्ता शोधू इच्छित असल्यास, आम्हाला पुन्हा संदेश द्या.\n\n` +
          `जर तुम्हाला नवीन संभाषण सुरू करायचे असल्यास, 'restart' असे टाइप करा.\n\n` +
          `आम्ही आपल्याला आपले स्वप्नातील घर शोधण्यास मदत करण्यास उत्सुक आहोत! 🏡✨\n\n` +
          `आपला दिवस शुभ असो! 👋`;
      }

      return `Thank you for choosing Malpure Group for your property search! 🙏\n\n` +
        `Your property viewing has been scheduled, and our agent will contact you shortly.\n\n` +
        `If you have any questions about your appointment or would like to search for more properties in the future, just message us again.\n\n` +
        `If you’d like to start a new conversation, simply type 'restart'.\n\n` +
        `We look forward to helping you find your dream property! 🏡✨\n\n` +
        `Have a great day! 👋`;
    }
  }

  async handleCompletedState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);

    // If already in document selection phase, handle document choices
    if (conversation.documentSelectionPhase) {
      switch (message) {
        case '1': // Property Brochure
          await this.sendPropertyDocument(conversation, 'brochure');
          conversation.documentSelectionPhase = false;
          await conversation.save();
          return this.getFinalMessage(conversation.language);

        case '2': // Floor Plans
          await this.sendPropertyDocument(conversation, 'floor_plans');
          conversation.documentSelectionPhase = false;
          await conversation.save();
          return this.getFinalMessage(conversation.language);

        case '3': // Images
          await this.sendPropertyImages(conversation);
          conversation.documentSelectionPhase = false;
          await conversation.save();
          return this.getFinalMessage(conversation.language);

        case '4': // None
          conversation.documentSelectionPhase = false;
          await conversation.save();
          return this.getFinalMessage(conversation.language);

        default:
          return this.getDocumentOptionsMessage(conversation); // Show options again if invalid
      }
    }

    // If NOT in document selection phase, handle main menu options
    switch (message) {
      case '1': // User wants brochure (directly send, no extra menu)
        await this.sendPropertyDocument(conversation, 'brochure');
        return this.getFinalMessage(conversation.language);

      case '2':
        await this.sendPropertyDocument(conversation, 'floor_plans');
        return this.getFinalMessage(conversation.language);

      case '3':
        await this.sendPropertyDocument(conversation, 'images');
        return this.getFinalMessage(conversation.language);

      case '4':
        conversation.documentSelectionPhase = false;
        await conversation.save();
        return this.getFinalMessage(conversation.language);

      case 'change language':
      case 'भाषा बदला':
        conversation.state = 'language_selection';
        await conversation.save();
        return 'Welcome to Malpure Group! 🏠\n\nPlease select your preferred language:\n\n1. English\n2. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.';

      default:
        return this.getFinalMessage(conversation.language);
    }
  }
  // Helper method to get document options message
  getDocumentOptionsMessage(conversation) {
    if (conversation.language === 'marathi') {
      return `कृपया आपल्याला हवा असलेला दस्तऐवज निवडा:\n\n` +
        `१. मालमत्ता ब्रोशर (PDF)\n` +
        `२. फ्लोअर प्लॅन (PDF)\n` +
        `३. मालमत्ता चित्रे\n` +
        `४. काहीही नको\n\n` +
        `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (1-4).`;
    }

    return `Please select which document you would like to receive:\n\n` +
      `1. Property Brochure (PDF)\n` +
      `2. Floor Plans (PDF)\n` +
      `3. Property Images\n` +
      `4. None\n\n` +
      `Reply with the number of your choice (1-4).`;
  }


  // Helper method to send property document
  async sendPropertyDocument(conversation, documentType) {
    try {
      let documentPath, documentName, displayName, documentUrl;

      if (documentType === 'brochure') {
        documentPath = 'https://demo.twilio.com/owl.png';
        documentUrl = 'https://surl.li/xmbbzt';
        documentName = 'Property_Brochure.pdf';
        displayName = conversation.language === 'marathi' ? 'मालमत्ता ब्रोशर' : 'Property Brochure';
      } else if (documentType === 'floor_plans') {
        documentPath = 'https://demo.twilio.com/owl.png';
        documentUrl = 'https://surl.li/xmbbzt';
        documentName = 'Floor_Plans.pdf';
        displayName = conversation.language === 'marathi' ? 'फ्लोअर प्लॅन' : 'Floor Plans';
      } else if (documentType === 'images') {
        documentPath = 'https://demo.twilio.com/owl.png';
        documentUrl = 'https://surl.li/xmbbzt';
        documentName = 'Property_Images.zip';
        displayName = conversation.language === 'marathi' ? 'मालमत्ता चित्रे' : 'Property Images';
      } else {
        throw new Error('Invalid document type');
      }

      const messageBody = conversation.language === 'marathi'
        ? `📄 ${displayName}\n\nकृपया खालील लिंकवरून दस्तऐवज डाउनलोड करा:\n${documentUrl}`
        : `📄 ${displayName}\n\nPlease download the document using the link below:\n${documentUrl}`;

      // Send message with document
      await this.whatsappService.sendMessage(
        conversation.userId,
        messageBody,
        documentPath
      );

    } catch (error) {
      console.error(`Error sending ${documentType}:`, error);
      return this.getErrorMessage(conversation.language);
    }
  }


  getDocumentNotAvailableMessage(language, documentType) {
    const docNames = {
      brochure: { english: 'brochure', marathi: 'ब्रोशर' },
      floor_plans: { english: 'floor plans', marathi: 'फ्लोअर प्लॅन' }
    };

    const localizedDocName = docNames[documentType]?.[language] || docNames[documentType]?.english;

    if (language === 'marathi') {
      return `क्षमस्व, ${localizedDocName} सध्या उपलब्ध नाही. कृपया नंतर पुन्हा प्रयत्न करा.`;
    }
    return `Sorry, the ${localizedDocName} is not available. Please try again later.`;
  }

  getErrorMessage(language, technicalDetail = '') {
    const messages = {
      english: `There was an error. ${technicalDetail ? `(Technical: ${technicalDetail})` : 'Please try again later.'}`,
      marathi: `त्रुटी आली. ${technicalDetail ? `(तांत्रिक माहिती: ${technicalDetail})` : 'कृपया नंतर पुन्हा प्रयत्न करा.'}`
    };

    return messages[language] || messages.english;
  }

  // Helper method for final message
  getFinalMessage(language) {
    if (language === 'marathi') {
      return `मालपुरे ग्रुप निवडल्याबद्दल धन्यवाद! 🙏\n\n` +
        `जर तुम्हाला नवीन संभाषण सुरू करायचे असल्यास, 'restart' असे टाइप करा.\n\n` +
        `जर तुम्हाला भाषा बदलायची असल्यास, 'भाषा बदला' असे टाइप करा.\n\n` +
        `आपला दिवस शुभ असो! 👋`;
    }

    return `Thank you for choosing Malpure Group! 🙏\n\n` +
      `If you'd like to start a new conversation, simply type 'restart'.\n\n` +
      `If you'd like to switch languages, simply type "change language" to switch languages..\n\n` +
      `Have a great day! 👋`;
  }

  // Helper methods for appointment status translation
  getAppointmentStatusInEnglish(status) {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'confirmed': return 'Confirmed';
      case 'cancelled': return 'Cancelled';
      case 'completed': return 'Completed';
      default: return 'Scheduled';
    }
  }

  getAppointmentStatusInMarathi(status) {
    switch (status) {
      case 'scheduled': return 'निश्चित केले';
      case 'confirmed': return 'पुष्टी केली';
      case 'cancelled': return 'रद्द केले';
      case 'completed': return 'पूर्ण झाले';
      default: return 'निश्चित केले';
    }
  }
}

module.exports = ConversationService;