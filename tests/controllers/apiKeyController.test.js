const request = require('supertest');
const express = require('express');
const apiKeyController = require('../../controllers/ApiKeyController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/planLimiter', () => ({
  getActiveApiKeyLimit: jest.fn().mockResolvedValue(5)
}));

const app = express();
app.use(express.json());

// Endpoints corrigés pour correspondre au contrôleur
app.get('/apiKey', apiKeyController.listApiKeys);
app.post('/apiKey', apiKeyController.createApiKey);
app.delete('/apiKey/:id', apiKeyController.deleteApiKey);
app.put('/apiKey/:id/toggle', apiKeyController.toggleApiKeyStatus);

describe('ApiKeyController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testApiKey;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    testApiKey = {
      id: 1,
      userId: 1,
      name: 'Test API Key',
      key: 'encrypted_key_data',
      prefix: 'testpref',
      scopes: ['read', 'write'],
      isActive: true,
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      get: jest.fn().mockImplementation(function() { 
        return { 
          ...this,
          user: testUser
        }; 
      })
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /apiKey', () => {
    test('should get all api keys for user with isDisabled flag', async () => {
      const apiKeys = [
        { ...testApiKey, id: 1 },
        { ...testApiKey, id: 2, name: 'Another Key' }
      ];
      
      mockModels.ApiKey.findAll.mockResolvedValue(apiKeys);

      const response = await request(app)
        .get('/apiKey')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('isDisabled', false);
      expect(mockModels.ApiKey.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        attributes: ['id', 'name', 'prefix', 'scopes', 'expiresAt', 'isActive', 'lastUsedAt', 'created_at'],
        order: [['created_at', 'ASC']]
      });
    });

    test('should mark keys beyond limit as disabled', async () => {
      // Mock lower limit
      require('../../middleware/planLimiter').getActiveApiKeyLimit.mockResolvedValue(1);
      
      const apiKeys = [
        { ...testApiKey, id: 1 },
        { ...testApiKey, id: 2, name: 'Another Key' }
      ];
      mockModels.ApiKey.findAll.mockResolvedValue(apiKeys);

      const response = await request(app)
        .get('/apiKey')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data[0].isDisabled).toBe(false);
      expect(response.body.data[1].isDisabled).toBe(true);
    });
  });

  describe('POST /apiKey', () => {
    test('should create api key successfully and return raw key', async () => {
      const apiKeyData = {
        name: 'New API Key',
        scopes: ['read'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Mock crypto functions
      const originalGenerate = apiKeyController._internal.generateSecureKey;
      const originalHash = apiKeyController._internal.hashKey;
      apiKeyController._internal.generateSecureKey = jest.fn().mockReturnValue('test_key_data');
      apiKeyController._internal.hashKey = jest.fn().mockReturnValue('hashed_key_data');

      const createdApiKey = {
        ...testApiKey,
        ...apiKeyData,
        key: 'hashed_key_data',
        prefix: 'testpref',
        get: jest.fn().mockReturnValue({
          ...testApiKey,
          ...apiKeyData,
          key: 'hashed_key_data',
          prefix: 'testpref',
          created_at: new Date()
        })
      };

      mockModels.ApiKey.create.mockResolvedValue(createdApiKey);

      const response = await request(app)
        .post('/apiKey')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      // Restore original functions
      apiKeyController._internal.generateSecureKey = originalGenerate;
      apiKeyController._internal.hashKey = originalHash;

      expectSuccessResponse(response, 201);
      expect(response.body.data).toHaveProperty('key', 'test_key_data');
      expect(response.body.message).toBe('API key created successfully');
      expect(mockModels.ApiKey.create).toHaveBeenCalledWith({
        userId: 1,
        name: apiKeyData.name,
        key: 'hashed_key_data',
        prefix: expect.any(String),
        scopes: ['read'],
        expiresAt: new Date(apiKeyData.expiresAt),
        isActive: true
      });
    });

    test('should handle creation errors', async () => {
      mockModels.ApiKey.create.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/apiKey')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Invalid Key' });

      expectErrorResponse(response, 500);
      expect(response.body.message).toContain('Failed to create API key');
    });
  });

  describe('DELETE /apiKey/:id', () => {
    test('should delete api key successfully', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(testApiKey);
      mockModels.ApiKey.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/apiKey/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toBe('API key deleted successfully');
      expect(mockModels.ApiKey.destroy).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });

    test('should return 404 for non-existent api key', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/apiKey/999')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404);
      expect(response.body.message).toBe('API key not found');
    });
  });

  describe('PUT /apiKey/:id/toggle', () => {
    test('should toggle api key status successfully', async () => {
      const inactiveKey = { ...testApiKey, isActive: false };
      
      // First call: deactivate active key
      mockModels.ApiKey.findOne
        .mockResolvedValueOnce(testApiKey)
        // Second call: reactivate inactive key
        .mockResolvedValueOnce(inactiveKey);
      
      mockModels.ApiKey.update.mockResolvedValue([1]);

      // First request: deactivate
      let response = await request(app)
        .put('/apiKey/1/toggle')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toContain('disabled');
      expect(response.body.data.isActive).toBe(false);

      // Second request: reactivate
      response = await request(app)
        .put('/apiKey/1/toggle')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toContain('enabled');
      expect(response.body.data.isActive).toBe(true);
    });

    test('should return 404 for non-existent api key', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put('/apiKey/999/toggle')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404);
      expect(response.body.message).toBe('API key not found');
    });

    test('should handle toggle errors', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(testApiKey);
      mockModels.ApiKey.update.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/apiKey/1/toggle')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 500);
      expect(response.body.message).toContain('toggle API key status');
    });
  });

  describe('Error Handling', () => {
    test('should handle internal server errors', async () => {
      mockModels.ApiKey.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/apiKey')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 500);
      expect(response.body.message).toContain('Failed to list API keys');
    });
  });
});