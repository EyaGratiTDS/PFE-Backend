const { DataTypes } = require('sequelize');
const sequelize = require("./../database/sequelize");

const WebNotifications = sequelize.define('WebNotifications', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  endpoint: {
    type: DataTypes.STRING,
    allowNull: true 
  },
  keys: {
    type: DataTypes.JSON,
    allowNull: true,
    validate: {
      isValidKeys(value) {
        if (value && (typeof value !== 'object' || typeof value.p256dh !== 'string' || typeof value.auth !== 'string')) {
          throw new Error('keys doit être un objet avec les attributs p256dh et auth de type string');
        }
      }
    }
  },
  expirationTime: {
    type: DataTypes.DATE
  },
}, {
  timestamps: true,
  tableName: 'web_notifications',
  createdAt: 'created_at',
  updatedAt: false,
});

WebNotifications.associate = function(models) {
  WebNotifications.belongsTo(models.Users, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE'
  });
};


module.exports = WebNotifications;