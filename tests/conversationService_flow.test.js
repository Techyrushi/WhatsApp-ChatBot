const ConversationService = require('../services/conversationService');
const Property = require('../models/Property');

// Mock WhatsAppService
const mockSendTemplate = jest.fn();
const mockSendMessage = jest.fn();
jest.mock('../services/whatsappService', () => {
  return jest.fn().mockImplementation(() => ({
    sendTemplate: mockSendTemplate,
    sendMessage: mockSendMessage,
    convertMarathiToArabicNumerals: (msg) => msg,
    sendPropertyDocument: jest.fn(),
  }));
});

// Mock AIService
jest.mock('../services/aiService', () => {
  return jest.fn().mockImplementation(() => ({
    // mock methods if needed
  }));
});

// Mock AppointmentService
jest.mock('../services/appointmentService', () => {
  return jest.fn().mockImplementation(() => ({
    // mock methods if needed
  }));
});

// Mock Property Model
jest.mock('../models/Property');

describe('ConversationService Flow with Content SIDs', () => {
  let conversationService;
  let mockConversation;

  beforeAll(() => {
    process.env.SMS_CONTENT_SID_VISIT_REQUIRE_LIST = 'HX_REQUIRE';
    process.env.SMS_CONTENT_SID_VISIT_CONFIRM_LIST = 'HX_CONFIRM';
    process.env.SMS_CONTENT_SID_LANG_LIST = 'HX_LANG';
    process.env.SMS_CONTENT_SID_INTEREST_LIST = 'HX_INTEREST';
    process.env.SMS_CONTENT_SID_PROPERTY_LIST = 'HX_PROPERTY';
    process.env.SMS_CONTENT_SID_PROPERTY_BROCHURE_DOWNLOAD = 'HX_BROCHURE';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    conversationService = new ConversationService();
    // Mock internal methods if necessary, but we are testing the public methods
    conversationService.convertMarathiToArabicNumerals = jest.fn((msg) => msg);
    conversationService.createAppointment = jest.fn().mockResolvedValue({ success: true });
    conversationService.sendPropertyDocument = jest.fn();

    mockConversation = {
      userId: 'test_user',
      language: 'english',
      state: 'schedule_visit',
      userInfo: {
          name: 'Test User',
          phone: '1234567890',
          preferredTimeText: 'Tomorrow 10 AM'
      },
      selectedProperty: 'prop123',
      matchedProperties: ['prop123'],
      save: jest.fn(),
    };
  });

  test('sendWelcomeMessage should send LANG_LIST template', async () => {
    await conversationService.sendWelcomeMessage(mockConversation);
    expect(mockSendTemplate).toHaveBeenCalledWith('test_user', 'HX_LANG');
  });

  test('sendPropertyTypeOptionsMessage should send INTEREST_LIST template', async () => {
    await conversationService.sendPropertyTypeOptionsMessage(mockConversation);
    expect(mockSendTemplate).toHaveBeenCalledWith('test_user', 'HX_INTEREST');
  });

  test('handlePropertyMatchState should send PROPERTY_LIST template when user selects property', async () => {
    mockConversation.state = 'property_match';
    mockConversation.matchedProperties = ['prop123'];
    
    // Mock Property.findById
    Property.findById.mockResolvedValue({
        _id: 'prop123',
        title: 'Test Property',
        type: 'office',
        subType: 'office',
        location: 'Nashik',
        forSale: true,
        forLease: false,
        carpetArea: { value: 1000, unit: 'sq.ft' },
        builtUpArea: { value: 1200, unit: 'sq.ft' },
        parkingSpaces: { fourWheeler: 1 },
        description: 'Nice office',
        formatDetails: jest.fn().mockReturnValue('Details Text')
    });

    const response = await conversationService.handlePropertyMatchState(mockConversation, '1');

    // Verify template was sent
    expect(mockSendTemplate).toHaveBeenCalledWith(
        'test_user', 
        'HX_PROPERTY',
        expect.objectContaining({
            "1": "Test Property",
            "2": "Nashik",
            "3": "office - office",
            "4": "For Sale",
            "5": "1000 sq.ft",
            "6": "1200 sq.ft",
            "7": "1",
            "8": "Nice office"
        })
    );
    
    // Response should be null since template handles the display
    expect(response).toBeNull();
  });

  test('handleScheduleVisitState should NOT send VISIT_REQUIRE_LIST template', async () => {
    mockConversation.state = 'schedule_visit';
    const message = '1'; // Schedule visit

    await conversationService.handleScheduleVisitState(mockConversation, message);

    expect(mockConversation.state).toBe('collect_info');
    // Ensure template was NOT sent here
    expect(mockSendTemplate).not.toHaveBeenCalledWith('test_user', 'HX_REQUIRE');
  });

  test('handleCollectInfoState should send VISIT_REQUIRE_LIST template when asking for requirements', async () => {
    mockConversation.state = 'collect_info';
    // User provides time
    mockConversation.userInfo = {
        name: 'Test User',
        phone: '1234567890'
    };
    
    const message = 'Tomorrow 10 AM';
    
    await conversationService.handleCollectInfoState(mockConversation, message);
    
    expect(mockSendTemplate).toHaveBeenCalledWith(
        'test_user', 
        'HX_REQUIRE',
        expect.objectContaining({
            "1": expect.any(String),
            "2": expect.any(String)
        })
    );
  });

  test('generateEnhancedConfirmation should send VISIT_CONFIRM_LIST template', async () => {
    // Mock Property.findById
    Property.findById.mockResolvedValue({
        _id: 'prop123',
        title: 'Test Property',
        type: 'office',
        location: 'Nashik',
        agent: { name: 'Agent', phone: '123' }
    });

    mockConversation.state = 'completed';
    mockConversation.userInfo = {
        name: 'Test User',
        phone: '1234567890',
        preferredTimeText: 'Tomorrow 10 AM',
        specialRequirements: 'None'
    };

    await conversationService.generateEnhancedConfirmation(mockConversation, 'english');

    expect(mockSendMessage).not.toHaveBeenCalled(); // Text details should be skipped
    // Verify template was sent with variables
    expect(mockSendTemplate).toHaveBeenCalledWith(
        'test_user', 
        'HX_CONFIRM',
        expect.objectContaining({
            "1": "Test User",
            "2": "Test Property",
            "3": expect.any(String), // Date (Time)
            "4": "Nashik",
            "5": "office",
            "9": "Aditya Malpure",
            "11": "None",
            "12": "shortly"
        })
    );
  });

  test('sendPropertyDocument should send BROCHURE_DOWNLOAD template', async () => {
    process.env.SMS_CONTENT_SID_PROPERTY_BROCHURE_DOWNLOAD = 'HX_BROCHURE';
    
    // Restore original implementation for this test or bind it correctly
    // Since we mocked conversationService.sendPropertyDocument in beforeEach, we need to unmock it or call the prototype method if possible,
    // OR just instantiate a fresh service or test the method directly if it's not mocked on the instance.
    // In beforeEach: conversationService.sendPropertyDocument = jest.fn();
    // This hides the real implementation. We need to remove this mock for this test.
    delete conversationService.sendPropertyDocument;

    // Mock Property.findById
    Property.findById.mockResolvedValue({
        _id: 'prop123',
        title: 'Test Property',
        type: 'office',
        location: 'Nashik',
        agent: { name: 'Agent', phone: '123' }
    });

    mockConversation.selectedProperty = 'prop123';
    
    await conversationService.sendPropertyDocument(mockConversation, 'brochure');
    
    expect(mockSendTemplate).toHaveBeenCalledWith(
        'test_user', 
        'HX_BROCHURE',
        expect.objectContaining({
            "1": "Property Brochure" // Default is english in mock
        })
    );
  });

  test('handleWelcomeState should accept LANG_EN and transition to property_type', async () => {
    mockConversation.state = 'welcome';
    const message = 'LANG_EN';
    
    // We expect sendPropertyTypeOptionsMessage to be called, which calls sendTemplate with HX_INTEREST
    await conversationService.handleWelcomeState(mockConversation, message);
    
    expect(mockConversation.language).toBe('english');
    expect(mockConversation.state).toBe('property_type');
    expect(mockSendTemplate).toHaveBeenCalledWith('test_user', 'HX_INTEREST');
  });
});
