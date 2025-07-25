// tests/whatsappService.test.js
const WhatsAppService = require('../services/whatsappService');

// Mock Twilio client
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => {
    return {
      messages: {
        create: jest.fn().mockResolvedValue({
          sid: 'test-message-sid',
          status: 'queued'
        })
      }
    };
  });
});

describe('WhatsAppService', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
    
    // Set up test environment variables
    process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
    process.env.TWILIO_PHONE_NUMBER = 'whatsapp:+14155238886';
  });
  
  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });
  
  test('should initialize with Twilio client', () => {
    expect(WhatsAppService.client).toBeDefined();
  });
  
  test('should send text message', async () => {
    const to = 'whatsapp:+1234567890';
    const message = 'Test message';
    
    const result = await WhatsAppService.sendTextMessage(to, message);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalledWith({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
      body: message
    });
  });
  
  test('should send welcome message', async () => {
    const to = 'whatsapp:+1234567890';
    
    const result = await WhatsAppService.sendWelcomeMessage(to);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    
    // Check that the welcome message contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toContain('Welcome');
  });
  
  test('should send location request', async () => {
    const to = 'whatsapp:+1234567890';
    
    const result = await WhatsAppService.sendLocationRequest(to);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    
    // Check that the location request contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toContain('location');
  });
  
  test('should send budget request', async () => {
    const to = 'whatsapp:+1234567890';
    const location = 'Mumbai';
    
    const result = await WhatsAppService.sendBudgetRequest(to, location);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    
    // Check that the budget request contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toContain('budget');
    expect(callArgs.body).toContain(location);
  });
  
  test('should send BHK request', async () => {
    const to = 'whatsapp:+1234567890';
    const location = 'Mumbai';
    const budget = '50-80';
    
    const result = await WhatsAppService.sendBHKRequest(to, location, budget);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    
    // Check that the BHK request contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toContain('BHK');
    expect(callArgs.body).toContain(location);
    expect(callArgs.body).toContain(budget);
  });
  
  test('should send property details', async () => {
    const to = 'whatsapp:+1234567890';
    const property = {
      title: 'Test Property',
      location: 'Mumbai',
      price: 5000000,
      bedrooms: 2,
      bathrooms: 2,
      area: { value: 1000, unit: 'sq.ft' },
      description: 'A beautiful property',
      images: [{ url: 'https://example.com/image.jpg', caption: 'Property Image' }],
      formatForWhatsApp: jest.fn().mockReturnValue('Formatted property details'),
      formatPriceIndian: jest.fn().mockReturnValue('₹50 Lakhs')
    };
    
    const result = await WhatsAppService.sendPropertyDetails(to, property);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    expect(property.formatForWhatsApp).toHaveBeenCalled();
    
    // Check that the property details message contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toBe('Formatted property details');
  });
  
  test('should send property image', async () => {
    const to = 'whatsapp:+1234567890';
    const imageUrl = 'https://example.com/image.jpg';
    const caption = 'Test Image';
    
    const result = await WhatsAppService.sendPropertyImage(to, imageUrl, caption);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalledWith({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
      body: caption,
      mediaUrl: [imageUrl]
    });
  });
  
  test('should send schedule visit request', async () => {
    const to = 'whatsapp:+1234567890';
    const property = {
      title: 'Test Property',
      location: 'Mumbai',
      formatPriceIndian: jest.fn().mockReturnValue('₹50 Lakhs')
    };
    
    const result = await WhatsAppService.sendScheduleVisitRequest(to, property);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    
    // Check that the schedule visit request contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toContain('schedule');
    expect(callArgs.body).toContain('Test Property');
  });
  
  test('should send contact info request', async () => {
    const to = 'whatsapp:+1234567890';
    
    const result = await WhatsAppService.sendContactInfoRequest(to);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    
    // Check that the contact info request contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toContain('name');
    expect(callArgs.body).toContain('phone');
  });
  
  test('should send appointment confirmation', async () => {
    const to = 'whatsapp:+1234567890';
    const property = {
      title: 'Test Property',
      location: 'Mumbai'
    };
    const userInfo = {
      name: 'John Doe',
      preferredTime: new Date(),
      preferredTimeText: 'Tomorrow at 2 PM'
    };
    
    const result = await WhatsAppService.sendAppointmentConfirmation(to, property, userInfo);
    
    expect(result).toBe(true);
    expect(WhatsAppService.client.messages.create).toHaveBeenCalled();
    
    // Check that the appointment confirmation contains expected content
    const callArgs = WhatsAppService.client.messages.create.mock.calls[0][0];
    expect(callArgs.body).toContain('confirmed');
    expect(callArgs.body).toContain('Test Property');
    expect(callArgs.body).toContain('John Doe');
    expect(callArgs.body).toContain('Tomorrow at 2 PM');
  });
  
  test('should handle Twilio errors gracefully', async () => {
    // Mock Twilio error
    WhatsAppService.client.messages.create.mockRejectedValueOnce(new Error('Twilio Error'));
    
    const to = 'whatsapp:+1234567890';
    const message = 'Test message';
    
    // Should return false on error
    const result = await WhatsAppService.sendTextMessage(to, message);
    expect(result).toBe(false);
  });
  
  test('should validate phone numbers correctly', () => {
    // Valid phone numbers
    expect(WhatsAppService.validatePhoneNumber('+1234567890')).toBe(true);
    expect(WhatsAppService.validatePhoneNumber('1234567890')).toBe(true);
    
    // Invalid phone numbers
    expect(WhatsAppService.validatePhoneNumber('123')).toBe(false);
    expect(WhatsAppService.validatePhoneNumber('abc')).toBe(false);
    expect(WhatsAppService.validatePhoneNumber('')).toBe(false);
  });
  
  test('should extract phone number from WhatsApp format', () => {
    expect(WhatsAppService.extractPhoneNumber('whatsapp:+1234567890')).toBe('+1234567890');
    expect(WhatsAppService.extractPhoneNumber('whatsapp:1234567890')).toBe('1234567890');
    expect(WhatsAppService.extractPhoneNumber('+1234567890')).toBe('+1234567890');
  });
});