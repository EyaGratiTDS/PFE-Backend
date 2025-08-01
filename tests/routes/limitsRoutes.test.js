const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: jest.fn()
}));

jest.mock('../../middleware/planLimiter', () => ({
  getVCardLimits: jest.fn(),
  getBlocksLimits: jest.fn(),
  getApiKeyLimits: jest.fn(),
  get2FAAccess: jest.fn(),
  getProjectLimits: jest.fn(),
  getPixelLimits: jest.fn(),
  getCustomDomainLimits: jest.fn()
}));

const { requireAuth } = require('../../middleware/authMiddleware');
const {
  getVCardLimits,
  getBlocksLimits,
  getApiKeyLimits,
  get2FAAccess,
  getProjectLimits,
  getPixelLimits,
  getCustomDomainLimits
} = require('../../middleware/planLimiter');
const limitsRoutes = require('../../routes/LimiteRoutes');

describe('Limits Routes Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/limits', limitsRoutes);
    
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
      req.user = { 
        id: 1, 
        email: 'user@example.com', 
        plan: 'premium',
        role: 'user'
      };
      next();
    });
  });

  describe('GET /limits/vcard', () => {
    it('should get vcard limits successfully', async () => {
      const mockVCardLimits = {
        maxVCards: 10,
        currentVCards: 3,
        remaining: 7,
        unlimited: false
      };

      getVCardLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockVCardLimits,
          message: 'VCard limits retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/limits/vcard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCardLimits);
      expect(requireAuth).toHaveBeenCalled();
      expect(getVCardLimits).toHaveBeenCalled();
    });

    it('should handle unlimited vcard plan', async () => {
      const mockUnlimitedLimits = {
        maxVCards: -1,
        currentVCards: 25,
        remaining: -1,
        unlimited: true
      };

      getVCardLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUnlimitedLimits,
          message: 'Unlimited VCard access'
        });
      });

      const response = await request(app)
        .get('/limits/vcard');

      expect(response.status).toBe(200);
      expect(response.body.data.unlimited).toBe(true);
      expect(response.body.data.remaining).toBe(-1);
    });

    it('should handle authentication failure', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .get('/limits/vcard');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(getVCardLimits).not.toHaveBeenCalled();
    });
  });

  describe('GET /limits/blocks', () => {
    it('should get blocks limits successfully', async () => {
      const mockBlocksLimits = {
        maxBlocks: 100,
        currentBlocks: 45,
        remaining: 55,
        unlimited: false
      };

      getBlocksLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockBlocksLimits,
          message: 'Blocks limits retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/limits/blocks');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBlocksLimits);
      expect(requireAuth).toHaveBeenCalled();
      expect(getBlocksLimits).toHaveBeenCalled();
    });

    it('should handle blocks limits exceeded', async () => {
      const mockExceededLimits = {
        maxBlocks: 50,
        currentBlocks: 50,
        remaining: 0,
        unlimited: false,
        exceeded: true
      };

      getBlocksLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockExceededLimits,
          message: 'Blocks limit reached'
        });
      });

      const response = await request(app)
        .get('/limits/blocks');

      expect(response.status).toBe(200);
      expect(response.body.data.remaining).toBe(0);
      expect(response.body.data.exceeded).toBe(true);
    });
  });

  describe('GET /limits/api-keys', () => {
    it('should get api keys limits successfully', async () => {
      const mockApiKeyLimits = {
        maxApiKeys: 5,
        currentApiKeys: 2,
        remaining: 3,
        unlimited: false
      };

      getApiKeyLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockApiKeyLimits,
          message: 'API keys limits retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/limits/api-keys');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockApiKeyLimits);
      expect(requireAuth).toHaveBeenCalled();
      expect(getApiKeyLimits).toHaveBeenCalled();
    });

    it('should handle basic plan with no api keys access', async () => {
      getApiKeyLimits.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          message: 'API keys not available in your current plan',
          data: {
            maxApiKeys: 0,
            currentApiKeys: 0,
            remaining: 0,
            unlimited: false,
            planUpgradeRequired: true
          }
        });
      });

      const response = await request(app)
        .get('/limits/api-keys');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.planUpgradeRequired).toBe(true);
    });
  });

  describe('GET /limits/2fa-access', () => {
    it('should get 2FA access successfully', async () => {
      const mock2FAAccess = {
        enabled: true,
        available: true,
        planSupport: true
      };

      get2FAAccess.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mock2FAAccess,
          message: '2FA access retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/limits/2fa-access');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mock2FAAccess);
      expect(requireAuth).toHaveBeenCalled();
      expect(get2FAAccess).toHaveBeenCalled();
    });

    it('should handle 2FA not available in plan', async () => {
      const mock2FADenied = {
        enabled: false,
        available: false,
        planSupport: false,
        planUpgradeRequired: true
      };

      get2FAAccess.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          data: mock2FADenied,
          message: '2FA not available in your current plan'
        });
      });

      const response = await request(app)
        .get('/limits/2fa-access');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.planUpgradeRequired).toBe(true);
    });
  });

  describe('GET /limits/project', () => {
    it('should get project limits successfully', async () => {
      const mockProjectLimits = {
        maxProjects: 20,
        currentProjects: 8,
        remaining: 12,
        unlimited: false
      };

      getProjectLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockProjectLimits,
          message: 'Project limits retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/limits/project');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProjectLimits);
      expect(requireAuth).toHaveBeenCalled();
      expect(getProjectLimits).toHaveBeenCalled();
    });

    it('should handle enterprise unlimited projects', async () => {
      const mockUnlimitedProjects = {
        maxProjects: -1,
        currentProjects: 150,
        remaining: -1,
        unlimited: true
      };

      getProjectLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUnlimitedProjects,
          message: 'Unlimited project access'
        });
      });

      const response = await request(app)
        .get('/limits/project');

      expect(response.status).toBe(200);
      expect(response.body.data.unlimited).toBe(true);
    });
  });

  describe('GET /limits/pixel', () => {
    it('should get pixel limits successfully', async () => {
      const mockPixelLimits = {
        maxPixels: 10,
        currentPixels: 3,
        remaining: 7,
        unlimited: false
      };

      getPixelLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockPixelLimits,
          message: 'Pixel limits retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/limits/pixel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPixelLimits);
      expect(requireAuth).toHaveBeenCalled();
      expect(getPixelLimits).toHaveBeenCalled();
    });

    it('should handle pixel feature not available', async () => {
      getPixelLimits.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          message: 'Pixel tracking not available in your current plan',
          data: {
            maxPixels: 0,
            currentPixels: 0,
            remaining: 0,
            unlimited: false,
            planUpgradeRequired: true
          }
        });
      });

      const response = await request(app)
        .get('/limits/pixel');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /limits/custom-domain', () => {
    it('should get custom domain limits successfully', async () => {
      const mockCustomDomainLimits = {
        maxCustomDomains: 3,
        currentCustomDomains: 1,
        remaining: 2,
        unlimited: false
      };

      getCustomDomainLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockCustomDomainLimits,
          message: 'Custom domain limits retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/limits/custom-domain');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCustomDomainLimits);
      expect(requireAuth).toHaveBeenCalled();
      expect(getCustomDomainLimits).toHaveBeenCalled();
    });

    it('should handle custom domain not available in plan', async () => {
      getCustomDomainLimits.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          message: 'Custom domains not available in your current plan',
          data: {
            maxCustomDomains: 0,
            currentCustomDomains: 0,
            remaining: 0,
            unlimited: false,
            planUpgradeRequired: true
          }
        });
      });

      const response = await request(app)
        .get('/limits/custom-domain');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.planUpgradeRequired).toBe(true);
    });
  });

  describe('Authentication Middleware Tests', () => {
    it('should require authentication for all routes', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Token not provided'
        });
      });

      const routes = [
        '/limits/vcard',
        '/limits/blocks',
        '/limits/api-keys',
        '/limits/2fa-access',
        '/limits/project',
        '/limits/pixel',
        '/limits/custom-domain'
      ];

      for (const route of routes) {
        const response = await request(app).get(route);
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }

      expect(requireAuth).toHaveBeenCalledTimes(routes.length);
    });

    it('should pass user data through authentication', async () => {
      const mockUser = {
        id: 123,
        email: 'testuser@example.com',
        plan: 'enterprise',
        role: 'admin'
      };

      let capturedReq;

      requireAuth.mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
      });

      getVCardLimits.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: { maxVCards: 50, currentVCards: 10, remaining: 40 }
        });
      });

      await request(app).get('/limits/vcard');

      expect(capturedReq.user).toEqual(mockUser);
    });
  });

  describe('Error Handling', () => {
    it('should handle middleware errors gracefully', async () => {
      getVCardLimits.mockImplementation((req, res, next) => {
        const error = new Error('Database connection failed');
        next(error);
      });

      const response = await request(app)
        .get('/limits/vcard');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database connection failed');
    });

    it('should handle plan limiter service unavailable', async () => {
      getBlocksLimits.mockImplementation((req, res) => {
        res.status(503).json({
          success: false,
          message: 'Plan limiter service temporarily unavailable'
        });
      });

      const response = await request(app)
        .get('/limits/blocks');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
    });

    it('should handle invalid user plan', async () => {
      getProjectLimits.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid user plan configuration',
          data: {
            error: 'INVALID_PLAN',
            userPlan: null
          }
        });
      });

      const response = await request(app)
        .get('/limits/project');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data.error).toBe('INVALID_PLAN');
    });
  });

  describe('Different Plan Types Response', () => {
    it('should handle free plan limitations', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        req.user = { 
          id: 1, 
          email: 'freeuser@example.com', 
          plan: 'free',
          role: 'user'
        };
        next();
      });

      const mockFreePlanLimits = {
        maxVCards: 1,
        currentVCards: 1,
        remaining: 0,
        unlimited: false,
        planType: 'free'
      };

      getVCardLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockFreePlanLimits,
          message: 'Free plan limits'
        });
      });

      const response = await request(app)
        .get('/limits/vcard');

      expect(response.status).toBe(200);
      expect(response.body.data.planType).toBe('free');
      expect(response.body.data.remaining).toBe(0);
    });

    it('should handle premium plan benefits', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        req.user = { 
          id: 1, 
          email: 'premiumuser@example.com', 
          plan: 'premium',
          role: 'user'
        };
        next();
      });

      const mockPremiumLimits = {
        maxApiKeys: 10,
        currentApiKeys: 3,
        remaining: 7,
        unlimited: false,
        planType: 'premium',
        features: ['analytics', 'custom_styling', 'api_access']
      };

      getApiKeyLimits.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockPremiumLimits,
          message: 'Premium plan API key limits'
        });
      });

      const response = await request(app)
        .get('/limits/api-keys');

      expect(response.status).toBe(200);
      expect(response.body.data.planType).toBe('premium');
      expect(response.body.data.features).toContain('api_access');
    });
  });

  describe('Route Parameter Validation', () => {
    it('should handle non-existent routes', async () => {
      const response = await request(app)
        .get('/limits/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should handle route with query parameters', async () => {
      let capturedReq;

      getVCardLimits.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: { maxVCards: 10, currentVCards: 5, remaining: 5 }
        });
      });

      await request(app)
        .get('/limits/vcard')
        .query({ detailed: 'true', format: 'json' });

      expect(capturedReq.query.detailed).toBe('true');
      expect(capturedReq.query.format).toBe('json');
    });
  });
});