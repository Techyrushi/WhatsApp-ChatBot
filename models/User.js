// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  },
  name: { 
    type: String, 
    trim: true 
  },
  email: { 
    type: String, 
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  preferences: {
    location: [{ type: String, trim: true }],
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    propertyType: [{ type: String }],
    bedrooms: { type: Number },
    amenities: [{ type: String }]
  },
  viewedProperties: [{
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    viewedAt: { type: Date, default: Date.now }
  }],
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  lastInteraction: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Create a compound index for efficient querying
userSchema.index({ phone: 1, isActive: 1 });

// Instance method to update last interaction time
userSchema.methods.updateLastInteraction = function() {
  this.lastInteraction = new Date();
  return this.save();
};

// Static method to find active users who haven't interacted in a while
userSchema.statics.findInactiveUsers = function(days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    isActive: true,
    lastInteraction: { $lt: cutoffDate }
  });
};

// Static method to find users by location preference
userSchema.statics.findByLocationPreference = function(location) {
  return this.find({
    'preferences.location': location,
    isActive: true
  });
};

// Static method to find users by property type preference
userSchema.statics.findByPropertyTypePreference = function(propertyType) {
  return this.find({
    'preferences.propertyType': propertyType,
    isActive: true
  });
};

const User = mongoose.model('User', userSchema);

module.exports = User;