const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../routes/projectRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

describe('Project Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    test('should get user projects', async () => {
      const projects = [
        {
          id: 1,
          userId: 1,
          name: 'Test Project',
          status: 'active'
        }
      ];
      mockModels.Project.findAll.mockResolvedValue(projects);

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
    });

    test('should filter projects by status', async () => {
      mockModels.Project.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/projects?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /api/projects', () => {
    test('should create new project', async () => {
      const projectData = {
        name: 'New Project',
        description: 'Test description'
      };

      mockModels.Project.create.mockResolvedValue({
        id: 1,
        ...projectData,
        userId: 1
      });

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should get project by id', async () => {
      mockModels.Project.findOne.mockResolvedValue({
        id: 1,
        name: 'Test Project',
        userId: 1
      });

      const response = await request(app)
        .get('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/projects/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    test('should update project', async () => {
      const updateData = { name: 'Updated Project' };
      
      mockModels.Project.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        name: 'Old Name'
      });
      mockModels.Project.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project', async () => {
      mockModels.Project.findOne.mockResolvedValue({
        id: 1,
        userId: 1
      });
      mockModels.Project.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /api/projects/:id/duplicate', () => {
    test('should duplicate project', async () => {
      mockModels.Project.findOne.mockResolvedValue({
        id: 1,
        name: 'Original Project',
        userId: 1
      });
      mockModels.Project.create.mockResolvedValue({
        id: 2,
        name: 'Copy of Original Project',
        userId: 1
      });

      const response = await request(app)
        .post('/api/projects/1/duplicate')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });
  });

  describe('Project VCards Management', () => {
    test('should get project vcards', async () => {
      mockModels.Project.findOne.mockResolvedValue({ id: 1, userId: 1 });
      mockModels.VCard.findAll.mockResolvedValue([
        { id: 1, name: 'VCard 1', projectId: 1 }
      ]);

      const response = await request(app)
        .get('/api/projects/1/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should add vcard to project', async () => {
      mockModels.Project.findOne.mockResolvedValue({ id: 1, userId: 1 });
      mockModels.VCard.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        projectId: null
      });
      mockModels.VCard.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/projects/1/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ vcardId: 1 });

      expectSuccessResponse(response);
    });

    test('should remove vcard from project', async () => {
      mockModels.Project.findOne.mockResolvedValue({ id: 1, userId: 1 });
      mockModels.VCard.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        projectId: 1
      });
      mockModels.VCard.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/api/projects/1/vcards/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.Project.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle authorization errors', async () => {
      const response = await request(app)
        .get('/api/projects/1');

      // Without auth token, should fail
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
