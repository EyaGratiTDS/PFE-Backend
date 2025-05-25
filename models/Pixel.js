const { DataTypes} = require('sequelize');
const sequelize = require("./../database/sequelize"); 


const Pixel = sequelize.define('Pixel',{
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  vcardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vcards',
        key: 'id'
      }
    },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
}, {
  tableName: 'pixels',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Pixel.associate = models => {
    Pixel.belongsTo(models.VCard, {
      foreignKey: 'vcardId',
      as: 'VCard'
    });

    Pixel.hasMany(models.EventTracking, {
    foreignKey: 'pixelId',
    as: 'EventTracking',
    onDelete: 'CASCADE'
  });
  };


module.exports = Pixel;