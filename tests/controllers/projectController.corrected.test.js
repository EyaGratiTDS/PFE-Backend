const request = require('supertest');
const express = require('express');
const projectController = require('../../controllers/ProjectController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => {
  const { createMockModels } = require('../utils/mockModels');
  return createMockModels();
});
jest.mock('../../services/uploadService');

const app = express();
app.use(express.json());

// Configuration des routes de test basées sur les fonctions réellement disponibles
app.post('/projects', projectController.createProject);
app.get('/projects/:id', projectController.getProjectById);
app.put('/projects/:id', projectController.updateProject);
app.delete('/projects/:id', projectController.deleteProject);
app.get('/projects/user', projectController.getProjectsByUserId);
app.get('/projects/:id/vcards', projectController.getVCardsByProject);
app.get('/admin/projects', projectController.getAllProjectsWithUser);
app.put('/projects/:id/toggle-status', projectController.toggleProjectBlocked);

describe('ProjectController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testProject;

  beforeEach(() => {
    mockModels = require('../../models');
    testUser = createTestUser();
    testProject = {
      id: 1,
      userId: 1,
      name: 'Test Project',
      description: 'Test project description',
      status: 'active',
      color: '#ff0000',
      created_at: new Date(),
      updated_at: new Date()
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('POST /projects', () => {
    test('should create project successfully', async () => {
      const projectData = {
        name: 'New Project',
        description: 'New project description',
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
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(response.body.name).toBe(projectData.name);
    });

    test('should require name and userId', async () => {
      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('mandatory');
    });

    test('should handle user not found', async () => {
      mockModels.User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          userId: 999
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('GET /projects/:id', () => {
    test('should get project by id successfully', async () => {
      mockModels.Project.findByPk.mockResolvedValue(testProject);

      const response = await request(app)
        .get('/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe(testProject.name);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/projects/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /projects/:id', () => {
    test('should update project successfully', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      const updatedProject = { ...testProject, ...updateData };
      mockModels.Project.findByPk.mockResolvedValue(testProject);
      mockModels.Project.update.mockResolvedValue([1]);
      mockModels.Project.findByPk.mockResolvedValueOnce(updatedProject);

      const response = await request(app)
        .put('/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .put('/projects/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /projects/:id', () => {
    test('should delete project successfully', async () => {
      mockModels.Project.findByPk.mockResolvedValue(testProject);
      mockModels.Project.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete('/projects/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /projects/user', () => {
    test('should get projects by user ID', async () => {
      const projects = [
        testProject,
        { ...testProject, id: 2, name: 'Another Project' }
      ];

      mockModels.Project.findAll.mockResolvedValue(projects);

      const response = await request(app)
        .get('/projects/user?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });

    test('should require userId parameter', async () => {
      const response = await request(app)
        .get('/projects/user')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /projects/:id/vcards', () => {
    test('should get VCards by project', async () => {
      const vcards = [
        { id: 1, name: 'VCard 1', projectId: 1 },
        { id: 2, name: 'VCard 2', projectId: 1 }
      ];

      mockModels.Project.findByPk.mockResolvedValue(testProject);
      mockModels.VCard.findAll.mockResolvedValue(vcards);

      const response = await request(app)
        .get('/projects/1/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/projects/999/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /admin/projects', () => {
    test('should get all projects with users for admin', async () => {
      const projects = [
        {
          ...testProject,
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
        .get('/admin/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('PUT /projects/:id/toggle-status', () => {
    test('should toggle project status', async () => {
      const toggledProject = {
        ...testProject,
        status: 'blocked'
      };

      mockModels.Project.findByPk.mockResolvedValue(testProject);
      mockModels.Project.update.mockResolvedValue([1]);
      mockModels.Project.findByPk.mockResolvedValueOnce(toggledProject);

      const response = await request(app)
        .put('/projects/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .put('/projects/999/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors in createProject', async () => {
      mockModels.User.findByPk.mockResolvedValue({ id: 1 });
      mockModels.Project.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          userId: 1
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
    });

    test('should handle database errors in getProjectById', async () => {
      mockModels.Project.findByPk.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle database errors in updateProject', async () => {
      mockModels.Project.findByPk.mockResolvedValue(testProject);
      mockModels.Project.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Project' });

      expectErrorResponse(response);
    });

    test('should handle database errors in deleteProject', async () => {
      mockModels.Project.findByPk.mockResolvedValue(testProject);
      mockModels.Project.destroy.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });
});
