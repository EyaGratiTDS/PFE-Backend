const request = require('supertest');
const express = require('express');
const subscriptionRoutes = require('../../routes/subscriptionRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', role: 'admin' };
  next();
});

const app = express();
app.use(express.json());
app.use('/subscription', subscriptionRoutes);

describe('Subscription Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();    
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email, role: 'admin' });

    jest.clearAllMocks();
  });

  describe('GET /subscription/current', () => {
    test('should get current user subscription', async () => {
      mockModels.Subscription.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        planId: 1,
        status: 'active'
      });

      const response = await request(app)
        .get('/subscription/current')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.userId).toBe(1);
    });
  });

  describe('POST /subscription/cancel', () => {
    test('should cancel current user subscription', async () => {
      mockModels.Subscription.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        status: 'active'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('GET /subscription/history', () => {
    test('should get current user subscriptions history', async () => {
      mockModels.Subscription.findAll.mockResolvedValue([
        { id: 1, userId: 1, planId: 1, status: 'active' },
        { id: 2, userId: 1, planId: 2, status: 'canceled' }
      ]);

      const response = await request(app)
        .get('/subscription/history')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /subscription/status', () => {
    test('should get current subscription status', async () => {
      mockModels.Subscription.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        status: 'active'
      });

      const response = await request(app)
        .get('/subscription/status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.status).toBe('active');
    });
  });

  describe('GET /subscription/all', () => {
    test('should get all subscriptions (admin)', async () => {
      mockModels.Subscription.findAll.mockResolvedValue([
        { id: 1, userId: 1, planId: 1, status: 'active' },
        { id: 2, userId: 2, planId: 2, status: 'canceled' }
      ]);

      const response = await request(app)
        .get('/subscription/all')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('PUT /subscription/:id/CancelByAdmin', () => {
    test('should cancel subscription by admin', async () => {
      mockModels.Subscription.findByPk.mockResolvedValue({
        id: 1,
        userId: 2,
        status: 'active'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/subscription/1/CancelByAdmin')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /subscription/assign', () => {
    test('should assign plan to user by admin', async () => {
      mockModels.Plan.findByPk.mockResolvedValue({ id: 2, name: 'Pro Plan' });
      mockModels.Subscription.create.mockResolvedValue({
        id: 3,
        userId: 2,
        planId: 2,
        status: 'active'
      });

      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 2, planId: 2 });

      expectSuccessResponse(response);
      expect(response.body.data.planId).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.Subscription.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/subscription/all')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should return 404 for non-existent subscription (CancelByAdmin)', async () => {
      mockModels.Subscription.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .put('/subscription/999/CancelByAdmin')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should return 400 for missing assign parameters', async () => {
      const response = await request(app)
        .post('/subscription/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });
});