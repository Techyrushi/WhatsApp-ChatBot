// tests/user.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
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
  // Clear the User collection before each test
  await User.deleteMany({});
  await Property.deleteMany({});
});

describe('User Model', () => {
  test('should create a user with required fields', async () => {
    const userData = {
      phone: '+919876543210',
      name: 'John Doe'
    };
    
    const user = new User(userData);
    const savedUser = await user.save();
    
    expect(savedUser._id).toBeDefined();
    expect(savedUser.phone).toBe(userData.phone);
    expect(savedUser.name).toBe(userData.name);
    expect(savedUser.isActive).toBe(true); // Default value
    expect(savedUser.lastInteraction).toBeDefined();
  });
  
  test('should fail to create a user without required fields', async () => {
    const userData = {
      name: 'John Doe'
      // Missing phone field
    };
    
    const user = new User(userData);
    
    await expect(user.save()).rejects.toThrow();
  });
  
  test('should update last interaction time', async () => {
    const user = new User({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    await user.save();
    
    const initialInteraction = user.lastInteraction;
    
    // Wait a bit to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update last interaction
    await user.updateInteraction();
    
    // Fetch the updated user
    const updatedUser = await User.findById(user._id);
    
    expect(updatedUser.lastInteraction).not.toEqual(initialInteraction);
    expect(updatedUser.lastInteraction.getTime()).toBeGreaterThan(initialInteraction.getTime());
  });
  
  test('should find inactive users', async () => {
    // Create active and inactive users
    const activeUser = new User({
      phone: '+919876543210',
      name: 'Active User',
      lastInteraction: new Date()
    });
    
    const inactiveUser = new User({
      phone: '+919876543211',
      name: 'Inactive User',
      lastInteraction: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
    });
    
    await activeUser.save();
    await inactiveUser.save();
    
    // Find inactive users (inactive for 7 days)
    const inactiveUsers = await User.findInactiveUsers(7);
    
    expect(inactiveUsers.length).toBe(1);
    expect(inactiveUsers[0].name).toBe('Inactive User');
  });
  
  test('should add viewed property to user', async () => {
    // Create a user
    const user = new User({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    await user.save();
    
    // Create a property
    const property = new Property({
      title: 'Test Property',
      location: 'Mumbai',
      price: 5000000,
      type: 'apartment',
      bedrooms: 2,
      bathrooms: 1,
      area: { value: 800, unit: 'sq.ft' },
      description: 'Test property',
      images: [{ url: 'https://example.com/test.jpg', caption: 'Test' }],
      agent: { name: 'Agent', phone: '+919876543210', email: 'agent@example.com' }
    });
    
    await property.save();
    
    // Add viewed property
    user.viewedProperties.push(property._id);
    await user.save();
    
    // Fetch the updated user
    const updatedUser = await User.findById(user._id).populate('viewedProperties');
    
    expect(updatedUser.viewedProperties.length).toBe(1);
    expect(updatedUser.viewedProperties[0].title).toBe('Test Property');
  });
  
  test('should find users by preferences', async () => {
    // Create users with different preferences
    await User.create([
      {
        phone: '+919876543210',
        name: 'User 1',
        preferences: {
          location: 'Mumbai',
          budget: { min: 5000000, max: 8000000 },
          type: 'apartment',
          bedrooms: 2
        }
      },
      {
        phone: '+919876543211',
        name: 'User 2',
        preferences: {
          location: 'Delhi',
          budget: { min: 10000000, max: 15000000 },
          type: 'villa',
          bedrooms: 3
        }
      },
      {
        phone: '+919876543212',
        name: 'User 3',
        preferences: {
          location: 'Mumbai',
          budget: { min: 3000000, max: 6000000 },
          type: 'apartment',
          bedrooms: 2
        }
      }
    ]);
    
    // Find users interested in Mumbai apartments
    const mumbaiUsers = await User.findByPreferences({
      location: 'Mumbai',
      type: 'apartment'
    });
    
    expect(mumbaiUsers.length).toBe(2);
    
    // Find users interested in 3 BHK
    const threeBHKUsers = await User.findByPreferences({
      bedrooms: 3
    });
    
    expect(threeBHKUsers.length).toBe(1);
    expect(threeBHKUsers[0].name).toBe('User 2');
    
    // Find users with specific budget range
    const budgetUsers = await User.findByPreferences({
      budget: { min: 4000000, max: 7000000 }
    });
    
    expect(budgetUsers.length).toBe(2);
  });
  
  test('should add appointment to user', async () => {
    // Create a user
    const user = new User({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    await user.save();
    
    // Add appointment ID
    const appointmentId = new mongoose.Types.ObjectId();
    user.appointments.push(appointmentId);
    await user.save();
    
    // Fetch the updated user
    const updatedUser = await User.findById(user._id);
    
    expect(updatedUser.appointments.length).toBe(1);
    expect(updatedUser.appointments[0].toString()).toBe(appointmentId.toString());
  });
  
  test('should update user preferences', async () => {
    // Create a user with initial preferences
    const user = new User({
      phone: '+919876543210',
      name: 'John Doe',
      preferences: {
        location: 'Mumbai',
        budget: { min: 5000000, max: 8000000 },
        type: 'apartment',
        bedrooms: 2
      }
    });
    
    await user.save();
    
    // Update preferences
    user.preferences.location = 'Bangalore';
    user.preferences.budget.max = 10000000;
    user.preferences.bedrooms = 3;
    await user.save();
    
    // Fetch the updated user
    const updatedUser = await User.findById(user._id);
    
    expect(updatedUser.preferences.location).toBe('Bangalore');
    expect(updatedUser.preferences.budget.max).toBe(10000000);
    expect(updatedUser.preferences.bedrooms).toBe(3);
    expect(updatedUser.preferences.type).toBe('apartment'); // Unchanged
  });
});