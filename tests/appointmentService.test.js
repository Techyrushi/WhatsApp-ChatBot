// tests/appointmentService.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AppointmentService = require('../services/appointmentService');
const Appointment = require('../models/Appointment');
const Property = require('../models/Property');
const User = require('../models/User');

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
  // Clear collections before each test
  await Appointment.deleteMany({});
  await Property.deleteMany({});
  await User.deleteMany({});
});

describe('AppointmentService', () => {
  test('should create an appointment', async () => {
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
    
    // Create a user
    const user = new User({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    await user.save();
    
    // Create an appointment
    const appointmentData = {
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(),
      preferredTimeText: 'Tomorrow at 2 PM',
      status: 'scheduled',
      userPhone: user.phone,
      userName: user.name
    };
    
    const appointment = await AppointmentService.createAppointment(appointmentData);
    
    expect(appointment._id).toBeDefined();
    expect(appointment.propertyId.toString()).toBe(property._id.toString());
    expect(appointment.userId.toString()).toBe(user._id.toString());
    expect(appointment.status).toBe('scheduled');
    expect(appointment.userPhone).toBe(user.phone);
    expect(appointment.userName).toBe(user.name);
  });
  
  test('should get appointment by ID', async () => {
    // Create a property and user
    const property = await Property.create({
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
    
    const user = await User.create({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    // Create an appointment
    const appointmentData = {
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(),
      preferredTimeText: 'Tomorrow at 2 PM',
      status: 'scheduled',
      userPhone: user.phone,
      userName: user.name
    };
    
    const createdAppointment = await AppointmentService.createAppointment(appointmentData);
    
    // Get the appointment by ID
    const appointment = await AppointmentService.getAppointmentById(createdAppointment._id);
    
    expect(appointment).not.toBeNull();
    expect(appointment._id.toString()).toBe(createdAppointment._id.toString());
  });
  
  test('should update appointment status', async () => {
    // Create a property and user
    const property = await Property.create({
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
    
    const user = await User.create({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    // Create an appointment
    const appointmentData = {
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(),
      status: 'scheduled',
      userPhone: user.phone,
      userName: user.name
    };
    
    const createdAppointment = await AppointmentService.createAppointment(appointmentData);
    
    // Update the appointment status
    const updatedAppointment = await AppointmentService.updateAppointmentStatus(
      createdAppointment._id,
      'confirmed'
    );
    
    expect(updatedAppointment).not.toBeNull();
    expect(updatedAppointment.status).toBe('confirmed');
  });
  
  test('should get appointments by user ID', async () => {
    // Create a property and user
    const property = await Property.create({
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
    
    const user = await User.create({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    // Create multiple appointments for the same user
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(),
      preferredTimeText: 'Today at 3 PM',
      status: 'scheduled',
      userPhone: user.phone,
      userName: user.name
    });
    
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      preferredTimeText: 'Tomorrow at 2 PM',
      status: 'scheduled',
      userPhone: user.phone,
      userName: user.name
    });
    
    // Get appointments by user ID
    const appointments = await AppointmentService.getAppointmentsByUserId(user._id);
    
    expect(appointments).not.toBeNull();
    expect(appointments.length).toBe(2);
    expect(appointments[0].userId.toString()).toBe(user._id.toString());
    expect(appointments[1].userId.toString()).toBe(user._id.toString());
  });
  
  test('should get appointments by property ID', async () => {
    // Create a property and multiple users
    const property = await Property.create({
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
    
    const user1 = await User.create({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    const user2 = await User.create({
      phone: '+919876543211',
      name: 'Jane Doe'
    });
    
    // Create appointments for different users but same property
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user1._id,
      dateTime: new Date(),
      preferredTimeText: 'Today at 4 PM',
      status: 'scheduled',
      userPhone: user1.phone,
      userName: user1.name
    });
    
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user2._id,
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      preferredTimeText: 'Tomorrow at 5 PM',
      status: 'scheduled',
      userPhone: user2.phone,
      userName: user2.name
    });
    
    // Get appointments by property ID
    const appointments = await AppointmentService.getAppointmentsByPropertyId(property._id);
    
    expect(appointments).not.toBeNull();
    expect(appointments.length).toBe(2);
    expect(appointments[0].propertyId.toString()).toBe(property._id.toString());
    expect(appointments[1].propertyId.toString()).toBe(property._id.toString());
    expect(appointments[0].userId.toString()).toBe(user1._id.toString());
    expect(appointments[1].userId.toString()).toBe(user2._id.toString());
  });
  
  test('should get appointments by status', async () => {
    // Create a property and user
    const property = await Property.create({
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
    
    const user = await User.create({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    // Create appointments with different statuses
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(),
      preferredTimeText: 'Today at 6 PM',
      status: 'scheduled',
      userPhone: user.phone,
      userName: user.name
    });
    
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      preferredTimeText: 'Tomorrow at 1 PM',
      status: 'confirmed',
      userPhone: user.phone,
      userName: user.name
    });
    
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      preferredTimeText: 'Yesterday at 3 PM',
      status: 'completed',
      userPhone: user.phone,
      userName: user.name
    });
    
    // Get appointments by status
    const scheduledAppointments = await AppointmentService.getAppointmentsByStatus('scheduled');
    expect(scheduledAppointments.length).toBe(1);
    expect(scheduledAppointments[0].status).toBe('scheduled');
    
    const confirmedAppointments = await AppointmentService.getAppointmentsByStatus('confirmed');
    expect(confirmedAppointments.length).toBe(1);
    expect(confirmedAppointments[0].status).toBe('confirmed');
    
    const completedAppointments = await AppointmentService.getAppointmentsByStatus('completed');
    expect(completedAppointments.length).toBe(1);
    expect(completedAppointments[0].status).toBe('completed');
  });
  
  test('should get upcoming appointments', async () => {
    // Create a property and user
    const property = await Property.create({
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
    
    const user = await User.create({
      phone: '+919876543210',
      name: 'John Doe'
    });
    
    // Create appointments with different dates
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      preferredTimeText: 'Yesterday at 2 PM',
      status: 'completed',
      userPhone: user.phone,
      userName: user.name
    });
    
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      preferredTimeText: 'Tomorrow at 4 PM',
      status: 'scheduled',
      userPhone: user.phone,
      userName: user.name
    });
    
    await AppointmentService.createAppointment({
      propertyId: property._id,
      userId: user._id,
      dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
      preferredTimeText: 'Day after tomorrow at 11 AM',
      status: 'confirmed',
      userPhone: user.phone,
      userName: user.name
    });
    
    // Get upcoming appointments
    const upcomingAppointments = await AppointmentService.getUpcomingAppointments();
    
    expect(upcomingAppointments.length).toBe(2);
    
    // All upcoming appointments should have dates in the future
    upcomingAppointments.forEach(appointment => {
      expect(new Date(appointment.dateTime).getTime()).toBeGreaterThan(Date.now());
    });
  });
});