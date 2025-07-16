const { Sequelize, DataTypes } = require('sequelize');

// Utiliser la base de données de test en mémoire
const sequelize = global.testDb || new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

// Mock des modèles pour les tests
const createMockModels = () => {
  // User Model Mock
  const User = sequelize.define('User', {
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
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'user', 'superAdmin'),
      defaultValue: 'user'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  // VCard Model Mock
  const VCard = sequelize.define('VCard', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  // Plan Model Mock
  const Plan = sequelize.define('Plan', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    type: {
      type: DataTypes.ENUM('free', 'premium', 'enterprise'),
      allowNull: false
    },
    features: {
      type: DataTypes.JSON,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  // Pixel Model Mock
  const Pixel = sequelize.define('Pixel', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    vcardId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    metaPixelId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  // Block Model Mock
  const Block = sequelize.define('Block', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    vcardId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content: {
      type: DataTypes.JSON,
      allowNull: true
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  // EventTracking Model Mock
  const EventTracking = sequelize.define('EventTracking', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    pixelId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  // Associations
  User.hasMany(VCard, { foreignKey: 'userId', as: 'VCards' });
  VCard.belongsTo(User, { foreignKey: 'userId', as: 'Users' });
  
  VCard.hasMany(Block, { foreignKey: 'vcardId', as: 'Block' });
  Block.belongsTo(VCard, { foreignKey: 'vcardId', as: 'VCard' });
  
  VCard.hasOne(Pixel, { foreignKey: 'vcardId', as: 'Pixel' });
  Pixel.belongsTo(VCard, { foreignKey: 'vcardId', as: 'VCard' });
  
  Pixel.hasMany(EventTracking, { foreignKey: 'pixelId', as: 'Events' });
  EventTracking.belongsTo(Pixel, { foreignKey: 'pixelId', as: 'Pixel' });

  return {
    User,
    VCard,
    Plan,
    Pixel,
    Block,
    EventTracking,
    sequelize
  };
};

module.exports = {
  createMockModels,
  sequelize
};
