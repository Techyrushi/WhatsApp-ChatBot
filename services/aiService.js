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
        max_tokens: 200,
        temperature: 0.7
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error);
      return this.getFallbackResponse(context);
    }
  }

  buildSystemPrompt(context) {
    let prompt = `You are a helpful real estate assistant for PropertyFinder, a WhatsApp chatbot that helps users find properties and schedule viewings.

Your role:
- Help users find their perfect property
- Answer questions about real estate
- Guide users through the property viewing process
- Be friendly, professional, and concise
- Keep responses short for WhatsApp (under 200 characters when possible)

Current context:
- Conversation state: ${context.state || 'initial'}
- Available properties: ${context.availableProperties || 0}`;

    if (context.selectedProperty) {
      prompt += `\n- Currently discussing: ${context.selectedProperty.title}`;
    }

    if (context.userPreferences) {
      prompt += `\n- User preferences: ${JSON.stringify(context.userPreferences)}`;
    }

    prompt += `\n\nGuidelines:
- If user asks about properties, guide them to type "properties"
- If user seems interested in scheduling, guide them toward that process
- If user asks about locations, prices, or amenities, provide helpful information
- Always end with a helpful next step suggestion
- Use emojis appropriately for WhatsApp
- Be conversational but stay focused on real estate`;

    return prompt;
  }

  async extractUserIntent(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: `Analyze this user message and return the primary intent. Return only one of these intents:
          - greeting
          - view_properties
          - property_details
          - schedule_viewing
          - ask_question
          - provide_info
          - other
          
          Message: "${message}"`
        }],
        max_tokens: 1000,
        temperature: 0.1
      });

      return completion.choices[0].message.content.trim().toLowerCase();
    } catch (error) {
      console.error('Intent extraction error:', error);
      return 'other';
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