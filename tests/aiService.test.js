// tests/aiService.test.js
const AIService = require('../services/aiService');

// Mock OpenAI API
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Mocked AI response' } }]
            })
          }
        }
      };
    })
  };
});

describe('AIService', () => {
  let aiService;
  
  beforeEach(() => {
    // Reset environment variables for testing
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    
    aiService = new AIService();
    
    // Mock the OpenAI API calls with more specific responses for different methods
    aiService.openai.chat.completions.create = jest.fn().mockImplementation((params) => {
      // Check the prompt to determine which method is being called
      const prompt = params.messages.find(m => m.role === 'user')?.content || '';
      
      if (prompt.includes('extract the location')) {
        return Promise.resolve({
          choices: [{ message: { content: 'Mumbai' } }]
        });
      } else if (prompt.includes('extract the budget range')) {
        return Promise.resolve({
          choices: [{ message: { content: '50-80' } }]
        });
      } else if (prompt.includes('extract the number of bedrooms')) {
        return Promise.resolve({
          choices: [{ message: { content: '2' } }]
        });
      } else if (prompt.includes('extract the user information')) {
        return Promise.resolve({
          choices: [{ message: { content: JSON.stringify({
            name: 'John Doe',
            phone: '+1234567890',
            preferredTime: new Date().toISOString(),
            preferredTimeText: 'Tomorrow at 2 PM'
          }) } }]
        });
      } else if (prompt.includes('identify the user intent')) {
        return Promise.resolve({
          choices: [{ message: { content: 'greeting' } }]
        });
      } else {
        return Promise.resolve({
          choices: [{ message: { content: 'Mocked AI response for general query' } }]
        });
      }
    });
  });
  
  test('should initialize with correct configuration', () => {
    expect(aiService.openai).toBeDefined();
  });
  
  test('should build system prompt based on conversation state', () => {
    // Test welcome state
    const welcomePrompt = aiService.buildSystemPrompt({ state: 'welcome' });
    expect(welcomePrompt).toContain('welcome message');
    
    // Test location state
    const locationPrompt = aiService.buildSystemPrompt({ state: 'location' });
    expect(locationPrompt).toContain('location');
    
    // Test budget state
    const budgetPrompt = aiService.buildSystemPrompt({ state: 'budget' });
    expect(budgetPrompt).toContain('budget');
    
    // Test BHK state
    const bhkPrompt = aiService.buildSystemPrompt({ state: 'bhk' });
    expect(bhkPrompt).toContain('BHK');
    
    // Test property match state
    const propertyMatchPrompt = aiService.buildSystemPrompt({
      state: 'property_match',
      matchedProperties: [{ title: 'Test Property' }]
    });
    expect(propertyMatchPrompt).toContain('property');
    
    // Test schedule visit state
    const scheduleVisitPrompt = aiService.buildSystemPrompt({
      state: 'schedule_visit',
      selectedProperty: { title: 'Selected Property' }
    });
    expect(scheduleVisitPrompt).toContain('schedule');
    
    // Test collect info state
    const collectInfoPrompt = aiService.buildSystemPrompt({ state: 'collect_info' });
    expect(collectInfoPrompt).toContain('collect');
    
    // Test completed state
    const completedPrompt = aiService.buildSystemPrompt({
      state: 'completed',
      userInfo: { name: 'John Doe' }
    });
    expect(completedPrompt).toContain('completed');
  });
  
  test('should generate AI response', async () => {
    const response = await aiService.generateResponse('Hello', { state: 'welcome' });
    expect(response).toBe('Mocked AI response for general query');
  });
  
  test('should extract user intent', async () => {
    const intent = await aiService.extractUserIntent('Hi there');
    expect(intent).toBe('greeting');
  });
  
  test('should extract location from message', async () => {
    const location = await aiService.extractLocation('I want a property in Mumbai');
    expect(location).toBe('Mumbai');
  });
  
  test('should extract budget from message', async () => {
    const budget = await aiService.extractBudget('My budget is between 50 and 80 lakhs');
    expect(budget).toBe('50-80');
  });
  
  test('should extract BHK from message', async () => {
    const bhk = await aiService.extractBHK('I need a 2 BHK apartment');
    expect(bhk).toBe('2');
  });
  
  test('should extract user information from message', async () => {
    const userInfo = await aiService.extractUserInfo('My name is John Doe, contact me at +1234567890, I prefer tomorrow at 2 PM');
    expect(userInfo).toEqual({
      name: 'John Doe',
      phone: '+1234567890',
      preferredTime: expect.any(String), // ISO string from Date
      preferredTimeText: 'Tomorrow at 2 PM'
    });
  });
  
  test('should handle API errors gracefully', async () => {
    // Mock API failure
    aiService.openai.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));
    
    // Should return a default response on error
    const response = await aiService.generateResponse('Hello', { state: 'welcome' });
    expect(response).toContain('I apologize');
  });
  
  test('should use different models for different operations', async () => {
    // Call methods that use different models
    await aiService.generateResponse('Hello', { state: 'welcome' });
    await aiService.extractUserIntent('Hi there');
    
    // Check that the API was called with different model parameters
    const calls = aiService.openai.chat.completions.create.mock.calls;
    
    // At least two calls should have been made
    expect(calls.length).toBeGreaterThanOrEqual(2);
    
    // Extract the models used in the calls
    const models = calls.map(call => call[0].model);
    
    // Verify that at least one call used the main model and one used the extraction model
    expect(models).toContain('anthropic/claude-3-haiku:beta');
  });
});