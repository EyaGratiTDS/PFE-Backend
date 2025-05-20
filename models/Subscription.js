const { DataTypes } = require('sequelize');
const sequelize = require("./../database/sequelize");


const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'canceled', 'pending'),
    defaultValue: 'pending'
  },
  user_id: {  
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  plan_id: {  
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'plans',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  tableName: 'subscriptions',  
});

Subscription.associate = (models) => {
  Subscription.belongsTo(models.Users, {
    foreignKey: 'user_id',
    as: 'Users'
  });
  
  Subscription.belongsTo(models.Plan, {
    foreignKey: 'plan_id',
    as: 'Plan'
  });

  Subscription.hasMany(models.Payment,{
    foreignKey: 'SubscriptionId',
    as: 'Payment',
    onDelete: 'CASCADE'
  })
};

module.exports = Subscription;