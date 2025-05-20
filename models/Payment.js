const { DataTypes} = require('sequelize');
const sequelize = require("./../database/sequelize"); 

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    transaction_id: {
        type: DataTypes.STRING,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    currency: {
        type: DataTypes.STRING,
        defaultValue: 'USD'
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending'
    },
    gateway_response: {
        type: DataTypes.JSON,
        allowNull: true
    },
    payment_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    refund_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    userId: {  
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
    },
    SubscriptionId: {  
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'subscriptions',
          key: 'id'
        }
      }
    }, {
        tableName: 'payment',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });
    
    Payment.associate = (models) => {
      Payment.belongsTo(models.Users, {
        foreignKey: 'userId',
        as: 'Users'
      });
      Payment.belongsTo(models.Subscription, {
        foreignKey: 'SubscriptionId',
        as: 'Subscription'
      });
    };
    
    module.exports = Payment;