// scripts/seedDatabase.js
require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB successfully');
  seedDatabase();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Sample property data
const properties = [
  {
    title: 'Luxury Apartment in Bandra',
    location: 'Bandra, Mumbai',
    price: 15000000,
    type: 'apartment',
    bedrooms: 3,
    bathrooms: 2,
    area: {
      value: 1500,
      unit: 'sq.ft'
    },
    amenities: ['Swimming Pool', 'Gym', '24/7 Security', 'Power Backup', 'Parking'],
    description: 'Beautiful luxury apartment in the heart of Bandra with modern amenities and stunning sea view. Close to shopping centers and restaurants.',
    images: [
      {
        url: 'https://example.com/property1_1.jpg',
        caption: 'Living Room'
      },
      {
        url: 'https://example.com/property1_2.jpg',
        caption: 'Master Bedroom'
      }
    ],
    agent: {
      name: 'Rahul Sharma',
      phone: '+919876543210',
      email: 'rahul@realestate.com'
    },
    availability: 'available',
    features: ['Sea View', 'Modular Kitchen', 'Marble Flooring'],
    yearBuilt: 2020,
    furnished: true,
    parking: true,
    nearbyFacilities: [
      {
        type: 'School',
        name: 'Delhi Public School',
        distance: '0.5 km'
      },
      {
        type: 'Hospital',
        name: 'Lilavati Hospital',
        distance: '1.2 km'
      }
    ],
    isPromoted: true
  },
  {
    title: 'Spacious Villa in Juhu',
    location: 'Juhu, Mumbai',
    price: 45000000,
    type: 'villa',
    bedrooms: 4,
    bathrooms: 4,
    area: {
      value: 3500,
      unit: 'sq.ft'
    },
    amenities: ['Private Garden', 'Swimming Pool', 'Gym', '24/7 Security', 'Power Backup', 'Parking'],
    description: 'Luxurious villa in Juhu with private garden and swimming pool. Perfect for families looking for space and comfort in a premium location.',
    images: [
      {
        url: 'https://example.com/property2_1.jpg',
        caption: 'Front View'
      },
      {
        url: 'https://example.com/property2_2.jpg',
        caption: 'Garden Area'
      }
    ],
    agent: {
      name: 'Priya Patel',
      phone: '+919876543211',
      email: 'priya@realestate.com'
    },
    availability: 'available',
    features: ['Private Garden', 'Italian Marble', 'Home Theater', 'Smart Home'],
    yearBuilt: 2019,
    furnished: true,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Beach',
        name: 'Juhu Beach',
        distance: '0.8 km'
      },
      {
        type: 'Mall',
        name: 'Infinity Mall',
        distance: '1.5 km'
      }
    ],
    isPromoted: true
  },
  {
    title: '2BHK Apartment in Andheri',
    location: 'Andheri, Mumbai',
    price: 9000000,
    type: 'apartment',
    bedrooms: 2,
    bathrooms: 2,
    area: {
      value: 950,
      unit: 'sq.ft'
    },
    amenities: ['Gym', '24/7 Security', 'Power Backup', 'Parking'],
    description: 'Well-maintained 2BHK apartment in Andheri with modern amenities. Close to metro station and shopping centers.',
    images: [
      {
        url: 'https://example.com/property3_1.jpg',
        caption: 'Living Room'
      },
      {
        url: 'https://example.com/property3_2.jpg',
        caption: 'Kitchen'
      }
    ],
    agent: {
      name: 'Amit Kumar',
      phone: '+919876543212',
      email: 'amit@realestate.com'
    },
    availability: 'available',
    features: ['Modular Kitchen', 'Vitrified Tiles', 'Balcony'],
    yearBuilt: 2018,
    furnished: false,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Metro',
        name: 'Andheri Metro Station',
        distance: '0.3 km'
      },
      {
        type: 'Mall',
        name: 'Infiniti Mall',
        distance: '1.0 km'
      }
    ],
    isPromoted: false
  },
  {
    title: 'Modern 3BHK in Powai',
    location: 'Powai, Mumbai',
    price: 18000000,
    type: 'apartment',
    bedrooms: 3,
    bathrooms: 3,
    area: {
      value: 1800,
      unit: 'sq.ft'
    },
    amenities: ['Swimming Pool', 'Gym', 'Club House', '24/7 Security', 'Power Backup', 'Parking'],
    description: 'Modern 3BHK apartment in Powai with lake view. Part of a premium gated community with excellent amenities.',
    images: [
      {
        url: 'https://example.com/property4_1.jpg',
        caption: 'Living Room'
      },
      {
        url: 'https://example.com/property4_2.jpg',
        caption: 'Master Bedroom'
      }
    ],
    agent: {
      name: 'Neha Singh',
      phone: '+919876543213',
      email: 'neha@realestate.com'
    },
    availability: 'available',
    features: ['Lake View', 'Modular Kitchen', 'Wooden Flooring', 'Walk-in Closet'],
    yearBuilt: 2021,
    furnished: true,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Lake',
        name: 'Powai Lake',
        distance: '0.5 km'
      },
      {
        type: 'School',
        name: 'Hiranandani Foundation School',
        distance: '0.7 km'
      }
    ],
    isPromoted: true
  },
  {
    title: 'Budget 1BHK in Thane',
    location: 'Thane, Mumbai',
    price: 4500000,
    type: 'apartment',
    bedrooms: 1,
    bathrooms: 1,
    area: {
      value: 550,
      unit: 'sq.ft'
    },
    amenities: ['Security', 'Power Backup', 'Parking'],
    description: 'Affordable 1BHK apartment in Thane, perfect for first-time buyers or investors. Well-connected to central Mumbai.',
    images: [
      {
        url: 'https://example.com/property5_1.jpg',
        caption: 'Living Room'
      },
      {
        url: 'https://example.com/property5_2.jpg',
        caption: 'Bedroom'
      }
    ],
    agent: {
      name: 'Rajesh Gupta',
      phone: '+919876543214',
      email: 'rajesh@realestate.com'
    },
    availability: 'available',
    features: ['Balcony', 'Vitrified Tiles'],
    yearBuilt: 2017,
    furnished: false,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Station',
        name: 'Thane Railway Station',
        distance: '1.2 km'
      },
      {
        type: 'Market',
        name: 'Thane Market',
        distance: '0.8 km'
      }
    ],
    isPromoted: false
  },
  {
    title: 'Luxury 4BHK Penthouse in Worli',
    location: 'Worli, Mumbai',
    price: 120000000,
    type: 'apartment',
    bedrooms: 4,
    bathrooms: 5,
    area: {
      value: 4500,
      unit: 'sq.ft'
    },
    amenities: ['Private Terrace', 'Swimming Pool', 'Gym', 'Spa', 'Club House', '24/7 Security', 'Power Backup', 'Valet Parking'],
    description: 'Exclusive penthouse in Worli with panoramic sea view. Features private terrace, premium finishes, and world-class amenities.',
    images: [
      {
        url: 'https://example.com/property6_1.jpg',
        caption: 'Living Area'
      },
      {
        url: 'https://example.com/property6_2.jpg',
        caption: 'Terrace View'
      }
    ],
    agent: {
      name: 'Vikram Malhotra',
      phone: '+919876543215',
      email: 'vikram@realestate.com'
    },
    availability: 'available',
    features: ['Sea View', 'Private Terrace', 'Italian Marble', 'Home Theater', 'Smart Home', 'Wine Cellar'],
    yearBuilt: 2022,
    furnished: true,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Beach',
        name: 'Worli Sea Face',
        distance: '0.2 km'
      },
      {
        type: 'Restaurant',
        name: 'The Table',
        distance: '1.0 km'
      }
    ],
    isPromoted: true
  },
  // New Nashik properties (more listings)
  {
    title: 'Premium Bungalow in College Road',
    location: 'College Road, Nashik',
    price: 8500000,
    type: 'house',
    bedrooms: 4,
    bathrooms: 3,
    area: {
      value: 2800,
      unit: 'sq.ft'
    },
    amenities: ['Garden', 'Parking', '24/7 Security', 'Power Backup'],
    description: 'Spacious bungalow in prime College Road location with beautiful garden and modern amenities. Close to educational institutions and markets.',
    images: [
      {
        url: 'https://example.com/nashik1_1.jpg',
        caption: 'Front View'
      },
      {
        url: 'https://example.com/nashik1_2.jpg',
        caption: 'Garden Area'
      }
    ],
    agent: {
      name: 'Nitin Deshmukh',
      phone: '+919876543216',
      email: 'nitin@realestate.com'
    },
    availability: 'available',
    features: ['Garden', 'Marble Flooring', 'Spacious Rooms'],
    yearBuilt: 2015,
    furnished: false,
    parking: true,
    nearbyFacilities: [
      {
        type: 'College',
        name: 'KTHM College',
        distance: '0.3 km'
      },
      {
        type: 'Hospital',
        name: 'Wockhardt Hospital',
        distance: '1.0 km'
      }
    ],
    isPromoted: true
  },
  {
    title: 'Modern 2BHK in Nashik Road',
    location: 'Nashik Road, Nashik',
    price: 3800000,
    type: 'apartment',
    bedrooms: 2,
    bathrooms: 2,
    area: {
      value: 950,
      unit: 'sq.ft'
    },
    amenities: ['Gym', 'Parking', 'Security'],
    description: 'Well-designed 2BHK apartment in Nashik Road area with modern fittings and good connectivity to railway station.',
    images: [
      {
        url: 'https://example.com/nashik2_1.jpg',
        caption: 'Living Room'
      },
      {
        url: 'https://example.com/nashik2_2.jpg',
        caption: 'Kitchen'
      }
    ],
    agent: {
      name: 'Priya Joshi',
      phone: '+919876543217',
      email: 'priya.j@realestate.com'
    },
    availability: 'available',
    features: ['Modular Kitchen', 'Balcony', 'Vitrified Tiles'],
    yearBuilt: 2019,
    furnished: false,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Station',
        name: 'Nashik Road Railway Station',
        distance: '1.5 km'
      },
      {
        type: 'Market',
        name: 'Nashik Road Market',
        distance: '0.8 km'
      }
    ],
    isPromoted: false
  },
  {
    title: 'Luxury Villa in Gangapur Road',
    location: 'Gangapur Road, Nashik',
    price: 12500000,
    type: 'villa',
    bedrooms: 5,
    bathrooms: 4,
    area: {
      value: 4000,
      unit: 'sq.ft'
    },
    amenities: ['Swimming Pool', 'Garden', 'Gym', 'Parking', 'Security'],
    description: 'Exclusive luxury villa in premium Gangapur Road location with private swimming pool and landscaped garden.',
    images: [
      {
        url: 'https://example.com/nashik3_1.jpg',
        caption: 'Front View'
      },
      {
        url: 'https://example.com/nashik3_2.jpg',
        caption: 'Swimming Pool'
      }
    ],
    agent: {
      name: 'Rajesh Patil',
      phone: '+919876543218',
      email: 'rajesh.p@realestate.com'
    },
    availability: 'available',
    features: ['Swimming Pool', 'Landscaped Garden', 'Wooden Flooring', 'Home Theater'],
    yearBuilt: 2020,
    furnished: true,
    parking: true,
    nearbyFacilities: [
      {
        type: 'School',
        name: 'Delhi Public School',
        distance: '2.0 km'
      },
      {
        type: 'Mall',
        name: 'City Centre Mall',
        distance: '3.0 km'
      }
    ],
    isPromoted: true
  },
  {
    title: 'Farmhouse on Nasik-Pune Highway',
    location: 'Nasik-Pune Highway, Nashik',
    price: 6500000,
    type: 'farmhouse',
    bedrooms: 3,
    bathrooms: 2,
    area: {
      value: 2,
      unit: 'acre'
    },
    amenities: ['Well', 'Parking', 'Outdoor Seating'],
    description: 'Beautiful farmhouse with fruit orchards and open spaces, perfect for weekend getaways or retirement living.',
    images: [
      {
        url: 'https://example.com/nashik4_1.jpg',
        caption: 'Farmhouse Front'
      },
      {
        url: 'https://example.com/nashik4_2.jpg',
        caption: 'Orchard'
      }
    ],
    agent: {
      name: 'Sunil Gaikwad',
      phone: '+919876543219',
      email: 'sunil@realestate.com'
    },
    availability: 'available',
    features: ['Fruit Orchard', 'Open Spaces', 'Peaceful Location'],
    yearBuilt: 2010,
    furnished: false,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Highway',
        name: 'Nasik-Pune Highway',
        distance: '0.5 km'
      },
      {
        type: 'Village',
        name: 'Sinnar',
        distance: '8.0 km'
      }
    ],
    isPromoted: false
  },
  {
    title: 'Commercial Space in CBD Nashik',
    location: 'CBD Belapur, Nashik',
    price: 12000000,
    type: 'commercial',
    bedrooms: 0,
    bathrooms: 2,
    area: {
      value: 1200,
      unit: 'sq.ft'
    },
    amenities: ['Parking', 'Power Backup', 'Elevator'],
    description: 'Premium commercial space in Nashik CBD area suitable for offices, clinics or showrooms. High visibility location.',
    images: [
      {
        url: 'https://example.com/nashik5_1.jpg',
        caption: 'Exterior View'
      },
      {
        url: 'https://example.com/nashik5_2.jpg',
        caption: 'Interior Space'
      }
    ],
    agent: {
      name: 'Anjali Mehta',
      phone: '+919876543220',
      email: 'anjali@realestate.com'
    },
    availability: 'available',
    features: ['High Visibility', 'Corner Location', 'Flexible Layout'],
    yearBuilt: 2018,
    furnished: false,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Business District',
        name: 'Nashik CBD',
        distance: '0.2 km'
      },
      {
        type: 'Bank',
        name: 'SBI Main Branch',
        distance: '0.3 km'
      }
    ],
    isPromoted: true
  },

  // Pune properties
  {
    title: 'Luxury Apartment in Koregaon Park',
    location: 'Koregaon Park, Pune',
    price: 12000000,
    type: 'apartment',
    bedrooms: 3,
    bathrooms: 3,
    area: {
      value: 1800,
      unit: 'sq.ft'
    },
    amenities: ['Swimming Pool', 'Gym', 'Club House', 'Security', 'Parking'],
    description: 'Premium apartment in Pune\'s most sought-after Koregaon Park location with high-end finishes and amenities.',
    images: [
      {
        url: 'https://example.com/pune1_1.jpg',
        caption: 'Living Area'
      },
      {
        url: 'https://example.com/pune1_2.jpg',
        caption: 'Balcony View'
      }
    ],
    agent: {
      name: 'Rohan Kapoor',
      phone: '+919876543221',
      email: 'rohan@realestate.com'
    },
    availability: 'available',
    features: ['Premium Location', 'Modular Kitchen', 'Wooden Flooring'],
    yearBuilt: 2019,
    furnished: true,
    parking: true,
    nearbyFacilities: [
      {
        type: 'Park',
        name: 'Osho Park',
        distance: '0.8 km'
      },
      {
        type: 'Restaurant',
        name: 'German Bakery',
        distance: '0.5 km'
      }
    ],
    isPromoted: true
  },
  {
    title: '2BHK in Hinjewadi IT Park',
    location: 'Hinjewadi, Pune',
    price: 6500000,
    type: 'apartment',
    bedrooms: 2,
    bathrooms: 2,
    area: {
      value: 1050,
      unit: 'sq.ft'
    },
    amenities: ['Gym', 'Security', 'Parking', 'Power Backup'],
    description: 'Modern 2BHK apartment close to IT Park with good connectivity and amenities. Ideal for IT professionals.',
    images: [
      {
        url: 'https://example.com/pune2_1.jpg',
        caption: 'Living Room'
      },
      {
        url: 'https://example.com/pune2_2.jpg',
        caption: 'Bedroom'
      }
    ],
    agent: {
      name: 'Neha Sharma',
      phone: '+919876543222',
      email: 'neha.s@realestate.com'
    },
    availability: 'available',
    features: ['IT Park Proximity', 'Balcony', 'Modular Kitchen'],
    yearBuilt: 2018,
    furnished: false,
    parking: true,
    nearbyFacilities: [
      {
        type: 'IT Park',
        name: 'Hinjewadi IT Park',
        distance: '1.2 km'
      },
      {
        type: 'Mall',
        name: 'Mall of Hinjewadi',
        distance: '2.0 km'
      }
    ],
    isPromoted: false
  },
  {
    title: 'Villa in Baner',
    location: 'Baner, Pune',
    price: 18000000,
    type: 'villa',
    bedrooms: 4,
    bathrooms: 4,
    area: {
      value: 3500,
      unit: 'sq.ft'
    },
    amenities: ['Garden', 'Swimming Pool', 'Gym', 'Parking', 'Security'],
    description: 'Luxury independent villa in Baner with private garden and swimming pool. Premium location with excellent connectivity.',
    images: [
      {
        url: 'https://example.com/pune3_1.jpg',
        caption: 'Front View'
      },
      {
        url: 'https://example.com/pune3_2.jpg',
        caption: 'Swimming Pool'
      }
    ],
    agent: {
      name: 'Amit Joshi',
      phone: '+919876543223',
      email: 'amit.j@realestate.com'
    },
    availability: 'available',
    features: ['Private Garden', 'Swimming Pool', 'Premium Location'],
    yearBuilt: 2020,
    furnished: true,
    parking: true,
    nearbyFacilities: [
      {
        type: 'School',
        name: 'Vibgyor High',
        distance: '1.5 km'
      },
      {
        type: 'Hospital',
        name: 'Sahyadri Hospital',
        distance: '2.0 km'
      }
    ],
    isPromoted: true
  }
];

// Sample user data with added preferences for Nashik and Pune
const users = [
  {
    phone: '+919876543220',
    name: 'Aditya Sharma',
    email: 'aditya@example.com',
    preferences: {
      location: ['Bandra', 'Juhu', 'Nashik'],
      budgetMin: 10000000,
      budgetMax: 50000000,
      propertyType: ['apartment', 'villa'],
      bedrooms: 3,
      amenities: ['Swimming Pool', 'Gym']
    },
    isActive: true
  },
  {
    phone: '+919876543221',
    name: 'Sneha Patel',
    email: 'sneha@example.com',
    preferences: {
      location: ['Andheri', 'Powai', 'Pune'],
      budgetMin: 5000000,
      budgetMax: 15000000,
      propertyType: ['apartment'],
      bedrooms: 2,
      amenities: ['Security', 'Parking']
    },
    isActive: true
  },
  {
    phone: '+919876543222',
    name: 'Rahul Deshpande',
    email: 'rahul.d@example.com',
    preferences: {
      location: ['Nashik'],
      budgetMin: 3000000,
      budgetMax: 10000000,
      propertyType: ['apartment', 'house'],
      bedrooms: 2,
      amenities: ['Parking']
    },
    isActive: true
  },
  {
    phone: '+919876543223',
    name: 'Priya Kulkarni',
    email: 'priya.k@example.com',
    preferences: {
      location: ['Pune'],
      budgetMin: 5000000,
      budgetMax: 20000000,
      propertyType: ['apartment', 'villa'],
      bedrooms: 3,
      amenities: ['Gym', 'Security']
    },
    isActive: true
  }
];

// Seed database with sample data
async function seedDatabase() {
  try {
    // Clear existing data
    await Property.deleteMany({});
    await User.deleteMany({});

    // Insert new data
    await Property.insertMany(properties);
    await User.insertMany(users);

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}