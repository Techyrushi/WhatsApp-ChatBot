// tests/conversationService.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import services and models for testing
const ConversationService = require('../services/conversationService');
const Conversation = require('../models/Conversation');
const Property = require('../models/Property');
const User = require('../models/User');

// Mock dependencies
jest.mock('../services/whatsappService');
jest.mock('../services/aiService');
jest.mock('../services/appointmentService');

const WhatsAppService = require('../services/whatsappService');
const AIService = require('../services/aiService');
const AppointmentService = require('../services/appointmentService');

let mongoServer;
let conversationService;

beforeAll(async () => {
  // Set up in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  await Conversation.deleteMany({});
  await Property.deleteMany({});
  await User.deleteMany({});
  
  // Set up mocks
  WhatsAppService.sendTextMessage = jest.fn().mockResolvedValue(true);
  WhatsAppService.sendPropertyDetails = jest.fn().mockResolvedValue(true);
  WhatsAppService.sendLocationRequest = jest.fn().mockResolvedValue(true);
  
  AIService.prototype.generateResponse = jest.fn().mockResolvedValue('AI response');
  AIService.prototype.extractLocation = jest.fn().mockResolvedValue('Mumbai');
  AIService.prototype.extractBudget = jest.fn().mockResolvedValue('50-80');
  AIService.prototype.extractBHK = jest.fn().mockResolvedValue(2);
  AIService.prototype.extractUserInfo = jest.fn().mockResolvedValue({
    name: 'John Doe',
    phone: '+1234567890',
    preferredTime: new Date(),
    preferredTimeText: 'Tomorrow at 2 PM'
  });
  
  AppointmentService.createAppointment = jest.fn().mockResolvedValue({
    _id: 'appointment-id',
    propertyId: 'property-id',
    userId: 'user-id',
    dateTime: new Date(),
    status: 'scheduled'
  });
  
  // Initialize conversation service
  conversationService = new ConversationService();
});

describe('ConversationService', () => {
  test('should create a new conversation for a new user', async () => {
    const userId = 'whatsapp:+1234567890';
    const conversation = await conversationService.getOrCreateConversation(userId);
    
    expect(conversation).not.toBeNull();
    expect(conversation.userId).toBe(userId);
    expect(conversation.state).toBe('welcome');
  });
  
  test('should process welcome state and move to location state', async () => {
    const userId = 'whatsapp:+1234567890';
    const message = 'Hi';
    
    await conversationService.processMessage(userId, message);
    
    // Check if welcome message was sent
    expect(WhatsAppService.sendTextMessage).toHaveBeenCalled();
    
    // Check if state was updated
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('location');
  });
  
  test('should process location state and move to budget state', async () => {
    // Create a conversation in location state
    const userId = 'whatsapp:+1234567890';
    await Conversation.create({
      userId,
      state: 'location',
      preferences: {}
    });
    
    const message = 'I want a property in Mumbai';
    
    await conversationService.processMessage(userId, message);
    
    // Check if location was extracted and saved
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('budget');
    expect(conversation.preferences.location).toBe('Mumbai');
  });
  
  test('should process budget state and move to bhk state', async () => {
    // Create a conversation in budget state
    const userId = 'whatsapp:+1234567890';
    await Conversation.create({
      userId,
      state: 'budget',
      preferences: { location: 'Mumbai' }
    });
    
    const message = 'My budget is 50-80 lakhs';
    
    await conversationService.processMessage(userId, message);
    
    // Check if budget was extracted and saved
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('bhk');
    expect(conversation.preferences.budget).toBe('50-80');
  });
  
  test('should process bhk state and move to property_match state', async () => {
    // Create a conversation in bhk state
    const userId = 'whatsapp:+1234567890';
    await Conversation.create({
      userId,
      state: 'bhk',
      preferences: { location: 'Mumbai', budget: '50-80' }
    });
    
    // Create test properties
    await Property.create([
      {
        title: 'Property 1',
        location: 'Mumbai',
        price: 5000000, // 50 lakhs
        type: 'apartment',
        bedrooms: 2,
        bathrooms: 1,
        area: { value: 800, unit: 'sq.ft' },
        description: 'Test property 1',
        images: [{ url: 'https://example.com/1.jpg', caption: 'Image 1' }],
        agent: { name: 'Agent 1', phone: '+1234567890', email: 'agent1@example.com' }
      },
      {
        title: 'Property 2',
        location: 'Mumbai',
        price: 7000000, // 70 lakhs
        type: 'apartment',
        bedrooms: 2,
        bathrooms: 2,
        area: { value: 1000, unit: 'sq.ft' },
        description: 'Test property 2',
        images: [{ url: 'https://example.com/2.jpg', caption: 'Image 2' }],
        agent: { name: 'Agent 2', phone: '+1234567891', email: 'agent2@example.com' }
      }
    ]);
    
    const message = 'I need 2 BHK';
    
    await conversationService.processMessage(userId, message);
    
    // Check if BHK was extracted and saved
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('property_match');
    expect(conversation.preferences.bhk).toBe(2);
    expect(conversation.matchedProperties.length).toBe(2);
  });
  
  test('should process property_match state and move to schedule_visit state', async () => {
    // Create a conversation in property_match state with matched properties
    const userId = 'whatsapp:+1234567890';
    const properties = await Property.create([
      {
        title: 'Property 1',
        location: 'Mumbai',
        price: 5000000,
        type: 'apartment',
        bedrooms: 2,
        bathrooms: 1,
        area: { value: 800, unit: 'sq.ft' },
        description: 'Test property 1',
        images: [{ url: 'https://example.com/1.jpg', caption: 'Image 1' }],
        agent: { name: 'Agent 1', phone: '+1234567890', email: 'agent1@example.com' }
      }
    ]);
    
    await Conversation.create({
      userId,
      state: 'property_match',
      preferences: { location: 'Mumbai', budget: '50-80', bhk: 2 },
      matchedProperties: [properties[0]._id]
    });
    
    const message = 'I like property 1';
    
    await conversationService.processMessage(userId, message);
    
    // Check if selected property was saved
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('schedule_visit');
    expect(conversation.selectedProperty.toString()).toBe(properties[0]._id.toString());
  });
  
  test('should process schedule_visit state and move to collect_info state', async () => {
    // Create a conversation in schedule_visit state with selected property
    const userId = 'whatsapp:+1234567890';
    const property = await Property.create({
      title: 'Property 1',
      location: 'Mumbai',
      price: 5000000,
      type: 'apartment',
      bedrooms: 2,
      bathrooms: 1,
      area: { value: 800, unit: 'sq.ft' },
      description: 'Test property 1',
      images: [{ url: 'https://example.com/1.jpg', caption: 'Image 1' }],
      agent: { name: 'Agent 1', phone: '+1234567890', email: 'agent1@example.com' }
    });
    
    await Conversation.create({
      userId,
      state: 'schedule_visit',
      preferences: { location: 'Mumbai', budget: '50-80', bhk: 2 },
      selectedProperty: property._id
    });
    
    const message = 'Yes, I want to schedule a visit';
    
    await conversationService.processMessage(userId, message);
    
    // Check if state was updated
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('collect_info');
  });
  
  test('should process collect_info state and move to completed state', async () => {
    // Create a conversation in collect_info state
    const userId = 'whatsapp:+1234567890';
    const property = await Property.create({
      title: 'Property 1',
      location: 'Mumbai',
      price: 5000000,
      type: 'apartment',
      bedrooms: 2,
      bathrooms: 1,
      area: { value: 800, unit: 'sq.ft' },
      description: 'Test property 1',
      images: [{ url: 'https://example.com/1.jpg', caption: 'Image 1' }],
      agent: { name: 'Agent 1', phone: '+1234567890', email: 'agent1@example.com' }
    });
    
    await Conversation.create({
      userId,
      state: 'collect_info',
      preferences: { location: 'Mumbai', budget: '50-80', bhk: 2 },
      selectedProperty: property._id
    });
    
    const message = 'My name is John Doe, phone: +1234567890, time: tomorrow at 2 PM';
    
    await conversationService.processMessage(userId, message);
    
    // Check if appointment was created and state was updated
    expect(AppointmentService.createAppointment).toHaveBeenCalled();
    
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('completed');
    expect(conversation.userInfo).toEqual({
      name: 'John Doe',
      phone: '+1234567890',
      preferredTime: expect.any(Date),
      preferredTimeText: 'Tomorrow at 2 PM'
    });
  });
  
  test('should handle restart intent from any state', async () => {
    // Create a conversation in any state
    const userId = 'whatsapp:+1234567890';
    await Conversation.create({
      userId,
      state: 'budget',
      preferences: { location: 'Mumbai' }
    });
    
    // Mock the intent extraction to return restart
    AIService.prototype.extractUserIntent = jest.fn().mockResolvedValue('restart');
    
    const message = 'I want to start over';
    
    await conversationService.processMessage(userId, message);
    
    // Check if conversation was reset
    const conversation = await Conversation.findOne({ userId });
    expect(conversation.state).toBe('welcome');
    expect(conversation.preferences).toEqual({});
  });
});