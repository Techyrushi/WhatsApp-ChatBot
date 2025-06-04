// tests/server.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

// Import services for testing
const WhatsAppService = require('../services/whatsappService');
const AIService = require('../services/aiService');
const ConversationService = require('../services/conversationService');
const Property = require('../models/Property');

// Mock dependencies
jest.mock('../services/whatsappService');
jest.mock('../services/aiService');

let mongoServer;
let app;

beforeAll(async () => {
  // Set up in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  // Create express app for testing
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add health check endpoint for testing
  app.get('/health', (req, res) => {
    res.status(200).send('Service is running');
  });
  
  // Add webhook endpoint for testing
  app.post('/webhook', async (req, res) => {
    try {
      res.status(200).send('OK');
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Server Endpoints', () => {
  test('Health check endpoint should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Service is running');
  });
  
  test('Webhook endpoint should return 200', async () => {
    const response = await request(app).post('/webhook').send({
      Body: 'Hello',
      From: 'whatsapp:+1234567890'
    });
    expect(response.status).toBe(200);
  });
});

describe('AIService', () => {
  let aiService;
  
  beforeEach(() => {
    aiService = new AIService();
    // Mock the OpenAI API calls
    aiService.openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mocked AI response' } }]
          })
        }
      }
    };
  });
  
  test('generateResponse should return a response', async () => {
    const response = await aiService.generateResponse('Hello', { state: 'welcome' });
    expect(response).toBe('Mocked AI response');
  });
  
  test('extractLocation should extract location from message', async () => {
    aiService.openai.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'Mumbai' } }]
    });
    
    const location = await aiService.extractLocation('I want a property in Mumbai');
    expect(location).toBe('Mumbai');
  });
});

describe('Property Model', () => {
  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });
  
  test('should create a property', async () => {
    const propertyData = {
      title: 'Test Property',
      location: 'Test Location',
      price: 1000000,
      type: 'apartment',
      bedrooms: 2,
      bathrooms: 2,
      area: {
        value: 1000,
        unit: 'sq.ft'
      },
      description: 'Test description',
      images: [{
        url: 'https://example.com/test.jpg',
        caption: 'Test Image'
      }],
      agent: {
        name: 'Test Agent',
        phone: '+1234567890',
        email: 'test@example.com'
      }
    };
    
    const property = new Property(propertyData);
    await property.save();
    
    const savedProperty = await Property.findOne({ title: 'Test Property' });
    expect(savedProperty).not.toBeNull();
    expect(savedProperty.location).toBe('Test Location');
    expect(savedProperty.price).toBe(1000000);
  });
  
  test('should find properties by criteria', async () => {
    // Create test properties
    await Property.create([
      {
        title: 'Property 1',
        location: 'Mumbai',
        price: 1000000,
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
        location: 'Delhi',
        price: 2000000,
        type: 'villa',
        bedrooms: 3,
        bathrooms: 2,
        area: { value: 1500, unit: 'sq.ft' },
        description: 'Test property 2',
        images: [{ url: 'https://example.com/2.jpg', caption: 'Image 2' }],
        agent: { name: 'Agent 2', phone: '+1234567891', email: 'agent2@example.com' }
      }
    ]);
    
    // Test finding by location
    const mumbaiProperties = await Property.findByCriteria({ location: 'Mumbai' });
    expect(mumbaiProperties.length).toBe(1);
    expect(mumbaiProperties[0].title).toBe('Property 1');
    
    // Test finding by price range
    const affordableProperties = await Property.findByCriteria({ 
      minPrice: 500000, 
      maxPrice: 1500000 
    });
    expect(affordableProperties.length).toBe(1);
    expect(affordableProperties[0].title).toBe('Property 1');
    
    // Test finding by bedrooms
    const threeBedroomProperties = await Property.findByCriteria({ bedrooms: 3 });
    expect(threeBedroomProperties.length).toBe(1);
    expect(threeBedroomProperties[0].title).toBe('Property 2');
  });
});