class Property {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.location = data.location;
    this.price = data.price;
    this.type = data.type; // apartment, villa, house, plot
    this.bedrooms = data.bedrooms;
    this.area = data.area;
    this.amenities = data.amenities || [];
    this.description = data.description;
    this.images = data.images || [];
    this.agent = data.agent || {};
    this.availability = data.availability || 'available';
    this.createdAt = data.createdAt || new Date();
  }

  // Format property for WhatsApp display
  formatForList(index) {
    return `${index + 1}. ${this.title}\n   📍 ${this.location}\n   💰 ${this.price}\n   🏠 ${this.bedrooms}BHK, ${this.area}`;
  }

  // Format detailed property information
  formatDetails() {
    return `🏠 *${this.title}*\n\n` +
           `📍 Location: ${this.location}\n` +
           `💰 Price: ${this.price}\n` +
           `🛏️ Bedrooms: ${this.bedrooms}\n` +
           `📐 Area: ${this.area}\n` +
           `🏢 Type: ${this.type}\n` +
           `✨ Amenities: ${this.amenities.join(', ')}\n\n` +
           `${this.description}`;
  }

  // Validate property data
  static validate(data) {
    const required = ['id', 'title', 'location', 'price', 'type'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    return true;
  }

  // Filter properties by criteria
  static filter(properties, criteria) {
    return properties.filter(property => {
      if (criteria.type && property.type !== criteria.type) return false;
      if (criteria.minPrice && parseFloat(property.price.replace(/[^\d]/g, '')) < criteria.minPrice) return false;
      if (criteria.maxPrice && parseFloat(property.price.replace(/[^\d]/g, '')) > criteria.maxPrice) return false;
      if (criteria.bedrooms && property.bedrooms !== criteria.bedrooms) return false;
      if (criteria.location && !property.location.toLowerCase().includes(criteria.location.toLowerCase())) return false;
      return true;
    });
  }
}

module.exports = Property;