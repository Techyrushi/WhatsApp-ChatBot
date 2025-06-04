# Real Estate WhatsApp Bot

A WhatsApp bot for real estate property management and appointments, built with Node.js, Express, MongoDB, and Twilio. The bot uses AI to provide personalized responses and guide users through a conversation flow to find properties and schedule site visits.

## Features

- Personalized real estate property search via WhatsApp
- Conversation flow: Welcome → Location → Budget → BHK → Property Match → Schedule Visit
- AI-powered responses using OpenRouter API
- Property matching based on user preferences
- Appointment scheduling and management
- Database storage for properties, users, and appointments
- Sales team notification for new appointments

## Bot Flow

1. **Welcome**: Bot introduces itself and asks for the user's preferred location
2. **Location**: User provides location, bot asks for budget
3. **Budget**: User provides budget range, bot asks for BHK preference
4. **BHK**: User provides BHK preference, bot finds matching properties
5. **Property Match**: Bot shows matching properties with images and details
6. **Schedule Visit**: Bot asks if user wants to schedule a site visit
7. **Collect Info**: Bot collects user's name, phone, and preferred time
8. **Confirmation**: Bot confirms appointment and notifies sales team

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Twilio account with WhatsApp API access
- OpenRouter API key

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/whatsapp-realestate-bot.git
   cd whatsapp-realestate-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example` and fill in your credentials:
   ```
   cp .env.example .env
   ```

4. Set up your environment variables in the `.env` file:
   - MongoDB connection string
   - Twilio credentials
   - OpenRouter API key
   - Notification settings

## Usage

1. Start the server:
   ```
   npm start
   ```

2. For development with auto-restart:
   ```
   npm run dev
   ```

3. Seed the database with sample properties:
   ```
   npm run seed
   ```

4. Expose your local server using a tool like ngrok:
   ```
   ngrok http 3000
   ```

5. Configure your Twilio WhatsApp Sandbox with the webhook URL:
   ```
   https://your-ngrok-url.ngrok.io/webhook
   ```

## Project Structure

```
├── config/
│   └── database.js         # Database configuration
├── models/
│   ├── Property.js         # Property model
│   └── User.js             # User model
├── scripts/
│   └── seedDatabase.js     # Database seeding script
├── services/
│   ├── aiService.js        # AI service for personalized responses
│   ├── appointmentService.js # Appointment management service
│   ├── conversationService.js # Conversation flow management
│   └── whatsappService.js  # WhatsApp messaging service
├── utils/
│   └── helpers.js          # Utility functions
├── .env.example            # Example environment variables
├── package.json            # Project dependencies
├── server.js              # Main application entry point
└── README.md              # Project documentation
```

## Customization

### Adding New Properties

You can add new properties by:

1. Adding them directly to the MongoDB database
2. Modifying the `scripts/seedDatabase.js` file and running `npm run seed`
3. Creating an admin interface (not included in this version)

### Modifying the Conversation Flow

The conversation flow is managed in `services/conversationService.js`. You can modify the flow by:

1. Adding new states to the conversation
2. Modifying the handling of existing states
3. Customizing the AI prompts in `services/aiService.js`

## Testing

Run tests using Jest:

```
npm test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Twilio for WhatsApp API
- OpenRouter for AI capabilities
- MongoDB for database storage
