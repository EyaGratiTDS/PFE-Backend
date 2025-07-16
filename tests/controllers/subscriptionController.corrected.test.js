const request = require('supertest');
const express = require('express');
const subscriptionController = require('../../controllers/SubscriptionController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../controllers/NotificationController', () => ({
  sendSubscriptionStatusNotification: jest.fn(),
  checkExpiringSubscriptions: jest.fn()
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

const app = express();
app.use(express.json());

app.get('/subscriptions', subscriptionController.getUserSubscriptions);
app.get('/subscriptions/current', subscriptionController.getUserSubscription);
app.delete('/subscriptions/cancel', subscriptionController.cancelSubscription);
app.get('/subscriptions/status', subscriptionController.getSubscriptionStatus);
app.get('/admin/subscriptions', subscriptionController.getAllSubscriptions);
app.delete('/admin/subscriptions/:id', subscriptionController.cancelSubscriptionByAdmin);
app.post('/admin/subscriptions/assign', subscriptionController.assignPlanToUser);

describe('SubscriptionController', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    test('should get current user subscription', async () => {
      const subscription = {
        id: 1,
        user_id: 1,
        plan_id: 1,
        status: 'active',
        Plan: { name: 'Basic Plan', price: 9.99 }
      };
      mockModels.Subscription.findOne.mockResolvedValue(subscription);

      const response = await request(app)
        .get('/subscriptions/current?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.id).toBe(1);
    });

    test('should return error when no userId provided', async () => {
      const response = await request(app)
        .get('/subscriptions/current')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID is required');
    });

    test('should return message when no active subscription found', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/subscriptions/current?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No active subscription found');
    });
  });

  describe('cancelSubscription', () => {
    test('should cancel subscription successfully', async () => {
      mockModels.Subscription.findOne.mockResolvedValue({
        id: 1,
        user_id: 1,
        status: 'active'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 1 });

      expectSuccessResponse(response);
    });

    test('should handle missing userId', async () => {
      const response = await request(app)
        .delete('/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });
  });

  describe('getUserSubscriptions', () => {
    test('should get user subscriptions with filters', async () => {
      const subscriptions = [
        {
          id: 1,
          user_id: 1,
          plan_id: 1,
          status: 'active',
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      ];
      mockModels.Subscription.findAll.mockResolvedValue(subscriptions);

      const response = await request(app)
        .get('/subscriptions?userId=1&status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('getSubscriptionStatus', () => {
    test('should get subscription status', async () => {
      mockModels.Subscription.findOne.mockResolvedValue({
        id: 1,
        status: 'active',
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get('/subscriptions/status?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('getAllSubscriptions (Admin)', () => {
    test('should get all subscriptions for admin', async () => {
      const subscriptions = [
        { id: 1, user_id: 1, status: 'active' },
        { id: 2, user_id: 2, status: 'expired' }
      ];
      mockModels.Subscription.findAll.mockResolvedValue(subscriptions);

      const response = await request(app)
        .get('/admin/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('cancelSubscriptionByAdmin', () => {
    test('should cancel subscription by admin', async () => {
      mockModels.Subscription.findByPk.mockResolvedValue({
        id: 1,
        user_id: 1,
        status: 'active'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/admin/subscriptions/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent subscription', async () => {
      mockModels.Subscription.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete('/admin/subscriptions/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('assignPlanToUser', () => {
    test('should assign plan to user successfully', async () => {
      mockModels.Plan.findOne.mockResolvedValue({
        id: 1,
        name: 'Basic Plan',
        duration: 1,
        unit: 'month',
        price: 9.99
      });

      mockModels.Subscription.create.mockResolvedValue({
        id: 1,
        user_id: 1,
        plan_id: 1,
        status: 'active'
      });

      const response = await request(app)
        .post('/admin/subscriptions/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          planId: 1
        });

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/admin/subscriptions/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });

    test('should handle non-existent plan', async () => {
      mockModels.Plan.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/admin/subscriptions/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          planId: 999
        });

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors in getUserSubscription', async () => {
      mockModels.Subscription.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/subscriptions/current?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle database errors in getAllSubscriptions', async () => {
      mockModels.Subscription.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/admin/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle database errors in assignPlanToUser', async () => {
      mockModels.Plan.findOne.mockResolvedValue({
        id: 1,
        name: 'Basic Plan'
      });
      mockModels.Subscription.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/admin/subscriptions/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 1,
          planId: 1
        });

      expectErrorResponse(response);
    });
  });

  describe('checkExpiredSubscriptions function', () => {
    test('should export checkExpiredSubscriptions function', () => {
      expect(typeof subscriptionController.checkExpiredSubscriptions).toBe('function');
    });
  });
});
