// tests/property.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Property = require('../models/Property');

let mongoServer;

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
  // Clear the Property collection before each test
  await Property.deleteMany({});
});

describe('Property Model', () => {
  test('should create a property with all required fields', async () => {
    const propertyData = {
      title: 'Luxury Apartment',
      location: 'Mumbai',
      price: 7500000, // 75 lakhs
      type: 'apartment',
      bedrooms: 3,
      bathrooms: 2,
      area: {
        value: 1200,
        unit: 'sq.ft'
      },
      description: 'A beautiful luxury apartment in the heart of Mumbai',
      images: [
        {
          url: 'https://example.com/image1.jpg',
          caption: 'Living Room'
        }
      ],
      agent: {
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com'
      }
    };
    
    const property = new Property(propertyData);
    const savedProperty = await property.save();
    
    expect(savedProperty._id).toBeDefined();
    expect(savedProperty.title).toBe(propertyData.title);
    expect(savedProperty.location).toBe(propertyData.location);
    expect(savedProperty.price).toBe(propertyData.price);
    expect(savedProperty.bedrooms).toBe(propertyData.bedrooms);
  });
  
  test('should fail to create a property without required fields', async () => {
    const propertyData = {
      title: 'Incomplete Property',
      // Missing required fields
    };
    
    const property = new Property(propertyData);
    
    await expect(property.save()).rejects.toThrow();
  });
  
  test('should format price in Indian currency format', async () => {
    const property = new Property({
      title: 'Test Property',
      location: 'Delhi',
      price: 10000000, // 1 crore
      type: 'villa',
      bedrooms: 4,
      bathrooms: 3,
      area: { value: 2000, unit: 'sq.ft' },
      description: 'Test description',
      images: [{ url: 'https://example.com/test.jpg', caption: 'Test' }],
      agent: { name: 'Agent', phone: '+919876543210', email: 'agent@example.com' }
    });
    
    await property.save();
    
    // Test the formatPriceIndian method
    const formattedPrice = property.formatPriceIndian();
    expect(formattedPrice).toBe('₹1 Crore');
    
    // Test with a different price
    property.price = 7500000; // 75 lakhs
    await property.save();
    expect(property.formatPriceIndian()).toBe('₹75 Lakhs');
    
    // Test with a smaller price
    property.price = 500000; // 5 lakhs
    await property.save();
    expect(property.formatPriceIndian()).toBe('₹5 Lakhs');
  });
  
  test('should find properties by criteria', async () => {
    // Create test properties
    await Property.create([
      {
        title: 'Budget Apartment',
        location: 'Mumbai',
        price: 3000000, // 30 lakhs
        type: 'apartment',
        bedrooms: 1,
        bathrooms: 1,
        area: { value: 500, unit: 'sq.ft' },
        description: 'Budget friendly apartment',
        images: [{ url: 'https://example.com/budget.jpg', caption: 'Budget' }],
        agent: { name: 'Agent1', phone: '+919876543210', email: 'agent1@example.com' }
      },
      {
        title: 'Mid-range Apartment',
        location: 'Mumbai',
        price: 6000000, // 60 lakhs
        type: 'apartment',
        bedrooms: 2,
        bathrooms: 2,
        area: { value: 900, unit: 'sq.ft' },
        description: 'Mid-range apartment',
        images: [{ url: 'https://example.com/mid.jpg', caption: 'Mid-range' }],
        agent: { name: 'Agent2', phone: '+919876543211', email: 'agent2@example.com' }
      },
      {
        title: 'Luxury Villa',
        location: 'Delhi',
        price: 15000000, // 1.5 crore
        type: 'villa',
        bedrooms: 4,
        bathrooms: 4,
        area: { value: 3000, unit: 'sq.ft' },
        description: 'Luxury villa',
        images: [{ url: 'https://example.com/luxury.jpg', caption: 'Luxury' }],
        agent: { name: 'Agent3', phone: '+919876543212', email: 'agent3@example.com' }
      }
    ]);
    
    // Test finding by location
    const mumbaiProperties = await Property.findByCriteria({ location: 'Mumbai' });
    expect(mumbaiProperties.length).toBe(2);
    
    // Test finding by price range
    const affordableProperties = await Property.findByCriteria({
      minPrice: 2000000, // 20 lakhs
      maxPrice: 5000000  // 50 lakhs
    });
    expect(affordableProperties.length).toBe(1);
    expect(affordableProperties[0].title).toBe('Budget Apartment');
    
    // Test finding by bedrooms
    const twoBedroomProperties = await Property.findByCriteria({ bedrooms: 2 });
    expect(twoBedroomProperties.length).toBe(1);
    expect(twoBedroomProperties[0].title).toBe('Mid-range Apartment');
    
    // Test finding by multiple criteria
    const specificProperties = await Property.findByCriteria({
      location: 'Mumbai',
      bedrooms: 2,
      minPrice: 5000000, // 50 lakhs
      maxPrice: 7000000  // 70 lakhs
    });
    expect(specificProperties.length).toBe(1);
    expect(specificProperties[0].title).toBe('Mid-range Apartment');
  });
  
  test('should format property details for WhatsApp', async () => {
    const property = new Property({
      title: 'Test Property',
      location: 'Bangalore',
      price: 8500000, // 85 lakhs
      type: 'apartment',
      bedrooms: 3,
      bathrooms: 2,
      area: { value: 1500, unit: 'sq.ft' },
      description: 'A beautiful property with garden view',
      images: [{ url: 'https://example.com/test.jpg', caption: 'Test' }],
      agent: { name: 'Test Agent', phone: '+919876543210', email: 'agent@example.com' },
      amenities: ['Swimming Pool', 'Gym', 'Security'],
      nearbyFacilities: ['School', 'Hospital', 'Shopping Mall']
    });
    
    await property.save();
    
    const formattedDetails = property.formatForWhatsApp();
    
    expect(formattedDetails).toContain('Test Property');
    expect(formattedDetails).toContain('Bangalore');
    expect(formattedDetails).toContain('₹85 Lakhs');
    expect(formattedDetails).toContain('3 BHK');
    expect(formattedDetails).toContain('1500 sq.ft');
    expect(formattedDetails).toContain('Swimming Pool');
    expect(formattedDetails).toContain('Test Agent');
  });
  
  test('should find similar properties', async () => {
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
        agent: { name: 'Agent 1', phone: '+919876543210', email: 'agent1@example.com' }
      },
      {
        title: 'Property 2',
        location: 'Mumbai',
        price: 5500000, // 55 lakhs
        type: 'apartment',
        bedrooms: 2,
        bathrooms: 2,
        area: { value: 850, unit: 'sq.ft' },
        description: 'Test property 2',
        images: [{ url: 'https://example.com/2.jpg', caption: 'Image 2' }],
        agent: { name: 'Agent 2', phone: '+919876543211', email: 'agent2@example.com' }
      },
      {
        title: 'Property 3',
        location: 'Delhi',
        price: 7000000, // 70 lakhs
        type: 'apartment',
        bedrooms: 3,
        bathrooms: 2,
        area: { value: 1200, unit: 'sq.ft' },
        description: 'Test property 3',
        images: [{ url: 'https://example.com/3.jpg', caption: 'Image 3' }],
        agent: { name: 'Agent 3', phone: '+919876543212', email: 'agent3@example.com' }
      }
    ]);
    
    const property = await Property.findOne({ title: 'Property 1' });
    const similarProperties = await Property.findSimilarProperties(property._id);
    
    expect(similarProperties.length).toBe(1);
    expect(similarProperties[0].title).toBe('Property 2');
  });
  
  test('should increment view count', async () => {
    const property = new Property({
      title: 'View Count Test',
      location: 'Chennai',
      price: 4000000, // 40 lakhs
      type: 'apartment',
      bedrooms: 2,
      bathrooms: 1,
      area: { value: 700, unit: 'sq.ft' },
      description: 'Test property for view count',
      images: [{ url: 'https://example.com/test.jpg', caption: 'Test' }],
      agent: { name: 'Agent', phone: '+919876543210', email: 'agent@example.com' },
      views: 0
    });
    
    await property.save();
    
    // Initial view count should be 0
    expect(property.views).toBe(0);
    
    // Increment view count
    await property.incrementViewCount();
    
    // Fetch the updated property
    const updatedProperty = await Property.findById(property._id);
    expect(updatedProperty.views).toBe(1);
    
    // Increment again
    await updatedProperty.incrementViewCount();
    
    // Fetch again
    const finalProperty = await Property.findById(property._id);
    expect(finalProperty.views).toBe(2);
  });
});