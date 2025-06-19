const { DataTypes} = require('sequelize');
const sequelize = require("./../database/sequelize");


const ActivityLog = sequelize.define('ActivityLog',{
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
  activityType: {
    type: DataTypes.ENUM(
      'login_success',
      'login_failed',
      'logout',
      'register_success',
      'login_success_with_google', 
      'login_failed_with_google', 
      'password_changed_success', 
      'password_changed_failed', 
      'password_reset_request',
      'password_reset_success',
      'email_verification_success',
      'two_factor_enabled',
      'two_factor_disabled',
      'update_profile'
    ),
    allowNull: false
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deviceType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  os: {
    type: DataTypes.STRING,
    allowNull: true
  },
  browser: {
    type: DataTypes.STRING,
    allowNull: true
  },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  tableName: 'activitylogs'
});

ActivityLog.associate = function(models) {
  ActivityLog.belongsTo(models.Users, { 
    foreignKey: 'userId',
    as: 'Users'
  });
};


module.exports = ActivityLog;
