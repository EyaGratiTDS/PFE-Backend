const request = require('supertest');
const express = require('express');
const planRoutes = require('../../routes/planRoutes');
const { createTestToken } = require('../utils/testHelpers');

jest.mock('../../controllers/PlanController', () => ({
  getAllPlans: jest.fn(),
  getFreePlan: jest.fn(),
  searchPlans: jest.fn(),
  createPlan: jest.fn(),
  getPlanById: jest.fn(),
  updatePlan: jest.fn(),
  deletePlan: jest.fn(),
  togglePlanStatus: jest.fn(),
  validatePlanType: jest.fn() 
}));

jest.mock('../../models', () => require('../utils/mockModels'));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  },
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'superadmin' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/plans', planRoutes);

describe('Plan Routes', () => {
  let mockModels;
  let authToken;
  let planController;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    authToken = createTestToken({ id: 1, email: 'test@example.com' });
    planController = require('../../controllers/PlanController');
    jest.clearAllMocks();

    planController.validatePlanType.mockImplementation((req, res, next) => {
      const validTypes = ['Free', 'Basic', 'Pro'];
      if (req.body.name && !validTypes.includes(req.body.name)) {
        return res.status(400).json({
          error: 'Type de plan invalide',
          validTypes: validTypes
        });
      }
      next();
    });
  });

  const createTestPlan = (overrides = {}) => {
    return {
      id: 1,
      name: 'Free',
      description: 'Free plan',
      price: 0,
      currency: 'USD',
      type: 'free',
      is_active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  };

  describe('GET /plans', () => {
    test('should return all plans without authentication', async () => {
      const plans = [
        createTestPlan({ name: 'Free', price: 0 }),
        createTestPlan({ id: 2, name: 'Basic', price: 12.00 }),
        createTestPlan({ id: 3, name: 'Pro', price: 29.00 })
      ];

      planController.getAllPlans.mockImplementation((req, res) => {
        res.status(200).json({ plans });
      });

      const response = await request(app).get('/plans');

      expect(response.status).toBe(200);
      expect(response.body.plans).toHaveLength(3);
      expect(planController.getAllPlans).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors', async () => {
      planController.getAllPlans.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Database connection failed' });
      });

      const response = await request(app).get('/plans');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /plans/free', () => {
    test('should return free plan without authentication', async () => {
      const freePlan = createTestPlan({ 
        name: 'Free', 
        price: 0,
        type: 'free'
      });

      planController.getFreePlan.mockImplementation((req, res) => {
        res.status(200).json({ plan: freePlan });
      });

      const response = await request(app).get('/plans/free');

      expect(response.status).toBe(200);
      expect(response.body.plan.name).toBe('Free');
      expect(planController.getFreePlan).toHaveBeenCalledTimes(1);
    });

    test('should return 404 if free plan not found', async () => {
      planController.getFreePlan.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Plan gratuit non trouvé' });
      });

      const response = await request(app).get('/plans/free');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Plan gratuit non trouvé');
    });
  });

  describe('GET /plans/search', () => {
    test('should search plans without authentication', async () => {
      const searchResults = [
        createTestPlan({ 
          name: 'Basic', 
          description: 'Basic plan',
          price: 12.00
        })
      ];

      planController.searchPlans.mockImplementation((req, res) => {
        expect(req.query.q).toBe('Basic');
        res.status(200).json({ data: searchResults });
      });

      const response = await request(app).get('/plans/search?q=Basic');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Basic');
      expect(planController.searchPlans).toHaveBeenCalledTimes(1);
    });

    test('should handle empty search results', async () => {
      planController.searchPlans.mockImplementation((req, res) => {
        res.status(200).json({ data: [] });
      });

      const response = await request(app).get('/plans/search?q=NonExistent');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    test('should handle missing search query', async () => {
      planController.searchPlans.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Query parameter required' });
      });

      const response = await request(app).get('/plans/search');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle search parameters', async () => {
      planController.searchPlans.mockImplementation((req, res) => {
        expect(req.query.q).toBe('test');
        expect(req.query.limit).toBe('10');
        expect(req.query.page).toBe('1');
        res.status(200).json({ data: [] });
      });

      const response = await request(app)
        .get('/plans/search?q=test&limit=10&page=1');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /plans', () => {
    test('should create plan with valid data', async () => {
      const planData = {
        name: 'Basic',
        description: 'Basic plan',
        price: 12.00,
        currency: 'USD',
        type: 'premium'
      };

      const createdPlan = createTestPlan({
        id: 1,
        ...planData
      });

      planController.createPlan.mockImplementation((req, res) => {
        res.status(201).json({ plan: createdPlan });
      });

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(201);
      expect(response.body.plan.name).toBe(planData.name);
      expect(planController.validatePlanType).toHaveBeenCalledTimes(1);
      expect(planController.createPlan).toHaveBeenCalledTimes(1);
    });

    test('should validate plan type and reject invalid types', async () => {
      const planData = {
        name: 'InvalidType',
        description: 'Invalid plan',
        price: 12.00
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Type de plan invalide');
      expect(response.body.validTypes).toEqual(['Free', 'Basic', 'Pro']);
      expect(planController.createPlan).not.toHaveBeenCalled();
    });

    test('should allow valid plan types', async () => {
      const validTypes = ['Free', 'Basic', 'Pro'];
      
      for (const type of validTypes) {
        planController.createPlan.mockImplementation((req, res) => {
          const createdPlan = createTestPlan({
            name: type,
            description: `${type} plan`,
            price: type === 'Free' ? 0 : 12.00,
            type: type.toLowerCase()
          });
          res.status(201).json({ plan: createdPlan });
        });

        const planData = {
          name: type,
          description: `${type} plan`,
          price: type === 'Free' ? 0 : 12.00,
          type: type.toLowerCase()
        };

        const response = await request(app)
          .post('/plans')
          .send(planData);

        expect(response.status).toBe(201);
        expect(response.body.plan.name).toBe(type);
      }
    });

    test('should handle creation errors', async () => {
      planController.createPlan.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to create plan' });
      });

      const planData = {
        name: 'Basic',
        description: 'Basic plan',
        price: 12.00
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    test('should pass validation when name is not provided', async () => {
      planController.createPlan.mockImplementation((req, res) => {
        const createdPlan = createTestPlan({
          description: 'Plan without name',
          price: 12.00,
          type: 'premium'
        });
        res.status(201).json({ plan: createdPlan });
      });

      const planData = {
        description: 'Plan without name',
        price: 12.00,
        type: 'premium'
      };

      const response = await request(app)
        .post('/plans')
        .send(planData);

      expect(response.status).toBe(201);
    });
  });

  describe('GET /plans/:id', () => {
    test('should return plan by id without authentication', async () => {
      const plan = createTestPlan({ id: 1 });

      planController.getPlanById.mockImplementation((req, res) => {
        expect(req.params.id).toBe('1');
        res.status(200).json({ plan });
      });

      const response = await request(app).get('/plans/1');

      expect(response.status).toBe(200);
      expect(response.body.plan.id).toBe(1);
      expect(planController.getPlanById).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent plan', async () => {
      planController.getPlanById.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Plan non trouvé' });
      });

      const response = await request(app).get('/plans/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Plan non trouvé');
    });

    test('should handle invalid plan ID format', async () => {
      planController.getPlanById.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Invalid plan ID format' });
      });

      const response = await request(app).get('/plans/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /plans/:id', () => {
    test('should update plan with valid data', async () => {
      const updateData = {
        name: 'Basic',
        description: 'Updated plan',
        price: 12.99
      };

      const updatedPlan = createTestPlan({
        id: 1,
        ...updateData
      });

      planController.updatePlan.mockImplementation((req, res) => {
        expect(req.params.id).toBe('1');
        res.status(200).json({ plan: updatedPlan });
      });

      const response = await request(app)
        .put('/plans/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.plan.description).toBe(updateData.description);
      expect(planController.validatePlanType).toHaveBeenCalledTimes(1);
      expect(planController.updatePlan).toHaveBeenCalledTimes(1);
    });

    test('should validate plan type on update', async () => {
      const updateData = {
        name: 'InvalidType'
      };

      const response = await request(app)
        .put('/plans/1')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Type de plan invalide');
      expect(planController.updatePlan).not.toHaveBeenCalled();
    });

    test('should return 404 for non-existent plan', async () => {
      planController.updatePlan.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Plan non trouvé' });
      });

      const updateData = {
        name: 'Basic',
        description: 'Updated plan'
      };

      const response = await request(app)
        .put('/plans/999')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle update errors', async () => {
      planController.updatePlan.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to update plan' });
      });

      const updateData = {
        name: 'Basic',
        description: 'Updated plan'
      };

      const response = await request(app)
        .put('/plans/1')
        .send(updateData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /plans/:id', () => {
    test('should delete plan without authentication', async () => {
      planController.deletePlan.mockImplementation((req, res) => {
        expect(req.params.id).toBe('1');
        res.status(200).json({ message: 'Plan supprimé avec succès' });
      });

      const response = await request(app).delete('/plans/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Plan supprimé avec succès');
      expect(planController.deletePlan).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent plan', async () => {
      planController.deletePlan.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Plan non trouvé' });
      });

      const response = await request(app).delete('/plans/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle deletion errors', async () => {
      planController.deletePlan.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to delete plan' });
      });

      const response = await request(app).delete('/plans/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /plans/:id/toggle-status', () => {
    test('should toggle plan status with superAdmin authentication', async () => {
      const toggledPlan = createTestPlan({
        id: 1,
        is_active: false
      });

      planController.togglePlanStatus.mockImplementation((req, res) => {
        expect(req.params.id).toBe('1');
        res.status(200).json({
          plan: toggledPlan,
          message: 'Plan désactivé avec succès'
        });
      });

      const response = await request(app)
        .patch('/plans/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.plan.is_active).toBe(false);
      expect(response.body.message).toContain('désactivé');
      expect(planController.togglePlanStatus).toHaveBeenCalledTimes(1);
    });

    test('should toggle inactive plan to active', async () => {
      const toggledPlan = createTestPlan({
        id: 1,
        is_active: true
      });

      planController.togglePlanStatus.mockImplementation((req, res) => {
        res.status(200).json({
          plan: toggledPlan,
          message: 'Plan activé avec succès'
        });
      });

      const response = await request(app)
        .patch('/plans/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.plan.is_active).toBe(true);
      expect(response.body.message).toContain('activé');
    });

    test('should return 404 for non-existent plan', async () => {
      planController.togglePlanStatus.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Plan non trouvé' });
      });

      const response = await request(app)
        .patch('/plans/999/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Plan non trouvé');
    });

    test('should handle toggle errors', async () => {
      planController.togglePlanStatus.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Failed to toggle plan status' });
      });

      const response = await request(app)
        .patch('/plans/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error handling', () => {
    test('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/plans')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    test('should handle missing required fields', async () => {
      planController.createPlan.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Missing required fields' });
      });

      const response = await request(app)
        .post('/plans')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle server errors gracefully', async () => {
      planController.getAllPlans.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app).get('/plans');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Authentication middleware', () => {
    test('should verify all controller methods are defined', async () => {
      expect(planController.getAllPlans).toBeDefined();
      expect(planController.getFreePlan).toBeDefined();
      expect(planController.searchPlans).toBeDefined();
      expect(planController.createPlan).toBeDefined();
      expect(planController.getPlanById).toBeDefined();
      expect(planController.updatePlan).toBeDefined();
      expect(planController.deletePlan).toBeDefined();
      expect(planController.togglePlanStatus).toBeDefined();
      expect(planController.validatePlanType).toBeDefined();
    });
  });
});