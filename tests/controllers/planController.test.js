const request = require('supertest');
const express = require('express');
const planController = require('../../controllers/PlanController');
const { createMockModels } = require('../utils/mockModels');
const { 
  createTestPlan, 
  expectSuccessResponse, 
  expectErrorResponse,
  expectValidationError,
} = require('../utils/testHelpers');

describe('PlanController', () => {
  let app;
  let models;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });

    app = express();
    app.use(express.json());
    
    // Middleware pour injecter les models dans req
    app.use((req, res, next) => {
      req.models = models;
      next();
    });
    
    // Routes corrigées pour correspondre au controller
    app.get('/plans', planController.getAllPlans);
    app.get('/plans/free', planController.getFreePlan);
    app.get('/plans/search', planController.searchPlans);
    app.post('/plans', planController.validatePlanType, planController.createPlan);
    app.get('/plans/:id', planController.getPlanById);
    app.put('/plans/:id', planController.validatePlanType, planController.updatePlan);
    app.delete('/plans/:id', planController.deletePlan);
    
    app.patch('/plans/:id/toggle-status', (req, res, next) => {
      req.user = { role: 'superAdmin' };
      next();
    }, planController.togglePlanStatus);
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await models.Plan.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    // Fermer la connexion à la base de données après tous les tests
    if (models && models.sequelize) {
      await models.sequelize.close();
    }
  });

  describe('GET /plans - getAllPlans', () => {
    test('should return all plans successfully', async () => {
      await models.Plan.create(createTestPlan({ name: 'Free', price: 0 }));
      await models.Plan.create(createTestPlan({ name: 'Basic', price: 12.00 }));
      await models.Plan.create(createTestPlan({ name: 'Pro', price: 29.00 }));

      const response = await request(app).get('/plans');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].name).toBe('Free');
      expect(response.body.data[1].name).toBe('Basic');
      expect(response.body.data[2].name).toBe('Pro');
    });

    test('should return empty array when no plans exist', async () => {
      const response = await request(app).get('/plans');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(0);
    });

    test('should handle database error gracefully', async () => {
      // Mock temporaire pour simuler une erreur
      const originalFindAll = models.Plan.findAll;
      models.Plan.findAll = jest.fn().mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/plans');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Erreur serveur');

      // Restaurer la méthode originale
      models.Plan.findAll = originalFindAll;
    });
  });

  describe('GET /plans/free - getFreePlan', () => {
    test('should return free plan when it exists', async () => {
      const freePlan = await models.Plan.create(createTestPlan({ 
        name: 'Free', 
        price: 0
      }));

      const response = await request(app).get('/plans/free');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe('Free');
      expect(response.body.data.price).toBe(0);
    });

    test('should return 404 when free plan does not exist', async () => {
      const response = await request(app).get('/plans/free');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Aucun plan gratuit trouvé');
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
        price: 12.00,
        is_active: true
      }));
      await models.Plan.create(createTestPlan({ 
        name: 'Pro', 
        description: 'Plan professionnel',
        price: 29.00,
        is_active: false
      }));
    });

    test('should search plans by name', async () => {
      const response = await request(app).get('/plans/search?q=Basic');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Basic');
    });

    test('should search plans by description', async () => {
      const response = await request(app).get('/plans/search?q=gratuit');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Free');
    });

    test('should filter active plans only', async () => {
      const response = await request(app).get('/plans/search?activeOnly=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every(plan => plan.is_active)).toBe(true);
    });

    test('should return all plans when no search query', async () => {
      const response = await request(app).get('/plans/search');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(3);
    });

    test('should return empty results for non-matching query', async () => {
      const response = await request(app).get('/plans/search?q=nonexistent');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /plans - createPlan', () => {
    test('should create plan successfully', async () => {
      const planData = {
        name: 'Basic',
        description: 'Plan basique',
        price: 12.00,
        duration_days: 30
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe(planData.name);
      expect(response.body.data.price).toBe(12);
    });

    test('should reject invalid plan type', async () => {
      const planData = {
        name: 'InvalidType',
        description: 'Plan invalide',
        price: 12.00,
        duration_days: 30
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(400);
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

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Name, price and duration_days are required fields');
    });
  });

  describe('GET /plans/:id - getPlanById', () => {
    test('should return plan by id successfully', async () => {
      const plan = await models.Plan.create(createTestPlan());

      const response = await request(app).get(`/plans/${plan.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.id).toBe(plan.id);
      expect(response.body.data.name).toBe(plan.name);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(app).get('/plans/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Plan non trouvé');
    });

    test('should handle invalid id format', async () => {
      const response = await request(app).get('/plans/invalid-id');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Erreur serveur');
    });
  });

  describe('PUT /plans/:id - updatePlan', () => {
    test('should update plan successfully', async () => {
      const plan = await models.Plan.create(createTestPlan({ name: 'Basic' }));
      const updateData = {
        name: 'Basic',
        description: 'Plan mis à jour',
        price: 12.00
      };

      const response = await request(app)
        .put(`/plans/${plan.id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.description).toBe(updateData.description);
    });

    test('should return 404 for non-existent plan', async () => {
      const updateData = {
        name: 'Basic',
        description: 'Plan inexistant'
      };

      const response = await request(app)
        .put('/plans/999')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Plan non trouvé');
    });

    test('should reject invalid plan type on update', async () => {
      const plan = await models.Plan.create(createTestPlan({ name: 'Basic' }));
      const updateData = {
        name: 'InvalidType'
      };

      const response = await request(app)
        .put(`/plans/${plan.id}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Type de plan invalide');
      expect(response.body.validTypes).toEqual(['Free', 'Basic', 'Pro']);
    });
  });

  describe('DELETE /plans/:id - deletePlan', () => {
    test('should delete plan successfully', async () => {
      const plan = await models.Plan.create(createTestPlan());

      const response = await request(app).delete(`/plans/${plan.id}`);

      expect(response.status).toBe(204);

      const deletedPlan = await models.Plan.findByPk(plan.id);
      expect(deletedPlan).toBeNull();
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(app).delete('/plans/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Plan non trouvé');
    });
  });

  describe('PATCH /plans/:id/toggle-status - togglePlanStatus', () => {
    test('should toggle plan status successfully', async () => {
      const plan = await models.Plan.create(createTestPlan({ is_active: true }));

      const response = await request(app).patch(`/plans/${plan.id}/toggle-status`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.is_active).toBe(false);
    });

    test('should toggle inactive plan to active', async () => {
      const plan = await models.Plan.create(createTestPlan({ is_active: false }));

      const response = await request(app).patch(`/plans/${plan.id}/toggle-status`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.is_active).toBe(true);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(app).patch('/plans/999/toggle-status');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Plan non trouvé');
    });
  });

  describe('Additional Edge Cases', () => {
    test('should handle database connection errors', async () => {
      // Fermer temporairement la connexion
      await models.sequelize.close();

      const response = await request(app).get('/plans');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toBe('Erreur serveur');

      // Rouvrir la connexion pour les autres tests
      models = createMockModels();
      await models.sequelize.sync({ force: true });
    });

    test('should validate price and duration_days as numbers', async () => {
      const planData = {
        name: 'Basic',
        price: 'invalid',
        duration_days: 'invalid'
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Price and duration_days must be valid numbers');
    });

    test('should handle features array properly', async () => {
      const planData = {
        name: 'Pro',
        description: 'Plan avec features',
        price: 29.00,
        duration_days: 30,
        features: ['Feature 1', 'Feature 2', 'Feature 3']
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(201);
      expect(response.body.data.features).toEqual(['Feature 1', 'Feature 2', 'Feature 3']);
    });

    test('should handle string features properly', async () => {
      const planData = {
        name: 'Pro',
        description: 'Plan avec features string',
        price: 29.00,
        duration_days: 30,
        features: 'Feature 1, Feature 2, Feature 3'
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(201);
      expect(response.body.data.features).toEqual(['Feature 1', 'Feature 2', 'Feature 3']);
    });
  });
});