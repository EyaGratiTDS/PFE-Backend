const { DataTypes } = require('sequelize');
const sequelize = require('./../database/sequelize');

const Notification = sequelize.define('Notifications', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM(
      'info',
      'success',
      'warning',
      'error',
      'system',
      'security',
      'Subscription',
      'feature',
      'welcome',
      'subscription_canceled',
      'subscription_expired',
      'subscription_expiration',
      'new_subscription'
    ),
    defaultValue: 'info',
    allowNull: false
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'notifications',
  createdAt: 'created_at',
});

Notification.associate = function(models) {
  Notification.belongsTo(models.Users, {
    foreignKey: 'userId',
    as: 'User'
  });
};

Notification.findByUserId = async function(userId, options = {}) {
  const defaultOptions = {
    limit: 50,
    offset: 0,
    order: [['created_at', 'DESC']],
    where: { userId }
  };
  
  return await this.findAll({
    ...defaultOptions,
    ...options
  });
};

Notification.markAsRead = async function(notificationId) {
  const notification = await this.findByPk(notificationId);
  if (!notification) {
    throw new Error('Notification not found');
  }
  
  notification.isRead = true;
  await notification.save();
  return notification;
};

Notification.markAllAsRead = async function(userId) {
  return await this.update(
    { isRead: true },
    { where: { userId, isRead: false } }
  );
};

Notification.deleteExpired = async function() {
  const now = new Date();
  return await this.destroy({
    where: {
      expiresAt: {
        [sequelize.Sequelize.Op.lt]: now
      }
    }
  });
};

Notification.createForUser = async function(userData) {
  return await this.create(userData);
};

Notification.createForUsers = async function(userIds, notificationData) {
  const notifications = userIds.map(userId => ({
    ...notificationData,
    userId
  }));
  
  return await this.bulkCreate(notifications);
};

module.exports = Notification;