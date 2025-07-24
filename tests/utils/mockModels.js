const { Sequelize, DataTypes } = require('sequelize');

const sequelize = global.testDb || new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

const createMockModels = () => {
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
    logo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    favicon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    background_value: {
      type: DataTypes.STRING,
      allowNull: true
    },
    background_type: {
      type: DataTypes.STRING,
      allowNull: true
    },
    font_family: {
      type: DataTypes.STRING,
      allowNull: true
    },
    font_size: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    search_engine_visibility: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    remove_branding: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_share: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_downloaded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    pixelId: {
      type: DataTypes.INTEGER,
      allowNull: true
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
  }
});

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'canceled', 'pending'),
    defaultValue: 'pending'
  },
  user_id: {  
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  plan_id: {  
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  is_unlimited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  admin_assigned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
});

  User.hasMany(VCard, { foreignKey: 'userId', as: 'VCards' });
  VCard.belongsTo(User, { foreignKey: 'userId', as: 'Users' });
  
  VCard.hasMany(Block, { foreignKey: 'vcardId', as: 'Block' });
  Block.belongsTo(VCard, { foreignKey: 'vcardId', as: 'VCard' });
  
  VCard.hasOne(Pixel, { foreignKey: 'vcardId', as: 'Pixel' });
  Pixel.belongsTo(VCard, { foreignKey: 'vcardId', as: 'VCard' });
  
  Pixel.hasMany(EventTracking, { foreignKey: 'pixelId', as: 'Events' });
  EventTracking.belongsTo(Pixel, { foreignKey: 'pixelId', as: 'Pixel' });

  User.hasMany(CustomDomain, { foreignKey: 'userId', as: 'CustomDomains' });
  CustomDomain.belongsTo(User, { foreignKey: 'userId', as: 'User' });

  User.hasMany(Subscription, { foreignKey: 'user_id', as: 'Subscriptions' });
  Subscription.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

  return {
    User,
    VCard,
    Plan,
    Pixel,
    Block,
    EventTracking,
    CustomDomain,
    Subscription,
    sequelize
  };
};

module.exports = {
  createMockModels,
  sequelize
};
