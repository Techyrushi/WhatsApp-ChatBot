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
│   ├── googleSheetsService.js # Google Sheets integration for data storage
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

## Google Sheets Integration Setup

The bot can store appointment data in Google Sheets. Follow these steps to set up the integration:

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Sheets API for your project

2. **Create Service Account Credentials**:
   - In your Google Cloud project, go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the service account details and click "Create"
   - Grant the service account "Editor" access to the project
   - Create a new JSON key for the service account and download it

3. **Set Up Your Google Sheet**:
   - Create a new Google Sheet
   - Add a sheet named "CRM Lead Tracker" with these columns:
     - Name
     - Contact
     - Visit Date & Time
     - Purpose
     - Language
     - Source
     - Status
     - Timestamp
   - Share the sheet with the service account email (with Editor permissions)

4. **Configure Environment Variables**:
   - Add these variables to your `.env` file:
   ```
   GOOGLE_SHEET_ID=your_google_sheet_id
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="your_private_key_with_newlines"
   ```
   - The Sheet ID is in the URL of your Google Sheet: `https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_SHEET_ID]/edit`
   - For the private key, copy it from the JSON file and include all newlines (\n)

## Error Handling and Troubleshooting

### Common Issues

1. **Google Sheets API Not Enabled**:
   - Error: "Google Sheets API has not been used in project ... before or it is disabled"
   - Solution: Enable the Google Sheets API in your Google Cloud Console
   - The system will automatically extract the project ID from the error message and provide the exact URL to enable the API
   - Run `npm run check-sheets` to verify the API status

2. **WhatsApp Message Delivery Failures**:
   - Check that your Twilio account is active and has sufficient credit
   - Verify that the phone numbers are in the correct format (with country code)
   - For sandbox mode, ensure recipients have joined your sandbox
   - The system now logs unsent messages as a backup

3. **Inactivity Detection Issues**:
   - If the bot is not detecting inactivity correctly, check the `lastActivityTimestamp` field in the conversation document
   - Adjust the inactivity timeout in the `Helpers.checkInactivity()` method
   - Run `npm run check-inactive` to manually check and notify inactive users

4. **Fallback Handling Not Working**:
   - Ensure the `getUnrecognizedInputMessage` method is being called correctly
   - Check for any custom message handling that might be bypassing the fallback

### Logging and Monitoring

The application includes enhanced logging mechanisms:

- Standard console logs for general operation
- Structured error logs with context using `Helpers.logError()`
- User-friendly error messages based on error type
- Backup logging for appointment data when Google Sheets integration fails
- Automatic monitoring scripts for system health checks

### Monitoring Scripts

The following monitoring scripts are available:

1. **Check Inactive Conversations**:
   ```
   npm run check-inactive
   ```
   This script identifies inactive conversations and sends notifications to users.

2. **Check Google Sheets API Status**:
   ```
   npm run check-sheets
   ```
   This script verifies the Google Sheets API connection and sends alerts to the admin if there are issues.

### Admin Notifications

Set up admin notifications by configuring these environment variables:

- `ADMIN_WHATSAPP_NUMBER`: WhatsApp number to receive system alerts
- `NOTIFY_ON_SUCCESS`: Set to `true` to receive notifications for successful checks (default: `false`)

These notifications help you stay informed about system health and potential issues.

For production environments, consider implementing a more robust logging solution like Winston or integrating with a monitoring service.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Twilio for WhatsApp API
- OpenRouter for AI capabilities
- MongoDB for database storage
- Google Sheets API for data integration
