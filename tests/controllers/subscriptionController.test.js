const request = require('supertest');
const express = require('express');
const subscriptionController = require('../../controllers/SubscriptionController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('stripe', () => ({
  subscriptions: {
    create: jest.fn(),
    cancel: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    list: jest.fn()
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  prices: {
    retrieve: jest.fn()
  }
}));

const app = express();
app.use(express.json());

// Configuration des routes de test
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
  let testSubscription;
  let stripe;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testSubscription = {
      id: 1,
      userId: 1,
      planId: 1,
      stripeSubscriptionId: 'sub_test123',
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false,
      created_at: new Date()
    };
    authToken = createTestToken({ id: 1, email: testUser.email });
    stripe = require('stripe');

    jest.clearAllMocks();
  });

  describe('GET /subscriptions', () => {
    test('should get user subscriptions successfully', async () => {
      const subscriptions = [
        testSubscription,
        { ...testSubscription, id: 2, status: 'canceled' }
      ];

      mockModels.Subscription.findAll.mockResolvedValue(subscriptions);

      const response = await request(app)
        .get('/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.Subscription.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: [{ model: mockModels.Plan, as: 'Plan' }],
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter subscriptions by status', async () => {
      mockModels.Subscription.findAll.mockResolvedValue([testSubscription]);

      const response = await request(app)
        .get('/subscriptions?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Subscription.findAll).toHaveBeenCalledWith({
        where: { userId: 1, status: 'active' },
        include: [{ model: mockModels.Plan, as: 'Plan' }],
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('POST /subscriptions', () => {
    test('should create subscription successfully', async () => {
      const subscriptionData = {
        planId: 1,
        paymentMethodId: 'pm_test123'
      };

      const plan = {
        id: 1,
        name: 'Premium Plan',
        stripePriceId: 'price_test123',
        price: 999
      };

      const stripeCustomer = { id: 'cus_test123' };
      const stripeSubscription = {
        id: 'sub_test123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
      };

      mockModels.Plan.findByPk.mockResolvedValue(plan);
      mockModels.User.findByPk.mockResolvedValue(testUser);
      stripe.customers.create.mockResolvedValue(stripeCustomer);
      stripe.subscriptions.create.mockResolvedValue(stripeSubscription);
      mockModels.Subscription.create.mockResolvedValue({
        ...testSubscription,
        ...subscriptionData
      });

      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should return error for invalid plan', async () => {
      mockModels.Plan.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 999, paymentMethodId: 'pm_test123' });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Plan not found');
    });

    test('should handle stripe errors', async () => {
      const plan = { id: 1, stripePriceId: 'price_test123' };
      mockModels.Plan.findByPk.mockResolvedValue(plan);
      mockModels.User.findByPk.mockResolvedValue(testUser);
      stripe.customers.create.mockRejectedValue(new Error('Stripe error'));

      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 1, paymentMethodId: 'pm_test123' });

      expectErrorResponse(response);
    });
  });

  describe('GET /subscriptions/:id', () => {
    test('should get subscription by id', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(testSubscription);

      const response = await request(app)
        .get('/subscriptions/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.status).toBe('active');
    });

    test('should return 404 for non-existent subscription', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/subscriptions/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /subscriptions/:id', () => {
    test('should cancel subscription successfully', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(testSubscription);
      stripe.subscriptions.cancel.mockResolvedValue({
        ...testSubscription,
        status: 'canceled'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/subscriptions/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test123');
    });

    test('should handle immediate cancellation', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(testSubscription);
      stripe.subscriptions.cancel.mockResolvedValue({
        status: 'canceled'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/subscriptions/1?immediate=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /subscriptions/:id/resume', () => {
    test('should resume subscription successfully', async () => {
      const canceledSubscription = {
        ...testSubscription,
        status: 'canceled',
        cancel_at_period_end: true
      };

      mockModels.Subscription.findOne.mockResolvedValue(canceledSubscription);
      stripe.subscriptions.update.mockResolvedValue({
        ...canceledSubscription,
        cancel_at_period_end: false,
        status: 'active'
      });
      mockModels.Subscription.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/subscriptions/1/resume')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should not resume already active subscription', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(testSubscription);

      const response = await request(app)
        .post('/subscriptions/1/resume')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('already active');
    });
  });

  describe('GET /subscriptions/:id/invoices', () => {
    test('should get subscription invoices', async () => {
      mockModels.Subscription.findOne.mockResolvedValue(testSubscription);
      
      const invoices = [
        {
          id: 'in_test123',
          amount_paid: 999,
          status: 'paid',
          created: Math.floor(Date.now() / 1000)
        }
      ];

      stripe.subscriptions.retrieve.mockResolvedValue({
        ...testSubscription,
        latest_invoice: 'in_test123'
      });

      const response = await request(app)
        .get('/subscriptions/1/invoices')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });
});
