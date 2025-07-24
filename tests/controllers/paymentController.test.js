const request = require('supertest');
const express = require('express');
const paymentController = require('../../controllers/PaymentController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('stripe', () => ({
  customers: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  paymentIntents: {
    create: jest.fn(),
    confirm: jest.fn(),
    retrieve: jest.fn()
  },
  subscriptions: {
    create: jest.fn(),
    cancel: jest.fn(),
    retrieve: jest.fn()
  },
  webhooks: {
    constructEvent: jest.fn()
  }
}));

const app = express();
app.use(express.json());

app.get('/payments', paymentController.getPayments);
app.post('/payments/create-intent', paymentController.createPaymentIntent);
app.post('/payments/confirm', paymentController.confirmPayment);
app.post('/payments/webhook', paymentController.handleWebhook);
app.get('/payments/:id', paymentController.getPaymentById);

describe('PaymentController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let stripe;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });
    stripe = require('stripe');

    jest.clearAllMocks();
  });

  describe('GET /payments', () => {
    test('should get user payments successfully', async () => {
      const payments = [
        {
          id: 1,
          userId: 1,
          amount: 999,
          currency: 'USD',
          status: 'completed',
          createdAt: new Date()
        }
      ];

      mockModels.Payment.findAll.mockResolvedValue(payments);

      const response = await request(app)
        .get('/payments')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
      expect(mockModels.Payment.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: [['createdAt', 'DESC']]
      });
    });

    test('should filter payments by status', async () => {
      mockModels.Payment.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/payments?status=completed')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Payment.findAll).toHaveBeenCalledWith({
        where: { userId: 1, status: 'completed' },
        order: [['createdAt', 'DESC']]
      });
    });
  });

  describe('POST /payments/create-intent', () => {
    test('should create payment intent successfully', async () => {
      const planData = {
        id: 1,
        name: 'Premium Plan',
        price: 999,
        currency: 'USD'
      };

      const paymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 999,
        currency: 'usd'
      };

      mockModels.Plan.findByPk.mockResolvedValue(planData);
      stripe.customers.create.mockResolvedValue({ id: 'cus_test123' });
      stripe.paymentIntents.create.mockResolvedValue(paymentIntent);

      const response = await request(app)
        .post('/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 1 });

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('clientSecret');
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 999,
        currency: 'usd',
        customer: 'cus_test123',
        metadata: {
          userId: 1,
          planId: 1
        }
      });
    });

    test('should return error for invalid plan', async () => {
      mockModels.Plan.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 999 });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Plan not found');
    });
  });

  describe('POST /payments/confirm', () => {
    test('should confirm payment successfully', async () => {
      const paymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 999,
        currency: 'usd',
        metadata: {
          userId: '1',
          planId: '1'
        }
      };

      const createdPayment = {
        id: 1,
        userId: 1,
        stripePaymentId: 'pi_test123',
        amount: 999,
        status: 'completed'
      };

      stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent);
      mockModels.Payment.create.mockResolvedValue(createdPayment);

      const response = await request(app)
        .post('/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentIntentId: 'pi_test123' });

      expectSuccessResponse(response);
      expect(mockModels.Payment.create).toHaveBeenCalledWith({
        userId: 1,
        planId: 1,
        stripePaymentId: 'pi_test123',
        amount: 999,
        currency: 'USD',
        status: 'completed'
      });
    });

    test('should handle failed payment', async () => {
      const paymentIntent = {
        id: 'pi_test123',
        status: 'payment_failed'
      };

      stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent);

      const response = await request(app)
        .post('/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentIntentId: 'pi_test123' });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Payment failed');
    });
  });

  describe('GET /payments/:id', () => {
    test('should get payment by id', async () => {
      const payment = {
        id: 1,
        userId: 1,
        amount: 999,
        status: 'completed'
      };

      mockModels.Payment.findOne.mockResolvedValue(payment);

      const response = await request(app)
        .get('/payments/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.id).toBe(1);
    });

    test('should return 404 for non-existent payment', async () => {
      mockModels.Payment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/payments/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not allow access to other users payments', async () => {
      mockModels.Payment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/payments/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(mockModels.Payment.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });
  });

  describe('POST /payments/webhook', () => {
    test('should handle webhook successfully', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            metadata: {
              userId: '1',
              planId: '1'
            }
          }
        }
      };

      stripe.webhooks.constructEvent.mockReturnValue(event);
      mockModels.Payment.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', 'test_signature')
        .send(Buffer.from('test_payload'));

      expect(response.status).toBe(200);
    });

    test('should handle invalid webhook signature', async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send(Buffer.from('test_payload'));

      expectErrorResponse(response);
    });
  });
});
