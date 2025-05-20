const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const db = require('../models');
const User = require('../models/User');


const initNotificationService = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running daily notification cleanup...');
      await Notification.deleteExpired();
    } catch (error) {
      console.error('Error in notification cleanup cron job:', error);
    }
  });

  console.log('Notification service initialized');
};

const setupNotificationEvents = (app) => {
  if (!app || !app.locals) {
    console.error('Invalid app object provided to setupNotificationEvents');
    return {
      broadcastToUser: () => console.error('Broadcast function not properly initialized')
    };
  }
  
  return {
    broadcastToUser: (userId, data) => {
      if (app.locals.wsBroadcastToUser) {
        console.log(`Broadcasting notification event to user ${userId}:`, data.type);
        app.locals.wsBroadcastToUser(userId, data);
      } else {
        console.error('wsBroadcastToUser function not available in app.locals');
      }
    }
  };
};


const getUserNotifications = async (req, res) => {
  try {
    const { limit = 10, offset = 0, unreadOnly } = req.query;
    const userId = req.user.id;

    console.log(`Fetching notifications for user ${userId}, limit: ${limit}, offset: ${offset}, unreadOnly: ${unreadOnly}`);

    const where = { userId };
    if (unreadOnly === 'true') where.isRead = false;

    const notifications = await Notification.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    const totalUnread = await Notification.count({ where: { userId, isRead: false } });

    console.log(`Found ${notifications.length} notifications, ${totalUnread} unread`);

    res.json({
      success: true,
      data: notifications,
      meta: { totalUnread }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};


const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required'
      });
    }

    console.log(`Marking notification ${notificationId} as read for user ${userId}`);

    const notification = await Notification.markAsRead(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (req.app.locals.wsBroadcastToUser) {
      req.app.locals.wsBroadcastToUser(userId, {
        type: 'NOTIFICATION_READ',
        notificationId: notification.id,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('WebSocket broadcast function not available');
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`Marking all notifications as read for user ${userId}`);

    const result = await Notification.markAllAsRead(userId);

    if (req.app.locals.wsBroadcastToUser) {
      req.app.locals.wsBroadcastToUser(userId, {
        type: 'ALL_NOTIFICATIONS_READ',
        userId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('WebSocket broadcast function not available');
    }

    res.status(200).json({
      success: true,
      data: {
        markedCount: result[0]
      }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required'
      });
    }
    console.log(`Deleting notification ${notificationId} for user ${userId}`);

    const result = await Notification.destroy({
      where: { id: notificationId, userId }
    });

    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (req.app.locals.wsBroadcastToUser) {
      req.app.locals.wsBroadcastToUser(userId, {
        type: 'NOTIFICATION_DELETED',
        notificationId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('WebSocket broadcast function not available');
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const sendWelcomeNotification = async (userId, userName) => {
  try {
    console.log(`Sending welcome notification to new user ${userId} (${userName})`);
    
    const notification = await Notification.createForUser({
      userId,
      title: 'Welcome to Our Platform!',
      message: `Hello ${userName}, welcome to our community! We're thrilled to have you with us.`,
      type: 'welcome',
      isRead: false,
      metadata: {
        event: 'user_registration',
        welcomeDate: new Date().toISOString()
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(userId, {
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          created_at: notification.created_at,
          type: notification.type,
          metadata: notification.metadata
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('Global WebSocket broadcast function not available');
    }

    return notification;
  } catch (error) {
    console.error('Failed to send welcome notification:', error);
    throw error;
  }
};

const sendSubscriptionStatusNotification = async (subscription, status) => {
  try {
    let title, message;

    switch (status) {
      case 'canceled':
        title = 'Subscription Canceled';
        message = 'Your subscription has been successfully canceled.';
        break;
      case 'expired':
        title = 'Subscription Expired';
        message = 'Your subscription has expired. Please renew to continue enjoying our services.';
        break;
      default:
        title = 'Subscription Update';
        message = `Your subscription status has been updated to: ${status}.`;
    }

    console.log(`Sending ${status} subscription notification to user ${subscription.user_id}`);

    const notification = await Notification.createForUser({
      userId: subscription.user_id,
      title: title,
      message: message,
      type: `subscription_${status}`,
      isRead: false,
      metadata: {
        event: `subscription_${status}`,
        subscription_id: subscription.id,
        status: status
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(subscription.user_id, {
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          created_at: notification.created_at,
          metadata: notification.metadata,
          type: notification.type
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Sent ${status} notification for subscription ${subscription.id}`);
    return notification;
  } catch (error) {
    console.error('Error sending subscription status notification:', error);
    throw error;
  }
};

const sendSubscriptionExpirationNotification = async (subscription, daysLeft) => {
  try {
    const plan = await db.Plan.findByPk(subscription.plan_id);
    const message = `Your ${plan ? plan.name : ''} subscription expires in ${daysLeft} day(s). Renew now to continue enjoying our services.`;

    const notification = await Notification.createForUser({
      userId: subscription.user_id,
      title: 'Subscription Expiration Reminder',
      message: message,
      type: 'subscription_expiration',
      isRead: false,
      metadata: {
        event: 'subscription_expiration',
        days_left: daysLeft,
        subscription_id: subscription.id
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(subscription.user_id, {
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.created_at,
          metadata: notification.metadata
        }
      });
    }

    console.log(`Notification sent for subscription ${subscription.id} (${daysLeft} days left)`);
    return notification;
  } catch (error) {
    console.error('Error sending subscription expiration notification:', error);
    throw error;
  }
};

const checkExpiringSubscriptions = async () => {
  try {
    const now = new Date();
    const upcomingDays = [1, 3, 5];

    for (const days of upcomingDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);

      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const subscriptions = await Subscription.findAll({
        where: {
          end_date: {
            [Op.between]: [startOfDay, endOfDay]
          },
          status: 'active'
        },
        include: [{
          model: db.Plan,
          as: 'Plan'
        }]
      });

      for (const subscription of subscriptions) {
        const existingNotification = await Notification.findOne({
          where: {
            userId: subscription.user_id,
            type: 'subscription_expiration',
            'metadata.days_left': days,
            'metadata.subscription_id': subscription.id
          }
        });

        if (!existingNotification) {
          await sendSubscriptionExpirationNotification(subscription, days);
        }
      }
    }

    console.log('Finished checking expiring subscriptions');
  } catch (error) {
    console.error('Error in checkExpiringSubscriptions:', error);
    throw error;
  }
};

const sendNewSubscriptionNotification = async (userId, planName, startDate, endDate) => {
  try {
    const notification = await Notification.createForUser({
      userId,
      title: 'New Subscription Activated',
      message: `Your ${planName} subscription has been activated! Valid from ${startDate.toDateString()} to ${endDate.toDateString()}.`,
      type: 'new_subscription',
      isRead: false,
      metadata: {
        event: 'subscription_activated',
        plan_name: planName,
        start_date: startDate,
        end_date: endDate
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(userId, {
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.created_at,
          metadata: notification.metadata
        }
      });
    }

    console.log(`New subscription notification sent to user ${userId}`);
    return notification;
  } catch (error) {
    console.error('Error sending new subscription notification:', error);
    throw error;
  }
};

const sendUpdateSubscriptionNotification = async (userId, planName, startDate, endDate, totalAmount) => {
  try {
    const notification = await Notification.createForUser({
      userId,
      title: 'Subscription Update',
      message: `New total amount: $${totalAmount} for ${planName} until ${endDate.toISOString().split('T')[0]}`,
      type: 'subscription_update',
      isRead: false,
      metadata: {
        event: 'subscription_update',
        plan_name: planName,
        start_date: startDate,
        end_date: endDate
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(userId, {
        type: 'NEW_NOTIFICATION',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.created_at,
          metadata: notification.metadata
        }
      });
    }

    console.log(`New subscription notification sent to user ${userId}`);
    return notification;
  } catch (error) {
    console.error('Error sending new subscription notification:', error);
    throw error;
  }
};

const sendTwoFactorEnabledNotification = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const notification = await Notification.createForUser({
      userId,
      title: '2FA Enabled Successfully',
      message: `Two-factor authentication has been activated for your account ${user.email}.`,
      type: 'security_update',
      isRead: false,
      metadata: {
        event: 'two_factor_enabled',
        enabled_at: new Date().toISOString()
      },
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) 
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(userId, {
        type: 'NEW_SECURITY_NOTIFICATION',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          metadata: notification.metadata
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Error sending 2FA enabled notification:', error);
    throw error;
  }
};

const sendTwoFactorDisabledNotification = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const notification = await Notification.createForUser({
      userId,
      title: '2FA Disabled Successfully',
      message: `Two-factor authentication has been deactivated for your account ${user.email}.`,
      type: 'security_update',
      isRead: false,
      metadata: {
        event: 'two_factor_disabled',
        disabled_at: new Date().toISOString()
      },
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(userId, {
        type: 'NEW_SECURITY_NOTIFICATION',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          metadata: notification.metadata
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Error sending 2FA disabled notification:', error);
    throw error;
  }
};

const sendVcardViewNotification = async (ownerId, viewerName, vcardId, vcardName) => {
  try {
    const notification = await Notification.createForUser({
      userId: ownerId,
      title: 'New view on your VCard',
      message: `${viewerName} viewed your ${vcardName} VCard`,
      type: 'vcard_view',
      isRead: false,
      metadata: {
        event: 'vcard_view',
        vcardId: vcardId,
        viewer: viewerName,
        timestamp: new Date().toISOString()
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    });

    if (global.wsBroadcastToUser) {
      global.wsBroadcastToUser(ownerId, {
        type: 'NEW_VCARD_VIEW',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Error sending vcard view notification:', error);
    throw error;
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  initNotificationService,
  sendWelcomeNotification,
  checkExpiringSubscriptions,
  sendSubscriptionStatusNotification,
  sendSubscriptionExpirationNotification,
  sendNewSubscriptionNotification,
  setupNotificationEvents,
  sendUpdateSubscriptionNotification,
  sendTwoFactorDisabledNotification,
  sendTwoFactorEnabledNotification,
  sendVcardViewNotification
};

initNotificationService();
const notificationEvents = setupNotificationEvents(require('express')());
require('express')().locals.notificationEvents = notificationEvents;