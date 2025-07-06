// services/googleSheetsService.js
const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    // Initialize with environment variables
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
    this.auth = null;
    this.sheets = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Create JWT client using service account credentials
      this.auth = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        null,
        // The private key needs to be properly formatted from the environment variable
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      // Initialize Google Sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;
      console.log('Google Sheets API initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google Sheets API:', error);
      return false;
    }
  }

  async appendAppointmentData(appointmentData) {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          return {
            success: false,
            error: 'Failed to initialize Google Sheets API',
            data: appointmentData
          };
        }
      }

      if (!this.spreadsheetId) {
        const error = new Error('Google Sheet ID not configured');
        return {
          success: false,
          error: error,
          errorType: 'CONFIG_ERROR',
          data: appointmentData
        };
      }

      // Format date for better readability
      const appointmentDate = appointmentData.dateTime;
      const formattedDate = `${appointmentDate.getDate()} ${this.getMonthName(appointmentDate.getMonth())}, ${appointmentDate.getHours()}:${String(appointmentDate.getMinutes()).padStart(2, '0')} ${appointmentDate.getHours() >= 12 ? 'PM' : 'AM'}`;
      
      // Format timestamp
      const timestamp = new Date();
      const formattedTimestamp = `${timestamp.getDate()} ${this.getMonthName(timestamp.getMonth())}, ${timestamp.getHours()}:${String(timestamp.getMinutes()).padStart(2, '0')} ${timestamp.getHours() >= 12 ? 'PM' : 'AM'}`;

      // Prepare row data according to the specified columns
      // Name, Contact, Visit Date & Time, Purpose, Language, Source, Status, Timestamp
      const values = [
        [
          appointmentData.userName || '',
          appointmentData.userPhone || '',
          formattedDate,
          appointmentData.purpose || '',
          appointmentData.language || 'English',
          appointmentData.source || 'WhatsApp Bot',
          appointmentData.status || 'Scheduled',
          formattedTimestamp
        ]
      ];

      try {
        // Append data to the sheet
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'CRM Lead Tracker!A:H', // Assuming this is the sheet name and range
          valueInputOption: 'USER_ENTERED',
          resource: { values }
        });

        console.log(`${response.data.updates.updatedCells} cells appended to Google Sheet`);
        return {
          success: true,
          updatedCells: response.data.updates.updatedCells,
          data: values[0]
        };
      } catch (apiError) {
        // Handle specific API errors
        if (apiError.message && (apiError.message.includes('API has not been used') || apiError.message.includes('disabled'))) {
          const projectId = this.extractProjectId(apiError.message);
          const enableUrl = projectId ? 
            `https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}` : 
            'https://console.developers.google.com/apis/api/sheets.googleapis.com/overview';
          
          console.error(`Google Sheets API is not enabled. Please enable it at ${enableUrl}`);
          console.error('Full error details:', JSON.stringify(apiError.errors || apiError, null, 2));
          
          // Log the data that would have been sent to Google Sheets as a fallback
          console.log('Appointment data (not sent to Google Sheets):', JSON.stringify(values));
          
          return {
            success: false,
            error: apiError,
            errorType: 'API_NOT_ENABLED',
            enableUrl: enableUrl,
            data: appointmentData
          };
        } else if (apiError.code === 403) {
          return {
            success: false,
            error: apiError,
            errorType: 'PERMISSION_DENIED',
            message: 'Permission denied. Check service account permissions.',
            data: appointmentData
          };
        } else if (apiError.code === 404) {
          return {
            success: false,
            error: apiError,
            errorType: 'SHEET_NOT_FOUND',
            message: 'Spreadsheet or sheet not found. Check spreadsheet ID and sheet name.',
            data: appointmentData
          };
        }
        
        // For other API errors
        return {
          success: false,
          error: apiError,
          errorType: 'API_ERROR',
          data: appointmentData
        };
      }
    } catch (error) {
      console.error('Error appending data to Google Sheet:', error);
      return {
        success: false,
        error: error,
        errorType: 'UNKNOWN_ERROR',
        data: appointmentData
      };
    }
  }

  // Helper method to get month name
  getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }
  
  // Extract project ID from error message
  extractProjectId(errorMessage) {
    if (!errorMessage) return null;
    
    // Try to extract project ID using regex
    const projectIdRegex = /project=([0-9]+)/;
    const match = errorMessage.match(projectIdRegex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // Alternative regex for different error message format
    const altProjectIdRegex = /project ([0-9]+)/;
    const altMatch = errorMessage.match(altProjectIdRegex);
    
    return altMatch && altMatch[1] ? altMatch[1] : null;
  }
}

module.exports = GoogleSheetsService;