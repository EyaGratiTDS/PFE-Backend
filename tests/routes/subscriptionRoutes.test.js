const request = require('supertest');
const express = require('express');
const subscriptionRoutes = require('../../routes/subscriptionRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/subscriptions', subscriptionRoutes);

describe('Subscription Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /api/subscriptions', () => {
    test('should get user subscriptions', async () => {
      const subscriptions = [
        {
          id: 1,
          userId: 1,
          planId: 1,
          status: 'active',
          current_period_end: new Date()
        }
      ];
      mockModels.Subscription.findAll.mockResolvedValue(subscriptions);

      const response = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/subscriptions', () => {
    test('should create new subscription', async () => {
      const subscriptionData = {
        planId: 1,
        paymentMethodId: 'pm_test123'
      };

      mockModels.Plan.findByPk.mockResolvedValue({ id: 1, name: 'Premium' });
      mockModels.Subscription.create.mockResolvedValue({
        id: 1,
        ...subscriptionData,
        status: 'active'
      });

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });
  });

  describe('PUT /api/subscriptions/:id', () => {
    test('should update subscription', async () => {
      const updateData = { planId: 2 };
      
      mockModels.Subscription.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        status: 'active'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/subscriptions/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('DELETE /api/subscriptions/:id', () => {
    test('should cancel subscription', async () => {
      mockModels.Subscription.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        status: 'active'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/api/subscriptions/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.Subscription.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });
});
