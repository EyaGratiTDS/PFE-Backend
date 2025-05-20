const { DataTypes } = require('sequelize');
const sequelize = require('./../database/sequelize'); 

const TypeBlock = sequelize.define('TypeBlock', {
  name: {
    type: DataTypes.ENUM(
      'Link', 'Email', 'Address', 'Phone', 'Facebook', 'Twitter', 'Instagram', 
      'Youtube', 'Whatsapp', 'Tiktok', 'Telegram', 'Spotify', 
      'Pinterest', 'Linkedin', 'Snapchat', 'Twitch', 'Discord', 
      'Messenger', 'Reddit', 'GitHub'
    ),
    allowNull: false,
    unique: true,
    primaryKey: true,
  },
}, {
  timestamps: false, 
});

module.exports = TypeBlock;