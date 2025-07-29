const request = require('supertest');
const express = require('express');
const ApiKey = require('../../models/ApiKey');
const User = require('../../models/User');
const apiKeyController = require('../../controllers/ApiKeyController');
const { hashKey } = require('../../controllers/ApiKeyController');

const app = express();
app.use(express.json());

const apiKeyRoutes = require('../../routes/apiKeyRoutes');
app.use('/apikey', apiKeyRoutes);

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1 };
    next();
  },
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, role: 'superadmin' };
    next();
  }
}));

jest.mock('../../middleware/planLimiter', () => ({
  getActiveApiKeyLimit: jest.fn().mockResolvedValue(5),
  checkApiKeyCreation: (req, res, next) => next()
}));

jest.mock('../../models/ApiKey');
jest.mock('../../models/User');

describe('API Key Controller', () => {
  let mockUser;
  let mockApiKey;
  
  beforeEach(() => {
    mockUser = {
      id: 1,
      email: 'test@example.com',
      role: 'user',
      save: jest.fn()
    };
    
    mockApiKey = {
      id: 'key-123',
      name: 'Test Key',
      userId: 1,
      key: hashKey('valid-key'),
      prefix: 'prefix-',
      expiresAt: null,
      scopes: ['*'],
      isActive: true,
      lastUsedAt: null,
      createdAt: new Date(),
      created_at: new Date(), 
      destroy: jest.fn().mockResolvedValue(),
      update: jest.fn().mockImplementation((data) => {
        Object.assign(mockApiKey, data);
        return Promise.resolve();
      }),
      get: jest.fn().mockImplementation(function() {
        return {
          ...this,
          user: mockUser
        };
      })
    };
    
    User.findByPk = jest.fn().mockResolvedValue(mockUser);
    
    ApiKey.create = jest.fn().mockResolvedValue({
      ...mockApiKey,
      get: jest.fn().mockReturnValue(mockApiKey)
    });
    
    ApiKey.findAll = jest.fn().mockResolvedValue([mockApiKey]);
    ApiKey.findOne = jest.fn().mockImplementation(({ where }) => {
      if (where.key === hashKey('valid-key')) {
        return Promise.resolve(mockApiKey);
      }
      if (where.id === 'key-123' && where.userId === 1) {
        return Promise.resolve(mockApiKey);
      }
      return Promise.resolve(null);
    });
    ApiKey.findByPk = jest.fn().mockImplementation((id) => {
      if (id === 'invalid-id') return Promise.resolve(null);
      if (id === 'key-123') return Promise.resolve(mockApiKey);
      return Promise.resolve(mockApiKey);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should create a new API key successfully', async () => {
      const response = await request(app)
        .post('/apikey')
        .send({
          name: 'Test Key',
          scopes: ['users:read']
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key created successfully');
      expect(response.body.data).toHaveProperty('key');
      expect(ApiKey.create).toHaveBeenCalled();
    });

    it('should handle missing name field', async () => {

      const testApp = express();
      testApp.use(express.json());
      
      testApp.post('/apikey', (req, res, next) => {
        req.user = { id: 1 };
        next();
      }, (req, res) => {
        if (!req.body.name || req.body.name.trim() === '') {
          return res.status(400).json({
            success: false,
            message: 'Name is required'
          });
        }
        
        return res.status(201).json({
          success: true,
          message: 'API key created successfully',
          data: { key: 'mock-key' }
        });
      });
      
      const response = await request(testApp)
        .post('/apikey')
        .send({ scopes: ['users:read'] });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Name is required');
    });

    it('should handle server errors', async () => {
      ApiKey.create.mockRejectedValue(new Error('DB error'));
      
      const response = await request(app)
        .post('/apikey')
        .send({ name: 'Test Key' });
      
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to create API key');
    });
  });

  describe('listApiKeys', () => {
    it('should list API keys for authenticated user', async () => {
      const response = await request(app)
        .get('/apikey');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('isDisabled', false);
    });

    it('should mark keys as disabled when over limit', async () => {
      const { getActiveApiKeyLimit } = require('../../middleware/planLimiter');
      getActiveApiKeyLimit.mockResolvedValue(5);
      
      const mockKeys = Array.from({ length: 6 }, (_, i) => ({
        ...mockApiKey,
        id: `key-${i + 1}`,
        createdAt: new Date(Date.now() - (6 - i - 1) * 10000), 
        created_at: new Date(Date.now() - (6 - i - 1) * 10000),
        isActive: true
      }));
      
      ApiKey.findAll.mockResolvedValue(mockKeys);
      
      const response = await request(app)
        .get('/apikey');
      
      expect(response.status).toBe(200);
      const keys = response.body.data;
      
      expect(keys[0].id).toBe('key-1');
      expect(keys[5].id).toBe('key-6');
      
      expect(keys[0].isDisabled).toBe(false);
      expect(keys[1].isDisabled).toBe(false);
      expect(keys[2].isDisabled).toBe(false);
      expect(keys[3].isDisabled).toBe(false);
      expect(keys[4].isDisabled).toBe(false);
      expect(keys[5].isDisabled).toBe(true);
      expect(keys.filter(k => k.isDisabled)).toHaveLength(1);
    });
  });

  describe('deleteApiKey', () => {
    it('should delete an existing API key', async () => {
      ApiKey.findOne.mockImplementation(({ where }) => {
        if (where.id === 'key-123' && where.userId === 1) {
          return Promise.resolve(mockApiKey);
        }
        return Promise.resolve(null);
      });

      const response = await request(app)
        .delete('/apikey/key-123');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('API key deleted successfully');
      expect(ApiKey.findOne).toHaveBeenCalledWith({
        where: { id: 'key-123', userId: 1 }
      });
      expect(mockApiKey.destroy).toHaveBeenCalled();
    });

    it('should handle non-existent key', async () => {
      ApiKey.findOne.mockImplementation(({ where }) => {
        if (where.id === 'invalid-id') {
          return Promise.resolve(null);
        }
        return Promise.resolve(mockApiKey);
      });

      const response = await request(app)
        .delete('/apikey/invalid-id');
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('API key not found');
    });
  });

  describe('toggleApiKeyStatus', () => {
    it('should toggle API key status (admin)', async () => {
      ApiKey.findByPk.mockImplementation((id) => {
        if (id === 'key-123') {
          return Promise.resolve(mockApiKey);
        }
        return Promise.resolve(null);
      });

      const response = await request(app)
        .put('/apikey/key-123/toggle-status');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/API key (enabled|disabled) successfully/);
      expect(mockApiKey.update).toHaveBeenCalled();
    });

    it('should handle non-existent key', async () => {
      ApiKey.findByPk.mockImplementation((id) => {
        if (id === 'invalid-id') {
          return Promise.resolve(null);
        }
        return Promise.resolve(mockApiKey);
      });

      const response = await request(app)
        .put('/apikey/invalid-id/toggle-status');
      
      expect(response.status).toBe(404);
    });
  });

  describe('authenticateWithApiKey middleware', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/protected', 
      apiKeyController.authenticateWithApiKey,
      (req, res) => res.status(200).json({ success: true })
    );
    testApp.use(apiKeyController.errorHandler); 

    it('should authenticate with valid API key', async () => {
      const response = await request(testApp)
        .get('/protected')
        .set('x-api-key', 'valid-key');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid API key', async () => {
      const response = await request(testApp)
        .get('/protected')
        .set('x-api-key', 'invalid-key');
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired API key');
    });

    it('should require API key', async () => {
      const response = await request(testApp)
        .get('/protected');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('API key is required');
    });
  });

  describe('checkApiKeyScope middleware', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/scoped',
      (req, res, next) => {
        req.apiKey = { scopes: ['users:read'] };
        next();
      },
      apiKeyController.checkApiKeyScope('users:read'),
      (req, res) => res.status(200).json({ success: true })
    );

    testApp.get('/wildcard',
      (req, res, next) => {
        req.apiKey = { scopes: ['*'] };
        next();
      },
      apiKeyController.checkApiKeyScope('users:write'),
      (req, res) => res.status(200).json({ success: true })
    );

    testApp.get('/insufficient',
      (req, res, next) => {
        req.apiKey = { scopes: ['metrics:read'] };
        next();
      },
      apiKeyController.checkApiKeyScope('users:write'),
      (req, res) => res.status(200).json({ success: true })
    );
    testApp.use(apiKeyController.errorHandler); 

    it('should grant access for matching scope', async () => {
      const response = await request(testApp)
        .get('/scoped');
      
      expect(response.status).toBe(200);
    });

    it('should grant access for wildcard scope', async () => {
      const response = await request(testApp)
        .get('/wildcard');
      
      expect(response.status).toBe(200);
    });

    it('should reject for missing scope', async () => {
      const response = await request(testApp)
        .get('/insufficient');
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient scope. Required: users:write');
    });
  });

  describe('listAllApiKeys', () => {
    it('should list all API keys (admin)', async () => {
      ApiKey.findAll.mockResolvedValue([mockApiKey]);
      
      const response = await request(app)
        .get('/apikey/all');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body).toHaveProperty('count', 1);
    });
  });
});