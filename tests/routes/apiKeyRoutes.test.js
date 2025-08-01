const request = require('supertest');
const express = require('express');

jest.mock('../../controllers/ApiKeyController');
jest.mock('../../middleware/authMiddleware');
jest.mock('../../middleware/planLimiter');

const apiKeyController = require('../../controllers/ApiKeyController');
const { requireAuth, requireAuthSuperAdmin } = require('../../middleware/authMiddleware');
const { checkApiKeyCreation } = require('../../middleware/planLimiter');
const apiKeyRoutes = require('../../routes/apiKeyRoutes'); 

describe('API Key Routes Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/apiKey', requireAuth, apiKeyRoutes);
    app.use((error, req, res, next) => {
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    requireAuth.mockImplementation((req, res, next) => {
      req.user = { id: 1, email: 'test@example.com', role: 'user' };
      next();
    });

    requireAuthSuperAdmin.mockImplementation((req, res, next) => {
      req.user = { id: 1, email: 'admin@example.com', role: 'super_admin' };
      next();
    });

    checkApiKeyCreation.mockImplementation((req, res, next) => {
      next();
    });
  });

  describe('POST /apiKey', () => {
    it('should create an API key successfully', async () => {
      const mockApiKey = {
        id: 1,
        key: 'ak_test_123456789',
        name: 'Test API Key',
        userId: 1,
        createdAt: '2025-07-31T10:15:59.614Z',
        isActive: true
      };

      apiKeyController.createApiKey.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: mockApiKey,
          message: 'API key created successfully'
        });
      });

      const response = await request(app)
        .post('/apiKey')
        .send({
          name: 'Test API Key',
          permissions: ['read', 'write']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockApiKey);
      expect(requireAuth).toHaveBeenCalled();
      expect(checkApiKeyCreation).toHaveBeenCalled();
      expect(apiKeyController.createApiKey).toHaveBeenCalled();
    });

    it('should fail when plan limit is exceeded', async () => {
      checkApiKeyCreation.mockImplementation((req, res, next) => {
        res.status(403).json({
          success: false,
          message: 'API key creation limit exceeded for your plan'
        });
      });

      const response = await request(app)
        .post('/apiKey')
        .send({
          name: 'Test API Key'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('limit exceeded');
    });

    it('should fail when user is not authenticated', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .post('/apiKey')
        .send({
          name: 'Test API Key'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /apiKey', () => {
    it('should list user API keys successfully', async () => {
      const mockApiKeys = [
        {
          id: 1,
          key: 'ak_test_123456789',
          name: 'Test API Key 1',
          userId: 1,
          isActive: true,
          createdAt: '2025-07-31T10:15:59.696Z'
        },
        {
          id: 2,
          key: 'ak_test_987654321',
          name: 'Test API Key 2',
          userId: 1,
          isActive: false,
          createdAt: '2025-07-31T10:15:59.696Z'
        }
      ];

      apiKeyController.listApiKeys.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockApiKeys,
          count: mockApiKeys.length
        });
      });

      const response = await request(app)
        .get('/apiKey');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockApiKeys);
      expect(response.body.count).toBe(2);
      expect(requireAuth).toHaveBeenCalled();
      expect(apiKeyController.listApiKeys).toHaveBeenCalled();
    });

    it('should return empty array when user has no API keys', async () => {
      apiKeyController.listApiKeys.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          count: 0
        });
      });

      const response = await request(app)
        .get('/apiKey');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /apiKey/all', () => {
    it('should list all API keys (admin access)', async () => {
      const mockAllApiKeys = [
        {
          id: 1,
          key: 'ak_test_123456789',
          name: 'User 1 API Key',
          userId: 1,
          isActive: true,
          user: { email: 'user1@example.com' }
        },
        {
          id: 2,
          key: 'ak_test_987654321',
          name: 'User 2 API Key',
          userId: 2,
          isActive: true,
          user: { email: 'user2@example.com' }
        }
      ];

      apiKeyController.listAllApiKeys.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockAllApiKeys,
          count: mockAllApiKeys.length
        });
      });

      const response = await request(app)
        .get('/apiKey/all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAllApiKeys);
      expect(apiKeyController.listAllApiKeys).toHaveBeenCalled();
    });

    it('should handle server error when fetching all API keys', async () => {
      apiKeyController.listAllApiKeys.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });

      const response = await request(app)
        .get('/apiKey/all');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /apiKey/:id', () => {
    it('should delete API key successfully', async () => {
      apiKeyController.deleteApiKey.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'API key deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/apiKey/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      expect(requireAuth).toHaveBeenCalled();
      expect(apiKeyController.deleteApiKey).toHaveBeenCalled();
    });

    it('should return 404 when API key not found', async () => {
      apiKeyController.deleteApiKey.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'API key not found'
        });
      });

      const response = await request(app)
        .delete('/apiKey/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 when user tries to delete API key they do not own', async () => {
      apiKeyController.deleteApiKey.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only delete your own API keys'
        });
      });

      const response = await request(app)
        .delete('/apiKey/1');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Forbidden');
    });
  });

  describe('PUT /apiKey/:id/toggle-status', () => {
    it('should toggle API key status successfully (super admin)', async () => {
      const mockApiKey = {
        id: 1,
        key: 'ak_test_123456789',
        name: 'Test API Key',
        userId: 1,
        isActive: false, 
        updatedAt: '2025-07-31T10:15:59.760Z' 
      };

      apiKeyController.toggleApiKeyStatus.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockApiKey,
          message: 'API key status updated successfully'
        });
      });

      const response = await request(app)
        .put('/apiKey/1/toggle-status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockApiKey);
      expect(requireAuthSuperAdmin).toHaveBeenCalled();
      expect(apiKeyController.toggleApiKeyStatus).toHaveBeenCalled();
    });

    it('should fail when user is not super admin', async () => {
      requireAuthSuperAdmin.mockImplementation((req, res, next) => {
        res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      });

      const response = await request(app)
        .put('/apiKey/1/toggle-status');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Super admin');
    });

    it('should return 404 when API key not found for status toggle', async () => {
      apiKeyController.toggleApiKeyStatus.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'API key not found'
        });
      });

      const response = await request(app)
        .put('/apiKey/999/toggle-status');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication and Authorization Edge Cases', () => {
    it('should handle missing authentication token', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      });

      const response = await request(app)
        .get('/apiKey');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('No token');
    });

    it('should handle invalid authentication token', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      });

      const response = await request(app)
        .post('/apiKey')
        .send({ name: 'Test Key' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should handle expired authentication token', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      });

      const response = await request(app)
        .delete('/apiKey/1');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('expired');
    });
  });

  describe('Input Validation', () => {
    it('should handle invalid API key ID format', async () => {
      apiKeyController.deleteApiKey.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid API key ID format'
        });
      });

      const response = await request(app)
        .delete('/apiKey/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should handle missing required fields in POST request', async () => {
      apiKeyController.createApiKey.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'API key name is required'
        });
      });

      const response = await request(app)
        .post('/apiKey')
        .send({}); 

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('name is required');
    });
  });

  describe('Server Errors', () => {
    it('should handle database connection errors', async () => {
      apiKeyController.listApiKeys.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Database connection error'
        });
      });

      const response = await request(app)
        .get('/apiKey');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle controller method errors with proper error handling', async () => {
      apiKeyController.createApiKey.mockImplementation((req, res, next) => {
        const error = new Error('Controller error');
        next(error); 
      });

      const response = await request(app)
        .post('/apiKey')
        .send({ name: 'Test Key' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Controller error');
    });

    it('should handle unexpected controller errors', async () => {
      apiKeyController.createApiKey.mockImplementation((req, res, next) => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/apiKey')
        .send({ name: 'Test Key' });

      expect(response.status).toBe(500);
    });
  });

  describe('Middleware Chain Validation', () => {
    it('should ensure middleware order is correct for protected routes', async () => {
      const middlewareCallOrder = [];
      
      requireAuth.mockImplementation((req, res, next) => {
        middlewareCallOrder.push('requireAuth');
        req.user = { id: 1, email: 'test@example.com' };
        next();
      });

      checkApiKeyCreation.mockImplementation((req, res, next) => {
        middlewareCallOrder.push('checkApiKeyCreation');
        next();
      });

      apiKeyController.createApiKey.mockImplementation((req, res) => {
        middlewareCallOrder.push('createApiKey');
        res.status(201).json({
          success: true,
          data: { id: 1, name: 'Test' },
          message: 'Created'
        });
      });

      await request(app)
        .post('/apiKey')
        .send({ name: 'Test Key' });

      expect(middlewareCallOrder).toEqual(['requireAuth', 'requireAuth', 'checkApiKeyCreation', 'createApiKey']);
    });

    it('should ensure super admin middleware is called for toggle status', async () => {
      const middlewareCallOrder = [];
      
      requireAuth.mockImplementation((req, res, next) => {
        middlewareCallOrder.push('requireAuth');
        req.user = { id: 1, email: 'test@example.com' };
        next();
      });

      requireAuthSuperAdmin.mockImplementation((req, res, next) => {
        middlewareCallOrder.push('requireAuthSuperAdmin');
        req.user = { id: 1, email: 'admin@example.com', role: 'super_admin' };
        next();
      });

      apiKeyController.toggleApiKeyStatus.mockImplementation((req, res) => {
        middlewareCallOrder.push('toggleApiKeyStatus');
        res.status(200).json({
          success: true,
          data: { id: 1, isActive: false },
          message: 'Updated'
        });
      });

      await request(app)
        .put('/apiKey/1/toggle-status');

      expect(middlewareCallOrder).toEqual(['requireAuth', 'requireAuthSuperAdmin', 'toggleApiKeyStatus']);
    });
  });

  describe('Request Parameter Validation', () => {
    it('should pass correct parameters to delete controller', async () => {
      let capturedReq;
      
      apiKeyController.deleteApiKey.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          message: 'Deleted'
        });
      });

      await request(app)
        .delete('/apiKey/123');

      expect(capturedReq.params.id).toBe('123');
      expect(capturedReq.user).toBeDefined();
    });

    it('should pass correct parameters to toggle status controller', async () => {
      let capturedReq;
      
      apiKeyController.toggleApiKeyStatus.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: { id: 456, isActive: true },
          message: 'Updated'
        });
      });

      await request(app)
        .put('/apiKey/456/toggle-status');

      expect(capturedReq.params.id).toBe('456');
      expect(capturedReq.user).toBeDefined();
    });
  });
});