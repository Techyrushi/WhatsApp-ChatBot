// utils/helpers.js
class Helpers {
  // Format phone number to international format
  static formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91)
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    } else if (cleaned.length === 13 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    }
    
    return phoneNumber; // Return original if can't format
  }

  // Validate email format
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Parse contact information from user input
  static parseContactInfo(input) {
    const parts = input.split(',').map(part => part.trim());
    
    const contact = {
      name: null,
      email: null,
      phone: null
    };

    // Try to identify each part
    parts.forEach(part => {
      if (this.isValidEmail(part)) {
        contact.email = part;
      } else if (/^\d{10,}$/.test(part.replace(/\D/g, ''))) {
        contact.phone = this.formatPhoneNumber(part);
      } else if (!contact.name && part.length > 2) {
        contact.name = part;
      }
    });

    return contact;
  }

  // Generate unique appointment reference
  static generateAppointmentReference() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `APT-${dateStr}-${randomStr}`;
  }

  // Format date for display
  static formatDate(date) {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Format currency (Indian Rupees)
  static formatCurrency(amount) {
    if (typeof amount === 'string') {
      return amount; // Already formatted
    }
    
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Sanitize user input
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 500); // Limit length
  }

  // Check if message contains property number
  static extractPropertyNumber(message) {
    const matches = message.match(/\b([1-9]\d?)\b/);
    return matches ? parseInt(matches[1]) : null;
  }

  // Check if message is affirmative
  static isAffirmative(message) {
    const affirmativeWords = [
      'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'correct',
      'right', 'proceed', 'continue', 'go ahead', 'confirm'
    ];
    
    const lowerMessage = message.toLowerCase().trim();
    return affirmativeWords.some(word => lowerMessage.includes(word));
  }

  // Check if message is negative
  static isNegative(message) {
    const negativeWords = [
      'no', 'nope', 'cancel', 'stop', 'quit', 'exit',
      'back', 'return', 'previous', 'wrong'
    ];
    
    const lowerMessage = message.toLowerCase().trim();
    return negativeWords.some(word => lowerMessage.includes(word));
  }

  // Extract time from message
  static extractTime(message) {
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2})\s*(am|pm)/i,
      /(\d{1,2}):(\d{2})/,
      /(\d{1,2})\s*o'?clock/i
    ];

    for (const pattern of timePatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  // Extract date from message
  static extractDate(message) {
    const datePatterns = [
      /tomorrow/i,
      /today/i,
      /next week/i,
      /(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
    ];

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  // Convert message to title case
  static toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  // Generate property search keywords
  static extractSearchKeywords(message) {
    const keywords = {
      location: [],
      type: [],
      bedrooms: null,
      budget: null,
      amenities: []
    };

    const lowerMessage = message.toLowerCase();

    // Extract location keywords
    const locationWords = [
      'koramangala', 'whitefield', 'electronic city', 'btm layout',
      'indiranagar', 'jayanagar', 'malleshwaram', 'rajajinagar',
      'hebbal', 'marathahalli', 'sarjapur', 'hsr layout'
    ];
    
    locationWords.forEach(location => {
      if (lowerMessage.includes(location)) {
        keywords.location.push(location);
      }
    });

    // Extract property type
    const typeWords = ['apartment', 'villa', 'house', 'flat', 'plot'];
    typeWords.forEach(type => {
      if (lowerMessage.includes(type)) {
        keywords.type.push(type);
      }
    });

    // Extract bedroom count
    const bedroomMatch = lowerMessage.match(/(\d+)\s*bhk/);
    if (bedroomMatch) {
      keywords.bedrooms = parseInt(bedroomMatch[1]);
    }

    // Extract amenities
    const amenityWords = [
      'parking', 'gym', 'swimming pool', 'security', 'lift',
      'garden', 'balcony', 'power backup', 'club house'
    ];
    
    amenityWords.forEach(amenity => {
      if (lowerMessage.includes(amenity)) {
        keywords.amenities.push(amenity);
      }
    });

    return keywords;
  }

  // Log user interaction
  static logInteraction(phoneNumber, message, response, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      phoneNumber: phoneNumber,
      userMessage: message,
      botResponse: response,
      context: context
    };

    console.log('User Interaction:', JSON.stringify(logEntry, null, 2));
    
    // In production, you might want to save this to a database
    // or send to a logging service like Winston, etc.
  }

  // Rate limiting helper
  static rateLimitKey(phoneNumber) {
    return `rate_limit:${phoneNumber}`;
  }

  // Generate OTP for verification (if needed)
  static generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    
    return otp;
  }

  // Format duration in human readable format
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  // Check business hours
  static isBusinessHours() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    
    // Business hours: Mon-Sat 9 AM - 6 PM
    return day >= 1 && day <= 6 && hour >= 9 && hour < 18;
  }

  // Get business hours message
  static getBusinessHoursMessage() {
    if (this.isBusinessHours()) {
      return "We're currently available to help you!";
    } else {
      return "We're currently outside business hours (Mon-Sat 9 AM - 6 PM). We'll respond to your message as soon as possible.";
    }
  }

  // Encrypt sensitive data (basic implementation)
  static encryptData(data, key = process.env.ENCRYPTION_KEY) {
    if (!key) return data;
    
    // This is a basic implementation
    // In production, use proper encryption libraries like crypto
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes192', key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // Decrypt sensitive data
  static decryptData(encryptedData, key = process.env.ENCRYPTION_KEY) {
    if (!key) return encryptedData;
    
    const crypto = require('crypto');
    const decipher = crypto.createDecipher('aes192', key);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Validate Indian phone number
  static isValidIndianPhoneNumber(phone) {
    const indianPhoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
    return indianPhoneRegex.test(phone.replace(/\s+/g, ''));
  }

  // Get time-based greeting
  static getTimeBasedGreeting() {
    const hour = new Date().getHours();
    
    if (hour < 12) {
      return "Good morning";
    } else if (hour < 17) {
      return "Good afternoon";
    } else {
      return "Good evening";
    }
  }
}

module.exports = Helpers;