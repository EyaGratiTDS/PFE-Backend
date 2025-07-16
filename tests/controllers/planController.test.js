const request = require('supertest');
const express = require('express');
const planController = require('../../controllers/PlanController');
const { createMockModels } = require('../utils/mockModels');
const { 
  createTestPlan, 
  createTestToken, 
  expectSuccessResponse, 
  expectErrorResponse,
  expectValidationError,
  expectUnauthorizedError
} = require('../utils/testHelpers');

describe('PlanController', () => {
  let app;
  let models;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });

    // Configuration de l'app Express pour les tests
    app = express();
    app.use(express.json());
    
    // Routes de test
    app.get('/plans', planController.getAllPlans);
    app.get('/plans/free', planController.getFreePlan);
    app.get('/plans/search', planController.searchPlans);
    app.post('/plans', planController.validatePlanType, planController.createPlan);
    app.get('/plans/:id', planController.getPlanById);
    app.put('/plans/:id', planController.validatePlanType, planController.updatePlan);
    app.delete('/plans/:id', planController.deletePlan);
    
    // Mock du middleware requireAuthSuperAdmin pour les tests
    app.patch('/plans/:id/toggle-status', (req, res, next) => {
      req.user = { role: 'superAdmin' };
      next();
    }, planController.togglePlanStatus);
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await models.Plan.destroy({ where: {} });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe('GET /plans - getAllPlans', () => {
    test('should return all plans successfully', async () => {
      // Créer des plans de test
      await models.Plan.create(createTestPlan({ name: 'Free', price: 0 }));
      await models.Plan.create(createTestPlan({ name: 'Basic', price: 9.99 }));
      await models.Plan.create(createTestPlan({ name: 'Pro', price: 19.99 }));

      const response = await request(app).get('/plans');

      expectSuccessResponse(response);
      expect(response.body.plans).toHaveLength(3);
      expect(response.body.plans[0].name).toBe('Free');
      expect(response.body.plans[1].name).toBe('Basic');
      expect(response.body.plans[2].name).toBe('Pro');
    });

    test('should return empty array when no plans exist', async () => {
      const response = await request(app).get('/plans');

      expectSuccessResponse(response);
      expect(response.body.plans).toHaveLength(0);
    });

    test('should handle database error gracefully', async () => {
      // Mock une erreur de base de données
      jest.spyOn(models.Plan, 'findAll').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/plans');

      expectErrorResponse(response, 500, 'Erreur lors de la récupération des plans');
    });
  });

  describe('GET /plans/free - getFreePlan', () => {
    test('should return free plan when it exists', async () => {
      const freePlan = await models.Plan.create(createTestPlan({ 
        name: 'Free', 
        price: 0,
        type: 'free'
      }));

      const response = await request(app).get('/plans/free');

      expectSuccessResponse(response);
      expect(response.body.plan.name).toBe('Free');
      expect(response.body.plan.price).toBe('0.00');
    });

    test('should return 404 when free plan does not exist', async () => {
      const response = await request(app).get('/plans/free');

      expectErrorResponse(response, 404, 'Plan gratuit non trouvé');
    });
  });

  describe('GET /plans/search - searchPlans', () => {
    beforeEach(async () => {
      await models.Plan.create(createTestPlan({ 
        name: 'Free', 
        description: 'Plan gratuit',
        price: 0,
        is_active: true
      }));
      await models.Plan.create(createTestPlan({ 
        name: 'Basic', 
        description: 'Plan basique',
        price: 9.99,
        is_active: true
      }));
      await models.Plan.create(createTestPlan({ 
        name: 'Pro', 
        description: 'Plan professionnel',
        price: 19.99,
        is_active: false
      }));
    });

    test('should search plans by name', async () => {
      const response = await request(app).get('/plans/search?q=Basic');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Basic');
    });

    test('should search plans by description', async () => {
      const response = await request(app).get('/plans/search?q=gratuit');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Free');
    });

    test('should filter active plans only', async () => {
      const response = await request(app).get('/plans/search?activeOnly=true');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every(plan => plan.is_active)).toBe(true);
    });

    test('should return all plans when no search query', async () => {
      const response = await request(app).get('/plans/search');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(3);
    });

    test('should return empty results for non-matching query', async () => {
      const response = await request(app).get('/plans/search?q=nonexistent');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /plans - createPlan', () => {
    test('should create plan successfully', async () => {
      const planData = {
        name: 'Basic',
        description: 'Plan basique',
        price: 9.99,
        currency: 'USD',
        type: 'premium'
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expectSuccessResponse(response);
      expect(response.body.plan.name).toBe(planData.name);
      expect(response.body.plan.price).toBe('9.99');
    });

    test('should reject invalid plan type', async () => {
      const planData = {
        name: 'InvalidType',
        description: 'Plan invalide',
        price: 9.99
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expectValidationError(response);
      expect(response.body.error).toBe('Type de plan invalide');
      expect(response.body.validTypes).toEqual(['Free', 'Basic', 'Pro']);
    });

    test('should handle missing required fields', async () => {
      const planData = {
        description: 'Plan sans nom'
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expectErrorResponse(response, 500);
    });
  });

  describe('GET /plans/:id - getPlanById', () => {
    test('should return plan by id successfully', async () => {
      const plan = await models.Plan.create(createTestPlan());

      const response = await request(app).get(`/plans/${plan.id}`);

      expectSuccessResponse(response);
      expect(response.body.plan.id).toBe(plan.id);
      expect(response.body.plan.name).toBe(plan.name);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(app).get('/plans/999');

      expectErrorResponse(response, 404, 'Plan non trouvé');
    });

    test('should handle invalid id format', async () => {
      const response = await request(app).get('/plans/invalid-id');

      expectErrorResponse(response, 500);
    });
  });

  describe('PUT /plans/:id - updatePlan', () => {
    test('should update plan successfully', async () => {
      const plan = await models.Plan.create(createTestPlan());
      const updateData = {
        name: 'Basic',
        description: 'Plan mis à jour',
        price: 12.99
      };

      const response = await request(app)
        .put(`/plans/${plan.id}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(response.body.plan.description).toBe(updateData.description);
      expect(response.body.plan.price).toBe('12.99');
    });

    test('should return 404 for non-existent plan', async () => {
      const updateData = {
        name: 'Basic',
        description: 'Plan inexistant'
      };

      const response = await request(app)
        .put('/plans/999')
        .send(updateData);

      expectErrorResponse(response, 404, 'Plan non trouvé');
    });

    test('should reject invalid plan type on update', async () => {
      const plan = await models.Plan.create(createTestPlan());
      const updateData = {
        name: 'InvalidType'
      };

      const response = await request(app)
        .put(`/plans/${plan.id}`)
        .send(updateData);

      expectValidationError(response);
    });
  });

  describe('DELETE /plans/:id - deletePlan', () => {
    test('should delete plan successfully', async () => {
      const plan = await models.Plan.create(createTestPlan());

      const response = await request(app).delete(`/plans/${plan.id}`);

      expectSuccessResponse(response);
      expect(response.body.message).toBe('Plan supprimé avec succès');

      // Vérifier que le plan a été supprimé
      const deletedPlan = await models.Plan.findByPk(plan.id);
      expect(deletedPlan).toBeNull();
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(app).delete('/plans/999');

      expectErrorResponse(response, 404, 'Plan non trouvé');
    });
  });

  describe('PATCH /plans/:id/toggle-status - togglePlanStatus', () => {
    test('should toggle plan status successfully', async () => {
      const plan = await models.Plan.create(createTestPlan({ is_active: true }));

      const response = await request(app).patch(`/plans/${plan.id}/toggle-status`);

      expectSuccessResponse(response);
      expect(response.body.plan.is_active).toBe(false);
      expect(response.body.message).toContain('désactivé');
    });

    test('should toggle inactive plan to active', async () => {
      const plan = await models.Plan.create(createTestPlan({ is_active: false }));

      const response = await request(app).patch(`/plans/${plan.id}/toggle-status`);

      expectSuccessResponse(response);
      expect(response.body.plan.is_active).toBe(true);
      expect(response.body.message).toContain('activé');
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(app).patch('/plans/999/toggle-status');

      expectErrorResponse(response, 404, 'Plan non trouvé');
    });
  });
});
