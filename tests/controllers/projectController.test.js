const request = require('supertest');
const express = require('express');
const projectController = require('../../controllers/ProjectController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/uploadService');

const app = express();
app.use(express.json());

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
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    testProject = {
      id: 1,
      userId: 1,
      name: 'Test Project',
      description: 'Test project description',
      status: 'active',
      settings: { theme: 'default', layout: 'grid' },
      created_at: new Date(),
      updated_at: new Date()
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /projects', () => {
    test('should get user projects successfully', async () => {
      const projects = [
        testProject,
        { ...testProject, id: 2, name: 'Another Project' }
      ];

      mockModels.Project.findAll.mockResolvedValue(projects);

      const response = await request(app)
        .get('/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.Project.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: [{ model: mockModels.VCard, as: 'VCards' }],
        order: [['updated_at', 'DESC']]
      });
    });

    test('should filter projects by status', async () => {
      mockModels.Project.findAll.mockResolvedValue([testProject]);

      const response = await request(app)
        .get('/projects?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Project.findAll).toHaveBeenCalledWith({
        where: { userId: 1, status: 'active' },
        include: [{ model: mockModels.VCard, as: 'VCards' }],
        order: [['updated_at', 'DESC']]
      });
    });

    test('should support search functionality', async () => {
      mockModels.Project.findAll.mockResolvedValue([testProject]);

      const response = await request(app)
        .get('/projects?search=Test')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /projects', () => {
    test('should create project successfully', async () => {
      const projectData = {
        name: 'New Project',
        description: 'New project description',
        settings: { theme: 'dark' }
      };

      const createdProject = { ...testProject, ...projectData };
      mockModels.Project.create.mockResolvedValue(createdProject);

      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.Project.create).toHaveBeenCalledWith({
        userId: 1,
        ...projectData,
        status: 'active'
      });
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
      expect(response.body.message).toContain('Name is required');
    });

    test('should validate project name length', async () => {
      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'a'.repeat(256) });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Name is too long');
    });

    test('should set default settings if not provided', async () => {
      const projectData = { name: 'Simple Project' };
      mockModels.Project.create.mockResolvedValue({
        ...testProject,
        ...projectData,
        settings: { theme: 'default', layout: 'list' }
      });

      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expectSuccessResponse(response);
    });
  });

  describe('GET /projects/:id', () => {
    test('should get project by id successfully', async () => {
      mockModels.Project.findOne.mockResolvedValue(testProject);

      const response = await request(app)
        .get('/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe(testProject.name);
    });

    test('should return 404 for non-existent project', async () => {
      mockModels.Project.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/projects/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not allow access to other users projects', async () => {
      mockModels.Project.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(mockModels.Project.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
        include: [{ model: mockModels.VCard, as: 'VCards' }]
      });
    });
  });

  describe('PUT /projects/:id', () => {
    test('should update project successfully', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      const updatedProject = { ...testProject, ...updateData };
      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.Project.update.mockResolvedValue([1]);
      mockModels.Project.findOne.mockResolvedValueOnce(updatedProject);

      const response = await request(app)
        .put('/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(mockModels.Project.update).toHaveBeenCalledWith(
        updateData,
        { where: { id: 1, userId: 1 } }
      );
    });

    test('should validate update data', async () => {
      mockModels.Project.findOne.mockResolvedValue(testProject);

      const response = await request(app)
        .put('/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Name cannot be empty');
    });

    test('should merge settings correctly', async () => {
      const updateData = {
        settings: { theme: 'dark' }
      };

      const updatedProject = {
        ...testProject,
        settings: { ...testProject.settings, theme: 'dark' }
      };

      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.Project.update.mockResolvedValue([1]);
      mockModels.Project.findOne.mockResolvedValueOnce(updatedProject);

      const response = await request(app)
        .put('/projects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('DELETE /projects/:id', () => {
    test('should delete project successfully', async () => {
      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.Project.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/projects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Project.destroy).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });

    test('should handle cascade deletion of related data', async () => {
      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.VCard.update.mockResolvedValue([2]); 
      mockModels.Project.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/projects/1?cascade=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /projects/:id/duplicate', () => {
    test('should duplicate project successfully', async () => {
      const duplicatedProject = {
        ...testProject,
        id: 2,
        name: 'Copy of ' + testProject.name
      };

      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.Project.create.mockResolvedValue(duplicatedProject);

      const response = await request(app)
        .post('/projects/1/duplicate')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(response.body.data.name).toContain('Copy of');
    });

    test('should handle custom name for duplicate', async () => {
      const customName = 'My Custom Copy';
      const duplicatedProject = {
        ...testProject,
        id: 2,
        name: customName
      };

      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.Project.create.mockResolvedValue(duplicatedProject);

      const response = await request(app)
        .post('/projects/1/duplicate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: customName });

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe(customName);
    });
  });

  describe('GET /projects/:id/vcards', () => {
    test('should get project vcards', async () => {
      const vcards = [
        { id: 1, name: 'VCard 1', projectId: 1 },
        { id: 2, name: 'VCard 2', projectId: 1 }
      ];

      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.VCard.findAll.mockResolvedValue(vcards);

      const response = await request(app)
        .get('/projects/1/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /projects/:id/vcards', () => {
    test('should add vcard to project', async () => {
      const vcard = { id: 1, name: 'Test VCard', userId: 1, projectId: null };
      
      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.VCard.findOne.mockResolvedValue(vcard);
      mockModels.VCard.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/projects/1/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ vcardId: 1 });

      expectSuccessResponse(response);
      expect(mockModels.VCard.update).toHaveBeenCalledWith(
        { projectId: 1 },
        { where: { id: 1, userId: 1 } }
      );
    });

    test('should not add vcard already in another project', async () => {
      const vcard = { id: 1, projectId: 2 };
      
      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.VCard.findOne.mockResolvedValue(vcard);

      const response = await request(app)
        .post('/projects/1/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ vcardId: 1 });

      expectErrorResponse(response);
      expect(response.body.message).toContain('already assigned to another project');
    });
  });

  describe('DELETE /projects/:id/vcards/:vcardId', () => {
    test('should remove vcard from project', async () => {
      mockModels.Project.findOne.mockResolvedValue(testProject);
      mockModels.VCard.findOne.mockResolvedValue({ id: 1, projectId: 1, userId: 1 });
      mockModels.VCard.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/projects/1/vcards/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.VCard.update).toHaveBeenCalledWith(
        { projectId: null },
        { where: { id: 1, userId: 1 } }
      );
    });
  });
});
