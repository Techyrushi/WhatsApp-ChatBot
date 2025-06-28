const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Property = require("../models/Property");
const AIService = require("./aiService");
const WhatsAppService = require("./whatsappService");
const AppointmentService = require("./appointmentService");

// Define Conversation Schema
const conversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    state: {
      type: String,
      enum: [
        "language_selection",
        "welcome",
        "property_type",
        "property_match",
        "schedule_visit",
        "collect_info",
        "completed",
      ],
      default: "language_selection",
    },
    language: {
      type: String,
      enum: ["english", "marathi"],
      default: "english",
    },
    preferences: {
      propertyType: { type: String }, // office_purchase, office_lease, shop_lease
    },
    matchedProperties: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    ],
    selectedProperty: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
    userInfo: {
      name: { type: String },
      phone: { type: String },
      preferredTime: { type: Date },
      specialRequirements: { type: String },
      awaitingSpecialRequirements: { type: Boolean, default: false },
    },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    lastMessageTimestamp: { type: Date, default: Date.now },
    documentSelectionPhase: { type: Boolean, default: false },
    viewingAppointmentDetails: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Create Conversation Model if it doesn't exist
const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

class ConversationService {
  constructor() {
    this.aiService = new AIService();
    this.whatsappService = new WhatsAppService();
    this.appointmentService = new AppointmentService();
  }

  // Utility function to convert Marathi numerals to Arabic
  async convertMarathiToArabicNumerals(input) {
    const marathiToArabic = {
      "०": "0",
      "१": "1",
      "२": "2",
      "३": "3",
      "४": "4",
      "५": "5",
      "६": "6",
      "७": "7",
      "८": "8",
      "९": "9",
    };

    if (typeof input === "string") {
      return input
        .split("")
        .map((char) => marathiToArabic[char] || char)
        .join("");
    }
    return input;
  }

  async processMessage(sender, message, mediaUrl = null, mediaType = null) {
    try {
      let conversation = await this.getOrCreateConversation(sender);

      let response;

      if (mediaUrl && mediaType) {
        response = await this.handleMediaMessage(
          conversation,
          mediaUrl,
          mediaType,
          message
        );
      } else {
        response = await this.handleConversationState(conversation, message);
      }

      conversation.lastMessageTimestamp = new Date();
      await conversation.save();

      return response;
    } catch (error) {
      console.error("Error processing message:", error);
      return "Sorry, I encountered an error. Please try again later.";
    }
  }

  async getOrCreateConversation(userId) {
    try {
      let conversation = await Conversation.findOne({ userId });

      if (!conversation) {
        conversation = new Conversation({
          userId,
          state: "language_selection",
          language: "english",
          preferences: {},
        });
        await conversation.save();
      }

      return conversation;
    } catch (error) {
      console.error("Error getting/creating conversation:", error);
      throw error;
    }
  }

  async handleConversationState(conversation, message) {
    // Check for global commands first
    if (
      message.toLowerCase() === "change language" ||
      message.toLowerCase() === "भाषा बदला"
    ) {
      conversation.state = "language_selection";
      await conversation.save();
      return "Welcome to MALPURE GROUP! 🏢\n\nPlease select your preferred language:\n1️⃣. English\n2️⃣. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.";
    }

    if (
      message.toLowerCase() === "restart" ||
      message.toLowerCase() === "पुन्हा सुरू करा" ||
      message.toLowerCase() === "start over" ||
      message.toLowerCase() === "new search" ||
      message.toLowerCase() === "main menu" ||
      message.toLowerCase() === "मुख्य मेनू"
    ) {
      conversation.state = "welcome";
      conversation.preferences = {};
      conversation.matchedProperties = [];
      conversation.selectedProperty = null;
      await conversation.save();
      return this.getWelcomeMessage(conversation.language);
    }

    if (message.toLowerCase() === "help" || message.toLowerCase() === "मदत") {
      return this.getHelpMessage(conversation.language, conversation.state);
    }

    // Check for conversation timeout
    const now = new Date();
    const lastMessageTime = conversation.lastMessageTimestamp || now;
    const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60);

    if (hoursSinceLastMessage > 24) {
      conversation.state = "welcome";
      conversation.preferences = {};
      await conversation.save();
      return this.getWelcomeMessage(conversation.language);
    }

    const state = conversation.state;
    let response;

    switch (state) {
      case "language_selection":
        response = await this.handleLanguageSelectionState(
          conversation,
          message
        );
        break;
      case "welcome":
        response = await this.handleWelcomeState(conversation, message);
        break;
      case "property_type":
        response = await this.handlePropertyTypeState(conversation, message);
        break;
      case "property_match":
        response = await this.handlePropertyMatchState(conversation, message);
        break;
      case "schedule_visit":
        response = await this.handleScheduleVisitState(conversation, message);
        break;
      case "collect_info":
        response = await this.handleCollectInfoState(conversation, message);
        break;
      case "completed":
        response = await this.handleCompletedState(conversation, message);
        break;
      default:
        response = "I'm not sure how to respond to that. Let's start over.";
        conversation.state = "language_selection";
        await conversation.save();
    }

    return response;
  }

  async handleLanguageSelectionState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);

    if (message && message.match(/^[1-2]$/)) {
      const languageChoice = parseInt(message);

      if (languageChoice === 1) {
        conversation.language = "english";
      } else if (languageChoice === 2) {
        conversation.language = "marathi";
      }

      conversation.state = "welcome";
      await conversation.save();

      return this.getWelcomeMessage(conversation.language);
    }

    return "Welcome to MALPURE GROUP! 🏢\n\nPlease select your preferred language:\n\n1️⃣. English\n2️⃣. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.";
  }

  getWelcomeMessage(language) {
    if (language === "marathi") {
      return "मालपुरे ग्रुपशी जोडल्याबद्दल धन्यवाद! 🏢\n\nआमच्या प्रीमियम कमर्शियल प्रोजेक्टची माहिती:\n\nप्रोजेक्ट: आशीर्वाद बाय मालपुरे ग्रुप\nस्थान: ठटे नगर, कॉलेज रोड, नाशिक\n✅ RERA नोंदणीकृत | वापरासाठी तयार | NMC पूर्णता प्रमाणपत्र\nपुरेशी पार्किंग | दुकाने फ्रंटेजसह | प्रीमियम ऑफिस युनिट्स\n\n.निवड प्रक्रिया सुरू करण्यासाठी, कृपया आपण फक्त क्रमांक 1️⃣ सह उत्तर द्या.";
    }

    return "Thank you for connecting with MALPURE GROUP! 🏢\n\nHere's our premium commercial project overview:\n\nProject: AASHIRWAD by Malpure Group\nLocation: Thatte Nagar, College Road, Nashik\n✅ RERA Registered | Ready-to-use | NMC Completion Certificate\nAmple Parking | Shops with Frontage | Premium Office Units\n\nPlease choose what you're looking for\nTo get started, Please reply with just the number 1️⃣ to continue.";
  }

  async handleWelcomeState(conversation, message) {
    conversation.state = "property_type";
    await conversation.save();
    return this.getPropertyTypeOptionsMessage(conversation.language);
  }

  getPropertyTypeOptionsMessage(language) {
    if (language === "marathi") {
      return "कृपया आपण स्वारस्य असलेले प्रकार निवडा:\n\n1️⃣. ऑफिस खरेदीमध्ये स्वारस्य\n2️⃣. ऑफिस भाड्याने घेण्यासाठी स्वारस्य\n3️⃣. दुकान भाड्याने घेण्यासाठी स्वारस्य\n\nआपला पर्याय निवडण्यासाठी फक्त क्रमांक (१-३) सह उत्तर द्या.";
    }

    return "Please choose what you're looking for:\n\n1️⃣. Interested in Office Purchase\n2️⃣. Interested in Office Leasing\n3️⃣. Interested in Shop Leasing\n\nReply with just the number (1-3) to select your option.";
  }

  async handlePropertyTypeState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    const propertyTypes = ["office_purchase", "office_lease", "shop_lease"];

    if (!message.match(/^[1-3]$/)) {
      return this.getPropertyTypeOptionsMessage(conversation.language);
    }

    const typeIndex = parseInt(message) - 1;
    const selectedType = propertyTypes[typeIndex];

    conversation.preferences.propertyType = selectedType;
    conversation.state = "property_match";
    await conversation.save();

    const matchingProperties = await this.findMatchingProperties(
      conversation.preferences
    );

    conversation.matchedProperties = matchingProperties.map((p) => p._id);
    await conversation.save();

    return this.generatePropertyMatchResponse(
      conversation,
      matchingProperties,
      conversation.language
    );
  }

  async findMatchingProperties(preferences) {
    try {
      // Base query - only commercial properties that are available
      const query = {
        type: "commercial",
        availability: "available",
      };

      // Add filters based on selected property type
      switch (preferences.propertyType) {
        case "office_purchase":
          query.subType = "office";
          query.forSale = true;
          break;
        case "office_lease":
          query.subType = "office";
          query.forLease = true;
          break;
        case "shop_lease":
          query.subType = "shop";
          query.forLease = true;
          break;
      }

      console.log("Executing property query:", JSON.stringify(query));

      // Find matching properties
      const properties = await Property.find(query)
        .sort({ isPromoted: -1, price: 1 })
        .limit(5);

      console.log(`Found ${properties.length} matching properties`);
      return properties;
    } catch (error) {
      console.error("Error in findMatchingProperties:", error);
      return [];
    }
  }

  async generatePropertyMatchResponse(conversation, properties, language) {
    if (!properties || properties.length === 0) {
      if (language === "marathi") {
        return `मला आपल्या निकषांशी जुळणारी कोणतीही मालमत्ता सापडली नाही. आपण वेगळ्या प्राधान्यांसह प्रयत्न करू इच्छिता? नवीन शोध सुरू करण्यासाठी 'restart' किंवा 'पुन्हा सुरू करा' उत्तर द्या.`;
      }
      return `I couldn't find any properties matching your criteria. Would you like to try with different preferences? Reply 'restart' to begin a new search.`;
    }

    const propertyList = properties
      .map((property, index) => property.formatForList(index + 1))
      .join("\n\n");

    if (language === "marathi") {
      return (
        `🏢 *आपल्या निकषांशी जुळणाऱ्या ${properties.length} मालमत्ता सापडल्या!*\n\n` +
        `${propertyList}\n\n` +
        `अधिक माहितीसाठी मालमत्तेचा क्रमांक टाइप करा (1-${properties.length}).`
      );
    }

    return (
      `🏢 *Found ${properties.length} properties matching your criteria!*\n\n` +
      `${propertyList}\n\n` +
      `Type the property number (1-${properties.length}) for more information.`
    );
  }

  async handlePropertyMatchState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check if user wants to restart
    if (
      message.toLowerCase() === "restart" ||
      message.toLowerCase() === "पुन्हा सुरू करा"
    ) {
      // Added Marathi for 'restart'
      // Reset conversation to welcome state
      conversation.state = "welcome";
      conversation.preferences = {};
      conversation.matchedProperties = [];
      conversation.selectedProperty = null;
      await conversation.save();

      // Return welcome message
      return this.getWelcomeMessage(conversation.language);
    }

    // Check if user has selected a property
    const propertyNumber = parseInt(message);
    if (
      isNaN(propertyNumber) ||
      propertyNumber < 1 ||
      propertyNumber > conversation.matchedProperties.length
    ) {
      // Invalid property selection
      if (conversation.language === "marathi") {
        return `कृपया वैध मालमत्ता क्रमांक निवडा (1-${conversation.matchedProperties.length}).`;
      }
      return `Please select a valid property number (1-${conversation.matchedProperties.length}).`;
    }

    // Get selected property
    const selectedPropertyId =
      conversation.matchedProperties[propertyNumber - 1];
    const property = await Property.findById(selectedPropertyId);

    if (!property) {
      if (conversation.language === "marathi") {
        return "माफ करा, निवडलेली मालमत्ता आढळली नाही. कृपया दुसरी मालमत्ता निवडा.";
      }
      return "Sorry, the selected property was not found. Please select another property.";
    }

    // Save selected property
    conversation.selectedProperty = selectedPropertyId;
    conversation.state = "schedule_visit";
    await conversation.save();

    // Format property details
    const propertyDetails = property.formatDetails(conversation.language);

    // Add options for scheduling a visit
    if (conversation.language === "marathi") {
      return (
        `${propertyDetails}\n\n` +
        `काय करू इच्छिता?\n\n` +
        `1️⃣. या मालमत्तेला भेट देण्यासाठी वेळ ठरवा\n` +
        `2️⃣. मालमत्ता यादीकडे परत जा\n\n` +
        `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (१-२).`
      );
    }

    return (
      `${propertyDetails}\n\n` +
      `What would you like to do?\n\n` +
      `1️⃣. Schedule a visit to this property\n` +
      `2️⃣. Go back to property list\n\n` +
      `Reply with the number of your choice (1-2).`
    );
  }

  async handleScheduleVisitState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check user's choice
    if (message === "1") {
      // User wants to schedule a visit
      conversation.state = "collect_info";
      conversation.userInfo = {}; // Initialize user info
      await conversation.save();

      // Ask for user's name
      if (conversation.language === "marathi") {
        return "उत्तम! आपल्या भेटीची व्यवस्था करण्यासाठी, आम्हाला काही माहिती हवी आहे.\n\nकृपया आपले पूर्ण नाव प्रदान करा.";
      }
      return "Great! To arrange your visit, we need some information.\n\nPlease provide your full name.";
    } else if (message === "2") {
      // User wants to go back to property list
      conversation.state = "property_match";
      conversation.selectedProperty = null;
      await conversation.save();

      // Show property list again
      const properties = await Property.find({
        _id: { $in: conversation.matchedProperties },
      });

      return this.generatePropertyMatchResponse(
        conversation,
        properties,
        conversation.language
      );
    } else {
      // Invalid choice
      if (conversation.language === "marathi") {
        return "कृपया वैध पर्याय निवडा (१-२).";
      }
      return "Please select a valid option (1-2).";
    }
  }

  async handleCollectInfoState(conversation, message) {
    // Define userInfo outside of try-catch block to make it accessible throughout the method
    const userInfo = conversation.userInfo || {};

    try {
      message = await this.convertMarathiToArabicNumerals(message);

      // If we don't have name yet
      if (!userInfo.name) {
        // Validate name is not empty
        if (!message || message.trim().length < 2) {
          if (conversation.language === "marathi") {
            return "कृपया वैध नाव प्रदान करा (किमान 2 अक्षरे).";
          }
          return "Please provide a valid name (minimum 2 characters).";
        }

        // Save name
        conversation.userInfo = { ...userInfo, name: message.trim() };
        await conversation.save();

        // Ask for phone number
        if (conversation.language === "marathi") {
          return "धन्यवाद! कृपया आपला संपर्क क्रमांक प्रदान करा.";
        }
        return "Thank you! Please provide your contact number.";
      }
    } catch (error) {
      console.error("Error in handleCollectInfoState (name):", error);
      return this.getErrorMessage(conversation.language);
    }

    if (!userInfo.phone) {
      try {
        // Check if message contains a phone number (now handles both formats)
        const phoneMatch = message.match(/\d{10}/);
        let phoneNumber = null;

        // Check for Marathi format with prefix
        if (message.includes("फोन:") || message.includes("Phone:")) {
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
          if (conversation.language === "marathi") {
            return "कृपया वैध 10-अंकी फोन नंबर प्रदान करा (उदा. ९८७६५४३२१० किंवा 9876543210).";
          }
          return "Please provide a valid 10-digit phone number (e.g. ९८७६५४३२१० or 9876543210).";
        }

        // Validate phone number format
        if (phoneNumber.length !== 10) {
          if (conversation.language === "marathi") {
            return "कृपया नक्की 10-अंकी फोन नंबर प्रदान करा.";
          }
          return "Please provide exactly 10 digits for your phone number.";
        }

        // Save phone number
        conversation.userInfo = { ...userInfo, phone: phoneNumber };
        await conversation.save();

        // Ask for preferred time
        if (conversation.language === "marathi") {
          return 'धन्यवाद! कृपया आपली पसंतीची भेटीची तारीख आणि वेळ प्रदान करा (उदा. "Tomorrow at 2 PM" किंवा "Saturday at 11 AM").';
        }
        return 'Thank you! Please provide your preferred date and time for the visit (e.g., "Tomorrow at 2 PM" or "Saturday at 11 AM").';
      } catch (error) {
        console.error("Error in handleCollectInfoState (phone):", error);
        return this.getErrorMessage(conversation.language);
      }
    }

    // If we have name and phone but no preferred time
    if (!userInfo.preferredTime) {
      // Define these variables outside the try-catch blocks to make them accessible throughout the method
      let extractedDate;
      let extractedTime;

      try {
        // Extract date and time from user message
        const Helpers = require("../utils/helpers");
        extractedDate = Helpers.extractDate(message);
        extractedTime = Helpers.extractTime(message);

        // If user didn't provide date or time, ask again
        if (!extractedDate && !extractedTime) {
          if (conversation.language === "marathi") {
            return 'कृपया भेटीसाठी तारीख आणि वेळ स्पष्टपणे नमूद करा (उदा. "Tomorrow at 2 PM" किंवा "Saturday at 11 AM").';
          }
          return 'Please specify a clear date and time for your visit (e.g., "Tomorrow at 2 PM" or "Saturday at 11 AM").';
        }

        if (!extractedDate) {
          if (conversation.language === "marathi") {
            return 'कृपया भेटीसाठी तारीख स्पष्टपणे नमूद करा (उदा. "Tomorrow" किंवा "Saturday").';
          }
          return 'Please specify a clear date for your visit (e.g., "Tomorrow" or "Saturday").';
        }

        if (!extractedTime) {
          if (conversation.language === "marathi") {
            return 'कृपया भेटीसाठी वेळ स्पष्टपणे नमूद करा (उदा. "2 PM" किंवा "11 AM").';
          }
          return 'Please specify a clear time for your visit (e.g., "2 PM" or "11 AM").';
        }
      } catch (error) {
        console.error(
          "Error in handleCollectInfoState (date/time extraction):",
          error
        );
        return this.getErrorMessage(conversation.language);
      }

      // Define these variables outside the try-catch block to make them accessible throughout the method
      let preferredDate = new Date();
      let validDate = false;
      let validTime = false;

      try {
        // Handle common date patterns
        if (extractedDate.toLowerCase().includes("tomorrow")) {
          preferredDate.setDate(preferredDate.getDate() + 1);
          validDate = true;
        } else if (extractedDate.toLowerCase().includes("today")) {
          // Today is already set
          validDate = true;
        } else if (extractedDate.toLowerCase().includes("next week")) {
          preferredDate.setDate(preferredDate.getDate() + 7);
          validDate = true;
        } else if (
          extractedDate
            .toLowerCase()
            .match(
              /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
            )
        ) {
          try {
            // Simple weekday handling - in a real app, use a more robust solution
            const weekdays = [
              "sunday",
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
            ];
            const today = preferredDate.getDay();
            const targetDay = weekdays.indexOf(
              extractedDate
                .toLowerCase()
                .match(
                  /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
                )[0]
            );

            if (targetDay !== -1) {
              let daysToAdd = targetDay - today;
              if (daysToAdd <= 0) daysToAdd += 7; // Next week if day has passed
              preferredDate.setDate(preferredDate.getDate() + daysToAdd);
              validDate = true;
            }
          } catch (error) {
            console.error("Error parsing weekday:", error);
            // Will be handled by the validDate check below
          }
        }

        // Handle time patterns
        if (extractedTime) {
          try {
            const hourMatch = extractedTime.match(/(\d{1,2})/);
            if (hourMatch) {
              let hour = parseInt(hourMatch[0]);

              // Validate hour is within range
              if (hour >= 0 && hour <= 23) {
                // Handle AM/PM
                if (extractedTime.toLowerCase().includes("pm") && hour < 12) {
                  hour += 12;
                } else if (
                  extractedTime.toLowerCase().includes("am") &&
                  hour === 12
                ) {
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

                // Check if time is during business hours (9 AM to 6 PM)
                if (hour >= 9 && hour <= 18) {
                  validTime = true;
                }
              }
            }
          } catch (error) {
            console.error("Error parsing time:", error);
            // Will be handled by the validTime check below
          }
        }

        // If date or time is invalid, ask user to provide valid information
        if (!validDate) {
          if (conversation.language === "marathi") {
            return 'कृपया वैध तारीख प्रदान करा (उदा. "Tomorrow" किंवा "Saturday").';
          }
          return 'Please provide a valid date (e.g., "Tomorrow" or "Saturday").';
        }

        if (!validTime) {
          if (conversation.language === "marathi") {
            return "कृपया व्यवसाय तासांदरम्यान वेळ प्रदान करा (सकाळी 9 ते संध्याकाळी 6).";
          }
          return "Please provide a time during business hours (9 AM to 6 PM).";
        }
      } catch (error) {
        console.error("Error parsing date and time:", error);
        if (conversation.language === "marathi") {
          return 'कृपया वैध तारीख आणि वेळ प्रदान करा (उदा. "Tomorrow at 2 PM").';
        }
        return 'Please provide a valid date and time (e.g., "Tomorrow at 2 PM").';
      }

      // Format the time for display
      const options = {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      };
      const formattedTime = preferredDate.toLocaleDateString(
        conversation.language === "marathi" ? "mr-IN" : "en-US",
        options
      );

      // Save preferred time
      conversation.userInfo = { ...userInfo, preferredTime: preferredDate };
      await conversation.save();

      // Ask for special requirements
      if (conversation.language === "marathi") {
        return (
          `छान! 📅 आपली भेट ${formattedTime} साठी निश्चित केली गेली आहे.\n\n` +
          `आपल्या भेटीसाठी आपल्याकडे काही विशेष आवश्यकता किंवा प्रश्न आहेत का? उदाहरणार्थ:\n\n` +
          `1️⃣. कोणत्याही विशेष आवश्यकता नाहीत\n` +
          `2️⃣. वित्तपुरवठा पर्यायांबद्दल माहिती हवी आहे\n` +
          `3️⃣. जवळपासच्या सुविधांमध्ये स्वारस्य आहे\n` +
          `4️⃣. नूतनीकरण शक्यतांबद्दल चर्चा करू इच्छिता\n` +
          `5️⃣. इतर (कृपया निर्दिष्ट करा)\n\n` +
          `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (१-५).`
        );
      }

      return (
        `Great! 📅 Your visit has been scheduled for ${formattedTime}.\n\n` +
        `Do you have any special requirements or questions for your visit? For example:\n\n` +
        `1️⃣. No special requirements\n` +
        `2️⃣. Need information about financing options\n` +
        `3️⃣. Interested in nearby amenities\n` +
        `4️⃣. Want to discuss renovation possibilities\n` +
        `5️⃣. Other (please specify)\n\n` +
        `Reply with the number of your choice (1-5).`
      );
    }

    // If we have name, phone, time but no special requirements
    if (!userInfo.specialRequirements) {
      // Check if this is a valid selection or custom message
      if (message.match(/^[1-5]$/)) {
        const requirementChoice = parseInt(message.trim());
        let specialRequirements = "";

        if (conversation.language === "marathi") {
          switch (requirementChoice) {
            case 1:
              specialRequirements = "कोणत्याही विशेष आवश्यकता नाहीत";
              break;
            case 2:
              specialRequirements = "वित्तपुरवठा पर्यायांबद्दल माहिती हवी आहे";
              break;
            case 3:
              specialRequirements = "जवळपासच्या सुविधांमध्ये स्वारस्य आहे";
              break;
            case 4:
              specialRequirements = "नूतनीकरण शक्यतांबद्दल चर्चा करू इच्छिता";
              break;
            case 5:
              // For 'Other', we'll ask for specifics
              conversation.userInfo = {
                ...userInfo,
                awaitingSpecialRequirements: true,
              };
              await conversation.save();
              return "कृपया आपल्या विशेष आवश्यकता किंवा प्रश्न तपशीलवार सांगा.";
          }
        } else {
          switch (requirementChoice) {
            case 1:
              specialRequirements = "No special requirements";
              break;
            case 2:
              specialRequirements = "Needs information about financing options";
              break;
            case 3:
              specialRequirements = "Interested in nearby amenities";
              break;
            case 4:
              specialRequirements = "Wants to discuss renovation possibilities";
              break;
            case 5:
              // For 'Other', we'll ask them to specify
              conversation.userInfo = {
                ...userInfo,
                awaitingSpecialRequirements: true,
              };
              await conversation.save();
              return `Please briefly describe your specific requirements or questions:`;
            default:
              return `Please select a valid option (1-5).`;
          }
        }

        // Save special requirements and complete the process
        conversation.userInfo = { ...userInfo, specialRequirements };
        conversation.state = "completed";
        await conversation.save();

        // Create appointment in database
        const appointmentResult = await this.createAppointment(conversation);

        // Check if appointment creation was successful
        if (!appointmentResult.success) {
          // Return error message in appropriate language
          return this.getErrorMessage(
            conversation.language,
            appointmentResult.error
          );
        }

        // Generate confirmation with enhanced details
        return this.generateEnhancedConfirmation(
          conversation,
          conversation.language
        );
      } else if (message.length > 0) {
        // User provided custom requirements (after selecting option 5)
        conversation.userInfo = {
          ...userInfo,
          specialRequirements: message.trim(),
        };
        conversation.state = "completed";
        await conversation.save();

        // Create appointment in database
        await this.createAppointment(conversation);

        // Generate confirmation with enhanced details
        return this.generateEnhancedConfirmation(
          conversation,
          conversation.language
        );
      } else {
        // Invalid input for special requirements
        if (conversation.language === "marathi") {
          return `कृपया एक पर्याय (१-५) निवडा किंवा आपल्या विशिष्ट आवश्यकता प्रदान करा:`;
        }
        return `Please select an option (1-5) or provide your specific requirements:`;
      }
    }

    // This should not happen, but just in case
    if (conversation.language === "marathi") {
      return (
        `मला खात्री नाही की आपण कोणती माहिती देत आहात. आपल्या अपॉइंटमेंट तपशीलांसह पुन्हा सुरू करूया.\n\n` +
        `कृपया आपले पूर्ण नाव प्रदान करा.`
      );
    }
    return (
      `I'm not sure what information you're providing. Let's start over with your appointment details.\n\n` +
      `Please provide your full name.`
    );
  }

  // Generate enhanced confirmation message
  async generateEnhancedConfirmation(conversation, language = "english") {
    try {
      // Get property details
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        throw new Error("Property not found");
      }

      // Format the date for display
      const options = {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      };
      const formattedTime =
        conversation.userInfo.preferredTime.toLocaleDateString(
          language === "marathi" ? "mr-IN" : "en-US",
          options
        );

      // Get agent details
      const agent = property.agent || {
        name: "Not assigned",
        phone: "Not available",
      };

      // Create a personalized confirmation message
      let confirmationMessage = "";

      if (language === "marathi") {
        // Marathi confirmation message
        confirmationMessage = `✅ *मालपुरे ग्रुपसह बुकिंग कन्फर्म झाले!*\n\n`;

        // Add personalized greeting
        confirmationMessage += `प्रिय ${conversation.userInfo.name},\n\n`;

        // Add appointment details
        confirmationMessage += `*${property.title}* पाहण्यासाठी आपली भेट *${formattedTime}* साठी निश्चित केली गेली आहे.\n\n`;

        // Add property details
        confirmationMessage += `*मालमत्ता तपशील:*\n`;
        confirmationMessage += `📍 ${property.location}\n`;
        confirmationMessage += `💰 ₹${property.price.toLocaleString(
          "en-IN"
        )}\n`;

        // Translate property type to Marathi
        let propertyType = "";
        switch (property.type.toLowerCase()) {
          case "apartment":
            propertyType = "अपार्टमेंट";
            break;
          case "villa":
            propertyType = "विला";
            break;
          case "house":
            propertyType = "घर";
            break;
          case "plot":
            propertyType = "प्लॉट";
            break;
          default:
            propertyType = property.type;
        }

        confirmationMessage += `🏢 ${propertyType}\n`;
        confirmationMessage += `🛏️ ${property.bedrooms} बेडरूम\n`;
        confirmationMessage += `🚿 ${property.bathrooms} बाथरूम\n`;
        // Use carpetArea if available, otherwise try builtUpArea, or skip if neither exists
        if (property.carpetArea && property.carpetArea.value) {
          confirmationMessage += `dY"? ${property.carpetArea.value} ${property.carpetArea.unit}\n\n`;
        } else if (property.builtUpArea && property.builtUpArea.value) {
          confirmationMessage += `dY"? ${property.builtUpArea.value} ${property.builtUpArea.unit}\n\n`;
        } else {
          confirmationMessage += "\n";
        }

        // Add agent details
        confirmationMessage += `*आपला समर्पित एजंट:*\n`;
        confirmationMessage += `👤 ${agent.name}\n`;
        confirmationMessage += `📱 ${agent.phone}\n\n`;

        // Add special requirements if any
        if (
          conversation.userInfo.specialRequirements &&
          conversation.userInfo.specialRequirements !==
            "कोणत्याही विशेष आवश्यकता नाहीत"
        ) {
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
        confirmationMessage = `✅ *Booking Confirmed with MALPURE GROUP!*\n\n`;

        // Add personalized greeting
        confirmationMessage += `Dear ${conversation.userInfo.name},\n\n`;

        // Add appointment details
        confirmationMessage += `Your visit to see *${property.title}* has been scheduled for *${formattedTime}*.\n\n`;

        // Add property details
        confirmationMessage += `*Property Details:*\n`;
        confirmationMessage += `📍 ${property.location}\n`;
        confirmationMessage += `💰 ₹${property.price.toLocaleString(
          "en-IN"
        )}\n`;
        confirmationMessage += `🏢 ${
          property.type.charAt(0).toUpperCase() + property.type.slice(1)
        }\n`;
        confirmationMessage += `🛏️ ${property.bedrooms} Bedroom${
          property.bedrooms > 1 ? "s" : ""
        }\n`;
        confirmationMessage += `🚿 ${property.bathrooms} Bathroom${
          property.bathrooms > 1 ? "s" : ""
        }\n`;
        // Use carpetArea if available, otherwise try builtUpArea, or skip if neither exists
        if (property.carpetArea && property.carpetArea.value) {
          confirmationMessage += `dY"? ${property.carpetArea.value} ${property.carpetArea.unit}\n\n`;
        } else if (property.builtUpArea && property.builtUpArea.value) {
          confirmationMessage += `dY"? ${property.builtUpArea.value} ${property.builtUpArea.unit}\n\n`;
        } else {
          confirmationMessage += "\n";
        }

        // Add agent details
        confirmationMessage += `*Your Dedicated Agent:*\n`;
        confirmationMessage += `👤 ${agent.name}\n`;
        confirmationMessage += `📱 ${agent.phone}\n\n`;

        // Add special requirements if any
        if (
          conversation.userInfo.specialRequirements &&
          conversation.userInfo.specialRequirements !==
            "No special requirements"
        ) {
          confirmationMessage += `*Special Requirements:*\n`;
          confirmationMessage += `✏️ ${conversation.userInfo.specialRequirements}\n\n`;
        }

        // Add next steps
        confirmationMessage += `Our agent will contact you at ${conversation.userInfo.phone} shortly to confirm the details.\n\n`;

        // Add what's next options
        confirmationMessage += `*What would you like to do next?*\n\n`;
        confirmationMessage += `1️⃣. Start a new property search\n`;
        confirmationMessage += `2️⃣. View appointment details\n`;
        confirmationMessage += `3️⃣. End conversation\n\n`;
        confirmationMessage += `Reply with the number of your choice (1-3).`;
      }

      return confirmationMessage;
    } catch (error) {
      console.error("Error generating confirmation:", error);
      if (language === "marathi") {
        return "माफ करा, पुष्टीकरण संदेश तयार करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.";
      }
      return "Sorry, there was an error generating the confirmation message. Please try again.";
    }
  }

  async createAppointment(conversation) {
    try {
      // Validate conversation object
      if (!conversation) {
        console.error("Conversation object is null or undefined");
        return { success: false, error: "Missing conversation data" };
      }

      // Validate required data before creating appointment
      if (!conversation.selectedProperty) {
        console.error("Missing property ID for appointment");
        return {
          success: false,
          error:
            conversation.language === "marathi"
              ? "अपॉइंटमेंटसाठी मालमत्ता आयडी गहाळ आहे"
              : "Missing property ID for appointment",
        };
      }

      if (!conversation.userInfo) {
        console.error("Missing user information object for appointment");
        return {
          success: false,
          error:
            conversation.language === "marathi"
              ? "वापरकर्ता माहिती गहाळ आहे"
              : "Missing user information",
        };
      }

      if (
        !conversation.userInfo.name ||
        conversation.userInfo.name.trim() === ""
      ) {
        console.error("Missing user name for appointment");
        return {
          success: false,
          error:
            conversation.language === "marathi"
              ? "अपॉइंटमेंटसाठी वापरकर्ता नाव गहाळ आहे"
              : "Missing user name for appointment",
        };
      }

      if (
        !conversation.userInfo.phone ||
        !/^\d{10}$/.test(conversation.userInfo.phone)
      ) {
        console.error("Missing or invalid phone number for appointment");
        return {
          success: false,
          error:
            conversation.language === "marathi"
              ? "अपॉइंटमेंटसाठी अवैध फोन नंबर"
              : "Invalid phone number for appointment",
        };
      }

      if (!conversation.userInfo.preferredTime) {
        console.error("Missing preferred time for appointment");
        return {
          success: false,
          error:
            conversation.language === "marathi"
              ? "अपॉइंटमेंटसाठी पसंतीचा वेळ गहाळ आहे"
              : "Missing preferred time for appointment",
        };
      }

      // Validate that preferred time is in the future
      const now = new Date();
      if (conversation.userInfo.preferredTime < now) {
        console.error("Preferred time is in the past");
        return {
          success: false,
          error:
            conversation.language === "marathi"
              ? "अपॉइंटमेंटची वेळ भूतकाळात आहे"
              : "Appointment time must be in the future",
        };
      }

      // Create appointment using appointment service
      const appointment = await this.appointmentService.createAppointment({
        userId: conversation.userId,
        propertyId: conversation.selectedProperty,
        userName: conversation.userInfo.name,
        userPhone: conversation.userInfo.phone,
        dateTime: conversation.userInfo.preferredTime,
        notes: conversation.userInfo.specialRequirements || "None",
        status: "scheduled",
      });

      if (!appointment || !appointment._id) {
        console.error("Failed to create appointment - no ID returned");
        return {
          success: false,
          error:
            conversation.language === "marathi"
              ? "अपॉइंटमेंट तयार करण्यात अयशस्वी"
              : "Failed to create appointment",
        };
      }

      // Store appointment ID in conversation for reference
      conversation.appointmentId = appointment._id;
      await conversation.save();

      return { success: true, appointmentId: appointment._id };
    } catch (error) {
      console.error("Error creating appointment:", error);
      return {
        success: false,
        error:
          conversation.language === "marathi"
            ? "अपॉइंटमेंट तयार करताना त्रुटी: " + error.message
            : "Error creating appointment: " + error.message,
      };
    }
  }

  // Provide context-aware help messages based on conversation state
  getHelpMessage(language, state) {
    if (language === "marathi") {
      // Marathi help messages
      switch (state) {
        case "language_selection":
          return "आपण भाषा निवडत आहात. कृपया 1 (इंग्रजी) किंवा 2 (मराठी) निवडा.";
        case "welcome":
          return "आपले स्वागत आहे! पुढे जाण्यासाठी 1 टाइप करा.";
        case "location":
          return 'आपण स्थान निवडत आहात. कृपया 1-4 मधील एक क्रमांक निवडा किंवा "restart" टाइप करा.';
        case "budget":
          return "आपण बजेट श्रेणी निवडत आहात. कृपया 1-5 मधील एक क्रमांक निवडा.";
        case "bhk":
          return "आपण बेडरूमची संख्या निवडत आहात. कृपया 1-5 मधील एक क्रमांक निवडा.";
        case "property_match":
          return 'आपण मालमत्ता पाहत आहात. अधिक माहितीसाठी मालमत्ता क्रमांक निवडा किंवा "restart" टाइप करा.';
        case "schedule_visit":
          return "आपण भेट ठरवत आहात. भेट ठरवण्यासाठी 1 निवडा किंवा मालमत्ता यादीकडे परत जाण्यासाठी 2 निवडा.";
        case "collect_info":
          return "आपण भेटीसाठी माहिती प्रदान करत आहात. कृपया विनंती केलेली माहिती प्रदान करा.";
        case "completed":
          return "आपली भेट ठरली आहे. नवीन शोध सुरू करण्यासाठी 1, अपॉइंटमेंट तपशील पाहण्यासाठी 2, किंवा संभाषण संपवण्यासाठी 3 टाइप करा.";
        default:
          return 'मदतीसाठी, आपण "restart" टाइप करू शकता किंवा "भाषा बदला" टाइप करून भाषा बदलू शकता.';
      }
    } else {
      // English help messages
      switch (state) {
        case "language_selection":
          return "You are selecting a language. Please choose 1 (English) or 2 (Marathi).";
        case "welcome":
          return "Welcome! Type 1 to continue.";
        case "location":
          return 'You are selecting a location. Please choose a number from 1-4 or type "restart".';
        case "budget":
          return "You are selecting a budget range. Please choose a number from 1-5.";
        case "bhk":
          return "You are selecting the number of bedrooms. Please choose a number from 1-5.";
        case "property_match":
          return 'You are viewing properties. Select a property number for more details or type "restart".';
        case "schedule_visit":
          return "You are scheduling a visit. Choose 1 to schedule a visit or 2 to go back to the property list.";
        case "collect_info":
          return "You are providing information for your visit. Please provide the requested information.";
        case "completed":
          return "Your visit has been scheduled.\n 1️⃣ To start a new search\n 2️⃣ To view appointment details\n 3️⃣ End the conversation.";
        default:
          return 'For help, you can type "restart" at any time or "change language" to switch languages.';
      }
    }
  }

  async handleCompletedState(conversation, message) {
    message = await this.convertMarathiToArabicNumerals(message);
    // Check user's choice for next steps
    if (message === "1") {
      // User wants to start a new property search
      conversation.state = "welcome";
      conversation.preferences = {};
      conversation.matchedProperties = [];
      conversation.selectedProperty = null;
      conversation.userInfo = {};
      // Keep the appointmentId for reference
      await conversation.save();

      // Return welcome message
      return this.getWelcomeMessage(conversation.language);
    } else if (message === "2") {
      // User wants to view appointment details
      let appointment;
      let property;

      // Try to get appointment details from stored appointmentId
      if (conversation.appointmentId) {
        try {
          appointment = await this.appointmentService.getAppointment(
            conversation.appointmentId
          );
          property = appointment.propertyId; // This is populated by the getAppointment method
        } catch (error) {
          console.error("Error retrieving appointment:", error);
          // Fall back to using the selectedProperty if appointment retrieval fails
        }
      }

      // If appointment not found, fall back to using the conversation data
      if (!property) {
        property = await Property.findById(conversation.selectedProperty);
      }

      if (!property) {
        if (conversation.language === "marathi") {
          return "माफ करा, अपॉइंटमेंट तपशील आढळले नाहीत. नवीन शोध सुरू करण्यासाठी १ टाइप करा.";
        }
        return "Sorry, appointment details not found. Type 1️⃣ to start a new search.";
      }

      // Get the date/time - either from appointment or from conversation
      const dateTime = appointment
        ? appointment.dateTime
        : conversation.userInfo.preferredTime;

      // Format the date for display
      const options = {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      };
      const formattedTime = dateTime.toLocaleDateString(
        conversation.language === "marathi" ? "mr-IN" : "en-US",
        options
      );

      // Get appointment status if available
      const status = appointment ? appointment.status : "scheduled";
      const statusText =
        conversation.language === "marathi"
          ? this.getAppointmentStatusInMarathi(status)
          : this.getAppointmentStatusInEnglish(status);

      if (conversation.language === "marathi") {
        return (
          `📅 *अपॉइंटमेंट तपशील*\n\n` +
          `मालमत्ता: ${property.title}\n` +
          `स्थान: ${property.location}\n` +
          `तारीख/वेळ: ${formattedTime}\n` +
          `स्थिती: ${statusText}\n` +
          `संदर्भ क्र.: ${conversation.appointmentId || "उपलब्ध नाही"}\n\n` +
          `आम्ही आपल्याला पुढील दस्तऐवज पाठवू:\n` +
          `- मालमत्ता ब्रोशर\n` +
          `- फ्लोअर प्लॅन\n` +
          `- स्थान फायदे\n` +
          `- पेमेंट प्लॅन\n\n` +
          `हे आपल्याला WhatsApp किंवा ईमेल द्वारे पाठवले जातील. आपल्याला कोणत्या विशिष्ट दस्तऐवजामध्ये सर्वाधिक स्वारस्य आहे?\n\n` +
          `1️⃣. नवीन मालमत्ता शोध सुरू करा\n` +
          `2️⃣. अपॉइंटमेंट तपशील पहा\n` +
          `3️⃣. संभाषण संपवा\n\n` +
          `आपल्या निवडीच्या क्रमांकासह उत्तर द्या.`
        );
      }

      return (
        `📅 *Appointment Details*\n\n` +
        `Property: ${property.title}\n` +
        `Location: ${property.location}\n` +
        `Date/Time: ${formattedTime}\n` +
        `Status: ${statusText}\n` +
        `Reference #: ${conversation.appointmentId || "Not available"}\n\n` +
        `We'll be sending you the following documents:\n` +
        `- Property brochure\n` +
        `- Floor plans\n` +
        `- Location advantages\n` +
        `- Payment plans\n\n` +
        `These will be sent to you via WhatsApp or email. Is there a specific document you're most interested in?\n\n` +
        `1️⃣. Start a new property search\n` +
        `2️⃣. View appointment details\n` +
        `3️⃣. End conversation\n\n` +
        `Reply with the number of your choice.`
      );
    } else if (
      message.toLowerCase() === "change language" ||
      message.toLowerCase() === "भाषा बदला"
    ) {
      // User wants to change language
      conversation.state = "language_selection";
      await conversation.save();
      return "Welcome to MALPURE GROUP! 🏠\n\nPlease select your preferred language:\n\n1. English\n2. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.";
    } else {
      // User wants to end conversation
      if (conversation.language === "marathi") {
        return (
          `मालपुरे ग्रुप निवडल्याबद्दल धन्यवाद! 🙏\n\n` +
          `आपली मालमत्ता पाहण्याची व्यवस्था केली गेली आहे, आणि आमचा एजंट लवकरच आपल्याशी संपर्क साधेल.\n\n` +
          `आपल्याकडे आपल्या अपॉइंटमेंटबद्दल काही प्रश्न असल्यास किंवा भविष्यात अधिक मालमत्ता शोधू इच्छित असल्यास, आम्हाला पुन्हा संदेश द्या.\n\n` +
          `जर तुम्हाला नवीन संभाषण सुरू करायचे असल्यास, 'restart' असे टाइप करा.\n\n` +
          `आम्ही आपल्याला आपले स्वप्नातील घर शोधण्यास मदत करण्यास उत्सुक आहोत! 🏡✨\n\n` +
          `आपला दिवस शुभ असो! 👋`
        );
      }

      return (
        `Thank you for choosing MALPURE GROUP for your property search! 🙏\n\n` +
        `Your property viewing has been scheduled, and our agent will contact you shortly.\n\n` +
        `If you have any questions about your appointment or would like to search for more properties in the future, just message us again.\n\n` +
        `If you’d like to start a new conversation, simply type 'restart'.\n\n` +
        `We look forward to helping you find your dream property! 🏡✨\n\n` +
        `Have a great day! 👋`
      );
    }
  }

  async handleCompletedState(conversation, message) {
    try {
      // Validate conversation
      if (!conversation) {
        console.error("Conversation object is missing");
        return this.getErrorMessage("english", "Missing conversation data");
      }

      // Sanitize and normalize input
      message = await this.convertMarathiToArabicNumerals(message);
      message = message.trim().toLowerCase();

      // If already in document selection phase, handle document choices
      if (conversation.documentSelectionPhase) {
        switch (message) {
          case "1": // Property Brochure
            const brochureResult = await this.sendPropertyDocument(
              conversation,
              "brochure"
            );
            conversation.documentSelectionPhase = false;
            await conversation.save();

            // If sending document failed, return the error message
            if (typeof brochureResult === "string") {
              return brochureResult;
            }
            return this.getFinalMessage(conversation.language);

          case "2": // Floor Plans
            const floorPlansResult = await this.sendPropertyDocument(
              conversation,
              "floor_plans"
            );
            conversation.documentSelectionPhase = false;
            await conversation.save();

            // If sending document failed, return the error message
            if (typeof floorPlansResult === "string") {
              return floorPlansResult;
            }
            return this.getFinalMessage(conversation.language);

          case "3": // Images
            const imagesResult = await this.sendPropertyImages(conversation);
            conversation.documentSelectionPhase = false;
            await conversation.save();

            // If sending images failed, return the error message
            if (typeof imagesResult === "string") {
              return imagesResult;
            }
            return this.getFinalMessage(conversation.language);

          case "4": // None
            conversation.documentSelectionPhase = false;
            await conversation.save();
            return this.getFinalMessage(conversation.language);

          default:
            // Show options again if invalid input
            return this.getDocumentOptionsMessage(conversation);
        }
      }

      // If NOT in document selection phase, handle main menu options
      switch (message) {
        case "1": // User wants to start a new property search
          conversation.state = "welcome";
          conversation.preferences = {};
          conversation.matchedProperties = [];
          conversation.selectedProperty = null;
          conversation.viewingAppointmentDetails = false;
          conversation.documentSelectionPhase = false;
          await conversation.save();
          return this.getWelcomeMessage(conversation.language);

        case "2": // View appointment details or documents
          // If user is coming from appointment details view and selects option 2, show document options
          if (conversation.viewingAppointmentDetails) {
            conversation.documentSelectionPhase = true;
            await conversation.save();
            return this.getDocumentOptionsMessage(conversation);
          }
          // Otherwise, show appointment details and set the flag
          conversation.viewingAppointmentDetails = true;
          await conversation.save();
          return await this.getAppointmentDetails(conversation);

        case "3": // End conversation
          conversation.viewingAppointmentDetails = false;
          conversation.documentSelectionPhase = false;
          await conversation.save();
          return this.getFinalMessage(conversation.language);

        case "change language":
        case "भाषा बदला":
          conversation.state = "language_selection";
          await conversation.save();
          return "Welcome to MALPURE GROUP! 🏠\n\nPlease select your preferred language:\n\n1. English\n2. मराठी (Marathi)\n\nReply with just the number (1-2) to select your language.";

        case "help":
          return this.getHelpMessage(conversation.state, conversation.language);

        default:
          // Check if user is asking for documents
          if (
            message.includes("document") ||
            message.includes("brochure") ||
            message.includes("floor plan") ||
            message.includes("image") ||
            message.includes("दस्तऐवज") ||
            message.includes("ब्रोशर") ||
            message.includes("फ्लोअर प्लॅन") ||
            message.includes("चित्र")
          ) {
            conversation.documentSelectionPhase = true;
            await conversation.save();
            return this.getDocumentOptionsMessage(conversation);
          }

          return this.getFinalMessage(conversation.language);
      }
    } catch (error) {
      console.error("Error in handleCompletedState:", error);
      return this.getErrorMessage(
        conversation?.language || "english",
        "An unexpected error occurred"
      );
    }
  }
  // Helper method to get document options message
  getDocumentOptionsMessage(conversation) {
    if (conversation.language === "marathi") {
      return (
        `कृपया आपल्याला हवा असलेला दस्तऐवज निवडा:\n\n` +
        `1️⃣. मालमत्ता ब्रोशर (PDF)\n` +
        `2️⃣. फ्लोअर प्लॅन (PDF)\n` +
        `3️⃣. मालमत्ता चित्रे\n` +
        `4️⃣. काहीही नको\n\n` +
        `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (1-4).`
      );
    }

    return (
      `Please select which document you would like to receive:\n\n` +
      `1️⃣. Property Brochure (PDF)\n` +
      `2️⃣. Floor Plans (PDF)\n` +
      `3️⃣. Property Images\n` +
      `4️⃣. None\n\n` +
      `Reply with the number of your choice (1-4).`
    );
  }

  // Helper method to send property document
  async sendPropertyDocument(conversation, documentType) {
    try {
      // Validate conversation and property
      if (!conversation) {
        console.error("Conversation object is missing");
        return this.getErrorMessage("english", "Missing conversation data");
      }

      // Check if property exists
      if (!conversation.selectedProperty) {
        console.error("No property selected in conversation");
        const errorMsg =
          conversation.language === "marathi"
            ? "कोणतीही मालमत्ता निवडलेली नाही"
            : "No property selected";
        return this.getErrorMessage(conversation.language, errorMsg);
      }

      let documentPath, documentName, displayName, documentUrl;

      if (documentType === "brochure") {
        documentPath = "https://demo.twilio.com/owl.png";
        documentUrl = "https://surl.li/xmbbzt";
        documentName = "Property_Brochure.pdf";
        displayName =
          conversation.language === "marathi"
            ? "मालमत्ता ब्रोशर"
            : "Property Brochure";
      } else if (documentType === "floor_plans") {
        documentPath = "https://demo.twilio.com/owl.png";
        documentUrl = "https://surl.li/xmbbzt";
        documentName = "Floor_Plans.pdf";
        displayName =
          conversation.language === "marathi" ? "फ्लोअर प्लॅन" : "Floor Plans";
      } else if (documentType === "images") {
        // For images, we'll call the sendPropertyImages method instead
        return await this.sendPropertyImages(conversation);
      } else {
        throw new Error("Invalid document type");
      }

      const messageBody =
        conversation.language === "marathi"
          ? `📄 ${displayName}\n\nकृपया खालील लिंकवरून दस्तऐवज डाउनलोड करा:\n${documentUrl}`
          : `📄 ${displayName}\n\nPlease download the document using the link below:\n${documentUrl}`;

      // Send message with document
      const result = await this.whatsappService.sendMessage(
        conversation.userId,
        messageBody,
        documentPath
      );

      if (!result) {
        throw new Error("Failed to send document via WhatsApp");
      }

      return true;
    } catch (error) {
      console.error(`Error sending ${documentType}:`, error);
      return this.getErrorMessage(conversation.language, error.message);
    }
  }

  // Helper method to send property images
  async sendPropertyImages(conversation) {
    try {
      // Validate conversation
      if (!conversation) {
        console.error("Conversation object is missing");
        return this.getErrorMessage("english", "Missing conversation data");
      }

      // Validate user ID
      if (!conversation.userId) {
        console.error("User ID is missing in conversation");
        return this.getErrorMessage(conversation.language, "Missing user ID");
      }

      // Validate property ID
      if (!conversation.selectedProperty) {
        console.error("No property selected in conversation");
        const errorMsg =
          conversation.language === "marathi"
            ? "कोणतीही मालमत्ता निवडलेली नाही"
            : "No property selected";
        return this.getErrorMessage(conversation.language, errorMsg);
      }

      // Fetch property details
      const property = await Property.findById(conversation.selectedProperty);
      if (!property) {
        console.error(
          `Property not found with ID: ${conversation.selectedProperty}`
        );
        const errorMsg =
          conversation.language === "marathi"
            ? "मालमत्ता सापडली नाही"
            : "Property not found";
        return this.getErrorMessage(conversation.language, errorMsg);
      }

      // Sample image URLs - in a real app, these would come from the property database
      const imageUrls = [
        "https://demo.twilio.com/owl.png",
        "https://demo.twilio.com/owl.png",
        "https://demo.twilio.com/owl.png",
      ];

      // Check if we have images to send
      if (!imageUrls || imageUrls.length === 0) {
        console.warn(`No images available for property: ${property.title}`);
        const noImagesMsg =
          conversation.language === "marathi"
            ? `क्षमस्व, ${property.title} साठी सध्या कोणतीही चित्रे उपलब्ध नाहीत.`
            : `Sorry, there are currently no images available for ${property.title}.`;
        await this.whatsappService.sendMessage(
          conversation.userId,
          noImagesMsg
        );
        return true;
      }

      // Send a message first
      const introMessage =
        conversation.language === "marathi"
          ? `📸 *मालमत्ता चित्रे*\n\nआम्ही आपल्याला ${property.title} च्या काही चित्रे पाठवत आहोत.`
          : `📸 *Property Images*\n\nHere are some images of ${property.title}.`;

      const introResult = await this.whatsappService.sendMessage(
        conversation.userId,
        introMessage
      );
      if (!introResult) {
        throw new Error("Failed to send intro message");
      }

      // Then send the images
      const imagesResult = await this.whatsappService.sendPropertyImages(
        conversation.userId,
        property.title,
        imageUrls
      );

      if (!imagesResult) {
        throw new Error("Failed to send property images");
      }

      return true;
    } catch (error) {
      console.error("Error sending property images:", error);
      return this.getErrorMessage(conversation.language, error.message);
    }
  }

  getDocumentNotAvailableMessage(language, documentType) {
    const docNames = {
      brochure: { english: "brochure", marathi: "ब्रोशर" },
      floor_plans: { english: "floor plans", marathi: "फ्लोअर प्लॅन" },
    };

    const localizedDocName =
      docNames[documentType]?.[language] || docNames[documentType]?.english;

    if (language === "marathi") {
      return `क्षमस्व, ${localizedDocName} सध्या उपलब्ध नाही. कृपया नंतर पुन्हा प्रयत्न करा.`;
    }
    return `Sorry, the ${localizedDocName} is not available. Please try again later.`;
  }

  getErrorMessage(language, technicalDetail = "") {
    const messages = {
      english: `There was an error. ${
        technicalDetail
          ? `(Technical: ${technicalDetail})`
          : "Please try again later."
      }`,
      marathi: `त्रुटी आली. ${
        technicalDetail
          ? `(तांत्रिक माहिती: ${technicalDetail})`
          : "कृपया नंतर पुन्हा प्रयत्न करा."
      }`,
    };

    return messages[language] || messages.english;
  }

  // Helper method for final message
  getFinalMessage(language) {
    try {
      // Default to English if language is not specified
      const userLanguage = language || "english";

      if (userLanguage === "marathi") {
        return (
          `मालपुरे ग्रुप निवडल्याबद्दल धन्यवाद! 🙏\n\n` +
          `आपल्या प्रश्नांची उत्तरे मिळाली अशी आशा आहे. आम्ही आपल्याला सेवा देण्यास आनंदित आहोत.\n\n` +
          `आपण काय करू शकता:\n` +
          `• नवीन संभाषण सुरू करण्यासाठी 'restart' टाइप करा\n` +
          `• भाषा बदलण्यासाठी 'भाषा बदला' टाइप करा\n` +
          `• अधिक मदतीसाठी 'help' टाइप करा\n\n` +
          `आपला दिवस शुभ असो! 👋`
        );
      }

      return (
        `Thank you for choosing MALPURE GROUP! 🙏\n\n` +
        `We hope you found the information you were looking for. We're happy to be of service.\n\n` +
        `What you can do next:\n` +
        `• Type 'restart' to begin a new conversation\n` +
        `• Type 'change language' to switch languages\n` +
        `• Type 'help' for more assistance\n\n` +
        `Have a great day! 👋`
      );
    } catch (error) {
      console.error("Error generating final message:", error);
      // Fallback message in case of any errors
      return "Thank you for your time. Type 'restart' to begin a new conversation.";
    }
  }

  // Helper methods for appointment status translation
  getAppointmentStatusInEnglish(status) {
    switch (status) {
      case "scheduled":
        return "Scheduled";
      case "confirmed":
        return "Confirmed";
      case "cancelled":
        return "Cancelled";
      case "completed":
        return "Completed";
      default:
        return "Scheduled";
    }
  }

  getAppointmentStatusInMarathi(status) {
    switch (status) {
      case "scheduled":
        return "निश्चित केले";
      case "confirmed":
        return "पुष्टी केली";
      case "cancelled":
        return "रद्द केले";
      case "completed":
        return "पूर्ण झाले";
      default:
        return "निश्चित केले";
    }
  }

  // Helper method to get appointment details
  async getAppointmentDetails(conversation) {
    try {
      // Validate conversation
      if (!conversation) {
        console.error("Conversation object is missing");
        return this.getErrorMessage("english", "Missing conversation data");
      }

      // Check if appointment ID exists
      if (!conversation.appointmentId) {
        console.error("No appointment ID in conversation");
        const errorMsg =
          conversation.language === "marathi"
            ? "अपॉइंटमेंट आयडी उपलब्ध नाही"
            : "No appointment ID available";
        return this.getErrorMessage(conversation.language, errorMsg);
      }

      // Get appointment details using appointment service
      const appointment = await this.appointmentService.getAppointment(
        conversation.appointmentId
      );

      if (!appointment) {
        const errorMsg =
          conversation.language === "marathi"
            ? "अपॉइंटमेंट सापडले नाही"
            : "Appointment not found";
        return this.getErrorMessage(conversation.language, errorMsg);
      }

      // Format date for display
      const options = {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      };

      const formattedTime = appointment.dateTime.toLocaleDateString(
        conversation.language === "marathi" ? "mr-IN" : "en-US",
        options
      );

      // Get property details
      const property = appointment.propertyId;
      if (!property) {
        console.error(`Property not found for appointment: ${appointment._id}`);
      }

      // Create appointment details message
      let detailsMessage = "";

      if (conversation.language === "marathi") {
        // Marathi appointment details
        detailsMessage = `📅 *अपॉइंटमेंट तपशील*\n\n`;
        detailsMessage += `🏠 *मालमत्ता:* ${
          property ? property.title : "उपलब्ध नाही"
        }\n`;
        detailsMessage += `📍 *स्थान:* ${
          property ? property.location : "उपलब्ध नाही"
        }\n`;
        detailsMessage += `⏰ *वेळ:* ${formattedTime}\n`;
        detailsMessage += `👤 *नाव:* ${appointment.userName}\n`;
        detailsMessage += `📱 *फोन:* ${appointment.userPhone}\n`;
        detailsMessage += `📝 *स्थिती:* ${this.getAppointmentStatusInMarathi(
          appointment.status
        )}\n`;

        if (appointment.notes && appointment.notes !== "None") {
          detailsMessage += `✏️ *विशेष आवश्यकता:* ${appointment.notes}\n`;
        }

        // Add property document options
        detailsMessage += `\n📄 *मालमत्ता दस्तऐवज*\n`;
        detailsMessage += `आपल्याला मालमत्ता दस्तऐवज हवे आहेत का? 'दस्तऐवज' टाइप करा किंवा खालील पर्यायांमधून निवडा:\n\n`;

        // Add main menu options
        detailsMessage += `*पुढे काय करायचे आहे?*\n\n`;
        detailsMessage += `1️⃣. नवीन मालमत्ता शोध सुरू करा\n`;
        detailsMessage += `2️⃣. दस्तऐवज पहा\n`;
        detailsMessage += `3️⃣. संभाषण संपवा\n\n`;
        detailsMessage += `आपल्या निवडीच्या क्रमांकासह उत्तर द्या (१-३).`;
      } else {
        // English appointment details
        detailsMessage = `📅 *Appointment Details*\n\n`;
        detailsMessage += `🏠 *Property:* ${
          property ? property.title : "Not available"
        }\n`;
        detailsMessage += `📍 *Location:* ${
          property ? property.location : "Not available"
        }\n`;
        detailsMessage += `⏰ *Time:* ${formattedTime}\n`;
        detailsMessage += `👤 *Name:* ${appointment.userName}\n`;
        detailsMessage += `📱 *Phone:* ${appointment.userPhone}\n`;
        detailsMessage += `📝 *Status:* ${this.getAppointmentStatusInEnglish(
          appointment.status
        )}\n`;

        if (appointment.notes && appointment.notes !== "None") {
          detailsMessage += `✏️ *Special Requirements:* ${appointment.notes}\n`;
        }

        // Add property document options
        detailsMessage += `\n📄 *Property Documents*\n`;
        detailsMessage += `Would you like to view property documents? Type 'document' or choose from the options below:\n\n`;

        // Add main menu options
        detailsMessage += `*What would you like to do next?*\n\n`;
        detailsMessage += `1️⃣. Start a new property search\n`;
        detailsMessage += `2️⃣. View documents\n`;
        detailsMessage += `3️⃣. End conversation\n\n`;
        detailsMessage += `Reply with the number of your choice (1-3).`;
      }

      return detailsMessage;
    } catch (error) {
      console.error("Error getting appointment details:", error);
      const errorMsg =
        conversation.language === "marathi"
          ? "अपॉइंटमेंट तपशील मिळवताना त्रुटी आली"
          : "Error retrieving appointment details";
      return this.getErrorMessage(conversation.language, errorMsg);
    }
  }
}

module.exports = ConversationService;
