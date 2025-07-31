const request = require('supertest');
const express = require('express');

describe('Subscription Routes Integration Tests', () => {
  let app;
  let mockController;
  let mockAuthMiddleware;

  beforeAll(() => {
    mockController = {
      getUserSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      getUserSubscriptions: jest.fn(),
      getSubscriptionStatus: jest.fn(),
      getAllSubscriptions: jest.fn(),
      cancelSubscriptionByAdmin: jest.fn(),
      assignPlanToUser: jest.fn()
    };

    mockAuthMiddleware = {
      requireAuth: jest.fn((req, res, next) => {
        req.user = {
          id: 'user123',
          email: 'test@example.com',
          role: 'user'
        };
        next();
      }),
      requireAuthSuperAdmin: jest.fn((req, res, next) => {
        req.user = {
          id: 'admin123',
          email: 'admin@example.com',
          role: 'superadmin'
        };
        next();
      })
    };

    app = express();
    app.use(express.json());

    const router = express.Router();
    
    router.get('/current', mockAuthMiddleware.requireAuth, mockController.getUserSubscription);
    router.post('/cancel', mockAuthMiddleware.requireAuth, mockController.cancelSubscription);
    router.get('/history', mockAuthMiddleware.requireAuth, mockController.getUserSubscriptions);
    router.get('/status', mockAuthMiddleware.requireAuth, mockController.getSubscriptionStatus);
    router.get('/all', mockAuthMiddleware.requireAuthSuperAdmin, mockController.getAllSubscriptions);
    router.put('/:id/CancelByAdmin', mockAuthMiddleware.requireAuthSuperAdmin, mockController.cancelSubscriptionByAdmin);
    router.post('/assign', mockAuthMiddleware.requireAuthSuperAdmin, mockController.assignPlanToUser);

    app.use('/subscription', router);

    app.use((error, req, res, next) => {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAuthMiddleware.requireAuth.mockImplementation((req, res, next) => {
      req.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      };
      next();
    });

    mockAuthMiddleware.requireAuthSuperAdmin.mockImplementation((req, res, next) => {
      req.user = {
        id: 'admin123',
        email: 'admin@example.com',
        role: 'superadmin'
      };
      next();
    });
  });

  describe('GET /subscription/current', () => {
    it('should get user subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub123',
        planId: 'plan456',
        status: 'active',
        userId: 'user123'
      };

      mockController.getUserSubscription.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockSubscription
        });
      });

      const response = await request(app)
        .get('/subscription/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSubscription);
      expect(mockAuthMiddleware.requireAuth).toHaveBeenCalled();
      expect(mockController.getUserSubscription).toHaveBeenCalled();
    });

    it('should handle authentication failure', async () => {
      mockAuthMiddleware.requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .get('/subscription/current')
        .expect(401);
    });

    it('should handle controller error', async () => {
      mockController.getUserSubscription.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      });

      const response = await request(app)
        .get('/subscription/current')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Subscription not found');
    });
  });

  describe('POST /subscription/cancel', () => {
    it('should cancel subscription successfully', async () => {
      mockController.cancelSubscription.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Subscription cancelled successfully'
        });
      });

      const response = await request(app)
        .post('/subscription/cancel')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription cancelled successfully');
      expect(mockAuthMiddleware.requireAuth).toHaveBeenCalled();
      expect(mockController.cancelSubscription).toHaveBeenCalled();
    });

    it('should handle cancellation error', async () => {
      mockController.cancelSubscription.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Cannot cancel subscription'
        });
      });

      const response = await request(app)
        .post('/subscription/cancel')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot cancel subscription');
    });
  });

  describe('GET /subscription/history', () => {
    it('should get user subscription history successfully', async () => {
      const mockHistory = [
        { id: 'sub1', status: 'cancelled', createdAt: '2024-01-01' },
        { id: 'sub2', status: 'active', createdAt: '2024-02-01' }
      ];

      mockController.getUserSubscriptions.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockHistory
        });
      });

      const response = await request(app)
        .get('/subscription/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistory);
      expect(mockAuthMiddleware.requireAuth).toHaveBeenCalled();
      expect(mockController.getUserSubscriptions).toHaveBeenCalled();
    });
  });

  describe('GET /subscription/status', () => {
    it('should get subscription status successfully', async () => {
      const mockStatus = {
        status: 'active',
        expiresAt: '2024-12-31',
        planName: 'Premium'
      };

      mockController.getSubscriptionStatus.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockStatus
        });
      });

      const response = await request(app)
        .get('/subscription/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
      expect(mockAuthMiddleware.requireAuth).toHaveBeenCalled();
      expect(mockController.getSubscriptionStatus).toHaveBeenCalled();
    });
  });

  describe('GET /subscription/all', () => {
    it('should get all subscriptions for super admin', async () => {
      const mockSubscriptions = [
        { id: 'sub1', userId: 'user1', status: 'active' },
        { id: 'sub2', userId: 'user2', status: 'cancelled' }
      ];

      mockController.getAllSubscriptions.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockSubscriptions,
          total: mockSubscriptions.length
        });
      });

      const response = await request(app)
        .get('/subscription/all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSubscriptions);
      expect(response.body.total).toBe(2);
      expect(mockAuthMiddleware.requireAuthSuperAdmin).toHaveBeenCalled();
      expect(mockController.getAllSubscriptions).toHaveBeenCalled();
    });

    it('should reject non-super-admin access', async () => {
      mockAuthMiddleware.requireAuthSuperAdmin.mockImplementation((req, res, next) => {
        res.status(403).json({ error: 'Forbidden: Super admin access required' });
      });

      await request(app)
        .get('/subscription/all')
        .expect(403);
    });
  });

  describe('PUT /subscription/:id/CancelByAdmin', () => {
    it('should cancel subscription by admin successfully', async () => {
      const subscriptionId = 'sub123';

      mockController.cancelSubscriptionByAdmin.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Subscription cancelled by admin',
          subscriptionId: req.params.id
        });
      });

      const response = await request(app)
        .put(`/subscription/${subscriptionId}/CancelByAdmin`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription cancelled by admin');
      expect(response.body.subscriptionId).toBe(subscriptionId);
      expect(mockAuthMiddleware.requireAuthSuperAdmin).toHaveBeenCalled();
      expect(mockController.cancelSubscriptionByAdmin).toHaveBeenCalled();
    });

    it('should handle invalid subscription ID', async () => {
      const invalidId = 'invalid123';

      mockController.cancelSubscriptionByAdmin.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      });

      const response = await request(app)
        .put(`/subscription/${invalidId}/CancelByAdmin`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Subscription not found');
    });
  });

  describe('POST /subscription/assign', () => {
    it('should assign plan to user successfully', async () => {
      const assignmentData = {
        userId: 'user123',
        planId: 'plan456',
        duration: 30
      };

      mockController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          message: 'Plan assigned successfully',
          data: {
            subscriptionId: 'sub789',
            ...assignmentData
          }
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .send(assignmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Plan assigned successfully');
      expect(response.body.data.userId).toBe(assignmentData.userId);
      expect(response.body.data.planId).toBe(assignmentData.planId);
      expect(mockAuthMiddleware.requireAuthSuperAdmin).toHaveBeenCalled();
      expect(mockController.assignPlanToUser).toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      const incompleteData = {
        userId: 'user123'
      };

      mockController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: planId'
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields: planId');
    });

    it('should handle user not found error', async () => {
      const assignmentData = {
        userId: 'nonexistent123',
        planId: 'plan456'
      };

      mockController.assignPlanToUser.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
      });

      const response = await request(app)
        .post('/subscription/assign')
        .send(assignmentData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should pass correct user data through middleware', async () => {
      mockController.getUserSubscription.mockImplementation((req, res) => {
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe('user123');
        expect(req.user.role).toBe('user');
        
        res.status(200).json({
          success: true,
          userId: req.user.id
        });
      });

      const response = await request(app)
        .get('/subscription/current')
        .expect(200);

      expect(response.body.userId).toBe('user123');
    });

    it('should pass correct admin data through middleware', async () => {
      mockController.getAllSubscriptions.mockImplementation((req, res) => {
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe('admin123');
        expect(req.user.role).toBe('superadmin');
        
        res.status(200).json({
          success: true,
          adminId: req.user.id,
          data: []
        });
      });

      const response = await request(app)
        .get('/subscription/all')
        .expect(200);

      expect(response.body.adminId).toBe('admin123');
    });
  });

  describe('Route Parameter Validation', () => {
    it('should handle valid subscription ID in URL parameters', async () => {
      const validId = '507f1f77bcf86cd799439011';

      mockController.cancelSubscriptionByAdmin.mockImplementation((req, res) => {
        expect(req.params.id).toBe(validId);
        
        res.status(200).json({
          success: true,
          message: 'Subscription cancelled by admin',
          subscriptionId: req.params.id
        });
      });

      const response = await request(app)
        .put(`/subscription/${validId}/CancelByAdmin`)
        .expect(200);

      expect(response.body.subscriptionId).toBe(validId);
    });
  });

  describe('HTTP Methods', () => {
    it('should reject wrong HTTP methods', async () => {
      await request(app)
        .post('/subscription/current')
        .expect(404);

      await request(app)
        .get('/subscription/cancel')
        .expect(404);
    });
  });
});