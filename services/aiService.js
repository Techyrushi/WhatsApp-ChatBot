// services/aiService.js
const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        "HTTP-Referer": "https://techyrushi.vercel.app/", // Optional, for including your app on openrouter.ai rankings.
        "X-Title": "Techyrushi", // Optional, for including your app on openrouter.ai rankings.
      },
      apiKey: process.env.OPENROUTER_API_KEY
    });
    
    // Define conversation states for the real estate bot flow
    this.conversationStates = {
      WELCOME: 'welcome',
      LOCATION: 'location',
      BUDGET: 'budget',
      BHK: 'bhk',
      PROPERTY_MATCH: 'property_match',
      SCHEDULE_VISIT: 'schedule_visit',
      COLLECT_INFO: 'collect_info',
      COMPLETED: 'completed'
    };
  }

  async generateResponse(message, context = {}) {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userMessage = `User message: "${message}"`;

      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 10000,
        temperature: 0.7
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error);
      return this.getFallbackResponse(context);
    }
  }

  buildSystemPrompt(context) {
    let prompt = `You are a helpful real estate assistant for Malpure Group, a WhatsApp chatbot that helps users find properties and schedule viewings.

Your role:
- Help users find their perfect property
- Answer questions about real estate
- Guide users through the property viewing process
- Be friendly, professional, and concise
- Keep responses short for WhatsApp (under 200 characters when possible)

Current context:
- Conversation state: ${context.state || 'initial'}`;

    // Add state-specific context
    switch (context.state) {
      case this.conversationStates.WELCOME:
        prompt += `\n- You are greeting the user for the first time`;
        break;
      case this.conversationStates.LOCATION:
        prompt += `\n- You are asking the user for their preferred location`;
        break;
      case this.conversationStates.BUDGET:
        prompt += `\n- User's preferred location: ${context.userPreferences?.location || 'Not specified'}`;
        prompt += `\n- You are asking the user for their budget range`;
        break;
      case this.conversationStates.BHK:
        prompt += `\n- User's preferred location: ${context.userPreferences?.location || 'Not specified'}`;
        prompt += `\n- User's budget range: ${context.userPreferences?.budget?.min || 'Not specified'} - ${context.userPreferences?.budget?.max || 'Not specified'}`;
        prompt += `\n- You are asking the user for their preferred number of bedrooms (BHK)`;
        break;
      case this.conversationStates.PROPERTY_MATCH:
        prompt += `\n- User's preferences: ${JSON.stringify(context.userPreferences || {})}`;
        prompt += `\n- Available matching properties: ${context.availableProperties || 0}`;
        break;
      case this.conversationStates.SCHEDULE_VISIT:
        prompt += `\n- Selected property: ${context.selectedProperty?.title || 'Not specified'}`;
        prompt += `\n- You are asking if the user wants to schedule a visit`;
        break;
      case this.conversationStates.COLLECT_INFO:
        prompt += `\n- Selected property: ${context.selectedProperty?.title || 'Not specified'}`;
        prompt += `\n- You are collecting user information for scheduling a visit`;
        break;
      case this.conversationStates.COMPLETED:
        prompt += `\n- Appointment has been scheduled`;
        prompt += `\n- User info: ${JSON.stringify(context.userInfo || {})}`;
        break;
    }

    if (context.selectedProperty) {
      prompt += `\n- Currently discussing property: ${JSON.stringify(context.selectedProperty)}`;
    }

    if (context.userPreferences && context.state !== this.conversationStates.BHK) {
      prompt += `\n- User preferences: ${JSON.stringify(context.userPreferences)}`;
    }

    prompt += `\n\nGuidelines:
- Follow the real estate bot flow: Welcome → Location → Budget → BHK → Property Match → Schedule Visit → Collect Info
- Keep responses concise and engaging for WhatsApp
- Use emojis appropriately for a friendly tone
- Provide personalized responses based on user preferences
- For property details, highlight key features that match user preferences
- When scheduling visits, be clear about the next steps
- Always maintain a professional but friendly tone
- Use Indian Rupee format (₹) for prices`;

    return prompt;
  }

  async extractUserIntent(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `Analyze this user message and return the primary intent. Return only one of these intents:
          - greeting
          - location_info
          - budget_info
          - bhk_info
          - view_properties
          - property_details
          - schedule_viewing
          - provide_contact_info
          - restart
          - ask_question
          - other
          
          Message: "${message}"`
        }],
        max_tokens: 50,
        temperature: 0.1
      });

      return completion.choices[0].message.content.trim().toLowerCase();
    } catch (error) {
      console.error('Intent extraction error:', error);
      return 'other';
    }
  }

  async extractLocation(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `Extract the location mentioned in this message: "${message}". If multiple locations are mentioned, return the most specific one. If no clear location is mentioned, respond with "UNCLEAR". Only return the location name, nothing else.`
        }],
        max_tokens: 50,
        temperature: 0.1
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Location extraction error:', error);
      return 'UNCLEAR';
    }
  }

  async extractBudget(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `Extract the budget range from this message: "${message}". Format the response as MIN-MAX in numbers only (e.g., "1000000-2000000"). Convert any lakh/crore values to their numeric equivalents. If no clear budget is mentioned, respond with "UNCLEAR".`
        }],
        max_tokens: 50,
        temperature: 0.1
      });

      const response = completion.choices[0].message.content.trim();
      
      if (response === 'UNCLEAR') {
        return { min: null, max: null };
      }
      
      const [min, max] = response.split('-').map(num => parseInt(num.trim()));
      return { min, max };
    } catch (error) {
      console.error('Budget extraction error:', error);
      return { min: null, max: null };
    }
  }

  async extractBHK(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `Extract the number of bedrooms (BHK) from this message: "${message}". Return only the number (e.g., "2"). If no clear BHK is mentioned, respond with "UNCLEAR".`
        }],
        max_tokens: 50,
        temperature: 0.1
      });

      const response = completion.choices[0].message.content.trim();
      
      if (response === 'UNCLEAR') {
        return null;
      }
      
      return parseInt(response);
    } catch (error) {
      console.error('BHK extraction error:', error);
      return null;
    }
  }

  async extractUserInfo(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `Extract the following information from this message:\n` +
                  `"${message}"\n\n` +
                  `Format the response as JSON with these fields:\n` +
                  `{"name": "extracted name", "phone": "extracted phone", "time": "extracted time"}\n` +
                  `If any field is missing, set its value to null.`
        }],
        max_tokens: 100,
        temperature: 0.1
      });

      try {
        const userInfo = JSON.parse(completion.choices[0].message.content.trim());
        
        // Format the time with day of week if it contains a date
        if (userInfo.time) {
          // Check if the time contains a date in format like DD/MM/YYYY
          const dateRegex = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/;
          const match = userInfo.time.match(dateRegex);
          
          if (match) {
            try {
              // Extract date components
              const day = parseInt(match[1]);
              const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
              const year = parseInt(match[3]);
              
              // Create a date object to get the day of week
              const date = new Date(year, month, day);
              
              // Get day of week
              const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const dayOfWeek = daysOfWeek[date.getDay()];
              
              // Format the time text to include day of week
              userInfo.time = userInfo.time.replace(match[0], `${dayOfWeek} ${match[0]}`);
            } catch (error) {
              console.error('Error formatting date with day of week:', error);
              // If there's an error, just use the original input
            }
          }
        }
        
        return userInfo;
      } catch (e) {
        console.error('Error parsing user info JSON:', e);
        return { name: null, phone: null, time: null };
      }
    } catch (error) {
      console.error('User info extraction error:', error);
      return { name: null, phone: null, time: null };
    }
  }

  async extractUserPreferences(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `Extract user preferences from this message about real estate. Return a JSON object with any of these fields that are mentioned:
          - bedrooms (number)
          - location (string)
          - budget (string)
          - type (apartment/villa/house/plot)
          - amenities (array of strings)
          
          If no specific preferences are mentioned, return an empty object {}.
          
          Message: "${message}"`
        }],
        max_tokens: 100,
        temperature: 0.1
      });

      const response = completion.choices[0].message.content.trim();
      try {
        return JSON.parse(response);
      } catch {
        return {};
      }
    } catch (error) {
      console.error('Preference extraction error:', error);
      return {};
    }
  }

  async generatePropertyRecommendation(userPreferences, availableProperties) {
    try {
      const propertiesText = availableProperties.map(p => 
        `${p.title} - ${p.location} - ${p.price} - ${p.bedrooms}BHK - ${p.type}`
      ).join('\n');

      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `Based on user preferences, recommend the best matching properties from the list.
          
          User preferences: ${JSON.stringify(userPreferences)}
          
          Available properties:
          ${propertiesText}
          
          Provide a brief recommendation explaining why certain properties match their needs. Keep it under 150 words and WhatsApp-friendly.`
        }],
        max_tokens: 150,
        temperature: 0.7
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Recommendation generation error:', error);
      return "I'd be happy to help you find the perfect property! Please let me know your preferences for location, budget, and number of bedrooms.";
    }
  }

  async processDateTimeInput(dateTimeString) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system", 
          content: `Parse this date/time input and return a standardized format. 
          Input: "${dateTimeString}"
          
          Return in format: "Day, Month Date, Year at Time" (e.g., "Monday, December 25, 2023 at 2:00 PM")
          If unclear, return the original input.`
        }],
        max_tokens: 50,
        temperature: 0.1
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('DateTime processing error:', error);
      return dateTimeString;
    }
  }

  getFallbackResponse(context) {
    const fallbacks = {
      initial: "Hello! I'm here to help you find your perfect property. Type 'properties' to see what's available! 🏠",
      browsing: "I can help you explore our properties. Send me a property number to see details, or ask me any questions!",
      property_details: "Would you like to know more about this property or schedule a viewing?",
      scheduling: "Please let me know your preferred date and time for the property viewing.",
      default: "I'm here to help you with property searches and viewings. Type 'properties' to get started! 🏠"
    };

    return fallbacks[context.state] || fallbacks.default;
  }

  // Check if user message contains scheduling keywords
  containsSchedulingKeywords(message) {
    const keywords = ['schedule', 'viewing', 'visit', 'see', 'appointment', 'book', 'when', 'time', 'date'];
    const lowerMessage = message.toLowerCase();
    return keywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Check if user is providing contact information
  looksLikeContactInfo(message) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phoneRegex = /\b\d{10,}\b/;
    const commaCount = (message.match(/,/g) || []).length;
    
    return emailRegex.test(message) || phoneRegex.test(message) || commaCount >= 1;
  }

  async analyzePropertyImage(imageUrl) {
    try {
      console.log(`Analyzing property image: ${imageUrl}`);
      
      // Call vision model to analyze the image
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free", // Using vision model
        messages: [{
          role: "system",
          content: `You are a real estate image analyzer specializing in Indian properties. Analyze the provided image and determine:
          1. If it shows a property (house, apartment, building, etc.)
          2. Extract key features visible in the image (location hints, property type, approximate size/BHK)
          3. Any notable amenities visible
          4. Architectural style and quality assessment
          5. Surrounding environment (if visible)
          
          Return the analysis as JSON with the following structure:
          {
            "isProperty": boolean,
            "features": {
              "type": string (apartment, villa, house, etc.),
              "bhk": number (if detectable),
              "location": string (if detectable),
              "amenities": array of strings,
              "quality": string (luxury, premium, standard, budget),
              "style": string (modern, traditional, etc.),
              "surroundings": string (description of surroundings if visible)
            },
            "description": string (brief description of what's visible),
            "confidence": number (0-1 indicating confidence in analysis)
          }`
        }, {
          role: "user",
          content: [
            { type: "text", text: "Analyze this property image:" },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 800
      });

      // Parse the response
      try {
        const analysisText = completion.choices[0].message.content.trim();
        // Extract JSON from the response (handling potential text before/after JSON)
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return { isProperty: false, confidence: 0 };
      } catch (parseError) {
        console.error('Error parsing image analysis result:', parseError);
        return { isProperty: false, confidence: 0 };
      }
    } catch (error) {
      console.error('Error analyzing property image:', error);
      return { isProperty: false, confidence: 0 };
    }
  }

  async analyzeDocumentImage(imageUrl) {
    try {
      // Call vision model to extract text from document
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `You are a document analyzer for a real estate company. Extract all text from the provided document image.
          If it appears to be an ID or contains personal information, only extract the type of document
          and mention that it contains personal information without including the actual details.
          
          For real estate documents, extract and organize the following information if present:
          1. Property details (address, size, type)
          2. Financial information (price, payment terms)
          3. Legal information (ownership, encumbrances)
          4. Contact information (if not personal)
          
          Format the extracted information in a structured way.`
        }, {
          role: "user",
          content: [
            { type: "text", text: "Extract text from this document:" },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 800
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error analyzing document image:', error);
      return "Error analyzing document";
    }
  }

  async transcribeAudio(audioUrl) {
    // Placeholder for future audio transcription functionality
    // This would typically use a speech-to-text service
    console.log(`Audio transcription requested for: ${audioUrl}`);
    return "Audio transcription not yet implemented";
  }
  
  async analyzePropertyVideo(videoUrl, thumbnailUrl) {
    try {
      // For now, we'll analyze the thumbnail image as a proxy for video content
      // In a production environment, this would extract frames from the video
      // or use a specialized video analysis service
      console.log(`Analyzing property video thumbnail: ${thumbnailUrl}`);
      
      const imageAnalysis = await this.analyzePropertyImage(thumbnailUrl);
      
      // Add video-specific metadata
      return {
        ...imageAnalysis,
        isVideo: true,
        videoUrl: videoUrl,
        message: "Video analysis based on thumbnail only. Full video analysis not yet implemented."
      };
    } catch (error) {
      console.error('Error analyzing property video:', error);
      return { isProperty: false, isVideo: true, confidence: 0 };
    }
  }
  
  async extractLocationFromCoordinates(latitude, longitude) {
    try {
      // In a production environment, this would call a geocoding API
      // For now, we'll use AI to generate a plausible location description
      const completion = await this.openai.chat.completions.create({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [{
          role: "system",
          content: `You are a location analyzer. Given these coordinates: ${latitude}, ${longitude}, 
          provide a plausible location name and description for India. 
          Format as JSON: {"name": "Location name", "description": "Brief description"}`
        }],
        max_tokens: 100,
        temperature: 0.3
      });

      try {
        const responseText = completion.choices[0].message.content.trim();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return { name: "Unknown Location", description: "Location details not available" };
      } catch (parseError) {
        console.error('Error parsing location data:', parseError);
        return { name: "Unknown Location", description: "Location details not available" };
      }
    } catch (error) {
      console.error('Error extracting location from coordinates:', error);
      return { name: "Unknown Location", description: "Location details not available" };
    }
  }
}

module.exports = AIService;