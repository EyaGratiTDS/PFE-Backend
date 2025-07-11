const { DataTypes} = require('sequelize');
const sequelize = require("./../database/sequelize");


const CustomDomain = sequelize.define('CustomDomain',{
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: false,
  },
   userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'failed', 'blocked'),
    defaultValue: 'pending'
  },
  verification_code: {
    type: DataTypes.STRING(64),
    allowNull: true,
    defaultValue: () => require('crypto').randomBytes(32).toString('hex')
  },
  cname_target: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: process.env.APP_DOMAIN || 'localhost' 
  },
  custom_index_url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  custom_not_found_url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  vcardId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true, 
    references: {
      model: 'vcards',
      key: 'id'
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  }

}, {
  tableName: 'custom_domains',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

CustomDomain.associate = models => {
    CustomDomain.belongsTo(models.Users, {
      foreignKey: 'userId',
      as: 'Users',
      onDelete: 'CASCADE'
    });

    CustomDomain.belongsTo(models.VCard, {
      foreignKey: 'vcardId',
      as: 'vcard',
      onDelete: 'SET NULL'
    });
  };


module.exports = CustomDomain;