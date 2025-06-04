// models/Property.js
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  location: { 
    type: String, 
    required: true, 
    trim: true,
    index: true
  },
  price: { 
    type: Number, 
    required: true,
    min: 0 
  },
  type: { 
    type: String, 
    required: true,
    enum: ['apartment', 'villa', 'house', 'plot', 'commercial','farmhouse'],
    index: true
  },
  bedrooms: { 
    type: Number, 
    min: 0,
    index: true
  },
  bathrooms: { 
    type: Number, 
    min: 0 
  },
  area: { 
    value: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'sq.ft' }
  },
  amenities: [{ 
    type: String 
  }],
  description: { 
    type: String, 
    required: true 
  },
  images: [{ 
    url: { type: String, required: true },
    caption: { type: String }
  }],
  agent: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String }
  },
  availability: { 
    type: String, 
    enum: ['available', 'sold', 'rented', 'pending'],
    default: 'available',
    index: true
  },
  features: [{ 
    type: String 
  }],
  yearBuilt: { 
    type: Number 
  },
  furnished: { 
    type: Boolean, 
    default: false 
  },
  parking: { 
    type: Boolean, 
    default: false 
  },
  nearbyFacilities: [{
    type: { type: String },
    name: { type: String },
    distance: { type: String }
  }],
  views: { 
    type: Number, 
    default: 0 
  },
  isPromoted: { 
    type: Boolean, 
    default: false,
    index: true
  }
}, { timestamps: true });

// Create compound indexes for efficient querying
propertySchema.index({ location: 1, type: 1, bedrooms: 1, price: 1 });
propertySchema.index({ availability: 1, isPromoted: 1 });

// Format property for WhatsApp display
propertySchema.methods.formatForList = function(index) {
  // Basic property information
  let formattedText = `*${index + 1}. ${this.title}*\n`;
  formattedText += `   📍 ${this.location}\n`;
  formattedText += `   💰 ₹${this.price.toLocaleString('en-IN')}\n`;
  formattedText += `   🏠 ${this.bedrooms}BHK, ${this.area.value} ${this.area.unit}\n`;
  
  // Add amenities (limited to 3 for brevity)
  if (this.amenities && this.amenities.length > 0) {
    const displayAmenities = this.amenities.slice(0, 3);
    formattedText += `   ✨ ${displayAmenities.join(', ')}${this.amenities.length > 3 ? '...' : ''}\n`;
  }
  
  // Add agent information
  if (this.agent && this.agent.name) {
    formattedText += `   👤 Agent: ${this.agent.name}\n`;
  }
  
  // Add property ID for reference
  formattedText += `   🔢 Property ID: ${this._id.toString().slice(-6)}`;
  
  return formattedText;
};

// Format detailed property information
propertySchema.methods.formatDetails = function() {
  return `🏠 *${this.title}*\n\n` +
         `📍 Location: ${this.location}\n` +
         `💰 Price: ₹${this.price.toLocaleString('en-IN')}\n` +
         `🛏️ Bedrooms: ${this.bedrooms}\n` +
         `🚿 Bathrooms: ${this.bathrooms}\n` +
         `📐 Area: ${this.area.value} ${this.area.unit}\n` +
         `🏢 Type: ${this.type}\n` +
         `✨ Amenities: ${this.amenities.join(', ')}\n\n` +
         `${this.description}`;
};

// Static method to find properties by criteria
propertySchema.statics.findByCriteria = function(criteria) {
  const query = { availability: 'available' };
  
  if (criteria.location) {
    query.location = { $regex: new RegExp(criteria.location, 'i') };
  }
  
  if (criteria.type) {
    query.type = criteria.type;
  }
  
  if (criteria.bedrooms) {
    query.bedrooms = criteria.bedrooms;
  }
  
  if (criteria.minPrice && criteria.maxPrice) {
    query.price = { $gte: criteria.minPrice, $lte: criteria.maxPrice };
  } else if (criteria.minPrice) {
    query.price = { $gte: criteria.minPrice };
  } else if (criteria.maxPrice) {
    query.price = { $lte: criteria.maxPrice };
  }
  
  if (criteria.amenities && criteria.amenities.length > 0) {
    query.amenities = { $all: criteria.amenities };
  }
  
  return this.find(query);
};

// Static method to find promoted properties
propertySchema.statics.findPromoted = function(limit = 5) {
  return this.find({ 
    availability: 'available',
    isPromoted: true 
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to find similar properties
propertySchema.statics.findSimilar = function(property, limit = 3) {
  return this.find({
    _id: { $ne: property._id },
    availability: 'available',
    location: property.location,
    type: property.type,
    bedrooms: property.bedrooms,
    price: { 
      $gte: property.price * 0.8, 
      $lte: property.price * 1.2 
    }
  })
  .limit(limit);
};

// Increment view count
propertySchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;