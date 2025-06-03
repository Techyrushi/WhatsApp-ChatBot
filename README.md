# WhatsApp Real Estate Bot

A WhatsApp bot built with Node.js that helps manage real estate properties and appointments using AI capabilities.

## Features

- Property listing and search
- AI-powered property recommendations
- Appointment scheduling
- WhatsApp integration
- Firebase database integration

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Twilio Account
- OpenAI API Key
- Firebase Project

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp-realestate-bot.git
cd whatsapp-realestate-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
- Copy `.env.example` to `.env`
- Fill in your configuration details

4. Set up Firebase:
- Download your Firebase service account key
- Save it as `serviceAccountKey.json` in the project root

5. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Project Structure

```
whatsapp-realestate-bot/
├── server.js
├── package.json
├── .env.example
├── .env
├── .gitignore
├── README.md
├── serviceAccountKey.json
├── config/
│   └── database.js
├── models/
│   └── Property.js
├── services/
│   ├── whatsappService.js
│   ├── aiService.js
│   └── appointmentService.js
├── utils/
│   └── helpers.js
└── tests/
    └── server.test.js
```

## Testing

Run tests using:
```bash
npm test
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request