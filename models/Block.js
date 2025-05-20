const { DataTypes } = require("sequelize");
const sequelize = require("./../database/sequelize");

const Block = sequelize.define(
  "Block",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type_block: {
      type: DataTypes.ENUM(
        'Link', 'Email', 'Address', 'Phone', 'Facebook',
        'Twitter', 'Instagram', 'Youtube', 'Whatsapp',
        'Tiktok', 'Telegram', 'Spotify', 'Pinterest',
        'Linkedin', 'Snapchat', 'Twitch', 'Discord',
        'Messenger', 'Reddit', 'GitHub'
      ),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    vcardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'vcards',
        key: 'id'
      }
    }
  },
  {
    tableName: "blocks",
    timestamps: true,
  }
);

Block.associate = function(models) {
  Block.belongsTo(models.VCard, {
    foreignKey: 'vcardId',
    as: 'VCard',
    onDelete: 'CASCADE'
  });
};

module.exports = Block;