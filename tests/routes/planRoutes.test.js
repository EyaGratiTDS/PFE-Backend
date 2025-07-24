const request = require('supertest');
const express = require('express');
const planRoutes = require('../../routes/planRoutes');
const { createMockModels } = require('../utils/mockModels');
const { 
  createTestPlan,
  expectSuccessResponse,
  expectErrorResponse,
} = require('../utils/testHelpers');

describe('PlanRoutes', () => {
  let app;
  let models;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });

    app = express();
    app.use(express.json());
    
    app.use('/plans', planRoutes);
  });

  beforeEach(async () => {
    await models.Plan.destroy({ where: {} });
    
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe('GET /plans', () => {
    test('should return all plans without authentication', async () => {
      await models.Plan.create(createTestPlan({ name: 'Free', price: 0 }));
      await models.Plan.create(createTestPlan({ name: 'Basic', price: 12.00 }));
      await models.Plan.create(createTestPlan({ name: 'Pro', price: 29.00 }));

      const response = await request(app).get('/plans');

      expectSuccessResponse(response);
      expect(response.body.plans).toHaveLength(3);
    });
  });

  describe('GET /plans/free', () => {
    test('should return free plan without authentication', async () => {
      await models.Plan.create(createTestPlan({ 
        name: 'Free', 
        price: 0,
        type: 'free'
      }));

      const response = await request(app).get('/plans/free');

      expectSuccessResponse(response);
      expect(response.body.plan.name).toBe('Free');
    });
  });

  describe('GET /plans/search', () => {
    test('should search plans without authentication', async () => {
      await models.Plan.create(createTestPlan({ 
        name: 'Basic', 
        description: 'Basic plan',
        price: 12.00
      }));

      const response = await request(app).get('/plans/search?q=Basic');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Basic');
    });
  });

  describe('POST /plans', () => {
    test('should create plan without authentication (public endpoint)', async () => {
      const planData = {
        name: 'Basic',
        description: 'Basic plan',
        price: 12.00,
        currency: 'USD',
        type: 'premium'
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expectSuccessResponse(response);
      expect(response.body.plan.name).toBe(planData.name);
    });

    test('should validate plan type', async () => {
      const planData = {
        name: 'InvalidType',
        description: 'Invalid plan',
        price: 12.00
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expectErrorResponse(response, 400);
      expect(response.body.error).toBe('Type de plan invalide');
      expect(response.body.validTypes).toEqual(['Free', 'Basic', 'Pro']);
    });
  });

  describe('GET /plans/:id', () => {
    test('should return plan by id without authentication', async () => {
      const plan = await models.Plan.create(createTestPlan());

      const response = await request(app).get(`/plans/${plan.id}`);

      expectSuccessResponse(response);
      expect(response.body.plan.id).toBe(plan.id);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(app).get('/plans/999');

      expectErrorResponse(response, 404, 'Plan non trouvé');
    });
  });

  describe('PUT /plans/:id', () => {
    test('should update plan without authentication (public endpoint)', async () => {
      const plan = await models.Plan.create(createTestPlan());
      const updateData = {
        name: 'Basic',
        description: 'Updated plan',
        price: 12.99
      };

      const response = await request(app)
        .put(`/plans/${plan.id}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(response.body.plan.description).toBe(updateData.description);
    });

    test('should validate plan type on update', async () => {
      const plan = await models.Plan.create(createTestPlan());
      const updateData = {
        name: 'InvalidType'
      };

      const response = await request(app)
        .put(`/plans/${plan.id}`)
        .send(updateData);

      expectErrorResponse(response, 400);
      expect(response.body.error).toBe('Type de plan invalide');
    });
  });

  describe('DELETE /plans/:id', () => {
    test('should delete plan without authentication (public endpoint)', async () => {
      const plan = await models.Plan.create(createTestPlan());

      const response = await request(app).delete(`/plans/${plan.id}`);

      expectSuccessResponse(response);
      expect(response.body.message).toBe('Plan supprimé avec succès');

      const deletedPlan = await models.Plan.findByPk(plan.id);
      expect(deletedPlan).toBeNull();
    });
  });

  describe('PATCH /plans/:id/toggle-status', () => {
    test('should require superAdmin authentication', async () => {
      const plan = await models.Plan.create(createTestPlan());

      const response = await request(app).patch(`/plans/${plan.id}/toggle-status`);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should toggle plan status with superAdmin authentication', async () => {
      const plan = await models.Plan.create(createTestPlan({ is_active: true }));

      const appWithAuth = express();
      appWithAuth.use(express.json());
      
      appWithAuth.use('/plans/:id/toggle-status', (req, res, next) => {
        req.user = { role: 'superAdmin', id: 1 };
        req.authInfo = { userId: 1, role: 'superAdmin' };
        next();
      });
      
      appWithAuth.use('/plans', planRoutes);

      const response = await request(appWithAuth).patch(`/plans/${plan.id}/toggle-status`);

      expectSuccessResponse(response);
      expect(response.body.plan.is_active).toBe(false);
      expect(response.body.message).toContain('désactivé');
    });

    test('should toggle inactive plan to active', async () => {
      const plan = await models.Plan.create(createTestPlan({ is_active: false }));

      const appWithAuth = express();
      appWithAuth.use(express.json());
      
      appWithAuth.use('/plans/:id/toggle-status', (req, res, next) => {
        req.user = { role: 'superAdmin', id: 1 };
        req.authInfo = { userId: 1, role: 'superAdmin' };
        next();
      });
      
      appWithAuth.use('/plans', planRoutes);

      const response = await request(appWithAuth).patch(`/plans/${plan.id}/toggle-status`);

      expectSuccessResponse(response);
      expect(response.body.plan.is_active).toBe(true);
      expect(response.body.message).toContain('activé');
    });

    test('should return 404 for non-existent plan', async () => {
      const appWithAuth = express();
      appWithAuth.use(express.json());
      
      appWithAuth.use('/plans/:id/toggle-status', (req, res, next) => {
        req.user = { role: 'superAdmin', id: 1 };
        req.authInfo = { userId: 1, role: 'superAdmin' };
        next();
      });
      
      appWithAuth.use('/plans', planRoutes);

      const response = await request(appWithAuth).patch('/plans/999/toggle-status');

      expectErrorResponse(response, 404, 'Plan non trouvé');
    });
  });

  describe('Validation middleware', () => {
    test('should validate plan type in middleware', async () => {
      const planData = {
        name: 'Enterprise', 
        description: 'Enterprise plan',
        price: 99.99
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expectErrorResponse(response, 400);
      expect(response.body.error).toBe('Type de plan invalide');
      expect(response.body.validTypes).toContain('Free');
      expect(response.body.validTypes).toContain('Basic');
      expect(response.body.validTypes).toContain('Pro');
    });

    test('should allow valid plan types', async () => {
      const validTypes = ['Free', 'Basic', 'Pro'];
      
      for (const type of validTypes) {
        const planData = {
          name: type,
          description: `${type} plan`,
          price: type === 'Free' ? 0 : 12.00,
          type: type.toLowerCase()
        };

        const response = await request(app)
          .post('/plans')
          .send(planData);

        expectSuccessResponse(response);
        expect(response.body.plan.name).toBe(type);
      }
    });

    test('should pass validation when name is not provided', async () => {
      const planData = {
        description: 'Plan without name',
        price: 12.00,
        type: 'premium'
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).not.toBe(400);
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      jest.spyOn(models.Plan, 'findAll').mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app).get('/plans');

      expectErrorResponse(response, 500);
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/plans')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expectErrorResponse(response, 400);
    });
  });
});
