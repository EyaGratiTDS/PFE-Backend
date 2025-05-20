const { DataTypes } = require('sequelize');
const sequelize = require("./../database/sequelize");
const crypto = require('crypto');

const ApiKey = sequelize.define('ApiKey', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  key: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  prefix: {
    type: DataTypes.STRING(8),
    allowNull: false
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  scopes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: ['*'] 
  },
  userId: {  
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', 
      key: 'id'
    }
  } 
}, {
  tableName: 'apikeys',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (apiKey) => {
      const rawKey = crypto.randomBytes(32).toString('hex');
      apiKey.prefix = rawKey.substring(0, 8);
      apiKey.key = ApiKey.hashKey(rawKey);
    }
  }
});

ApiKey.hashKey = function(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
};

ApiKey.generateKey = function() {
  return crypto.randomBytes(32).toString('hex');
};

ApiKey.findByKey = async function(key) {
  const hashedKey = this.hashKey(key);
  return await this.findOne({ 
    where: { key: hashedKey },
    include: ['user']
  });
};

ApiKey.prototype.isExpired = function() {
  return this.expiresAt && new Date(this.expiresAt) < new Date();
};

ApiKey.prototype.hasScope = function(scope) {
  return this.scopes.includes('*') || this.scopes.includes(scope);
};

ApiKey.prototype.markAsUsed = async function() {
  this.lastUsedAt = new Date();
  return await this.save();
};

ApiKey.associate = function(models) {
  ApiKey.belongsTo(models.Users, {
    foreignKey: 'userId',
    as: 'Users',
    onDelete: 'CASCADE'
  });
};

module.exports = ApiKey;