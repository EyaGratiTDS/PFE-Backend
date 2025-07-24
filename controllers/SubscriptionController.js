const Subscription = require('../models/Subscription');
const cron = require('node-cron');
const { Op } = require('sequelize');
const db = require('../models');
const SubscriptionNotificationService = require('./NotificationController');

const checkExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    const expiredSubscriptions = await Subscription.findAll({
      where: {
        end_date: { [Op.lt]: now },
        status: 'active'
      }
    });

    const result = await Subscription.update(
      { status: 'expired' },
      {
        where: {
          end_date: { [Op.lt]: now },
          status: 'active'
        }
      }
    );
    
    console.log(`Updated ${result[0]} expired subscriptions`);
    
    for (const sub of expiredSubscriptions) {
      await SubscriptionNotificationService.sendSubscriptionStatusNotification(sub, 'expired');
    }
    
    return result;
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
    throw error;
  }
};

if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily subscription expiration check...');
    try {
      await checkExpiredSubscriptions();
      await SubscriptionNotificationService.checkExpiringSubscriptions(); 
    } catch (error) {
      console.error('Cron job error:', error);
    }
  });
}

const getUserSubscription = async (req, res) => {
  try {
    const userId = req.query.userId; 
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }

    

    const subscription = await Subscription.findOne({
      where: { 
        user_id: userId,
        status: 'active' 
      },
      include: [{
        model: db.Plan, 
        as: 'Plan'
      }]
    });
    if (process.env.NODE_ENV !== 'test') {
      await checkExpiredSubscriptions();
    }
    if (!subscription) {
      return res.status(200).json({ 
        success: false,
        message: 'No active subscription found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: subscription
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }

    const subscription = await Subscription.findOne({
      where: { user_id: userId, status: 'active' }
    });

    if (!subscription) {
      return res.status(404).json({ 
        success: false,
        message: 'No active subscription found' 
      });
    }

    const now = new Date();
    const endDate = new Date(subscription.end_date);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    await subscription.update({
      status: 'canceled',
      days_remaining: daysRemaining > 0 ? daysRemaining : 0,
      end_date: now
    });
    
    await SubscriptionNotificationService.sendSubscriptionStatusNotification(subscription, 'canceled');

    res.status(200).json({ 
      success: true,
      message: 'Subscription canceled successfully',
      data: {
        canceled_at: now,
        days_remaining: daysRemaining > 0 ? daysRemaining : 0
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }

    const subscriptions = await Subscription.findAll({
      where: { 
        user_id: userId 
      },
      order: [['created_at', 'DESC']] 
    });

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ 
        success: true,
        data: [],
        message: 'No subscriptions found for this user'
      });
    }

    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      status: sub.status,
      start_date: sub.start_date,
      end_date: sub.end_date,
      created_at: sub.created_at,
      plan_id: sub.plan_id,
      payment_method: sub.payment_method
    }));

    res.status(200).json({
      success: true,
      data: formattedSubscriptions
    });

  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getSubscriptionStatus = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }

    const subscription = await Subscription.findOne({
      where: { 
        user_id: userId,
        status: 'active' 
      }
    });

    if (!subscription) {
      return res.status(200).json({ 
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }

    const now = new Date();
    const daysLeft = Math.ceil((subscription.end_date - now) / (1000 * 60 * 60 * 24));
    const shouldNotify = [1, 3, 5].includes(daysLeft);

    res.status(200).json({
      success: true,
      data: {
        ...subscription.toJSON(),
        days_left: daysLeft,
        should_notify: shouldNotify,
        notification_message: shouldNotify 
          ? `Your subscription expires in ${daysLeft} day(s)` 
          : null
      }
    });

  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.findAll({
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

    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      start_date: sub.start_date,
      end_date: sub.end_date,
      status: sub.status,
      created_at: sub.created_at,
      user: {
        id: sub.user_id,
        name: sub.Users ? sub.Users.name : 'N/A',
        email: sub.Users ? sub.Users.email : 'N/A'
      },
      plan: {
        id: sub.plan_id,
        name: sub.Plan ? sub.Plan.name : 'N/A',
        price: sub.Plan ? sub.Plan.price : 'N/A'
      }
    }));

    res.status(200).json({
      success: true,
      count: formattedSubscriptions.length,
      data: formattedSubscriptions
    });
    
  } catch (error) {
    console.error('Error fetching all subscriptions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const cancelSubscriptionByAdmin = async (req, res) => {
  try {
    const { id } = req.params; 
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'Subscription ID is required' 
      });
    }

    const subscription = await Subscription.findByPk(id);

    if (!subscription) {
      return res.status(404).json({ 
        success: false,
        message: 'Subscription not found' 
      });
    }

    if (subscription.status !== 'active') {
      return res.status(400).json({ 
        success: false,
        message: 'Only active subscriptions can be canceled'
      });
    }

    const now = new Date();
    const endDate = new Date(subscription.end_date);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    await subscription.update({
      status: 'canceled',
      days_remaining: daysRemaining > 0 ? daysRemaining : 0,
      end_date: now,
    });
    
    await SubscriptionNotificationService.sendSubscriptionStatusNotification(
      subscription, 
      'canceled'
    );

    res.status(200).json({ 
      success: true,
      message: 'Subscription canceled successfully',
      data: {
        canceled_at: now,
        days_remaining: daysRemaining > 0 ? daysRemaining : 0
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const assignPlanToUser = async (req, res) => {
  try {
    const { userId, planId, duration, unit = 'days' } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Plan ID are required'
      });
    }

    const user = await db.Users.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const plan = await db.Plan.findByPk(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    const existingSubscription = await Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (plan.name.toLowerCase() === 'free') {
      if (existingSubscription) {
        await existingSubscription.update({
          status: 'canceled',
          end_date: new Date()
        });
        
        await SubscriptionNotificationService.sendSubscriptionStatusNotification(
          existingSubscription, 
          'canceled'
        );
      }
      
      return res.status(200).json({
        success: true,
        message: `User downgraded to Free plan. Active subscription canceled.`
      });
    }

    if (existingSubscription) {
      await existingSubscription.update({
        status: 'canceled',
        end_date: new Date()
      });
      
      await SubscriptionNotificationService.sendSubscriptionStatusNotification(
        existingSubscription, 
        'canceled'
      );
    }

    const startDate = new Date();
    let endDate = new Date(startDate);

    if (duration === 'unlimited') {
      endDate.setFullYear(endDate.getFullYear() + 10);
    } else if (duration && unit) {
      const durationValue = parseInt(duration);
      
      switch(unit) {
        case 'days':
          endDate.setDate(endDate.getDate() + durationValue);
          break;
        case 'months':
          endDate.setMonth(endDate.getMonth() + durationValue);
          break;
        case 'years':
          endDate.setFullYear(endDate.getFullYear() + durationValue);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid duration unit'
          });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Duration or unit missing'
      });
    }

    const newSubscription = await Subscription.create({
      user_id: userId,
      plan_id: planId,
      start_date: startDate,
      end_date: endDate,
      status: 'active'
    });

    if (SubscriptionNotificationService.sendAdminAssignedNotification) {
      const durationText = duration === 'unlimited' 
        ? 'unlimited' 
        : `${duration} ${unit}`;
        
      await SubscriptionNotificationService.sendAdminAssignedNotification(
        user, 
        plan, 
        durationText
      );
    }

    res.status(201).json({
      success: true,
      message: `Plan "${plan.name}" (${duration} ${unit}) successfully assigned to user`,
      data: newSubscription
    });

  } catch (error) {
    console.error('Error assigning plan to user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  cancelSubscription,
  getUserSubscription,
  checkExpiredSubscriptions,
  getUserSubscriptions, 
  getSubscriptionStatus,
  getAllSubscriptions,
  cancelSubscriptionByAdmin,
  assignPlanToUser
};