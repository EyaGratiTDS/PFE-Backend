const { Op } = require('sequelize');
const cron = require('node-cron');
const Notification = require('../models/Notification');
const Subscription = require('../models/Subscription');
const db = require('../models');
const User = require('../models/User');

const NOTIFICATION_TYPES = {
  SECURITY: 'security_update',
  WELCOME: 'welcome',
  SUBSCRIPTION: {
    EXPIRATION: 'subscription_expiration',
    UPDATE: 'subscription_update',
    NEW: 'new_subscription'
  },
  VCARD_VIEW: 'vcard_view'
};

const EXPIRATION_TIMES = {
  SHORT: 7 * 24 * 60 * 60 * 1000,
  STANDARD: 30 * 24 * 60 * 60 * 1000,
  LONG: 90 * 24 * 60 * 60 * 1000
};

const createNotification = async (userId, config) => {
  const notification = await Notification.createForUser({
    userId,
    isRead: false,
    expiresAt: new Date(Date.now() + (config.expiresIn || EXPIRATION_TIMES.STANDARD)),
    ...config
  });

  return { ...notification.get({ plain: true }), created_at: notification.created_at };
};

const broadcast = (userId, data, type = 'NEW_NOTIFICATION') => {
  if (!global.wsBroadcastToUser) {
    console.warn('WebSocket broadcast unavailable');
    return;
  }
  
  global.wsBroadcastToUser(userId, { type, ...data });
};

const handleOperation = async (res, operation, context) => {
  try {
    const result = await operation();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

const initNotificationService = () => {
  if (process.env.NODE_ENV !== 'test') {
    cron.schedule('0 0 * * *', () => {
      console.log('Running notification cleanup...');
      Notification.deleteExpired().catch(console.error);
    });
    console.log('Notification service initialized');
  }
};

const setupNotificationEvents = (app) => ({
  broadcastToUser: (userId, data) => 
    app.locals.wsBroadcastToUser?.(userId, data) || 
    console.error('WebSocket broadcast not initialized')
});

const getUserNotifications = async (req, res) => handleOperation(res, async () => {
  const { limit = 10, offset = 0, unreadOnly } = req.query;
  const where = { 
    userId: req.user.id, 
    ...(unreadOnly === 'true' && { isRead: false }) 
  };

  const [notifications, totalUnread] = await Promise.all([
    Notification.findAll({ 
      where,
      limit: Number(limit),
      offset: Number(offset),
      order: [['created_at', 'DESC']]
    }),
    Notification.count({ where: { ...where, isRead: false } })
  ]);

  return { data: notifications, meta: { totalUnread } };
}, 'Fetch notifications');

const markNotificationAsRead = async (req, res) => handleOperation(res, async () => {
  const notification = await Notification.markAsRead(req.params.notificationId);
  if (!notification) throw new Error('Notification not found');

  broadcast(req.user.id, {
    notificationId: notification.id,
    timestamp: new Date().toISOString()
  }, 'NOTIFICATION_READ');

  return { data: notification };
}, 'Mark as read');

const markAllNotificationsAsRead = async (req, res) => handleOperation(res, async () => {
  const result = await Notification.markAllAsRead(req.user.id);
  broadcast(req.user.id, { timestamp: new Date().toISOString() }, 'ALL_NOTIFICATIONS_READ');
  return { markedCount: result[0] };
}, 'Mark all read');

const deleteNotification = async (req, res) => handleOperation(res, async () => {
  const result = await Notification.destroy({
    where: { id: req.params.notificationId, userId: req.user.id }
  });
  if (result === 0) throw new Error('Notification not found');
  
  broadcast(req.user.id, { 
    notificationId: req.params.notificationId 
  }, 'NOTIFICATION_DELETED');
  
  return { message: 'Notification deleted' };
}, 'Delete notification');

const generateSecurityNotification = async (userId, config) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  return createNotification(userId, {
    ...config,
    type: NOTIFICATION_TYPES.SECURITY,
    metadata: { ...config.metadata, event: config.eventType }
  });
};

const sendWelcomeNotification = async (userId, userName) => {
  const notification = await createNotification(userId, {
    title: 'Welcome to Our Platform!',
    message: `Hello ${userName}, welcome to our community!`,
    type: NOTIFICATION_TYPES.WELCOME,
    metadata: { event: 'user_registration' }
  });

  broadcast(userId, { notification });
  return notification;
};

const sendPasswordChangeNotification = async (userId) => {
  const notification = await generateSecurityNotification(userId, {
    title: 'Password Changed Successfully',
    message: 'Account password updated. Contact support if unauthorized.',
    eventType: 'password_changed',
    metadata: { changed_at: new Date().toISOString() }
  });

  broadcast(userId, { notification }, 'NEW_SECURITY_NOTIFICATION');
  return notification;
};

const sendSubscriptionStatusNotification = async (subscription, status) => {
  const messages = {
    canceled: ['Subscription Canceled', 'Successfully canceled'],
    expired: ['Subscription Expired', 'Please renew to continue services'],
    default: ['Subscription Update', `Status updated to: ${status}`]
  };

  const [title, message] = messages[status] || messages.default;
  const notification = await createNotification(subscription.user_id, {
    title,
    message,
    type: `subscription_${status}`,
    metadata: { 
      event: `subscription_${status}`,
      subscription_id: subscription.id 
    }
  });

  broadcast(subscription.user_id, { notification });
  return notification;
};

const sendSubscriptionExpirationNotification = async (subscription, daysLeft) => {
  const plan = await db.Plan.findByPk(subscription.plan_id);
  const notification = await createNotification(subscription.user_id, {
    title: 'Subscription Expiration Reminder',
    message: `Your ${plan?.name || ''} subscription expires in ${daysLeft} day(s)`,
    type: NOTIFICATION_TYPES.SUBSCRIPTION.EXPIRATION,
    expiresIn: EXPIRATION_TIMES.SHORT,
    metadata: { 
      event: 'subscription_expiration',
      days_left: daysLeft 
    }
  });

  broadcast(subscription.user_id, { notification });
  return notification;
};

const checkExpiringSubscriptions = async () => {
  try {
    const now = new Date();
    
    for (const days of [1, 3, 5]) {
      const targetDate = new Date(now.setDate(now.getDate() + days));
      const [start, end] = [
        new Date(targetDate.setHours(0, 0, 0, 0)),
        new Date(targetDate.setHours(23, 59, 59, 999))
      ];

      const subscriptions = await Subscription.findAll({
        where: { end_date: { [Op.between]: [start, end] }, status: 'active' },
        include: [{ model: db.Plan, as: 'Plan' }]
      });

      for (const sub of subscriptions) {
        const exists = await Notification.findOne({
          where: { 
            userId: sub.user_id,
            type: NOTIFICATION_TYPES.SUBSCRIPTION.EXPIRATION,
            'metadata.days_left': days
          }
        });
        
        if (!exists) await sendSubscriptionExpirationNotification(sub, days);
      }
    }
  } catch (error) {
    console.error('Subscription check error:', error);
  }
};

const sendNewSubscriptionNotification = async (userId, planName, startDate, endDate) => {
  const notification = await createNotification(userId, {
    title: 'New Subscription Activated',
    message: `${planName} subscription active from ${startDate.toDateString()} to ${endDate.toDateString()}`,
    type: NOTIFICATION_TYPES.SUBSCRIPTION.NEW,
    metadata: { 
      event: 'subscription_activated',
      plan_name: planName 
    }
  });

  broadcast(userId, { notification });
  return notification;
};

const sendTwoFactorNotification = async (userId, action) => {
  const user = await User.findByPk(userId);
  const notification = await generateSecurityNotification(userId, {
    title: `2FA ${action === 'enable' ? 'Enabled' : 'Disabled'} Successfully`,
    message: `Two-factor authentication ${action === 'enable' ? 'activated' : 'deactivated'} for ${user.email}`,
    eventType: `two_factor_${action}ed`,
    expiresIn: EXPIRATION_TIMES.LONG
  });

  broadcast(userId, { notification }, 'NEW_SECURITY_NOTIFICATION');
  return notification;
};

const sendVcardViewNotification = async (ownerId, viewerName, vcardId) => {
  const notification = await createNotification(ownerId, {
    title: 'New VCard View',
    message: `${viewerName} viewed your VCard`,
    type: NOTIFICATION_TYPES.VCARD_VIEW,
    expiresIn: EXPIRATION_TIMES.SHORT,
    metadata: { 
      event: 'vcard_view',
      vcardId,
      viewer: viewerName 
    }
  });

  broadcast(ownerId, { notification }, 'NEW_VCARD_VIEW');
  return notification;
};

module.exports = {
  initNotificationService,
  setupNotificationEvents,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  sendWelcomeNotification,
  sendPasswordChangeNotification,
  sendSubscriptionStatusNotification,
  sendSubscriptionExpirationNotification,
  checkExpiringSubscriptions,
  sendNewSubscriptionNotification,
  sendTwoFactorEnabledNotification: (userId) => sendTwoFactorNotification(userId, 'enable'),
  sendTwoFactorDisabledNotification: (userId) => sendTwoFactorNotification(userId, 'disable'),
  sendVcardViewNotification
};

if (process.env.NODE_ENV !== 'test') {
  initNotificationService();
}
