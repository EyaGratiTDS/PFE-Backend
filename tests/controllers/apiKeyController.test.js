const request = require('supertest');
const express = require('express');
const apiKeyController = require('../../controllers/ApiKeyController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/cryptoUtils');

const app = express();
app.use(express.json());

// Configuration des routes de test
app.get('/api-keys', apiKeyController.getAllApiKeys);
app.post('/api-keys', apiKeyController.createApiKey);
app.get('/api-keys/:id', apiKeyController.getApiKeyById);
app.put('/api-keys/:id', apiKeyController.updateApiKey);
app.delete('/api-keys/:id', apiKeyController.deleteApiKey);
app.post('/api-keys/:id/regenerate', apiKeyController.regenerateApiKey);

describe('ApiKeyController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testApiKey;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testApiKey = {
      id: 1,
      userId: 1,
      name: 'Test API Key',
      key: 'encrypted_key_data',
      permissions: ['read', 'write'],
      is_active: true,
      last_used: null,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /api-keys', () => {
    test('should get all api keys for user', async () => {
      const apiKeys = [testApiKey, { ...testApiKey, id: 2, name: 'Another Key' }];
      mockModels.ApiKey.findAll.mockResolvedValue(apiKeys);

      const response = await request(app)
        .get('/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.ApiKey.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        attributes: { exclude: ['key'] },
        order: [['createdAt', 'DESC']]
      });
    });

    test('should filter by active status', async () => {
      mockModels.ApiKey.findAll.mockResolvedValue([testApiKey]);

      const response = await request(app)
        .get('/api-keys?active=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.ApiKey.findAll).toHaveBeenCalledWith({
        where: { userId: 1, is_active: true },
        attributes: { exclude: ['key'] },
        order: [['createdAt', 'DESC']]
      });
    });
  });

  describe('POST /api-keys', () => {
    test('should create api key successfully', async () => {
      const apiKeyData = {
        name: 'New API Key',
        permissions: ['read']
      };

      const cryptoUtils = require('../../services/cryptoUtils');
      cryptoUtils.encryptToken = jest.fn().mockReturnValue('encrypted_key');

      const createdApiKey = {
        ...testApiKey,
        ...apiKeyData,
        key: 'encrypted_key'
      };

      mockModels.ApiKey.create.mockResolvedValue(createdApiKey);

      const response = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send(apiKeyData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('plainKey');
      expect(mockModels.ApiKey.create).toHaveBeenCalledWith({
        userId: 1,
        name: apiKeyData.name,
        key: 'encrypted_key',
        permissions: apiKeyData.permissions,
        expires_at: expect.any(Date)
      });
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
      expect(response.body.message).toContain('Name is required');
    });

    test('should validate permissions', async () => {
      const response = await request(app)
        .post('/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          permissions: ['invalid_permission']
        });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Invalid permissions');
    });
  });

  describe('GET /api-keys/:id', () => {
    test('should get api key by id', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(testApiKey);

      const response = await request(app)
        .get('/api-keys/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe(testApiKey.name);
    });

    test('should return 404 for non-existent api key', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api-keys/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api-keys/:id', () => {
    test('should update api key successfully', async () => {
      const updateData = {
        name: 'Updated API Key',
        permissions: ['read', 'write', 'delete']
      };

      mockModels.ApiKey.findOne.mockResolvedValue(testApiKey);
      mockModels.ApiKey.update.mockResolvedValue([1]);
      mockModels.ApiKey.findOne.mockResolvedValueOnce({ ...testApiKey, ...updateData });

      const response = await request(app)
        .put('/api-keys/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(mockModels.ApiKey.update).toHaveBeenCalledWith(
        updateData,
        { where: { id: 1, userId: 1 } }
      );
    });

    test('should not allow updating key directly', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(testApiKey);

      const response = await request(app)
        .put('/api-keys/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ key: 'new_key' });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Key cannot be updated directly');
    });
  });

  describe('DELETE /api-keys/:id', () => {
    test('should deactivate api key successfully', async () => {
      mockModels.ApiKey.findOne.mockResolvedValue(testApiKey);
      mockModels.ApiKey.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/api-keys/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.ApiKey.update).toHaveBeenCalledWith(
        { is_active: false },
        { where: { id: 1, userId: 1 } }
      );
    });
  });

  describe('POST /api-keys/:id/regenerate', () => {
    test('should regenerate api key successfully', async () => {
      const cryptoUtils = require('../../services/cryptoUtils');
      cryptoUtils.encryptToken = jest.fn().mockReturnValue('new_encrypted_key');

      mockModels.ApiKey.findOne.mockResolvedValue(testApiKey);
      mockModels.ApiKey.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api-keys/1/regenerate')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('plainKey');
      expect(mockModels.ApiKey.update).toHaveBeenCalledWith(
        { key: 'new_encrypted_key' },
        { where: { id: 1, userId: 1 } }
      );
    });

    test('should not regenerate inactive api key', async () => {
      const inactiveApiKey = { ...testApiKey, is_active: false };
      mockModels.ApiKey.findOne.mockResolvedValue(inactiveApiKey);

      const response = await request(app)
        .post('/api-keys/1/regenerate')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('Cannot regenerate inactive API key');
    });
  });
});
