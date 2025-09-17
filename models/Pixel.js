const { DataTypes } = require("sequelize");
const sequelize = require("./../database/sequelize");

const Pixel = sequelize.define(
  "Pixel",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false, // Nom donné par l’utilisateur
    },
    type: {
      type: DataTypes.ENUM(
        "meta",
        "ga",
        "linkedin",
        "gtm",
        "pinterest",
        "twitter",
        "quora"
      ),
      allowNull: true,
    },
    vcardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "vcards",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    pixelCode: {
      type: DataTypes.STRING, // Stocker l’ID ou le code du pixel (ex: G-XXXX, fbq id, GTM-XXXX)
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "pixels",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

Pixel.associate = (models) => {
  Pixel.belongsTo(models.VCard, {
    foreignKey: "vcardId",
    as: "VCard",
    onDelete: "CASCADE",
  });

  Pixel.hasMany(models.EventTracking, {
    foreignKey: "pixelId",
    as: "EventTracking",
    onDelete: "CASCADE",
  });
};

module.exports = Pixel;
