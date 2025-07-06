// scripts/checkGoogleSheetsStatus.js
require('dotenv').config();
const mongoose = require('mongoose');
const GoogleSheetsService = require('../services/googleSheetsService');
const WhatsAppService = require('../services/whatsappService');
const Helpers = require('../utils/helpers');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  checkGoogleSheetsStatus();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Initialize services
const googleSheetsService = new GoogleSheetsService();
const whatsappService = new WhatsAppService();

async function checkGoogleSheetsStatus() {
  try {
    console.log('Checking Google Sheets API status...');
    
    // Test data for checking API status
    const testData = {
      userName: 'API Test',
      userPhone: 'test',
      dateTime: new Date(),
      purpose: 'API Status Check',
      language: 'English',
      source: 'System Check',
      status: 'test'
    };
    
    // Try to initialize and append test data
    const result = await googleSheetsService.appendAppointmentData(testData);
    
    if (result.success) {
      console.log('Google Sheets API is working correctly');
      await sendStatusNotification(true);
    } else {
      console.error(`Google Sheets API check failed: ${result.errorType}`);
      
      // Format error details
      let errorDetails = '';
      switch(result.errorType) {
        case 'API_NOT_ENABLED':
          errorDetails = `API not enabled. Enable at: ${result.enableUrl}`;
          break;
        case 'PERMISSION_DENIED':
          errorDetails = 'Permission denied. Check service account permissions.';
          break;
        case 'SHEET_NOT_FOUND':
          errorDetails = 'Spreadsheet or sheet not found. Check spreadsheet ID and sheet name.';
          break;
        case 'CONFIG_ERROR':
          errorDetails = `Configuration error: ${result.error?.message || 'Unknown'}`;
          break;
        default:
          errorDetails = result.error?.message || 'Unknown error';
      }
      
      await sendStatusNotification(false, errorDetails);
    }
    
    console.log('Google Sheets status check completed');
    process.exit(0);
  } catch (error) {
    console.error('Error checking Google Sheets status:', error);
    await sendStatusNotification(false, error.message);
    process.exit(1);
  }
}

async function sendStatusNotification(isWorking, errorDetails = '') {
  try {
    // Only send notification if there's an admin WhatsApp number configured
    const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
    if (!adminNumber) {
      console.log('No admin WhatsApp number configured. Skipping notification.');
      return;
    }
    
    // Only send notification if there's an error (to avoid daily spam)
    if (isWorking && !process.env.NOTIFY_ON_SUCCESS) {
      console.log('API is working and NOTIFY_ON_SUCCESS is not enabled. Skipping notification.');
      return;
    }
    
    const message = isWorking
      ? '✅ Google Sheets API is working correctly.'
      : `❌ Google Sheets API check failed: ${errorDetails}`;
    
    await whatsappService.sendMessage(`whatsapp:${adminNumber}`, message);
    console.log(`Status notification sent to ${adminNumber}`);
  } catch (error) {
    console.error('Error sending status notification:', error);
  }
}