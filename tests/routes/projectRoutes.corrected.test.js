const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projectRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => {
  const { createMockModels } = require('../utils/mockModels');
  return createMockModels();
});
jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  },
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
    next();
  }
}));
jest.mock('../../services/uploadService', () => ({
  upload: {
    single: () => (req, res, next) => {
      req.file = { filename: 'test-logo.jpg' };
      next();
    }
  }
}));
jest.mock('../../middleware/planLimiter', () => ({
  checkProjectCreation: (req, res, next) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

describe('Project Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    mockModels = require('../../models');
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('POST /api/projects', () => {
    test('should create new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test project description',
        color: '#ff0000',
        userId: 1
      };

      const createdProject = {
        id: 1,
        ...projectData,
        status: 'active',
        logo: '/uploads/test-logo.jpg'
      };

      mockModels.User.findByPk.mockResolvedValue({ id: 1, email: 'test@example.com' });
      mockModels.Project.create.mockResolvedValue(createdProject);

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should require name and userId', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('mandatory');
    });

    test('should handle user not found', async () => {
      mockModels.User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          userId: 999
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('GET /api/projects/user', () => {
    test('should get projects by user ID', async () => {
      const projects = [
        {
          id: 1,
          name: 'Project 1',
          userId: 1
        },
        {
          id: 2,
          name: 'Project 2',
          userId: 1
        }
      ];

      mockModels.Project.findAll.mockResolvedValue(projects);

      const response = await request(app)
        .get('/api/projects/user?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should get project by ID', async () => {
      const project = {
        id: 1,
        name: 'Test Project',
        userId: 1
      };

      mockModels.Project.findByPk.mockResolvedValue(project);

      const response = await request(app)
        .get('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe('Test Project');
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/projects/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      const existingProject = {
        id: 1,
        name: 'Old Project',
        userId: 1
      };

      const updatedProject = {
        ...existingProject,
        ...updateData
      };

      mockModels.Project.findByPk.mockResolvedValue(existingProject);
      mockModels.Project.update.mockResolvedValue([1]);
      mockModels.Project.findByPk.mockResolvedValueOnce(updatedProject);

      const response = await request(app)
        .put('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      const project = {
        id: 1,
        name: 'Test Project',
        userId: 1
      };

      mockModels.Project.findByPk.mockResolvedValue(project);
      mockModels.Project.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/projects/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/vcards', () => {
    test('should get VCards by project', async () => {
      const project = { id: 1, userId: 1 };
      const vcards = [
        { id: 1, name: 'VCard 1', projectId: 1 },
        { id: 2, name: 'VCard 2', projectId: 1 }
      ];

      mockModels.Project.findByPk.mockResolvedValue(project);
      mockModels.VCard.findAll.mockResolvedValue(vcards);

      const response = await request(app)
        .get('/api/projects/1/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/projects/projects-with-users (Admin)', () => {
    test('should get all projects with users for admin', async () => {
      const projects = [
        {
          id: 1,
          name: 'Project 1',
          User: { id: 1, email: 'user1@example.com' }
        },
        {
          id: 2,
          name: 'Project 2',
          User: { id: 2, email: 'user2@example.com' }
        }
      ];

      mockModels.Project.findAll.mockResolvedValue(projects);

      const response = await request(app)
        .get('/api/projects/projects-with-users')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('PUT /api/projects/:id/toggle-status (Admin)', () => {
    test('should toggle project status', async () => {
      const project = {
        id: 1,
        name: 'Test Project',
        status: 'active'
      };

      const toggledProject = {
        ...project,
        status: 'blocked'
      };

      mockModels.Project.findByPk.mockResolvedValue(project);
      mockModels.Project.update.mockResolvedValue([1]);
      mockModels.Project.findByPk.mockResolvedValueOnce(toggledProject);

      const response = await request(app)
        .put('/api/projects/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors on project creation', async () => {
      mockModels.User.findByPk.mockResolvedValue({ id: 1 });
      mockModels.Project.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          userId: 1
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
    });

    test('should handle database errors on project fetch', async () => {
      mockModels.Project.findByPk.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle database errors on project update', async () => {
      mockModels.Project.findByPk.mockResolvedValue({ id: 1, userId: 1 });
      mockModels.Project.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Project' });

      expectErrorResponse(response);
    });

    test('should handle database errors on project deletion', async () => {
      mockModels.Project.findByPk.mockResolvedValue({ id: 1, userId: 1 });
      mockModels.Project.destroy.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });
});
