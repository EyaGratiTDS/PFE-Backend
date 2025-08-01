const request = require('supertest');
const express = require('express');

jest.mock('../../controllers/PaymentController', () => ({
  createPaymentIntent: jest.fn(),
  confirmPayment: jest.fn(),
  handlePaymentWebhook: jest.fn()
}));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: jest.fn()
}));

const paymentController = require('../../controllers/PaymentController');
const { requireAuth } = require('../../middleware/authMiddleware');
const paymentRoutes = require('../../routes/paymentRoutes');

describe('Payment Routes Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/payment', paymentRoutes);
    
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
        role: 'user'
      };
      next();
    });
  });

  describe('POST /payment/create-payment-intent', () => {
    it('should create payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_1234567890',
        clientSecret: 'pi_1234567890_secret_abcdef',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method'
      };

      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockPaymentIntent,
          message: 'Payment intent created successfully'
        });
      });

      const paymentData = {
        amount: 2000,
        currency: 'usd',
        planId: 'premium'
      };

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send(paymentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPaymentIntent);
      expect(response.body.data.clientSecret).toBeDefined();
      expect(requireAuth).toHaveBeenCalled();
      expect(paymentController.createPaymentIntent).toHaveBeenCalled();
    });

    it('should handle invalid amount', async () => {
      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid amount. Amount must be at least 50 cents',
          errors: [
            { field: 'amount', message: 'Amount must be greater than 50' }
          ]
        });
      });

      const paymentData = {
        amount: 10,
        currency: 'usd',
        planId: 'basic'
      };

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send(paymentData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid amount');
    });

    it('should handle missing required fields', async () => {
      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: [
            { field: 'amount', message: 'Amount is required' },
            { field: 'currency', message: 'Currency is required' }
          ]
        });
      });

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toHaveLength(2);
    });

    it('should handle authentication failure', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send({ amount: 2000, currency: 'usd' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(paymentController.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should pass request data to controller', async () => {
      let capturedReq;
      
      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: { id: 'pi_test', amount: req.body.amount }
        });
      });

      const paymentData = {
        amount: 5000,
        currency: 'eur',
        planId: 'enterprise',
        metadata: { userId: 123 }
      };

      await request(app)
        .post('/payment/create-payment-intent')
        .send(paymentData);

      expect(capturedReq.body).toEqual(paymentData);
      expect(capturedReq.user.id).toBe(1);
    });

    it('should handle Stripe API errors', async () => {
      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        res.status(502).json({
          success: false,
          message: 'Stripe API error: Invalid API key provided',
          code: 'STRIPE_API_ERROR'
        });
      });

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send({ amount: 2000, currency: 'usd' });

      expect(response.status).toBe(502);
      expect(response.body.code).toBe('STRIPE_API_ERROR');
    });
  });

  describe('POST /payment/confirm', () => {
    it('should confirm payment successfully', async () => {
      const mockConfirmedPayment = {
        id: 'pi_1234567890',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd',
        paymentMethod: 'pm_card_visa',
        receiptUrl: 'https://pay.stripe.com/receipts/test_receipt'
      };

      paymentController.confirmPayment.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockConfirmedPayment,
          message: 'Payment confirmed successfully'
        });
      });

      const confirmData = {
        paymentIntentId: 'pi_1234567890',
        paymentMethodId: 'pm_card_visa'
      };

      const response = await request(app)
        .post('/payment/confirm')
        .send(confirmData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('succeeded');
      expect(response.body.data.receiptUrl).toBeDefined();
      expect(requireAuth).toHaveBeenCalled();
      expect(paymentController.confirmPayment).toHaveBeenCalled();
    });

    it('should handle payment failed', async () => {
      paymentController.confirmPayment.mockImplementation((req, res) => {
        res.status(402).json({
          success: false,
          message: 'Payment failed: Your card was declined',
          code: 'PAYMENT_FAILED',
          data: {
            paymentIntentId: 'pi_1234567890',
            status: 'requires_payment_method',
            lastPaymentError: {
              type: 'card_error',
              code: 'card_declined',
              message: 'Your card was declined.'
            }
          }
        });
      });

      const confirmData = {
        paymentIntentId: 'pi_1234567890',
        paymentMethodId: 'pm_card_declined'
      };

      const response = await request(app)
        .post('/payment/confirm')
        .send(confirmData);

      expect(response.status).toBe(402);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PAYMENT_FAILED');
      expect(response.body.data.lastPaymentError).toBeDefined();
    });

    it('should handle invalid payment intent', async () => {
      paymentController.confirmPayment.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Payment intent not found',
          code: 'PAYMENT_INTENT_NOT_FOUND'
        });
      });

      const confirmData = {
        paymentIntentId: 'pi_invalid',
        paymentMethodId: 'pm_card_visa'
      };

      const response = await request(app)
        .post('/payment/confirm')
        .send(confirmData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PAYMENT_INTENT_NOT_FOUND');
    });

    it('should handle missing payment intent ID', async () => {
      paymentController.confirmPayment.mockImplementation((req, res) => {
        res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: [
            { field: 'paymentIntentId', message: 'Payment intent ID is required' }
          ]
        });
      });

      const response = await request(app)
        .post('/payment/confirm')
        .send({ paymentMethodId: 'pm_card_visa' });

      expect(response.status).toBe(422);
      expect(response.body.errors).toHaveLength(1);
    });

    it('should pass confirmation data to controller', async () => {
      let capturedReq;
      
      paymentController.confirmPayment.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: { id: req.body.paymentIntentId, status: 'succeeded' }
        });
      });

      const confirmData = {
        paymentIntentId: 'pi_test123',
        paymentMethodId: 'pm_test456',
        returnUrl: 'https://example.com/return'
      };

      await request(app)
        .post('/payment/confirm')
        .send(confirmData);

      expect(capturedReq.body).toEqual(confirmData);
      expect(capturedReq.user.id).toBe(1);
    });

    it('should handle 3D Secure authentication required', async () => {
      paymentController.confirmPayment.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            id: 'pi_1234567890',
            status: 'requires_action',
            nextAction: {
              type: 'use_stripe_sdk',
              useStripeSDK: {
                type: 'three_d_secure_redirect',
                stripe_js: 'https://js.stripe.com/v3/'
              }
            }
          },
          message: '3D Secure authentication required'
        });
      });

      const response = await request(app)
        .post('/payment/confirm')
        .send({
          paymentIntentId: 'pi_1234567890',
          paymentMethodId: 'pm_card_threeDSecure'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('requires_action');
      expect(response.body.data.nextAction).toBeDefined();
    });
  });

  describe('POST /payment/webhook/stripe', () => {
    it('should handle Stripe webhook successfully', async () => {
      paymentController.handlePaymentWebhook.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Webhook processed successfully'
        });
      });

      const webhookPayload = JSON.stringify({
        id: 'evt_1234567890',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            amount: 2000,
            currency: 'usd'
          }
        }
      });

      const response = await request(app)
        .post('/payment/webhook/stripe')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(paymentController.handlePaymentWebhook).toHaveBeenCalled();
    });

    it('should handle invalid webhook signature', async () => {
      paymentController.handlePaymentWebhook.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid webhook signature',
          code: 'INVALID_SIGNATURE'
        });
      });

      const webhookPayload = JSON.stringify({
        id: 'evt_invalid',
        type: 'payment_intent.succeeded'
      });

      const response = await request(app)
        .post('/payment/webhook/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(webhookPayload);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_SIGNATURE');
    });

    it('should handle missing webhook signature', async () => {
      paymentController.handlePaymentWebhook.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Missing Stripe signature header',
          code: 'MISSING_SIGNATURE'
        });
      });

      const response = await request(app)
        .post('/payment/webhook/stripe')
        .send('{"type": "payment_intent.succeeded"}');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_SIGNATURE');
    });

    it('should handle different webhook event types', async () => {
      const eventTypes = [
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'payment_method.attached',
        'customer.subscription.created',
        'invoice.payment_succeeded'
      ];

      let capturedEvents = [];

      for (const eventType of eventTypes) {
        paymentController.handlePaymentWebhook.mockImplementationOnce((req, res) => {
          try {
            const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            capturedEvents.push(event.type);
            res.status(200).json({
              success: true,
              eventType: event.type
            });
          } catch (error) {
            res.status(500).json({
              success: false,
              message: 'Error parsing webhook'
            });
          }
        });

        const webhookPayload = JSON.stringify({
          id: `evt_${eventType}`,
          type: eventType,
          data: { object: { id: 'test_object' } }
        });

        const response = await request(app)
          .post('/payment/webhook/stripe')
          .set('stripe-signature', 'test_signature')
          .set('Content-Type', 'application/json')
          .send(webhookPayload);

        expect(response.status).toBe(200);
        expect(response.body.eventType).toBe(eventType);
      }

      expect(capturedEvents).toEqual(eventTypes);
    });

    it('should handle malformed webhook payload', async () => {
      paymentController.handlePaymentWebhook.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid JSON payload',
          code: 'INVALID_PAYLOAD'
        });
      });

      const response = await request(app)
        .post('/payment/webhook/stripe')
        .set('stripe-signature', 'test_signature')
        .send('invalid json payload');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PAYLOAD');
    });

    it('should process webhook without authentication', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      paymentController.handlePaymentWebhook.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Webhook processed'
        });
      });

      const response = await request(app)
        .post('/payment/webhook/stripe')
        .set('stripe-signature', 'test_signature')
        .send('{"type": "payment_intent.succeeded"}');

      expect(response.status).toBe(200);
      expect(paymentController.handlePaymentWebhook).toHaveBeenCalled();
    });

    it('should handle webhook processing errors', async () => {
      paymentController.handlePaymentWebhook.mockImplementation((req, res, next) => {
        const error = new Error('Database connection failed during webhook processing');
        next(error);
      });

      const response = await request(app)
        .post('/payment/webhook/stripe')
        .set('stripe-signature', 'test_signature')
        .send('{"type": "payment_intent.succeeded"}');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });
  });

  describe('Authentication Middleware Tests', () => {
    it('should require authentication for payment routes (except webhook)', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication token required'
        });
      });

      const protectedRoutes = [
        { method: 'post', path: '/payment/create-payment-intent' },
        { method: 'post', path: '/payment/confirm' }
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)[route.method](route.path)
          .send({});
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }

      expect(requireAuth).toHaveBeenCalledTimes(protectedRoutes.length);
    });

    it('should pass user data through authentication to controllers', async () => {
      const mockUser = {
        id: 123,
        email: 'testuser@example.com',
        role: 'premium'
      };

      let capturedReqs = [];

      requireAuth.mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
      });

      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        capturedReqs.push({ endpoint: 'createPaymentIntent', user: req.user });
        res.status(200).json({ success: true, data: {} });
      });

      paymentController.confirmPayment.mockImplementation((req, res) => {
        capturedReqs.push({ endpoint: 'confirmPayment', user: req.user });
        res.status(200).json({ success: true, data: {} });
      });

      await request(app)
        .post('/payment/create-payment-intent')
        .send({ amount: 2000, currency: 'usd' });

      await request(app)
        .post('/payment/confirm')
        .send({ paymentIntentId: 'pi_test' });

      expect(capturedReqs).toHaveLength(2);
      capturedReqs.forEach(req => {
        expect(req.user).toEqual(mockUser);
      });
    });

    it('should handle expired token', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      });

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send({ amount: 2000, currency: 'usd' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      paymentController.createPaymentIntent.mockImplementation((req, res, next) => {
        const error = new Error('Stripe service unavailable');
        next(error);
      });

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send({ amount: 2000, currency: 'usd' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Stripe service unavailable');
    });

    it('should handle validation errors', async () => {
      paymentController.confirmPayment.mockImplementation((req, res) => {
        res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: [
            { field: 'paymentIntentId', message: 'Must be a valid Stripe payment intent ID' },
            { field: 'paymentMethodId', message: 'Must be a valid Stripe payment method ID' }
          ]
        });
      });

      const response = await request(app)
        .post('/payment/confirm')
        .send({ paymentIntentId: 'invalid', paymentMethodId: 'invalid' });

      expect(response.status).toBe(422);
      expect(response.body.errors).toHaveLength(2);
    });

    it('should handle rate limiting errors', async () => {
      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        res.status(429).json({
          success: false,
          message: 'Too many payment requests. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfter: 30
        });
      });

      const response = await request(app)
        .post('/payment/create-payment-intent')
        .send({ amount: 2000, currency: 'usd' });

      expect(response.status).toBe(429);
      expect(response.body.code).toBe('RATE_LIMITED');
      expect(response.body.retryAfter).toBe(30);
    });
  });

  describe('Request Body and Content Type Handling', () => {
    it('should handle different payment amounts and currencies', async () => {
      const testCases = [
        { amount: 1000, currency: 'usd' },
        { amount: 2500, currency: 'eur' },
        { amount: 5000, currency: 'gbp' },
        { amount: 10000, currency: 'cad' }
      ];

      let capturedRequests = [];

      paymentController.createPaymentIntent.mockImplementation((req, res) => {
        capturedRequests.push({
          amount: req.body.amount,
          currency: req.body.currency
        });
        res.status(200).json({
          success: true,
          data: { amount: req.body.amount, currency: req.body.currency }
        });
      });

      for (const testCase of testCases) {
        await request(app)
          .post('/payment/create-payment-intent')
          .send(testCase);
      }

      expect(capturedRequests).toEqual(testCases);
    });

    it('should handle raw body for webhook endpoint', async () => {
      let capturedBody;

      paymentController.handlePaymentWebhook.mockImplementation((req, res) => {
        capturedBody = req.body;
        res.status(200).json({ 
          success: true,
          bodyType: typeof req.body,
          bodyContent: req.body
        });
      });

      const rawPayload = '{"id":"evt_test","type":"payment_intent.succeeded"}';

      const response = await request(app)
        .post('/payment/webhook/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'test_signature')
        .send(rawPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(typeof capturedBody).toBe('object');
      expect(capturedBody.id).toBe('evt_test');
      expect(capturedBody.type).toBe('payment_intent.succeeded');
    });

    it('should handle non-existent routes', async () => {
      const response = await request(app)
        .get('/payment/nonexistent-endpoint');

      expect(response.status).toBe(404);
    });

    it('should handle wrong HTTP methods', async () => {
      const wrongMethodTests = [
        { method: 'get', path: '/payment/create-payment-intent' },
        { method: 'get', path: '/payment/confirm' },
        { method: 'get', path: '/payment/webhook/stripe' },
        { method: 'delete', path: '/payment/create-payment-intent' }
      ];

      for (const test of wrongMethodTests) {
        const response = await request(app)[test.method](test.path);
        expect(response.status).toBe(404);
      }
    });
  });

  describe('Payment Flow Integration', () => {
    it('should simulate complete payment flow', async () => {
      let paymentIntentId;

      paymentController.createPaymentIntent.mockImplementationOnce((req, res) => {
        paymentIntentId = 'pi_test_flow_123';
        res.status(200).json({
          success: true,
          data: {
            id: paymentIntentId,
            clientSecret: `${paymentIntentId}_secret_abc`,
            amount: req.body.amount,
            currency: req.body.currency,
            status: 'requires_payment_method'
          }
        });
      });

      paymentController.confirmPayment.mockImplementationOnce((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            id: req.body.paymentIntentId,
            status: 'succeeded',
            amount: 2000,
            currency: 'usd'
          }
        });
      });

      paymentController.handlePaymentWebhook.mockImplementationOnce((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Payment success webhook processed'
        });
      });

      const createResponse = await request(app)
        .post('/payment/create-payment-intent')
        .send({ amount: 2000, currency: 'usd', planId: 'premium' });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.data.id).toBe(paymentIntentId);

      const confirmResponse = await request(app)
        .post('/payment/confirm')
        .send({
          paymentIntentId: paymentIntentId,
          paymentMethodId: 'pm_card_visa'
        });

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.data.status).toBe('succeeded');

      const webhookResponse = await request(app)
        .post('/payment/webhook/stripe')
        .set('stripe-signature', 'valid_signature')
        .send(JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: paymentIntentId } }
        }));

      expect(webhookResponse.status).toBe(200);
    });
  });
});