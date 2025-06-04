// services/whatsappService.js
const twilio = require('twilio');

class WhatsAppService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.fromNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
  }

  async sendMessage(to, body, mediaUrl = null) {
    try {
      // Validate the phone number
      const extractedNumber = WhatsAppService.extractPhoneNumber(to);
      if (!WhatsAppService.validatePhoneNumber(extractedNumber)) {
        throw new Error(`Invalid phone number format: ${to}`);
      }
  
      const messageOptions = {
        body: body,
        from: this.fromNumber,
        to: `whatsapp:${extractedNumber}`
      };
  
      if (mediaUrl) {
        messageOptions.mediaUrl = [mediaUrl];
      }
  
      const message = await this.client.messages.create(messageOptions);
      console.log(`Message sent to ${to}: ${message.sid}`);
      return message.sid;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }
  

  async sendTemplate(to, templateName, parameters = []) {
    try {
      const message = await this.client.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${to}`,
        contentSid: templateName,
        contentVariables: JSON.stringify(parameters)
      });
      return message.sid;
    } catch (error) {
      console.error('Error sending WhatsApp template:', error);
      throw error;
    }
  }

  async sendLocation(to, latitude, longitude, name, address) {
    try {
      const message = await this.client.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${to}`,
        body: `📍 *${name}*\n${address}`,
        persistentAction: [
          `geo:${latitude},${longitude}`
        ]
      });
      return message.sid;
    } catch (error) {
      console.error('Error sending location:', error);
      throw error;
    }
  }

  async sendPropertyImages(to, propertyTitle, imageUrls) {
    try {
      const promises = imageUrls.map((url, index) => {
        const caption = index === 0 ? `🏠 ${propertyTitle}` : '';
        return this.sendMessage(to, caption, url);
      });
      
      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      console.error('Error sending property images:', error);
      throw error;
    }
  }

  // Format common message templates
  static templates = {
    welcome: (properties) => {
      const propertyList = properties.map((prop, index) => prop.formatForList(index)).join('\n\n');
      return `🏠 *Welcome to Malpure Group!*\n\n` +
             `I'm here to help you find your dream property and schedule viewings.\n\n` +
             `Here are our available properties:\n\n${propertyList}\n\n` +
             `Reply with the property number to see details, or ask me anything about real estate!`;
    },

    propertyDetails: (property) => {
      return `${property.formatDetails()}\n\n` +
             `Would you like to schedule a viewing for this property? Reply *YES* to proceed or *BACK* to see other properties.`;
    },

    schedulingPrompt: (propertyTitle) => {
      return `Great! Let's schedule your viewing for *${propertyTitle}*.\n\n` +
             `Please provide your preferred date and time.\n\n` +
             `Example: "Tomorrow 2 PM" or "25th December 10 AM"\n\n` +
             `Available slots: 9 AM - 6 PM (Mon-Sun)`;
    },

    contactInfo: (datetime) => {
      return `Perfect! I've noted your preferred time: *${datetime}*\n\n` +
             `Now, please provide your contact details:\n\n` +
             `Format: Name, Email, Phone\n` +
             `Example: John Doe, john@email.com, 9876543210`;
    },

    confirmation: (appointmentData, appointmentId) => {
      return `✅ *Viewing Scheduled Successfully!*\n\n` +
             `📋 *Appointment Details:*\n` +
             `🏠 Property: ${appointmentData.propertyTitle}\n` +
             `📅 Date/Time: ${appointmentData.preferredDateTime}\n` +
             `👤 Name: ${appointmentData.customerName}\n` +
             `📧 Email: ${appointmentData.customerEmail}\n` +
             `📱 Phone: ${appointmentData.customerPhone}\n\n` +
             `📝 Appointment ID: ${appointmentId}\n\n` +
             `Our agent will contact you within 24 hours to confirm the exact timing.\n\n` +
             `Type 'properties' to view more properties or 'help' for assistance.`;
    },

    error: () => {
      return `Sorry, I didn't understand that. Here are some things you can try:\n\n` +
             `• Type "properties" to see available properties\n` +
             `• Type "help" for assistance\n` +
             `• Send a property number (1, 2, 3, etc.) to see details`;
    },

    help: () => {
      return `🤖 *How can I help you?*\n\n` +
             `Here's what I can do:\n` +
             `• Show you available properties\n` +
             `• Provide detailed property information\n` +
             `• Schedule property viewings\n` +
             `• Answer questions about real estate\n\n` +
             `*Quick Commands:*\n` +
             `• "properties" - View all properties\n` +
             `• "help" - Show this message\n` +
             `• Send property numbers (1, 2, 3) for details`;
    }
  };

  // Validate phone number format
  static validatePhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  // Extract phone number from WhatsApp format
  static extractPhoneNumber(whatsappNumber) {
    return whatsappNumber.replace('whatsapp:', '');
  }
}

module.exports = WhatsAppService;