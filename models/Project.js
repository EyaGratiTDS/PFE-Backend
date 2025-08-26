const { DataTypes } = require("sequelize");
const sequelize = require("./../database/sequelize");

const Project = sequelize.define(
  "Project",
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
      type: DataTypes.STRING,
      allowNull: true,
    },
    logo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    logoPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {     
      type: DataTypes.ENUM('active', 'archived', 'pending'),
      defaultValue: 'active',
    }, 
    is_blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    }
  },
  {
    tableName: "project",
    timestamps: true,
  }
);

Project.associate = function(models) {
  Project.hasMany(models.VCard, {
    foreignKey: 'vcardId',
    as: 'VCard',
    onDelete: 'CASCADE'
  });

  Project.belongsTo(models.Users, {
    foreignKey: 'userId',
    as: 'Users'
  });
};


module.exports = Project;