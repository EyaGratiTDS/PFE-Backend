
const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Quote = sequelize.define('Quote', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  service: {
    type: DataTypes.ENUM(
      'Digital business cards',
      'analytics & Tracking',
      'custom design',
      'entreprise solutions'
    ),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'quotes',
  timestamps: true,
});

module.exports = Quote;
