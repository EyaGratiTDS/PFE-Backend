const { DataTypes } = require("sequelize");
const sequelize = require("./../database/sequelize");

const VCard = sequelize.define(
  "VCard",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    logo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    logoPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    favicon: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    faviconPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    background_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    backgroundPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    background_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    font_family: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    font_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    search_engine_visibility: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    remove_branding: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_share: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_downloaded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,  // 🟢 VCard active par défaut lors de la génération
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Project',
        key: 'id'
      }
    },
     pixelId: {
      type: DataTypes.UUID,
      allowNull: true,
    }
   },
  {
    tableName: "vcards",
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
);

VCard.associate = function(models) {

  VCard.hasMany(models.Block, {
    foreignKey: 'vcardId',
    as: 'Block',
    onDelete: 'CASCADE'
  });

  VCard.hasMany(models.VcardView, {
    foreignKey: 'vcardId',
    as: 'VcardView',
    onDelete: 'CASCADE'
  });

  VCard.belongsTo(models.Users, {
    foreignKey: 'userId',
    as: 'Users'
  });

  VCard.belongsTo(models.Project, {
    foreignKey: 'projectId',
    as: 'Project'
  });

  VCard.hasOne(models.Pixel, {
    foreignKey: 'vcardId',
    as: 'Pixel',
    onDelete: 'CASCADE'
  });

  VCard.hasOne(models.CustomDomain, {
    foreignKey: 'vcardId',
    as: 'customDomain',
    onDelete: 'SET NULL'
  });
};

module.exports = VCard;