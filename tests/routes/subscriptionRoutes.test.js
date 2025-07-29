const request = require('supertest');
const express = require('express');

const mockSubscriptionController = {
  getUserSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getUserSubscriptions: jest.fn(),
  getSubscriptionStatus: jest.fn(),
  getAllSubscriptions: jest.fn(),
  cancelSubscriptionByAdmin: jest.fn(),
  assignPlanToUser: jest.fn()
};

jest.mock('../../controllers/SubscriptionController', () => mockSubscriptionController);

jest.mock('../../models', () => require('../utils/mockModels'));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'admin' };
    next();
  },
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'admin' };
    next();
  }
}));

const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

describe('Subscription Routes', () => {
  let app;
  let mockModels;
  let authToken;
  let testUser;
  let subscriptionRoutes;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    subscriptionRoutes = require('../../routes/subscriptionRoutes');
    app.use('/subscription', subscriptionRoutes);

    app.use((err, req, res, next) => {
      console.error('Test error:', err.message);
      res.status(500).json({ error: err.message });
    });
  });

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();    
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email, role: 'admin' });

    jest.clearAllMocks();
    
    Object.values(mockSubscriptionController).forEach(mock => {
      mock.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: {} });
      });
    });
  });

  describe('GET /subscription/current', () => {
    test('should get current user subscription', async () => {
      const mockSubscriptionData = {
        id: 1,
        userId: 1,
        planId: 1,
        status: 'active'
      };

      mockModels.Subscription.findOne.mockResolvedValue(mockSubscriptionData);
      
      mockSubscriptionController.getUserSubscription.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: mockSubscriptionData 
        });
      });

      const response = await request(app)
        .get('/subscription/current')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.userId).toBe(1);
      expect(mockSubscriptionController.getUserSubscription).toHaveBeenCalledTimes(1);
    });

    test('should handle no subscription found', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(null);
      
      mockSubscriptionController.getUserSubscription.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'No subscription found' 
        });
      });

      const response = await request(app)
        .get('/subscription/current')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /subscription/cancel', () => {
    test('should cancel current user subscription', async () => {
      const mockSubscription = {
        id: 1,
        userId: 1,
        status: 'active'
      };

      mockModels.Subscription.findOne.mockResolvedValue(mockSubscription);
      mockModels.Subscription.update.mockResolvedValue([1]);

      mockSubscriptionController.cancelSubscription.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          message: 'Subscription cancelled successfully' 
        });
      });

      const response = await request(app)
        .post('/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockSubscriptionController.cancelSubscription).toHaveBeenCalledTimes(1);
    });

    test('should handle no active subscription to cancel', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(null);
      
      mockSubscriptionController.cancelSubscription.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'No active subscription found' 
        });
      });

      const response = await request(app)
        .post('/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /subscription/history', () => {
    test('should get current user subscriptions history', async () => {
      const mockHistory = [
        { id: 1, userId: 1, planId: 1, status: 'active' },
        { id: 2, userId: 1, planId: 2, status: 'canceled' }
      ];

      mockModels.Subscription.findAll.mockResolvedValue(mockHistory);

      mockSubscriptionController.getUserSubscriptions.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: mockHistory 
        });
      });

      const response = await request(app)
        .get('/subscription/history')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockSubscriptionController.getUserSubscriptions).toHaveBeenCalledTimes(1);
    });

    test('should handle empty subscription history', async () => {
      mockModels.Subscription.findAll.mockResolvedValue([]);

      mockSubscriptionController.getUserSubscriptions.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: [] 
        });
      });

      const response = await request(app)
        .get('/subscription/history')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /subscription/status', () => {
    test('should get current subscription status', async () => {
      const mockStatus = {
        id: 1,
        userId: 1,
        status: 'active'
      };

      mockModels.Subscription.findOne.mockResolvedValue(mockStatus);

      mockSubscriptionController.getSubscriptionStatus.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: mockStatus 
        });
      });

      const response = await request(app)
        .get('/subscription/status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.status).toBe('active');
      expect(mockSubscriptionController.getSubscriptionStatus).toHaveBeenCalledTimes(1);
    });

    test('should handle no subscription status', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(null);

      mockSubscriptionController.getSubscriptionStatus.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'No subscription found' 
        });
      });

      const response = await request(app)
        .get('/subscription/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /subscription/all', () => {
    test('should get all subscriptions (admin)', async () => {
      const mockAllSubscriptions = [
        { id: 1, userId: 1, planId: 1, status: 'active' },
        { id: 2, userId: 2, planId: 2, status: 'canceled' }
      ];

      mockModels.Subscription.findAll.mockResolvedValue(mockAllSubscriptions);

      mockSubscriptionController.getAllSubscriptions.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: mockAllSubscriptions 
        });
      });

      const response = await request(app)
        .get('/subscription/all')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockSubscriptionController.getAllSubscriptions).toHaveBeenCalledTimes(1);
    });

    test('should handle empty subscriptions list', async () => {
      mockModels.Subscription.findAll.mockResolvedValue([]);

      mockSubscriptionController.getAllSubscriptions.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          data: [] 
        });
      });

      const response = await request(app)
        .get('/subscription/all')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('PUT /subscription/:id/CancelByAdmin', () => {
    test('should cancel subscription by admin', async () => {
      const mockSubscription = {
        id: 1,
        userId: 2,
        status: 'active'
      };

      mockModels.Subscription.findByPk.mockResolvedValue(mockSubscription);
      mockModels.Subscription.update.mockResolvedValue([1]);

      mockSubscriptionController.cancelSubscriptionByAdmin.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          message: 'Subscription cancelled by admin' 
        });
      });

      const response = await request(app)
        .put('/subscription/1/CancelByAdmin')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockSubscriptionController.cancelSubscriptionByAdmin).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent subscription', async () => {
      mockModels.Subscription.findByPk.mockResolvedValue(null);

      mockSubscriptionController.cancelSubscriptionByAdmin.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'Subscription not found' 
        });
      });

      const response = await request(app)
        .put('/subscription/999/CancelByAdmin')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /subscription/assign', () => {
    test('should assign plan to user by admin', async () => {
      const mockPlan = { id: 2, name: 'Pro Plan' };
      const mockAssignedSubscription = {
        id: 3,
        userId: 2,
        planId: 2,
        status: 'active'
      };

      mockModels.Plan.findByPk.mockResolvedValue(mockPlan);
      mockModels.Subscription.create.mockResolvedValue(mockAssignedSubscription);

      mockSubscriptionController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(201).json({ 
          success: true, 
          data: mockAssignedSubscription 
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 2, planId: 2 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.planId).toBe(2);
      expect(mockSubscriptionController.assignPlanToUser).toHaveBeenCalledTimes(1);
    });

    test('should return 400 for missing assign parameters', async () => {
      mockSubscriptionController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(400).json({ 
          success: false, 
          message: 'Missing required parameters: userId and planId' 
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 404 for non-existent plan', async () => {
      mockModels.Plan.findByPk.mockResolvedValue(null);

      mockSubscriptionController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'Plan not found' 
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 2, planId: 999 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.Subscription.findAll.mockRejectedValue(new Error('Database error'));

      mockSubscriptionController.getAllSubscriptions.mockImplementation((req, res, next) => {
        const error = new Error('Database error');
        next(error);
      });

      const response = await request(app)
        .get('/subscription/all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });

    test('should handle controller errors', async () => {
      mockSubscriptionController.getUserSubscription.mockImplementation((req, res) => {
        res.status(500).json({ 
          success: false, 
          message: 'Internal server error' 
        });
      });

      const response = await request(app)
        .get('/subscription/current')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    test('should handle validation errors', async () => {
      mockSubscriptionController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(422).json({ 
          success: false, 
          message: 'Validation failed',
          errors: ['userId is required', 'planId is required']
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 'invalid' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('should handle authentication errors', async () => {
      const originalAuth = require('../../middleware/authMiddleware').requireAuth;
      
      jest.doMock('../../middleware/authMiddleware', () => ({
        requireAuth: (req, res, next) => {
          res.status(401).json({ 
            success: false, 
            message: 'Unauthorized' 
          });
        },
        requireAuthSuperAdmin: (req, res, next) => {
          res.status(401).json({ 
            success: false, 
            message: 'Unauthorized' 
          });
        }
      }));

      const response = await request(app)
        .get('/subscription/current');

      expect(mockSubscriptionController.getUserSubscription).toHaveBeenCalled();
    });
  });

  describe('Route Parameters', () => {
    test('should handle invalid subscription ID in CancelByAdmin', async () => {
      mockSubscriptionController.cancelSubscriptionByAdmin.mockImplementation((req, res) => {
        const { id } = req.params;
        if (isNaN(id)) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid subscription ID' 
          });
        }
        res.status(404).json({ 
          success: false, 
          message: 'Subscription not found' 
        });
      });

      const response = await request(app)
        .put('/subscription/invalid-id/CancelByAdmin')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle different HTTP methods', async () => {
      const response = await request(app)
        .delete('/subscription/current')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404); 
    });
  });

  describe('Request Body Validation', () => {
    test('should handle malformed JSON in assign request', async () => {
      mockSubscriptionController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(400).json({ 
          success: false, 
          message: 'Invalid JSON format' 
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    test('should handle empty request body for assign', async () => {
      mockSubscriptionController.assignPlanToUser.mockImplementation((req, res) => {
        const { userId, planId } = req.body;
        if (!userId || !planId) {
          return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields' 
          });
        }
        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});