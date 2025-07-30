const { Sequelize, DataTypes } = require('sequelize');

// Configuration de la base de données de test
const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  define: {
    timestamps: true,
    paranoid: true,
    underscored: true
  }
});

// Helper functions pour créer des données de test
const createTestData = {
  user: () => ({
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    role: 'user',
    isVerified: true,
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  plan: () => ({
    name: 'Test Plan',
    description: 'Test Plan Description',
    price: 29.99,
    currency: 'USD',
    type: 'premium',
    features: JSON.stringify(['feature1', 'feature2']),
    is_active: true,
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  vcard: (userId, projectId = null) => ({
    name: 'Test VCard',
    description: 'Test Description',
    url: `test-card-${Date.now()}`,
    userId: userId,
    projectId: projectId,
    is_active: true,
    status: true,
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  project: (userId) => ({
    name: 'Test Project',
    description: 'Test Description',
    userId: userId,
    status: 'active',
    is_blocked: false,
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  subscription: (userId, planId) => ({
    userId: userId,
    planId: planId,
    status: 'active',
    current_period_start: new Date('2025-07-30 12:47:25'),
    current_period_end: new Date('2025-08-30 12:47:25'),
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  apiKey: (userId) => ({
    userId: userId,
    key: `key-${Date.now()}`,
    name: 'Test API Key',
    expires_at: new Date('2025-12-31'),
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  pixel: (vcardId) => ({
    name: 'Test Pixel',
    vcardId: vcardId,
    is_active: true,
    is_blocked: false,
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  customDomain: (userId, vcardId) => ({
    userId: userId,
    vcardId: vcardId,
    domain: `test-${Date.now()}.example.com`,
    status: 'active',
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  eventTracking: (pixelId) => ({
    pixelId: pixelId,
    eventType: 'view',
    metadata: JSON.stringify({ page: 'home' }),
    created_at: new Date('2025-07-30 12:47:25')
  }),

  quote: (vcardId) => ({
    vcardId: vcardId,
    content: 'Test quote content',
    author: 'Test Author',
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  activityLog: (userId) => ({
    userId: userId,
    activityType: 'login_success',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    country: 'TN',
    city: 'Tunis',
    deviceType: 'Desktop',
    os: 'Linux',
    browser: 'Chrome',
    created_at: new Date('2025-07-30 12:47:25')
  }),

  block: (vcardId) => ({
    type_block: 'Link',
    name: 'Test Block',
    description: 'Test Block Description',
    status: true,
    vcardId: vcardId,
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  }),

  notification: (userId) => ({
    userId: userId,
    title: 'Test Notification',
    message: 'This is a test notification.',
    type: 'info',
    isRead: false,
    metadata: { foo: 'bar' },
    expiresAt: new Date('2025-12-31'),
    created_at: new Date('2025-07-30 12:47:25')
  }),

  payment: (userId, subscriptionId) => ({
    transaction_id: `tx-${Date.now()}`,
    amount: 49.99,
    currency: 'USD',
    status: 'completed',
    gateway_response: { success: true },
    payment_date: new Date('2025-07-30 12:47:25'),
    refund_date: null,
    userId: userId,
    SubscriptionId: subscriptionId,
    created_at: new Date('2025-07-30 12:47:25')
  }),

  vcardView: (vcardId, userId = null) => ({
    vcardId: vcardId,
    userId: userId,
    fingerprint: `fp-${Date.now()}`,
    created_at: new Date('2025-07-30 12:47:25'),
    updated_at: new Date('2025-07-30 12:47:25')
  })
};

// Définition des modèles de test, y compris les 5 nouveaux modèles
const defineModels = () => {
  // User Model
  const User = testSequelize.define('Users', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true
    },
    password: DataTypes.STRING,
    role: {
      type: DataTypes.ENUM('user', 'admin', 'superAdmin'),
      defaultValue: 'user'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  // Plan Model
  const Plan = testSequelize.define('Plans', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.STRING,
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
    features: DataTypes.TEXT,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  // VCard Model
  const VCard = testSequelize.define('VCard', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.STRING,
    url: {
      type: DataTypes.STRING,
      unique: true,
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

  // Project Model
  const Project = testSequelize.define('Project', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.STRING,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'active'
    },
    is_blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  // Subscription Model
  const Subscription = testSequelize.define('Subscription', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'active'
    },
    current_period_start: DataTypes.DATE,
    current_period_end: DataTypes.DATE
  });

  // 1. ActivityLog Model
  const ActivityLog = testSequelize.define('ActivityLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    activityType: {
      type: DataTypes.ENUM(
        'login_success', 'login_failed', 'logout', 'register_success',
        'login_success_with_google', 'login_failed_with_google',
        'password_changed_success', 'password_changed_failed',
        'password_reset_request', 'password_reset_success',
        'email_verification_success', 'two_factor_enabled',
        'two_factor_disabled', 'update_profile'
      ),
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    deviceType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    os: {
      type: DataTypes.STRING,
      allowNull: true
    },
    browser: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'activitylogs'
  });

  // 2. Block Model
  const Block = testSequelize.define('Block', {
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
      allowNull: false
    }
  }, {
    tableName: "blocks",
    timestamps: true,
  });

  // 3. Notification Model
  const Notification = testSequelize.define('Notifications', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM(
        'info', 'success', 'warning', 'error', 'system', 'security',
        'Subscription', 'feature', 'welcome', 'subscription_canceled',
        'subscription_expired', 'subscription_expiration', 'new_subscription'
      ),
      defaultValue: 'info',
      allowNull: false
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    tableName: 'notifications',
    createdAt: 'created_at'
  });

  // 4. Payment Model
  const Payment = testSequelize.define('Payment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    transaction_id: {
      type: DataTypes.STRING,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    gateway_response: {
      type: DataTypes.JSON,
      allowNull: true
    },
    payment_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    refund_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    SubscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'payment',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  // 5. VcardView Model
  const VcardView = testSequelize.define('VcardView', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    vcardId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fingerprint: {
      type: DataTypes.STRING(64),
      allowNull: false
    }
  }, {
    tableName: "vcardviews",
    timestamps: true
  });

  // Définition des associations
  User.hasMany(VCard, { as: 'VCards', foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Project, { as: 'Projects', foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Subscription, { as: 'Subscriptions', foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(ActivityLog, { as: 'ActivityLogs', foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Notification, { as: 'Notifications', foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Payment, { as: 'Payments', foreignKey: 'userId', onDelete: 'CASCADE' });

  VCard.belongsTo(User, { as: 'User', foreignKey: 'userId', onDelete: 'CASCADE' });
  VCard.belongsTo(Project, { as: 'Project', foreignKey: 'projectId', onDelete: 'CASCADE' });
  VCard.hasMany(Block, { as: 'Blocks', foreignKey: 'vcardId', onDelete: 'CASCADE' });
  VCard.hasMany(VcardView, { as: 'VcardViews', foreignKey: 'vcardId', onDelete: 'CASCADE' });

  Project.hasMany(VCard, { as: 'VCards', foreignKey: 'projectId', onDelete: 'CASCADE' });
  Project.belongsTo(User, { as: 'User', foreignKey: 'userId', onDelete: 'CASCADE' });

  Subscription.belongsTo(User, { as: 'User', foreignKey: 'userId', onDelete: 'CASCADE' });
  Subscription.belongsTo(Plan, { as: 'Plan', foreignKey: 'planId', onDelete: 'CASCADE' });
  Subscription.hasMany(Payment, { as: 'Payments', foreignKey: 'SubscriptionId', onDelete: 'CASCADE' });

  ActivityLog.belongsTo(User, { as: 'User', foreignKey: 'userId', onDelete: 'CASCADE' });

  Block.belongsTo(VCard, { as: 'VCard', foreignKey: 'vcardId', onDelete: 'CASCADE' });

  Notification.belongsTo(User, { as: 'User', foreignKey: 'userId', onDelete: 'CASCADE' });

  Payment.belongsTo(User, { as: 'User', foreignKey: 'userId', onDelete: 'CASCADE' });
  Payment.belongsTo(Subscription, { as: 'Subscription', foreignKey: 'SubscriptionId', onDelete: 'CASCADE' });

  VcardView.belongsTo(VCard, { as: 'VCard', foreignKey: 'vcardId', onDelete: 'CASCADE' });

  return {
    User,
    Plan,
    VCard,
    Project,
    Subscription,
    ActivityLog,
    Block,
    Notification,
    Payment,
    VcardView,
    sequelize: testSequelize
  };
};

// Tests
describe('Models', () => {
  let models;

  beforeAll(async () => {
    models = defineModels();
    await models.sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  beforeEach(async () => {
    await Promise.all(
      Object.values(models)
        .filter(model => typeof model.destroy === 'function')
        .map(model =>
          model.destroy({
            where: {},
            force: true,
            truncate: true,
            cascade: true
          })
        )
    );
  });

  describe('User Model', () => {
    it('should create a user with valid data', async () => {
      const userData = createTestData.user();
      const user = await models.User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe('user');
      expect(user.isVerified).toBe(true);
    });

    it('should enforce unique email constraint', async () => {
      const userData = createTestData.user();
      await models.User.create(userData);

      await expect(models.User.create(userData))
        .rejects
        .toThrow();
    });
  });

  describe('VCard Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
    });

    it('should create a vcard with valid data', async () => {
      const vcardData = createTestData.vcard(testUser.id);
      const vcard = await models.VCard.create(vcardData);

      expect(vcard.id).toBeDefined();
      expect(vcard.name).toBe(vcardData.name);
      expect(vcard.userId).toBe(testUser.id);
    });

    it('should enforce unique url constraint', async () => {
      const vcardData = createTestData.vcard(testUser.id);
      await models.VCard.create(vcardData);

      await expect(models.VCard.create(vcardData))
        .rejects
        .toThrow();
    });
  });

  describe('Project Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
    });

    it('should create a project with valid data', async () => {
      const projectData = createTestData.project(testUser.id);
      const project = await models.Project.create(projectData);

      expect(project.id).toBeDefined();
      expect(project.name).toBe(projectData.name);
      expect(project.userId).toBe(testUser.id);
    });
  });

  describe('Model Associations', () => {
    let testUser;
    let testProject;
    let testPlan;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
      testProject = await models.Project.create(createTestData.project(testUser.id));
      testPlan = await models.Plan.create(createTestData.plan());
    });

    it('should establish User-VCard-Project relationships', async () => {
      const vcard = await models.VCard.create(createTestData.vcard(testUser.id, testProject.id));

      const userWithVCards = await models.User.findByPk(testUser.id, {
        include: ['VCards']
      });

      const projectWithVCards = await models.Project.findByPk(testProject.id, {
        include: ['VCards']
      });

      expect(userWithVCards.VCards[0].id).toBe(vcard.id);
      expect(projectWithVCards.VCards[0].id).toBe(vcard.id);
    });

    it('should establish User-Subscription-Plan relationships', async () => {
      const subscription = await models.Subscription.create(
        createTestData.subscription(testUser.id, testPlan.id)
      );

      const userWithSubs = await models.User.findByPk(testUser.id, {
        include: ['Subscriptions']
      });

      expect(userWithSubs.Subscriptions[0].id).toBe(subscription.id);
    });
  });

  describe('Cascade Deletes', () => {
    it('should delete related records when user is deleted', async () => {
      // Créer l'utilisateur
      const user = await models.User.create(createTestData.user());

      // Créer un projet associé à l'utilisateur
      const project = await models.Project.create(createTestData.project(user.id));

      // Créer une vcard associée à l'utilisateur et au projet
      await models.VCard.create({
        ...createTestData.vcard(user.id, project.id)
      });

      await models.User.destroy({
        where: { id: user.id },
        force: true
      });

      const vcards = await models.VCard.findAll({
        where: { userId: user.id },
        paranoid: false
      });

      const projects = await models.Project.findAll({
        where: { userId: user.id },
        paranoid: false
      });

      expect(vcards.length).toBe(0);
      expect(projects.length).toBe(0);
    });
  });

  // ---------- Nouveau : tests basiques pour les nouveaux modèles -----------
  describe('ActivityLog Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
    });

    it('should create an activity log with valid data', async () => {
      const logData = createTestData.activityLog(testUser.id);
      const log = await models.ActivityLog.create(logData);

      expect(log.id).toBeDefined();
      expect(log.userId).toBe(testUser.id);
      expect(log.activityType).toBe(logData.activityType);
    });
  });

  describe('Block Model', () => {
    let testUser, testVCard;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
      testVCard = await models.VCard.create(createTestData.vcard(testUser.id));
    });

    it('should create a block with valid data', async () => {
      const blockData = createTestData.block(testVCard.id);
      const block = await models.Block.create(blockData);

      expect(block.id).toBeDefined();
      expect(block.vcardId).toBe(testVCard.id);
    });
  });

  describe('Notification Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
    });

    it('should create a notification with valid data', async () => {
      const notificationData = createTestData.notification(testUser.id);
      const notification = await models.Notification.create(notificationData);

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(testUser.id);
      expect(notification.title).toBe(notificationData.title);
    });
  });

  describe('Payment Model', () => {
    let testUser, testPlan, testSubscription;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
      testPlan = await models.Plan.create(createTestData.plan());
      testSubscription = await models.Subscription.create(createTestData.subscription(testUser.id, testPlan.id));
    });

    it('should create a payment with valid data', async () => {
      const paymentData = createTestData.payment(testUser.id, testSubscription.id);
      const payment = await models.Payment.create(paymentData);

      expect(payment.id).toBeDefined();
      expect(payment.userId).toBe(testUser.id);
      expect(payment.SubscriptionId).toBe(testSubscription.id);
    });
  });

  describe('VcardView Model', () => {
    let testUser, testVCard;

    beforeEach(async () => {
      testUser = await models.User.create(createTestData.user());
      testVCard = await models.VCard.create(createTestData.vcard(testUser.id));
    });

    it('should create a vcard view with valid data', async () => {
      const vcardViewData = createTestData.vcardView(testVCard.id, testUser.id);
      const vcardView = await models.VcardView.create(vcardViewData);

      expect(vcardView.id).toBeDefined();
      expect(vcardView.vcardId).toBe(testVCard.id);
      expect(vcardView.userId).toBe(testUser.id);
    });
  });
});