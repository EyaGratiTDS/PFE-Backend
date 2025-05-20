const { DataTypes } = require("sequelize"); 
const sequelize = require("./../database/sequelize");

const VcardView = sequelize.define(
  "VcardView",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vcardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vcards',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fingerprint: {
      type: DataTypes.STRING(64),
      allowNull: false
    }
  }, 
  {
    tableName: "vcardviews",
    timestamps: true
    }
  );

  VcardView.associate = function(models) {
  
    VcardView.belongsTo(models.VCard, {
      foreignKey: 'vcardId',
      as: 'VCard'
    });
  
  };

module.exports = VcardView;