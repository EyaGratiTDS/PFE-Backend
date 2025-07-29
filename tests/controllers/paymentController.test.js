process.env.STRIPE_SECRET_KEY = 'test_stripe_key';
process.env.STRIPE_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.NODE_ENV = 'test';

jest.mock('sequelize', () => ({
  Op: {
    in: 'in',
    eq: 'eq',
    ne: 'ne',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
    like: 'like',
    and: 'and',
    or: 'or'
  },
  DataTypes: {
    INTEGER: 'INTEGER',
    STRING: jest.fn(() => 'STRING'),
    DATE: 'DATE',
    DECIMAL: jest.fn(() => 'DECIMAL'),
    ENUM: jest.fn((...values) => `ENUM(${values.join(',')})`),
    TEXT: 'TEXT',
    BOOLEAN: 'BOOLEAN',
    UUID: 'UUID',
    UUIDV4: 'UUIDV4'
  },
  Sequelize: jest.fn().mockImplementation(() => ({
    define: jest.fn(),
    transaction: jest.fn()
  }))
}));

const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  webhooks: {
    constructEvent: jest.fn()
  }
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

const mockNotificationController = {
  sendNewSubscriptionNotification: jest.fn(),
  sendUpdateSubscriptionNotification: jest.fn()
};

jest.mock('../../controllers/NotificationController', () => mockNotificationController);

const mockSubscription = {
  findOne: jest.fn(),
  findByPk: jest.fn(),
  upsert: jest.fn(),
  create: jest.fn(),
  sequelize: {
    transaction: jest.fn()
  }
};

const mockPayment = {
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  sequelize: {
    transaction: jest.fn()
  }
};

const mockUser = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn()
};

const mockPlan = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn()
};

const mockNotification = {
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn()
};

jest.mock('../../models/Subscription', () => mockSubscription);
jest.mock('../../models/Payment', () => mockPayment);
jest.mock('../../models/User', () => mockUser);
jest.mock('../../models/Plan', () => mockPlan);
jest.mock('../../models/Notification', () => mockNotification);

const paymentController = require('../../controllers/PaymentController');

describe('PaymentController', () => {
  let mockReq, mockRes, mockTransaction;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    };

    mockSubscription.sequelize = {
      transaction: jest.fn().mockResolvedValue(mockTransaction)
    };
    mockPayment.sequelize = mockSubscription.sequelize;

    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    beforeEach(() => {
      mockReq = {
        body: {
          planId: 1,
          userId: 1,
          months: 1,
          paymentMethod: 'card'
        }
      };
    });

    test('devrait créer un payment intent avec succès pour un nouvel utilisateur', async () => {
      const mockUserData = { id: 1, name: 'Test User' };
      const mockPlanData = { id: 1, price: 10, duration_days: 30 };
      const mockSubscriptionData = { id: 1 };
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret'
      };
      const mockPaymentData = { id: 1 };

      mockUser.findByPk.mockResolvedValue(mockUserData);
      mockPlan.findByPk.mockResolvedValue(mockPlanData);
      mockSubscription.findOne.mockResolvedValue(null);
      mockSubscription.upsert.mockResolvedValue([mockSubscriptionData, true]);
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      mockPayment.create.mockResolvedValue(mockPaymentData);

      await paymentController.createPaymentIntent(mockReq, mockRes);

      expect(mockUser.findByPk).toHaveBeenCalledWith(1);
      expect(mockPlan.findByPk).toHaveBeenCalledWith(1);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1000,
        currency: 'USD',
        metadata: {
          userId: '1',
          subscriptionId: '1',
          months: '1',
          isRenewal: false
        }
      });
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          paymentId: 1,
          clientSecret: 'pi_test123_secret',
          totalAmount: 10,
          endDate: expect.any(String)
        }
      });
    });

    test('devrait gérer un renouvellement d\'abonnement existant', async () => {
      const mockUserData = { id: 1, name: 'Test User' };
      const mockPlanData = { id: 1, price: 10, duration_days: 30 };
      const futureEndDate = new Date();
      futureEndDate.setDate(futureEndDate.getDate() + 10);
      
      const mockExistingSubscription = { 
        id: 1, 
        end_date: futureEndDate.toISOString()
      };
      const mockExistingPayment = { amount: 5 };
      const mockSubscriptionData = { id: 1 };
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret'
      };
      const mockPaymentData = { id: 1 };

      mockUser.findByPk.mockResolvedValue(mockUserData);
      mockPlan.findByPk.mockResolvedValue(mockPlanData);
      mockSubscription.findOne.mockResolvedValue(mockExistingSubscription);
      mockPayment.findOne.mockResolvedValue(mockExistingPayment);
      mockSubscription.upsert.mockResolvedValue([mockSubscriptionData, true]);
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      mockPayment.create.mockResolvedValue(mockPaymentData);

      await paymentController.createPaymentIntent(mockReq, mockRes);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1500,
        currency: 'USD',
        metadata: {
          userId: '1',
          subscriptionId: '1',
          months: '1',
          isRenewal: true
        }
      });
    });

    test('devrait retourner une erreur 400 si des champs requis manquent', async () => {
      mockReq.body = { planId: 1 };

      await paymentController.createPaymentIntent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Champs requis manquants'
      });
    });

    test('devrait retourner une erreur 404 si l\'utilisateur n\'existe pas', async () => {
      mockUser.findByPk.mockResolvedValue(null);
      mockPlan.findByPk.mockResolvedValue({ id: 1 });

      await paymentController.createPaymentIntent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Utilisateur ou plan introuvable'
      });
    });

    test('devrait gérer les erreurs et faire un rollback', async () => {
      mockUser.findByPk.mockResolvedValue({ id: 1 });
      mockPlan.findByPk.mockResolvedValue({ id: 1 });
      mockSubscription.findOne.mockRejectedValue(new Error('Database error'));

      await paymentController.createPaymentIntent(mockReq, mockRes);

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Erreur serveur'
      });
    });
  });

  describe('confirmPayment', () => {
    beforeEach(() => {
      mockReq = {
        body: {
          paymentId: 1
        }
      };
    });

    test('devrait confirmer un paiement avec succès', async () => {
      const mockPaymentData = {
        id: 1,
        status: 'pending',
        SubscriptionId: 1,
        userId: 1,
        amount: 10,
        transaction_id: 'pi_test123',
        save: jest.fn().mockImplementation(function() {
          this.status = 'completed';
          return Promise.resolve();
        })
      };
      const mockSubscriptionData = {
        id: 1,
        status: 'pending',
        plan_id: 1,
        start_date: new Date(),
        end_date: new Date(),
        save: jest.fn()
      };
      const mockPlanData = { id: 1, name: 'Test Plan' };
      const mockStripePayment = {
        metadata: { isRenewal: 'false' }
      };

      mockPayment.findByPk.mockResolvedValue(mockPaymentData);
      mockSubscription.findByPk.mockResolvedValue(mockSubscriptionData);
      mockPlan.findByPk.mockResolvedValue(mockPlanData);
      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockStripePayment);
      mockNotificationController.sendNewSubscriptionNotification.mockResolvedValue();

      await paymentController.confirmPayment(mockReq, mockRes);

      expect(mockPaymentData.save).toHaveBeenCalled();
      expect(mockSubscriptionData.save).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockNotificationController.sendNewSubscriptionNotification).toHaveBeenCalledWith(
        1, 'Test Plan', mockSubscriptionData.start_date, mockSubscriptionData.end_date
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          paymentId: 1,
          subscriptionId: 1,
          status: 'completed'
        }
      });
    });

    test('devrait retourner un succès si le paiement est déjà confirmé', async () => {
      const mockPaymentData = {
        id: 1,
        status: 'completed'
      };

      mockPayment.findByPk.mockResolvedValue(mockPaymentData);

      await paymentController.confirmPayment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Payment already confirmed',
          paymentId: 1
        }
      });
    });

    test('devrait retourner une erreur 400 si paymentId manque', async () => {
      mockReq.body = {};

      await paymentController.confirmPayment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing paymentId'
      });
    });

    test('devrait retourner une erreur 404 si le paiement n\'existe pas', async () => {
      mockPayment.findByPk.mockResolvedValue(null);

      await paymentController.confirmPayment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Payment not found'
      });
    });
  });

  describe('handlePaymentWebhook', () => {
    beforeEach(() => {
      mockReq = {
        body: 'raw_body',
        headers: {
          'stripe-signature': 'test_signature'
        }
      };
    });

    test('devrait gérer un webhook payment_intent.succeeded', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_test123' }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      
      const originalHandleSuccessfulPayment = paymentController.handleSuccessfulPayment;
      paymentController.handleSuccessfulPayment = jest.fn().mockResolvedValue();

      await paymentController.handlePaymentWebhook(mockReq, mockRes);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'raw_body',
        'test_signature',
        'test_webhook_secret'
      );
      expect(paymentController.handleSuccessfulPayment).toHaveBeenCalledWith({
        id: 'pi_test123'
      });
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: {} });

      paymentController.handleSuccessfulPayment = originalHandleSuccessfulPayment;
    });

    test('devrait gérer un webhook payment_intent.payment_failed', async () => {
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: { id: 'pi_test123' }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      
      const originalHandleFailedPayment = paymentController.handleFailedPayment;
      paymentController.handleFailedPayment = jest.fn().mockResolvedValue();

      await paymentController.handlePaymentWebhook(mockReq, mockRes);

      expect(paymentController.handleFailedPayment).toHaveBeenCalledWith({
        id: 'pi_test123'
      });

      paymentController.handleFailedPayment = originalHandleFailedPayment;
    });

    test('devrait retourner une erreur 400 si la signature webhook est invalide', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await paymentController.handlePaymentWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Webhook Error: Invalid signature'
      });
    });

    test('devrait ignorer les événements non gérés', async () => {
      const mockEvent = {
        type: 'payment_intent.created',
        data: {
          object: { id: 'pi_test123' }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await paymentController.handlePaymentWebhook(mockReq, mockRes);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled event type payment_intent.created');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: {} });

      consoleSpy.mockRestore();
    });
  });

  describe('handleSuccessfulPayment', () => {
    test('devrait traiter un paiement réussi', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { isRenewal: 'false' }
      };
      const mockPaymentData = {
        id: 1,
        status: 'pending',
        SubscriptionId: 1,
        userId: 1,
        amount: 10,
        save: jest.fn().mockImplementation(function() {
          this.status = 'completed';
          this.gateway_response = JSON.stringify(mockPaymentIntent);
          return Promise.resolve();
        })
      };
      const mockSubscriptionData = {
        id: 1,
        status: 'pending',
        plan_id: 1,
        start_date: new Date(),
        end_date: new Date(),
        save: jest.fn().mockImplementation(function() {
          this.status = 'active';
          return Promise.resolve();
        })
      };
      const mockPlanData = { id: 1, name: 'Test Plan' };

      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      mockSubscription.findByPk.mockResolvedValue(mockSubscriptionData);
      mockPlan.findByPk.mockResolvedValue(mockPlanData);
      mockNotificationController.sendNewSubscriptionNotification.mockResolvedValue();

      await paymentController.handleSuccessfulPayment(mockPaymentIntent);

      expect(mockPaymentData.status).toBe('completed');
      expect(mockPaymentData.gateway_response).toBe(JSON.stringify(mockPaymentIntent));
      expect(mockPaymentData.save).toHaveBeenCalled();
      expect(mockSubscriptionData.status).toBe('active');
      expect(mockSubscriptionData.save).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockNotificationController.sendNewSubscriptionNotification).toHaveBeenCalled();
    });

    test('devrait traiter un paiement réussi pour un renouvellement', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { isRenewal: 'true' }
      };
      const mockPaymentData = {
        id: 1,
        status: 'pending',
        SubscriptionId: 1,
        userId: 1,
        amount: 10,
        save: jest.fn()
      };
      const mockSubscriptionData = {
        id: 1,
        status: 'pending',
        plan_id: 1,
        start_date: new Date(),
        end_date: new Date(),
        save: jest.fn()
      };
      const mockPlanData = { id: 1, name: 'Test Plan' };

      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      mockSubscription.findByPk.mockResolvedValue(mockSubscriptionData);
      mockPlan.findByPk.mockResolvedValue(mockPlanData);
      mockNotificationController.sendUpdateSubscriptionNotification.mockResolvedValue();

      await paymentController.handleSuccessfulPayment(mockPaymentIntent);

      expect(mockNotificationController.sendUpdateSubscriptionNotification).toHaveBeenCalledWith(
        1, 'Test Plan', mockSubscriptionData.start_date, mockSubscriptionData.end_date, 10
      );
    });

    test('devrait ignorer si le paiement n\'existe pas', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      mockPayment.findOne.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await paymentController.handleSuccessfulPayment(mockPaymentIntent);

      expect(consoleSpy).toHaveBeenCalledWith('Payment with transaction ID pi_test123 not found');
      expect(mockTransaction.commit).not.toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('devrait ignorer si le paiement est déjà complété', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      const mockPaymentData = { status: 'completed' };
      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await paymentController.handleSuccessfulPayment(mockPaymentIntent);

      expect(consoleSpy).toHaveBeenCalledWith('Payment with transaction ID pi_test123 already completed');
      expect(mockTransaction.commit).not.toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('devrait faire un rollback si la subscription n\'existe pas', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      const mockPaymentData = {
        id: 1,
        status: 'pending',
        SubscriptionId: 1,
        save: jest.fn()
      };

      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      mockSubscription.findByPk.mockResolvedValue(null);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        mockTransaction.rollback();
      });

      await paymentController.handleSuccessfulPayment(mockPaymentIntent);

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Subscription not found for payment 1');

      consoleErrorSpy.mockRestore();
    });

    test('devrait gérer les erreurs de notification sans faire échouer le processus', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { isRenewal: 'false' }
      };
      const mockPaymentData = {
        id: 1,
        status: 'pending',
        SubscriptionId: 1,
        userId: 1,
        amount: 10,
        save: jest.fn()
      };
      const mockSubscriptionData = {
        id: 1,
        status: 'pending',
        plan_id: 1,
        start_date: new Date(),
        end_date: new Date(),
        save: jest.fn()
      };
      const mockPlanData = { id: 1, name: 'Test Plan' };

      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      mockSubscription.findByPk.mockResolvedValue(mockSubscriptionData);
      mockPlan.findByPk.mockResolvedValue(mockPlanData);
      mockNotificationController.sendNewSubscriptionNotification.mockRejectedValue(new Error('Notification error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        mockTransaction.commit();
      });

      await paymentController.handleSuccessfulPayment(mockPaymentIntent);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending notification:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleFailedPayment', () => {
    test('devrait traiter un paiement échoué', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      const mockPaymentData = {
        id: 1,
        status: 'pending',
        SubscriptionId: 1,
        save: jest.fn().mockImplementation(function() {
          this.status = 'failed';
          this.gateway_response = JSON.stringify(mockPaymentIntent);
          return Promise.resolve();
        })
      };
      const mockSubscriptionData = {
        id: 1,
        status: 'pending',
        save: jest.fn().mockImplementation(function() {
          this.status = 'failed';
          return Promise.resolve();
        })
      };

      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      mockSubscription.findByPk.mockResolvedValue(mockSubscriptionData);

      await paymentController.handleFailedPayment(mockPaymentIntent);

      expect(mockPaymentData.status).toBe('failed');
      expect(mockPaymentData.gateway_response).toBe(JSON.stringify(mockPaymentIntent));
      expect(mockPaymentData.save).toHaveBeenCalled();
      expect(mockSubscriptionData.status).toBe('failed');
      expect(mockSubscriptionData.save).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('devrait ignorer si le paiement n\'existe pas', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      mockPayment.findOne.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await paymentController.handleFailedPayment(mockPaymentIntent);

      expect(consoleSpy).toHaveBeenCalledWith('Payment with transaction ID pi_test123 not found');
      expect(mockTransaction.commit).not.toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('devrait ignorer si le paiement est déjà marqué comme échoué', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      const mockPaymentData = { status: 'failed' };
      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await paymentController.handleFailedPayment(mockPaymentIntent);

      expect(consoleSpy).toHaveBeenCalledWith('Payment with transaction ID pi_test123 already marked as failed');
      expect(mockTransaction.commit).not.toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('devrait gérer le cas où la subscription n\'existe pas', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      const mockPaymentData = {
        id: 1,
        status: 'pending',
        SubscriptionId: 1,
        save: jest.fn().mockImplementation(function() {
          this.status = 'failed';
          return Promise.resolve();
        })
      };

      mockPayment.findOne.mockResolvedValue(mockPaymentData);
      mockSubscription.findByPk.mockResolvedValue(null);

      await paymentController.handleFailedPayment(mockPaymentIntent);

      expect(mockPaymentData.status).toBe('failed');
      expect(mockPaymentData.save).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('devrait gérer les erreurs et faire un rollback', async () => {
      const mockPaymentIntent = { id: 'pi_test123' };
      mockPayment.findOne.mockRejectedValue(new Error('Database error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        mockTransaction.rollback();
      });

      try {
        await paymentController.handleFailedPayment(mockPaymentIntent);
      } catch (error) {
      }

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error handling failed payment:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });
});