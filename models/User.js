const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require("./../database/sequelize");

const User = sequelize.define('Users', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'superAdmin'),
    defaultValue: 'user'
  },
  avatar:{
    type: DataTypes.STRING,
    allowNull: true,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationToken: {
    type: DataTypes.STRING
  },
  resetPasswordToken: {
    type: DataTypes.STRING
  },
  resetPasswordExpires: {
    type: DataTypes.DATE
  },
  rememberMeToken: {
    type: DataTypes.STRING
  },
  rememberMeExpires: {
    type: DataTypes.DATE
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  twoFactorSecret: {
    type: DataTypes.STRING,
    allowNull: true
  },
  twoFactorRecoveryCodes: {
    type: DataTypes.STRING,
    allowNull: true
  },
  recoveryCodes: {
    type: DataTypes.STRING,
    allowNull: true
  },
}, {
  timestamps: true,
  tableName: 'users',
  createdAt: 'created_at',
  updatedAt: false,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await User.hashPassword(user.password);
      }
    }
  }
});

User.associate = function(models) {
  User.hasMany(models.VCard, {
    foreignKey: 'userId',
    as: 'VCard',
    onDelete: 'CASCADE'
  });

  User.hasMany(models.Subscription, {
    foreignKey: 'user_id',
    as: 'Subscription',
    onDelete: 'CASCADE'
  });

  User.hasMany(models.ActivityLog, {
    foreignKey: 'userId',
    as: 'ActivityLog',
    onDelete: 'CASCADE'
  });
  
  User.hasMany(models.ApiKey, {
    foreignKey: 'userId',
    as: 'ApiKey',
    onDelete: 'CASCADE'
  });

  User.hasMany(models.Payment, {
    foreignKey: 'userId',
    as: 'Payment',
  });
  
  User.hasMany(models.Project, {
    foreignKey: 'userId',
    as: 'Project',
    onDelete: 'CASCADE'
  });

  User.hasMany(models.CustomDomain, {
    foreignKey: 'userId',
    as: 'CustomDomain',
    onDelete: 'CASCADE'
  });
};


User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.findByEmail = async function(email) {
  return await this.findOne({ where: { email } });
};

User.findById = async function(id) {
  return await this.findByPk(id);
};

User.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.verifyUser = async function(token) {
  const user = await this.findOne({ where: { verificationToken: token } });
  if (!user) {
    throw new Error('Invalid or expired verification token');
  }
  
  user.isVerified = true;
  user.verificationToken = null;
  await user.save();
  
  return user;
};

module.exports = User;