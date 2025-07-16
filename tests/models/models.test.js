const { createMockModels } = require('../utils/mockModels');
const { createTestUser, createTestVCard, createTestPlan } = require('../utils/testHelpers');

describe('Models', () => {
  let models;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await models.User.destroy({ where: {} });
    await models.VCard.destroy({ where: {} });
    await models.Plan.destroy({ where: {} });
    await models.Pixel.destroy({ where: {} });
    await models.Block.destroy({ where: {} });
    await models.EventTracking.destroy({ where: {} });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe('User Model', () => {
    test('should create user with valid data', async () => {
      const userData = await createTestUser();
      const user = await models.User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.isVerified).toBe(userData.isVerified);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    test('should enforce unique email constraint', async () => {
      const userData = await createTestUser();
      await models.User.create(userData);

      await expect(models.User.create(userData)).rejects.toThrow();
    });

    test('should have default role as user', async () => {
      const userData = await createTestUser();
      delete userData.role;
      
      const user = await models.User.create(userData);
      expect(user.role).toBe('user');
    });

    test('should have default isVerified as false', async () => {
      const userData = await createTestUser();
      delete userData.isVerified;
      
      const user = await models.User.create(userData);
      expect(user.isVerified).toBe(false);
    });

    test('should validate email format', async () => {
      const userData = await createTestUser({ email: 'invalid-email' });


      const user = await models.User.create(userData);
      expect(user.email).toBe('invalid-email');
    });

    test('should require name and email', async () => {
      await expect(models.User.create({ password: 'password' })).rejects.toThrow();
      await expect(models.User.create({ name: 'Test', password: 'password' })).rejects.toThrow();
    });
  });

  describe('VCard Model', () => {
    test('should create vCard with valid data', async () => {
      const user = await models.User.create(await createTestUser());
      const vcardData = createTestVCard({ userId: user.id });
      const vcard = await models.VCard.create(vcardData);

      expect(vcard.id).toBeDefined();
      expect(vcard.name).toBe(vcardData.name);
      expect(vcard.description).toBe(vcardData.description);
      expect(vcard.url).toBe(vcardData.url);
      expect(vcard.userId).toBe(user.id);
      expect(vcard.is_active).toBe(vcardData.is_active);
      expect(vcard.status).toBe(vcardData.status);
    });

    test('should enforce unique url constraint', async () => {
      const user = await models.User.create(await createTestUser());
      const vcardData = createTestVCard({ userId: user.id });
      await models.VCard.create(vcardData);

      await expect(models.VCard.create(vcardData)).rejects.toThrow();
    });

    test('should require name, url and userId', async () => {
      await expect(models.VCard.create({})).rejects.toThrow();
      await expect(models.VCard.create({ name: 'Test' })).rejects.toThrow();
      await expect(models.VCard.create({ name: 'Test', url: 'test' })).rejects.toThrow();
    });

    test('should have default values for boolean fields', async () => {
      const user = await models.User.create(await createTestUser());
      const vcardData = createTestVCard({ userId: user.id });
      delete vcardData.is_active;
      delete vcardData.status;

      const vcard = await models.VCard.create(vcardData);
      expect(vcard.is_active).toBe(true);
      expect(vcard.status).toBe(true);
    });
  });

  describe('Plan Model', () => {
    test('should create plan with valid data', async () => {
      const planData = createTestPlan();
      const plan = await models.Plan.create(planData);

      expect(plan.id).toBeDefined();
      expect(plan.name).toBe(planData.name);
      expect(plan.description).toBe(planData.description);
      expect(plan.price).toBe(planData.price);
      expect(plan.currency).toBe(planData.currency);
      expect(plan.type).toBe(planData.type);
      expect(plan.is_active).toBe(planData.is_active);
    });

    test('should require name, price and type', async () => {
      await expect(models.Plan.create({})).rejects.toThrow();
      await expect(models.Plan.create({ name: 'Test' })).rejects.toThrow();
      await expect(models.Plan.create({ name: 'Test', price: 9.99 })).rejects.toThrow();
    });

    test('should have default currency as USD', async () => {
      const planData = createTestPlan();
      delete planData.currency;

      const plan = await models.Plan.create(planData);
      expect(plan.currency).toBe('USD');
    });

    test('should have default is_active as true', async () => {
      const planData = createTestPlan();
      delete planData.is_active;

      const plan = await models.Plan.create(planData);
      expect(plan.is_active).toBe(true);
    });

    test('should validate plan type enum', async () => {
      const planData = createTestPlan({ type: 'invalid_type' });

      await expect(models.Plan.create(planData)).rejects.toThrow();
    });

    test('should allow valid plan types', async () => {
      const validTypes = ['free', 'premium', 'enterprise'];

      for (const type of validTypes) {
        const planData = createTestPlan({ type, name: `Plan ${type}` });
        const plan = await models.Plan.create(planData);
        expect(plan.type).toBe(type);
      }
    });
  });

  describe('Pixel Model', () => {
    test('should create pixel with valid data', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixelData = {
        name: 'Test Pixel',
        vcardId: vcard.id,
        is_active: true,
        is_blocked: false
      };

      const pixel = await models.Pixel.create(pixelData);

      expect(pixel.id).toBeDefined();
      expect(pixel.name).toBe(pixelData.name);
      expect(pixel.vcardId).toBe(vcard.id);
      expect(pixel.is_active).toBe(true);
      expect(pixel.is_blocked).toBe(false);
    });

    test('should require name and vcardId', async () => {
      await expect(models.Pixel.create({})).rejects.toThrow();
      await expect(models.Pixel.create({ name: 'Test' })).rejects.toThrow();
    });

    test('should have default values for boolean fields', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixelData = {
        name: 'Test Pixel',
        vcardId: vcard.id
      };

      const pixel = await models.Pixel.create(pixelData);
      expect(pixel.is_active).toBe(true);
      expect(pixel.is_blocked).toBe(false);
    });

    test('should allow metaPixelId to be null', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixelData = {
        name: 'Test Pixel',
        vcardId: vcard.id,
        metaPixelId: null
      };

      const pixel = await models.Pixel.create(pixelData);
      expect(pixel.metaPixelId).toBeNull();
    });
  });

  describe('Block Model', () => {
    test('should create block with valid data', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const blockData = {
        vcardId: vcard.id,
        type: 'text',
        content: { text: 'Hello World' },
        position: 1,
        is_active: true
      };

      const block = await models.Block.create(blockData);

      expect(block.id).toBeDefined();
      expect(block.vcardId).toBe(vcard.id);
      expect(block.type).toBe(blockData.type);
      expect(block.content).toEqual(blockData.content);
      expect(block.position).toBe(blockData.position);
      expect(block.is_active).toBe(true);
    });

    test('should require vcardId and type', async () => {
      await expect(models.Block.create({})).rejects.toThrow();
      await expect(models.Block.create({ vcardId: 1 })).rejects.toThrow();
    });

    test('should have default values', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const blockData = {
        vcardId: vcard.id,
        type: 'text'
      };

      const block = await models.Block.create(blockData);
      expect(block.position).toBe(0);
      expect(block.is_active).toBe(true);
    });
  });

  describe('EventTracking Model', () => {
    test('should create event tracking with valid data', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create({
        name: 'Test Pixel',
        vcardId: vcard.id
      });

      const eventData = {
        pixelId: pixel.id,
        eventType: 'view',
        metadata: { page: 'home' },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser'
      };

      const event = await models.EventTracking.create(eventData);

      expect(event.id).toBeDefined();
      expect(event.pixelId).toBe(pixel.id);
      expect(event.eventType).toBe(eventData.eventType);
      expect(event.metadata).toEqual(eventData.metadata);
      expect(event.ipAddress).toBe(eventData.ipAddress);
      expect(event.userAgent).toBe(eventData.userAgent);
    });

    test('should require pixelId and eventType', async () => {
      await expect(models.EventTracking.create({})).rejects.toThrow();
      await expect(models.EventTracking.create({ pixelId: 1 })).rejects.toThrow();
    });

    test('should allow optional fields to be null', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create({
        name: 'Test Pixel',
        vcardId: vcard.id
      });

      const eventData = {
        pixelId: pixel.id,
        eventType: 'view'
      };

      const event = await models.EventTracking.create(eventData);
      expect(event.metadata).toBeNull();
      expect(event.ipAddress).toBeNull();
      expect(event.userAgent).toBeNull();
    });
  });

  describe('Model Associations', () => {
    test('User should have many VCards', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard1 = await models.VCard.create(createTestVCard({ 
        userId: user.id, 
        url: 'vcard1' 
      }));
      const vcard2 = await models.VCard.create(createTestVCard({ 
        userId: user.id, 
        url: 'vcard2' 
      }));

      const userWithVCards = await models.User.findByPk(user.id, {
        include: [{ model: models.VCard, as: 'VCards' }]
      });

      expect(userWithVCards.VCards).toHaveLength(2);
      expect(userWithVCards.VCards.map(v => v.id)).toContain(vcard1.id);
      expect(userWithVCards.VCards.map(v => v.id)).toContain(vcard2.id);
    });

    test('VCard should belong to User', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));

      const vcardWithUser = await models.VCard.findByPk(vcard.id, {
        include: [{ model: models.User, as: 'Users' }]
      });

      expect(vcardWithUser.Users.id).toBe(user.id);
      expect(vcardWithUser.Users.name).toBe(user.name);
    });

    test('VCard should have many Blocks', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      
      await models.Block.create({
        vcardId: vcard.id,
        type: 'text',
        content: { text: 'Block 1' }
      });
      await models.Block.create({
        vcardId: vcard.id,
        type: 'image',
        content: { url: 'image.jpg' }
      });

      const vcardWithBlocks = await models.VCard.findByPk(vcard.id, {
        include: [{ model: models.Block, as: 'Block' }]
      });

      expect(vcardWithBlocks.Block).toHaveLength(2);
    });

    test('VCard should have one Pixel', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create({
        name: 'Test Pixel',
        vcardId: vcard.id
      });

      const vcardWithPixel = await models.VCard.findByPk(vcard.id, {
        include: [{ model: models.Pixel, as: 'Pixel' }]
      });

      expect(vcardWithPixel.Pixel.id).toBe(pixel.id);
    });

    test('Pixel should have many EventTracking', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create({
        name: 'Test Pixel',
        vcardId: vcard.id
      });

      await models.EventTracking.create({
        pixelId: pixel.id,
        eventType: 'view'
      });
      await models.EventTracking.create({
        pixelId: pixel.id,
        eventType: 'click'
      });

      const pixelWithEvents = await models.Pixel.findByPk(pixel.id, {
        include: [{ model: models.EventTracking, as: 'Events' }]
      });

      expect(pixelWithEvents.Events).toHaveLength(2);
    });
  });

  describe('Model Validations', () => {
    test('should validate required fields', async () => {
      await expect(models.User.create({})).rejects.toThrow();
      await expect(models.VCard.create({})).rejects.toThrow();
      await expect(models.Plan.create({})).rejects.toThrow();
      await expect(models.Pixel.create({})).rejects.toThrow();
      await expect(models.Block.create({})).rejects.toThrow();
      await expect(models.EventTracking.create({})).rejects.toThrow();
    });

    test('should handle JSON fields correctly', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));

      const block = await models.Block.create({
        vcardId: vcard.id,
        type: 'complex',
        content: {
          title: 'Complex Block',
          items: [1, 2, 3],
          nested: { key: 'value' }
        }
      });

      const retrievedBlock = await models.Block.findByPk(block.id);
      expect(retrievedBlock.content).toEqual({
        title: 'Complex Block',
        items: [1, 2, 3],
        nested: { key: 'value' }
      });

      const pixel = await models.Pixel.create({
        name: 'Test Pixel',
        vcardId: vcard.id
      });

      const event = await models.EventTracking.create({
        pixelId: pixel.id,
        eventType: 'custom',
        metadata: {
          action: 'button_click',
          element_id: 'submit_button',
          timestamp: Date.now()
        }
      });

      const retrievedEvent = await models.EventTracking.findByPk(event.id);
      expect(retrievedEvent.metadata.action).toBe('button_click');
    });
  });
});
