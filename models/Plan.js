const { DataTypes} = require('sequelize');
const sequelize = require("./../database/sequelize"); 


const Plan = sequelize.define('Plan',{
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  duration_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  features: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    get() {
      const rawValue = this.getDataValue('features');
      try {
        return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      } catch {
        return [];
      }
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
}, {
  tableName: 'plans',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Plan.associate = (models) => {
  Plan.hasMany(models.Subscription, {
    foreignKey: 'plan_id',
    as: 'Subscription'
  });
};

Plan.prototype.getVCardLimit = function() {
  const vcardFeature = this.features.find(f => 
    f.toLowerCase().includes('vcard') && !f.toLowerCase().includes('block')
  );
  
  if (!vcardFeature) return 1; 
  
  if (vcardFeature.toLowerCase().includes('unlimited')) return -1;
  
  const match = vcardFeature.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

module.exports = Plan;