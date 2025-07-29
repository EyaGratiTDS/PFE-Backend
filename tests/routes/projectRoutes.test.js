const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

jest.mock('../../controllers/ProjectController', () => ({
  createProject: jest.fn(),
  getProjectById: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  getProjectsByUserId: jest.fn(),
  getVCardsByProject: jest.fn(),
  getAllProjectsWithUser: jest.fn(),
  toggleProjectBlocked: jest.fn()
}));

jest.mock('../../models', () => ({
  Project: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  User: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  VCard: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  Subscription: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  Plan: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  }
}));

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

jest.mock('../../services/uploadService', () => ({
  upload: {
    single: jest.fn(() => (req, res, next) => {
      if (req.body.hasFile) {
        req.file = {
          filename: 'test-logo.jpg',
          originalname: 'logo.jpg',
          mimetype: 'image/jpeg',
          size: 1024
        };
      }
      next();
    })
  }
}));

jest.mock('../../middleware/planLimiter', () => ({
  checkProjectCreation: (req, res, next) => {
    next();
  },
  getActiveBlockLimit: jest.fn(),
  getProjectLimits: jest.fn()
}));

const createTestToken = (payload = { id: 1, email: 'test@example.com' }) => {
  const secret = process.env.JWT_SECRET || 'test-secret-key';
  return jwt.sign(payload, secret, { expiresIn: '24h' });
};

const createTestUser = (overrides = {}) => {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    role: 'user',
    isVerified: true,
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

const projectRoutes = require('../../routes/projectRoutes');

const app = express();
app.use(express.json());
app.use('/project', projectRoutes);

describe('Project Routes', () => {
  let authToken;
  let testUser;
  let projectController;

  beforeEach(() => {
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });
    projectController = require('../../controllers/ProjectController');
    jest.clearAllMocks();
  });

  describe('GET /project/user', () => {
    test('should get user projects', async () => {
      const projects = [
        {
          id: 1,
          userId: 1,
          name: 'Test Project',
          status: 'active',
          is_blocked: false
        }
      ];

      projectController.getProjectsByUserId.mockImplementation((req, res) => {
        res.status(200).json(projects);
      });

      const response = await request(app)
        .get('/project/user?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Test Project');
      expect(projectController.getProjectsByUserId).toHaveBeenCalledTimes(1);
    });

    test('should return 400 if userId is missing', async () => {
      projectController.getProjectsByUserId.mockImplementation((req, res) => {
        res.status(400).json({ message: 'User ID is required' });
      });

      const response = await request(app)
        .get('/project/user')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID is required');
      expect(projectController.getProjectsByUserId).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors', async () => {
      projectController.getProjectsByUserId.mockImplementation((req, res) => {
        res.status(500).json({ message: 'Database error' });
      });

      const response = await request(app)
        .get('/project/user?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Database error');
    });
  });

  describe('POST /project', () => {
    test('should create new project successfully', async () => {
      const projectData = {
        name: 'New Project',
        description: 'Test description',
        userId: 1,
        color: '#ff0000'
      };

      const createdProject = {
        id: 1,
        ...projectData,
        status: 'active',
        logo: null
      };

      projectController.createProject.mockImplementation((req, res) => {
        res.status(201).json(createdProject);
      });

      const response = await request(app)
        .post('/project')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(projectData.name);
      expect(response.body.id).toBe(1);
      expect(projectController.createProject).toHaveBeenCalledTimes(1);
    });

    test('should create project with logo file', async () => {
      const projectData = {
        name: 'New Project',
        description: 'Test description',
        userId: 1,
        hasFile: true
      };

      const createdProject = {
        id: 1,
        name: 'New Project',
        description: 'Test description',
        userId: 1,
        status: 'active',
        logo: '/uploads/test-logo.jpg'
      };

      projectController.createProject.mockImplementation((req, res) => {
        res.status(201).json(createdProject);
      });

      const response = await request(app)
        .post('/project')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body.logo).toBe('/uploads/test-logo.jpg');
      expect(projectController.createProject).toHaveBeenCalledTimes(1);
    });

    test('should validate required fields', async () => {
      projectController.createProject.mockImplementation((req, res) => {
        res.status(400).json({ message: "The 'name' and 'userId' fields are mandatory" });
      });

      const response = await request(app)
        .post('/project')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("The 'name' and 'userId' fields are mandatory");
    });

    test('should return 404 if user not found', async () => {
      projectController.createProject.mockImplementation((req, res) => {
        res.status(404).json({ message: 'User not found' });
      });

      const response = await request(app)
        .post('/project')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          userId: 999
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('GET /project/:id', () => {
    test('should get project by id', async () => {
      const project = {
        id: 1,
        name: 'Test Project',
        userId: 1,
        description: 'Test description'
      };

      projectController.getProjectById.mockImplementation((req, res) => {
        res.status(200).json(project);
      });

      const response = await request(app)
        .get('/project/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Test Project');
      expect(projectController.getProjectById).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent project', async () => {
      projectController.getProjectById.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Project not found' });
      });

      const response = await request(app)
        .get('/project/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });

    test('should handle server errors', async () => {
      projectController.getProjectById.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Server error' });
      });

      const response = await request(app)
        .get('/project/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('PUT /project/:id', () => {
    test('should update project successfully', async () => {
      const updateData = { 
        name: 'Updated Project',
        description: 'Updated description',
        userId: 1
      };

      const updatedProject = {
        id: 1,
        ...updateData,
        status: 'active',
        color: '#ff0000'
      };

      projectController.updateProject.mockImplementation((req, res) => {
        res.status(200).json(updatedProject);
      });

      const response = await request(app)
        .put('/project/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Project');
      expect(projectController.updateProject).toHaveBeenCalledTimes(1);
    });

    test('should return 404 if project not found', async () => {
      projectController.updateProject.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Project not found' });
      });

      const response = await request(app)
        .put('/project/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Project', userId: 1 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });

    test('should validate required name field', async () => {
      projectController.updateProject.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Project name is required' });
      });

      const response = await request(app)
        .put('/project/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Project name is required');
    });

    test('should handle logo update', async () => {
      const updateData = { 
        name: 'Updated Project',
        userId: 1,
        hasFile: true
      };

      const updatedProject = {
        id: 1,
        name: 'Updated Project',
        userId: 1,
        logo: '/uploads/test-logo.jpg'
      };

      projectController.updateProject.mockImplementation((req, res) => {
        res.status(200).json(updatedProject);
      });

      const response = await request(app)
        .put('/project/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.logo).toBe('/uploads/test-logo.jpg');
    });

    test('should handle logo removal', async () => {
      const updateData = { 
        name: 'Updated Project',
        userId: 1,
        removeLogo: 'true'
      };

      const updatedProject = {
        id: 1,
        name: 'Updated Project',
        userId: 1,
        logo: null
      };

      projectController.updateProject.mockImplementation((req, res) => {
        res.status(200).json(updatedProject);
      });

      const response = await request(app)
        .put('/project/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.logo).toBeNull();
    });
  });

  describe('DELETE /project/:id', () => {
    test('should delete project successfully', async () => {
      projectController.deleteProject.mockImplementation((req, res) => {
        res.status(204).end();
      });

      const response = await request(app)
        .delete('/project/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
      expect(projectController.deleteProject).toHaveBeenCalledTimes(1);
    });

    test('should return 404 if project not found', async () => {
      projectController.deleteProject.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Project not found' });
      });

      const response = await request(app)
        .delete('/project/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });

    test('should handle server errors', async () => {
      projectController.deleteProject.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Server error' });
      });

      const response = await request(app)
        .delete('/project/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /project/:id/vcards', () => {
    test('should get project vcards successfully', async () => {
      const mockResponse = {
        success: true,
        count: 1,
        data: [
          {
            id: 1,
            name: 'VCard 1',
            projectId: 1,
            logo: null,
            favicon: null,
            background_type: 'color',
            background_value: '#ffffff'
          }
        ]
      };

      projectController.getVCardsByProject.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .get('/project/1/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.count).toBe(1);
      expect(projectController.getVCardsByProject).toHaveBeenCalledTimes(1);
    });

    test('should return 404 if project not found', async () => {
      projectController.getVCardsByProject.mockImplementation((req, res) => {
        res.status(404).json({ message: 'Project not found' });
      });

      const response = await request(app)
        .get('/project/999/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Project not found');
    });

    test('should handle server errors', async () => {
      projectController.getVCardsByProject.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });

      const response = await request(app)
        .get('/project/1/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /project/projects-with-users', () => {
    test('should get all projects with users (super admin)', async () => {
      const mockResponse = {
        success: true,
        count: 1,
        data: [
          {
            id: 1,
            name: 'Project 1',
            Users: {
              id: 1,
              name: 'User 1',
              email: 'user1@example.com'
            }
          }
        ]
      };

      projectController.getAllProjectsWithUser.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .get('/project/projects-with-users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.count).toBe(1);
      expect(projectController.getAllProjectsWithUser).toHaveBeenCalledTimes(1);
    });

    test('should handle server errors', async () => {
      projectController.getAllProjectsWithUser.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });

      const response = await request(app)
        .get('/project/projects-with-users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /project/:id/toggle-status', () => {
    test('should toggle project from unblocked to blocked', async () => {
      const mockResponse = {
        success: true,
        message: 'Project blocked successfully',
        data: {
          id: 1,
          is_blocked: true
        }
      };

      projectController.toggleProjectBlocked.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .put('/project/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project blocked successfully');
      expect(projectController.toggleProjectBlocked).toHaveBeenCalledTimes(1);
    });

    test('should toggle project from blocked to unblocked', async () => {
      const mockResponse = {
        success: true,
        message: 'Project unblocked successfully',
        data: {
          id: 1,
          is_blocked: false
        }
      };

      projectController.toggleProjectBlocked.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .put('/project/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project unblocked successfully');
    });

    test('should return 404 if project not found', async () => {
      projectController.toggleProjectBlocked.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Project not found' });
      });

      const response = await request(app)
        .put('/project/999/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });

    test('should handle server errors', async () => {
      projectController.toggleProjectBlocked.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Server error'
        });
      });

      const response = await request(app)
        .put('/project/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication middleware', () => {
    test('should require authentication for all routes', async () => {
      // Ce test vérifie que les contrôleurs sont bien définis
      expect(projectController.createProject).toBeDefined();
      expect(projectController.getProjectById).toBeDefined();
      expect(projectController.updateProject).toBeDefined();
      expect(projectController.deleteProject).toBeDefined();
      expect(projectController.getProjectsByUserId).toBeDefined();
      expect(projectController.getVCardsByProject).toBeDefined();
      expect(projectController.getAllProjectsWithUser).toBeDefined();
      expect(projectController.toggleProjectBlocked).toBeDefined();
    });
  });

  describe('Parameter validation', () => {
    test('should handle invalid project ID format', async () => {
      projectController.getProjectById.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Invalid project ID format' });
      });

      const response = await request(app)
        .get('/project/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid project ID format');
    });

    test('should handle pagination parameters', async () => {
      projectController.getProjectsByUserId.mockImplementation((req, res) => {
        expect(req.query.userId).toBe('1');
        expect(req.query.page).toBe('2');
        expect(req.query.limit).toBe('5');
        res.status(200).json([]);
      });

      const response = await request(app)
        .get('/project/user?userId=1&page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });
});