const { createTestToken, createTestUser, createTestVCard, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

describe('Test Helpers', () => {
  test('createTestToken creates valid JWT token', () => {
    const token = createTestToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); 
  });

  test('createTestToken with custom data', () => {
    const customData = { id: 123, email: 'custom@example.com' };
    const token = createTestToken(customData);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('createTestUser creates valid user object', async () => {
    const user = await createTestUser();
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('password');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('isVerified');
  });

  test('createTestUser with custom data', async () => {
    const customUser = await createTestUser({
      name: 'Custom User',
      email: 'custom@example.com'
    });
    expect(customUser.name).toBe('Custom User');
    expect(customUser.email).toBe('custom@example.com');
  });

  test('createTestVCard creates valid vCard object', () => {
    const vcard = createTestVCard();
    expect(vcard).toHaveProperty('name');
    expect(vcard).toHaveProperty('url');
    expect(vcard).toHaveProperty('is_active'); // Corrigé pour correspondre à la structure réelle
  });

  test('expectSuccessResponse validates successful responses', () => {
    const mockResponse = {
      status: 200,
      body: { success: true, data: { id: 1 } }
    };
    
    // Should not throw
    expect(() => expectSuccessResponse(mockResponse)).not.toThrow();
  });

  test('expectErrorResponse validates error responses', () => {
    const mockResponse = {
      status: 400,
      body: { success: false, message: 'Bad request' }
    };
    
    // Should not throw
    expect(() => expectErrorResponse(mockResponse, 400, 'Bad request')).not.toThrow();
  });
});
