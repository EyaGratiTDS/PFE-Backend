const {
  validatePlanType,
  searchPlans,
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  getFreePlan,
  VALID_PLAN_TYPES
} = require('../../controllers/planController');

const { Op } = require('sequelize');

jest.mock('sequelize', () => ({
  Op: {
    or: Symbol('or'),
    like: Symbol('like')
  }
}));

describe('Plan Controller', () => {
  let req, res, next, mockPlan;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
      models: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn()
    };
    next = jest.fn();

    mockPlan = {
      id: 1,
      name: 'Pro',
      description: 'Plan professionnel',
      price: 29.99,
      duration_days: 30,
      features: ['feature1', 'feature2'],
      is_active: true,
      is_default: false,
      update: jest.fn(),
      destroy: jest.fn()
    };

    req.models.Plan = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePlanType', () => {
    test('should call next() when plan type is valid', () => {
      req.body.name = 'Pro';
      
      validatePlanType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 400 error when plan type is invalid', () => {
      req.body.name = 'InvalidType';
      
      validatePlanType(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Type de plan invalide',
        validTypes: VALID_PLAN_TYPES
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() when no name is provided', () => {
      validatePlanType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('searchPlans', () => {
    test('should search plans with query parameter', async () => {
      req.query.q = 'test';
      const mockPlans = [mockPlan];
      req.models.Plan.findAll.mockResolvedValue(mockPlans);

      await searchPlans(req, res);

      expect(req.models.Plan.findAll).toHaveBeenCalledWith({
        where: {
          [Op.or]: [
            { name: { [Op.like]: '%test%' } },
            { description: { [Op.like]: '%test%' } }
          ]
        },
        order: [['price', 'ASC']],
        limit: 20
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPlans,
        count: 1
      });
    });

    test('should filter active plans only', async () => {
      req.query.activeOnly = 'true';
      const mockPlans = [mockPlan];
      req.models.Plan.findAll.mockResolvedValue(mockPlans);

      await searchPlans(req, res);

      expect(req.models.Plan.findAll).toHaveBeenCalledWith({
        where: { is_active: true },
        order: [['price', 'ASC']],
        limit: 20
      });
    });

    test('should handle search error', async () => {
      const error = new Error('Database error');
      req.models.Plan.findAll.mockRejectedValue(error);

      await searchPlans(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Erreur serveur',
        details: 'Database error'
      });
    });
  });

  describe('createPlan', () => {
    test('should create a plan successfully', async () => {
      req.body = {
        name: 'Pro',
        description: 'Test plan',
        price: '29.99',
        duration_days: '30',
        features: ['feature1', 'feature2'],
        is_active: true
      };
      req.models.Plan.create.mockResolvedValue(mockPlan);

      await createPlan(req, res);

      expect(req.models.Plan.create).toHaveBeenCalledWith({
        name: 'Pro',
        description: 'Test plan',
        price: 29.99,
        duration_days: 30,
        features: ['feature1', 'feature2'],
        is_active: true,
        is_default: false
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPlan
      });
    });

    test('should return 400 when required fields are missing', async () => {
      req.body = { name: 'Pro' }; 

      await createPlan(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Name, price and duration_days are required fields'
      });
    });

    test('should return 400 for invalid plan type', async () => {
      req.body = {
        name: 'InvalidType',
        price: '29.99',
        duration_days: '30'
      };

      await createPlan(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid plan type',
        validTypes: VALID_PLAN_TYPES
      });
    });

    test('should handle string features correctly', async () => {
      req.body = {
        name: 'Pro',
        price: '29.99',
        duration_days: '30',
        features: 'feature1, feature2, feature3'
      };
      req.models.Plan.create.mockResolvedValue(mockPlan);

      await createPlan(req, res);

      expect(req.models.Plan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          features: ['feature1', 'feature2', 'feature3']
        })
      );
    });

    test('should return 400 for invalid numbers', async () => {
      req.body = {
        name: 'Pro',
        price: 'invalid',
        duration_days: '30'
      };

      await createPlan(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Price and duration_days must be valid numbers'
      });
    });

    test('should handle validation errors', async () => {
      req.body = {
        name: 'Pro',
        price: '29.99',
        duration_days: '30'
      };
      const validationError = {
        name: 'SequelizeValidationError',
        errors: [
          { path: 'name', message: 'Name is required' }
        ]
      };
      req.models.Plan.create.mockRejectedValue(validationError);

      await createPlan(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: [
          { field: 'name', message: 'Name is required' }
        ]
      });
    });
  });

  describe('getFreePlan', () => {
    test('should return free plan', async () => {
      const freePlan = { ...mockPlan, price: 0.00 };
      req.models.Plan.findAll.mockResolvedValue([freePlan]);

      await getFreePlan(req, res);

      expect(req.models.Plan.findAll).toHaveBeenCalledWith({
        where: { price: 0.00 },
        limit: 1
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: freePlan
      });
    });

    test('should return 404 when no free plan found', async () => {
      req.models.Plan.findAll.mockResolvedValue([]);

      await getFreePlan(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Aucun plan gratuit trouvé'
      });
    });
  });

  describe('getAllPlans', () => {
    test('should get all plans', async () => {
      const mockPlans = [mockPlan];
      req.models.Plan.findAll.mockResolvedValue(mockPlans);

      await getAllPlans(req, res);

      expect(req.models.Plan.findAll).toHaveBeenCalledWith({
        where: {},
        order: [['price', 'ASC']]
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPlans,
        count: 1
      });
    });

    test('should filter active plans only', async () => {
      req.query.active_only = 'true';
      const mockPlans = [mockPlan];
      req.models.Plan.findAll.mockResolvedValue(mockPlans);

      await getAllPlans(req, res);

      expect(req.models.Plan.findAll).toHaveBeenCalledWith({
        where: { is_active: true },
        order: [['price', 'ASC']]
      });
    });

    test('should filter default plans only', async () => {
      req.query.is_default = 'true';
      const mockPlans = [mockPlan];
      req.models.Plan.findAll.mockResolvedValue(mockPlans);

      await getAllPlans(req, res);

      expect(req.models.Plan.findAll).toHaveBeenCalledWith({
        where: { is_default: true },
        order: [['price', 'ASC']]
      });
    });
  });

  describe('getPlanById', () => {
    test('should get plan by id', async () => {
      req.params.id = '1';
      req.models.Plan.findByPk.mockResolvedValue(mockPlan);

      await getPlanById(req, res);

      expect(req.models.Plan.findByPk).toHaveBeenCalledWith('1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPlan
      });
    });

    test('should return 404 when plan not found', async () => {
      req.params.id = '999';
      req.models.Plan.findByPk.mockResolvedValue(null);

      await getPlanById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Plan non trouvé'
      });
    });
  });

  describe('updatePlan', () => {
    test('should update plan successfully', async () => {
      req.params.id = '1';
      req.body = {
        name: 'Updated Plan',
        price: 39.99,
        features: ['new_feature1', 'new_feature2']
      };
      req.models.Plan.findByPk.mockResolvedValue(mockPlan);
      mockPlan.update.mockResolvedValue(mockPlan);

      await updatePlan(req, res);

      expect(mockPlan.update).toHaveBeenCalledWith({
        name: 'Updated Plan',
        price: 39.99,
        features: ['new_feature1', 'new_feature2']
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPlan
      });
    });

    test('should handle string features in update', async () => {
      req.params.id = '1';
      req.body = {
        features: 'feature1, feature2, feature3'
      };
      req.models.Plan.findByPk.mockResolvedValue(mockPlan);
      mockPlan.update.mockResolvedValue(mockPlan);

      await updatePlan(req, res);

      expect(mockPlan.update).toHaveBeenCalledWith({
        features: ['feature1', 'feature2', 'feature3']
      });
    });

    test('should return 404 when plan not found', async () => {
      req.params.id = '999';
      req.models.Plan.findByPk.mockResolvedValue(null);

      await updatePlan(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Plan non trouvé'
      });
    });
  });

  describe('deletePlan', () => {
    test('should delete plan successfully', async () => {
      req.params.id = '1';
      req.models.Plan.findByPk.mockResolvedValue(mockPlan);
      mockPlan.destroy.mockResolvedValue();

      await deletePlan(req, res);

      expect(mockPlan.destroy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    test('should return 404 when plan not found', async () => {
      req.params.id = '999';
      req.models.Plan.findByPk.mockResolvedValue(null);

      await deletePlan(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Plan non trouvé'
      });
    });
  });

  describe('togglePlanStatus', () => {
    test('should toggle plan status successfully', async () => {
      req.params.id = '1';
      const updatedPlan = { ...mockPlan, is_active: false };
      req.models.Plan.findByPk.mockResolvedValue(mockPlan);
      mockPlan.update.mockResolvedValue(updatedPlan);

      await togglePlanStatus(req, res);

      expect(mockPlan.update).toHaveBeenCalledWith({
        is_active: !mockPlan.is_active
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: updatedPlan.id,
          name: updatedPlan.name,
          is_active: updatedPlan.is_active
        }
      });
    });

    test('should return 404 when plan not found', async () => {
      req.params.id = '999';
      req.models.Plan.findByPk.mockResolvedValue(null);

      await togglePlanStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Plan non trouvé'
      });
    });
  });

  describe('Error handling', () => {
    test('should handle database errors in getAllPlans', async () => {
      const error = new Error('Database connection failed');
      req.models.Plan.findAll.mockRejectedValue(error);

      await getAllPlans(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Erreur serveur'
      });
    });

    test('should handle errors in updatePlan', async () => {
      req.params.id = '1';
      req.body = { name: 'Updated' };
      const error = new Error('Update failed');
      req.models.Plan.findByPk.mockResolvedValue(mockPlan);
      mockPlan.update.mockRejectedValue(error);

      await updatePlan(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Données invalides',
        details: 'Update failed'
      });
    });
  });

  describe('VALID_PLAN_TYPES', () => {
    test('should export valid plan types', () => {
      expect(VALID_PLAN_TYPES).toEqual(['Free', 'Basic', 'Pro']);
    });
  });
});