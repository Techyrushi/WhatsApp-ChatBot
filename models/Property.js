const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['residential', 'commercial'],
    default: 'commercial'
  },
  subType: {
    type: String,
    enum: ['office', 'shop', 'warehouse', 'other'],
    required: true
  },
  forSale: { type: Boolean, default: false },
  forLease: { type: Boolean, default: false },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  carpetArea: {
    value: { type: Number },
    unit: { type: String, default: 'sq.ft' }
  },
  builtUpArea: {
    value: { type: Number },
    unit: { type: String, default: 'sq.ft' }
  },
  parkingSpaces: {
    fourWheeler: { type: Number, default: 0 }
  },
  amenities: [{ type: String }],
  description: { type: String },
  availability: {
    type: String,
    enum: ['available', 'sold', 'rented', 'pending'],
    default: 'available'
  },
  isPromoted: { type: Boolean, default: false }
}, { timestamps: true });

// Create indexes for faster queries
propertySchema.index({ type: 1, subType: 1 });
propertySchema.index({ forSale: 1, forLease: 1 });
propertySchema.index({ availability: 1 });

// Format for property listing
propertySchema.methods.formatForList = function(index) {
  let text = `${index}. ${this.title}\n`;
  text += `📍 ${this.location}\n`;
  text += `💰 ₹${this.price.toLocaleString('en-IN')}\n`;
  
  if (this.carpetArea?.value) {
    text += `📏 ${this.carpetArea.value} ${this.carpetArea.unit} carpet area\n`;
  }
  
  if (this.parkingSpaces?.fourWheeler > 0) {
    text += `🚗 ${this.parkingSpaces.fourWheeler} parking space(s)\n`;
  }
  
  if (this.amenities?.length > 0) {
    text += `✨ ${this.amenities.slice(0, 3).join(', ')}`;
    if (this.amenities.length > 3) text += '...';
    text += '\n';
  }
  
  return text;
};

// Format detailed property information
propertySchema.methods.formatDetails = function(language = 'english') {
  let text = `*${this.title}*\n\n`;
  
  // Location
  text += language === 'marathi' ? `📍 स्थान: ${this.location}\n` : `📍 Location: ${this.location}\n`;
  
  // Price
  const formattedPrice = this.price.toLocaleString('en-IN');
  text += language === 'marathi' ? `💰 किंमत: ₹${formattedPrice}\n` : `💰 Price: ₹${formattedPrice}\n`;
  
  // Property type
  const typeLabel = language === 'marathi' ? 'प्रकार' : 'Type';
  text += `🏢 ${typeLabel}: ${this.type} - ${this.subType}\n`;
  
  // For sale/lease
  if (this.forSale && this.forLease) {
    text += language === 'marathi' ? '🔖 विक्री आणि भाड्यासाठी उपलब्ध\n' : '🔖 Available for Sale and Lease\n';
  } else if (this.forSale) {
    text += language === 'marathi' ? '🔖 विक्रीसाठी उपलब्ध\n' : '🔖 Available for Sale\n';
  } else if (this.forLease) {
    text += language === 'marathi' ? '🔖 भाड्यासाठी उपलब्ध\n' : '🔖 Available for Lease\n';
  }
  
  // Area
  if (this.carpetArea?.value) {
    const areaLabel = language === 'marathi' ? 'कार्पेट क्षेत्र' : 'Carpet Area';
    text += `📏 ${areaLabel}: ${this.carpetArea.value} ${this.carpetArea.unit}\n`;
  }
  
  if (this.builtUpArea?.value) {
    const builtUpLabel = language === 'marathi' ? 'बिल्ट-अप क्षेत्र' : 'Built-up Area';
    text += `📐 ${builtUpLabel}: ${this.builtUpArea.value} ${this.builtUpArea.unit}\n`;
  }
  
  // Parking
  if (this.parkingSpaces?.fourWheeler > 0) {
    const parkingLabel = language === 'marathi' ? 'पार्किंग' : 'Parking';
    text += `🚗 ${parkingLabel}: ${this.parkingSpaces.fourWheeler} ${language === 'marathi' ? 'जागा' : 'space(s)'}\n`;
  }
  
  // Amenities
  if (this.amenities?.length > 0) {
    const amenitiesLabel = language === 'marathi' ? 'सुविधा' : 'Amenities';
    text += `✨ ${amenitiesLabel}: ${this.amenities.join(', ')}\n`;
  }
  
  // Description
  if (this.description) {
    const descLabel = language === 'marathi' ? '📝 वर्णन' : '📝 Description';
    text += `\n${descLabel}:\n${this.description}\n`;
  }
  
  return text;
};

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;