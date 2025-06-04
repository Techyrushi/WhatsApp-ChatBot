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
        model: "deepseek/deepseek-r1:free",
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
        model: "deepseek/deepseek-r1:free",
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
        model: "deepseek/deepseek-r1:free",
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
        model: "deepseek/deepseek-r1:free",
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
        model: "deepseek/deepseek-r1:free",
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
        model: "deepseek/deepseek-r1:free",
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
        return JSON.parse(completion.choices[0].message.content.trim());
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
        model: "gpt-3.5-turbo",
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
        model: "gpt-3.5-turbo",
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
        model: "gpt-3.5-turbo",
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
}

module.exports = AIService;