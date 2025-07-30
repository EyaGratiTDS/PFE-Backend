const {
  cancelSubscription,
  getUserSubscription,
  checkExpiredSubscriptions,
  getUserSubscriptions,
  getSubscriptionStatus,
  getAllSubscriptions,
  cancelSubscriptionByAdmin,
  assignPlanToUser
} = require('../../controllers/SubscriptionController');

const { Op } = require('sequelize');

jest.mock('../../models/Subscription');
jest.mock('../../models');
jest.mock('../../controllers/NotificationController');
jest.mock('node-cron');

const Subscription = require('../../models/Subscription');
const db = require('../../models');
const SubscriptionNotificationService = require('../../controllers/NotificationController');

describe('Subscription Controller', () => {
  let req, res, mockSubscription, mockUser, mockPlan;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockSubscription = {
      id: 1,
      user_id: 123,
      plan_id: 1,
      start_date: new Date('2025-01-01'),
      end_date: new Date('2025-02-01'),
      status: 'active',
      created_at: new Date('2025-01-01'),
      payment_method: 'card',
      toJSON: jest.fn().mockReturnValue({
        id: 1,
        user_id: 123,
        plan_id: 1,
        status: 'active'
      }),
      update: jest.fn(),
      Plan: {
        name: 'Pro',
        price: 29.99
      },
      Users: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    };

    mockUser = {
      id: 123,
      name: 'John Doe',
      email: 'john@example.com'
    };

    mockPlan = {
      id: 1,
      name: 'Pro',
      price: 29.99
    };

    Subscription.findAll = jest.fn();
    Subscription.findOne = jest.fn();
    Subscription.findByPk = jest.fn();
    Subscription.create = jest.fn();
    Subscription.update = jest.fn();
    
    db.Users = {
      findByPk: jest.fn()
    };
    
    db.Plan = {
      findByPk: jest.fn()
    };

    // Mock des services de notification
    SubscriptionNotificationService.sendSubscriptionStatusNotification = jest.fn();
    SubscriptionNotificationService.checkExpiringSubscriptions = jest.fn();
    SubscriptionNotificationService.sendAdminAssignedNotification = jest.fn();

    // Mock console pour éviter le spam
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkExpiredSubscriptions', () => {
    test('should update expired subscriptions and send notifications', async () => {
      const expiredSubs = [mockSubscription];
      Subscription.findAll.mockResolvedValue(expiredSubs);
      Subscription.update.mockResolvedValue([1]);

      const result = await checkExpiredSubscriptions();

      expect(Subscription.findAll).toHaveBeenCalledWith({
        where: {
          end_date: { [Op.lt]: expect.any(Date) },
          status: 'active'
        }
      });

      expect(Subscription.update).toHaveBeenCalledWith(
        { status: 'expired' },
        {
          where: {
            end_date: { [Op.lt]: expect.any(Date) },
            status: 'active'
          }
        }
      );

      expect(SubscriptionNotificationService.sendSubscriptionStatusNotification)
        .toHaveBeenCalledWith(mockSubscription, 'expired');

      expect(result).toEqual([1]);
    });

    test('should handle errors in checkExpiredSubscriptions', async () => {
      const error = new Error('Database error');
      Subscription.findAll.mockRejectedValue(error);

      await expect(checkExpiredSubscriptions()).rejects.toThrow('Database error');
      expect(console.error).toHaveBeenCalledWith('Error checking expired subscriptions:', error);
    });
  });

  describe('getUserSubscription', () => {
    test('should return user subscription successfully', async () => {
      req.query.userId = '123';
      Subscription.findOne.mockResolvedValue(mockSubscription);

      await getUserSubscription(req, res);

      expect(Subscription.findOne).toHaveBeenCalledWith({
        where: {
          user_id: '123',
          status: 'active'
        },
        include: [{
          model: db.Plan,
          as: 'Plan'
        }]
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSubscription
      });
    });

    test('should return 400 when userId is missing', async () => {
      await getUserSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required'
      });
    });

    test('should return message when no active subscription found', async () => {
      req.query.userId = '123';
      Subscription.findOne.mockResolvedValue(null);

      await getUserSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No active subscription found'
      });
    });

    test('should handle database errors', async () => {
      req.query.userId = '123';
      const error = new Error('Database error');
      Subscription.findOne.mockRejectedValue(error);

      await getUserSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        details: undefined
      });
    });
  });

  describe('cancelSubscription', () => {
    test('should cancel subscription successfully', async () => {
      req.body.userId = 123;
      const endDate = new Date('2025-02-01');
      const now = new Date('2025-01-15');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
      
      const subscriptionWithEndDate = {
        ...mockSubscription,
        end_date: endDate,
        update: jest.fn().mockResolvedValue(true)
      };
      
      Subscription.findOne.mockResolvedValue(subscriptionWithEndDate);

      await cancelSubscription(req, res);

      expect(Subscription.findOne).toHaveBeenCalledWith({
        where: { user_id: 123, status: 'active' }
      });

      expect(subscriptionWithEndDate.update).toHaveBeenCalledWith({
        status: 'canceled',
        days_remaining: expect.any(Number),
        end_date: expect.any(Date)
      });

      expect(SubscriptionNotificationService.sendSubscriptionStatusNotification)
        .toHaveBeenCalledWith(subscriptionWithEndDate, 'canceled');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Subscription canceled successfully',
        data: {
          canceled_at: expect.any(Date),
          days_remaining: expect.any(Number)
        }
      });
    });

    test('should return 400 when userId is missing', async () => {
      await cancelSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required'
      });
    });

    test('should return 404 when no active subscription found', async () => {
      req.body.userId = 123;
      Subscription.findOne.mockResolvedValue(null);

      await cancelSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No active subscription found'
      });
    });
  });

  describe('getUserSubscriptions', () => {
    test('should return user subscriptions successfully', async () => {
      req.query.userId = '123';
      const subscriptions = [mockSubscription];
      Subscription.findAll.mockResolvedValue(subscriptions);

      await getUserSubscriptions(req, res);

      expect(Subscription.findAll).toHaveBeenCalledWith({
        where: { user_id: '123' },
        order: [['created_at', 'DESC']]
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{
          id: mockSubscription.id,
          status: mockSubscription.status,
          start_date: mockSubscription.start_date,
          end_date: mockSubscription.end_date,
          created_at: mockSubscription.created_at,
          plan_id: mockSubscription.plan_id,
          payment_method: mockSubscription.payment_method
        }]
      });
    });

    test('should return empty array when no subscriptions found', async () => {
      req.query.userId = '123';
      Subscription.findAll.mockResolvedValue([]);

      await getUserSubscriptions(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        message: 'No subscriptions found for this user'
      });
    });

    test('should return 400 when userId is missing', async () => {
      await getUserSubscriptions(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required'
      });
    });
  });

  describe('getSubscriptionStatus', () => {
    test('should return subscription status with days left and notification info', async () => {
      req.query.userId = '123';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3); // 3 days remaining
      
      const subscription = {
        ...mockSubscription,
        end_date: futureDate,
        toJSON: jest.fn().mockReturnValue({
          id: 1,
          user_id: 123,
          status: 'active'
        })
      };
      
      Subscription.findOne.mockResolvedValue(subscription);

      await getSubscriptionStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          user_id: 123,
          status: 'active',
          days_left: 3,
          should_notify: true,
          notification_message: 'Your subscription expires in 3 day(s)'
        }
      });
    });

    test('should return null when no active subscription found', async () => {
      req.query.userId = '123';
      Subscription.findOne.mockResolvedValue(null);

      await getSubscriptionStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    });
  });

  describe('getAllSubscriptions', () => {
    test('should return all subscriptions with user and plan info', async () => {
      const subscriptions = [mockSubscription];
      Subscription.findAll.mockResolvedValue(subscriptions);

      await getAllSubscriptions(req, res);

      expect(Subscription.findAll).toHaveBeenCalledWith({
        include: [
          {
            model: db.Users,
            as: 'Users',
            attributes: ['name', 'email']
          },
          {
            model: db.Plan,
            as: 'Plan',
            attributes: ['name', 'price']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: [{
          id: mockSubscription.id,
          start_date: mockSubscription.start_date,
          end_date: mockSubscription.end_date,
          status: mockSubscription.status,
          created_at: mockSubscription.created_at,
          user: {
            id: mockSubscription.user_id,
            name: mockSubscription.Users.name,
            email: mockSubscription.Users.email
          },
          plan: {
            id: mockSubscription.plan_id,
            name: mockSubscription.Plan.name,
            price: mockSubscription.Plan.price
          }
        }]
      });
    });
  });

  describe('cancelSubscriptionByAdmin', () => {
    test('should cancel subscription by admin successfully', async () => {
      req.params.id = '1';
      const subscription = {
        ...mockSubscription,
        update: jest.fn().mockResolvedValue(true)
      };
      Subscription.findByPk.mockResolvedValue(subscription);

      await cancelSubscriptionByAdmin(req, res);

      expect(Subscription.findByPk).toHaveBeenCalledWith('1');
      expect(subscription.update).toHaveBeenCalledWith({
        status: 'canceled',
        days_remaining: expect.any(Number),
        end_date: expect.any(Date)
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Subscription canceled successfully',
        data: {
          canceled_at: expect.any(Date),
          days_remaining: expect.any(Number)
        }
      });
    });

    test('should return 400 when subscription ID is missing', async () => {
      await cancelSubscriptionByAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Subscription ID is required'
      });
    });

    test('should return 404 when subscription not found', async () => {
      req.params.id = '999';
      Subscription.findByPk.mockResolvedValue(null);

      await cancelSubscriptionByAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Subscription not found'
      });
    });

    test('should return 400 when subscription is not active', async () => {
      req.params.id = '1';
      const inactiveSubscription = { ...mockSubscription, status: 'expired' };
      Subscription.findByPk.mockResolvedValue(inactiveSubscription);

      await cancelSubscriptionByAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only active subscriptions can be canceled'
      });
    });
  });

  describe('assignPlanToUser', () => {
    beforeEach(() => {
      db.Users.findByPk.mockResolvedValue(mockUser);
      db.Plan.findByPk.mockResolvedValue(mockPlan);
      Subscription.findOne.mockResolvedValue(null);
      Subscription.create.mockResolvedValue(mockSubscription);
    });

    test('should assign plan to user successfully', async () => {
      req.body = {
        userId: 123,
        planId: 1,
        duration: '30',
        unit: 'days'
      };

      await assignPlanToUser(req, res);

      expect(db.Users.findByPk).toHaveBeenCalledWith(123);
      expect(db.Plan.findByPk).toHaveBeenCalledWith(1);
      expect(Subscription.create).toHaveBeenCalledWith({
        user_id: 123,
        plan_id: 1,
        start_date: expect.any(Date),
        end_date: expect.any(Date),
        status: 'active'
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Plan "Pro" (30 days) successfully assigned to user',
        data: mockSubscription
      });
    });

    test('should handle free plan assignment', async () => {
      req.body = {
        userId: 123,
        planId: 1,
        duration: '30',
        unit: 'days'
      };

      const freePlan = { ...mockPlan, name: 'Free' };
      db.Plan.findByPk.mockResolvedValue(freePlan);

      const existingSubscription = {
        ...mockSubscription,
        update: jest.fn().mockResolvedValue(true)
      };
      Subscription.findOne.mockResolvedValue(existingSubscription);

      await assignPlanToUser(req, res);

      expect(existingSubscription.update).toHaveBeenCalledWith({
        status: 'canceled',
        end_date: expect.any(Date)
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User downgraded to Free plan. Active subscription canceled.'
      });
    });

    test('should handle unlimited duration', async () => {
      req.body = {
        userId: 123,
        planId: 1,
        duration: 'unlimited',
        unit: 'days'
      };

      await assignPlanToUser(req, res);

      expect(Subscription.create).toHaveBeenCalledWith({
        user_id: 123,
        plan_id: 1,
        start_date: expect.any(Date),
        end_date: expect.any(Date), // Should be 10 years from now
        status: 'active'
      });
    });

    test('should handle different time units', async () => {
      req.body = {
        userId: 123,
        planId: 1,
        duration: '1',
        unit: 'months'
      };

      await assignPlanToUser(req, res);

      expect(Subscription.create).toHaveBeenCalled();
    });

    test('should return 400 when required fields are missing', async () => {
      req.body = { userId: 123 }; // Missing planId

      await assignPlanToUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID and Plan ID are required'
      });
    });

    test('should return 404 when user not found', async () => {
      req.body = { userId: 999, planId: 1 };
      db.Users.findByPk.mockResolvedValue(null);

      await assignPlanToUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    test('should return 404 when plan not found', async () => {
      req.body = { userId: 123, planId: 999 };
      db.Plan.findByPk.mockResolvedValue(null);

      await assignPlanToUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Plan not found'
      });
    });

    test('should return 400 for invalid duration unit', async () => {
      req.body = {
        userId: 123,
        planId: 1,
        duration: '30',
        unit: 'invalid'
      };

      await assignPlanToUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid duration unit'
      });
    });

    test('should cancel existing subscription before creating new one', async () => {
      req.body = {
        userId: 123,
        planId: 1,
        duration: '30',
        unit: 'days'
      };

      const existingSubscription = {
        ...mockSubscription,
        update: jest.fn().mockResolvedValue(true)
      };
      Subscription.findOne.mockResolvedValue(existingSubscription);

      await assignPlanToUser(req, res);

      expect(existingSubscription.update).toHaveBeenCalledWith({
        status: 'canceled',
        end_date: expect.any(Date)
      });

      expect(SubscriptionNotificationService.sendSubscriptionStatusNotification)
        .toHaveBeenCalledWith(existingSubscription, 'canceled');

      expect(Subscription.create).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      req.query.userId = '123';
      const error = new Error('Database connection failed');
      Subscription.findOne.mockRejectedValue(error);

      await getUserSubscription(req, res);

      expect(console.error).toHaveBeenCalledWith('Error:', error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        details: undefined // Should be undefined in non-development environment
      });
    });

    test('should include error details in development environment', async () => {
      process.env.NODE_ENV = 'development';
      req.query.userId = '123';
      const error = new Error('Database connection failed');
      Subscription.findOne.mockRejectedValue(error);

      await getUserSubscription(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        details: 'Database connection failed'
      });

      delete process.env.NODE_ENV;
    });
  });
});