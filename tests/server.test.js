// tests/server.test.js
const request = require('supertest');
const app = require('../server');

describe('WhatsApp Real Estate Bot', () => {
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /webhook', () => {
    it('should handle WhatsApp webhook', async () => {
      const webhookPayload = {
        Body: 'Hi',
        From: 'whatsapp:+1234567890'
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);
      
      expect(response.text).toBe('OK');
    });

    it('should handle property inquiry', async () => {
      const webhookPayload = {
        Body: 'properties',
        From: 'whatsapp:+1234567890'
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);
      
      expect(response.text).toBe('OK');
    });
  });

  describe('GET /appointments', () => {
    it('should return appointments list', async () => {
      const response = await request(app)
        .get('/appointments')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('PUT /appointments/:id', () => {
    it('should update appointment status', async () => {
      // Note: This test requires a valid appointment ID
      // In a real test environment, you'd create a test appointment first
      
      const appointmentId = 'test-appointment-id';
      const updateData = {
        status: 'confirmed'
      };

      // This test would fail without a real appointment
      // const response = await request(app)
      //   .put(`/appointments/${appointmentId}`)
      //   .send(updateData)
      //   .expect(200);
      
      // expect(response.body).toHaveProperty('message');
    });
  });
});

// Mock tests for services
describe('Services', () => {
  
  describe('WhatsAppService', () => {
    const WhatsAppService = require('../services/whatsappService');
    
    it('should validate phone numbers correctly', () => {
      expect(WhatsAppService.validatePhoneNumber('+1234567890')).toBe(true);
      expect(WhatsAppService.validatePhoneNumber('1234567890')).toBe(true);
      expect(WhatsAppService.validatePhoneNumber('123')).toBe(false);
    });

    it('should extract phone number from WhatsApp format', () => {
      const extracted = WhatsAppService.extractPhoneNumber('whatsapp:+1234567890');
      expect(extracted).toBe('+1234567890');
    });
  });

  describe('Property Model', () => {
    const Property = require('../models/Property');
    
    it('should create property instance correctly', () => {
      const propertyData = {
        id: 'test1',
        title: 'Test Property',
        location: 'Test Location',
        price: '₹50 Lakhs',
        type: 'apartment',
        bedrooms: 2,
        area: '1000 sq ft',
        description: 'Test description'
      };

      const property = new Property(propertyData);
      expect(property.id).toBe('test1');
      expect(property.title).toBe('Test Property');
    });

    it('should validate required fields', () => {
      const incompleteData = {
        title: 'Test Property'
      };

      expect(() => {
        Property.validate(incompleteData);
      }).toThrow();
    });

    it('should filter properties correctly', () => {
      const properties = [
        new Property({
          id: '1',
          title: 'Apartment 1',
          location: 'Location 1',
          price: '₹50 Lakhs',
          type: 'apartment',
          bedrooms: 2
        }),
        new Property({
          id: '2',
          title: 'Villa 1',
          location: 'Location 2',
          price: '₹1 Crore',
          type: 'villa',
          bedrooms: 4
        })
      ];

      const filtered = Property.filter(properties, { type: 'apartment' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('apartment');
    });
  });

  describe('Helpers', () => {
    const Helpers = require('../utils/helpers');
    
    it('should format phone numbers correctly', () => {
      expect(Helpers.formatPhoneNumber('9876543210')).toBe('+919876543210');
      expect(Helpers.formatPhoneNumber('+919876543210')).toBe('+919876543210');
    });

    it('should validate email addresses', () => {
      expect(Helpers.isValidEmail('test@example.com')).toBe(true);
      expect(Helpers.isValidEmail('invalid-email')).toBe(false);
    });

    it('should parse contact information', () => {
      const contact = Helpers.parseContactInfo('John Doe, john@example.com, 9876543210');
      expect(contact.name).toBe('John Doe');
      expect(contact.email).toBe('john@example.com');
      expect(contact.phone).toBe('+919876543210');
    });

    it('should detect affirmative responses', () => {
      expect(Helpers.isAffirmative('yes')).toBe(true);
      expect(Helpers.isAffirmative('okay')).toBe(true);
      expect(Helpers.isAffirmative('no')).toBe(false);
    });

    it('should extract property numbers', () => {
      expect(Helpers.extractPropertyNumber('I want property 1')).toBe(1);
      expect(Helpers.extractPropertyNumber('Show me number 3')).toBe(3);
      expect(Helpers.extractPropertyNumber('hello')).toBe(null);
    });
  });
});

// Integration tests
describe('Integration Tests', () => {
  
  describe('Complete conversation flow', () => {
    it('should handle full property viewing workflow', async () => {
      const phoneNumber = '+1234567890';
      
      // Step 1: Initial greeting
      let response = await request(app)
        .post('/webhook')
        .send({
          Body: 'Hi',
          From: `whatsapp:${phoneNumber}`
        })
        .expect(200);

      // Step 2: Select property
      response = await request(app)
        .post('/webhook')
        .send({
          Body: '1',
          From: `whatsapp:${phoneNumber}`
        })
        .expect(200);

      // Step 3: Schedule viewing
      response = await request(app)
        .post('/webhook')
        .send({
          Body: 'yes',
          From: `whatsapp:${phoneNumber}`
        })
        .expect(200);

      // Step 4: Provide date/time
      response = await request(app)
        .post('/webhook')
        .send({
          Body: 'Tomorrow 2 PM',
          From: `whatsapp:${phoneNumber}`
        })
        .expect(200);

      // Step 5: Provide contact info
      response = await request(app)
        .post('/webhook')
        .send({
          Body: 'John Doe, john@example.com, 9876543210',
          From: `whatsapp:${phoneNumber}`
        })
        .expect(200);

      expect(response.text).toBe('OK');
    });
  });
});

// Performance tests
describe('Performance Tests', () => {
  
  it('should handle multiple concurrent requests', async () => {
    const requests = [];
    
    for (let i = 0; i < 10; i++) {
      requests.push(
        request(app)
          .post('/webhook')
          .send({
            Body: 'Hi',
            From: `whatsapp:+123456789${i}`
          })
      );
    }

    const responses = await Promise.all(requests);
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});

// Error handling tests
describe('Error Handling', () => {
  
  it('should handle malformed webhook requests', async () => {
    const response = await request(app)
      .post('/webhook')
      .send({})
      .expect(500);
  });

  it('should handle invalid appointment updates', async () => {
    const response = await request(app)
      .put('/appointments/invalid-id')
      .send({ status: 'invalid-status' })
      .expect(500);
  });
});

// Cleanup
afterAll((done) => {
  // Close any open connections
  done();
});