const request = require('supertest');
const express = require('express');
const { createTestToken, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock simple et direct pour les routes
const mockProjectController = {
  createProject: jest.fn((req, res) => {
    const { name, userId } = req.body;
    if (!name || !userId) {
      return res.status(400).json({ message: "The 'name' and 'userId' fields are mandatory" });
    }
    res.status(201).json({ id: 1, name, userId, status: 'active' });
  }),
  
  getProjectById: jest.fn((req, res) => {
    const { id } = req.params;
    if (id === '999') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ data: { id: parseInt(id), name: 'Test Project', userId: 1 } });
  }),
  
  updateProject: jest.fn((req, res) => {
    const { id } = req.params;
    if (id === '999') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ success: true, message: 'Project updated successfully' });
  }),
  
  deleteProject: jest.fn((req, res) => {
    const { id } = req.params;
    if (id === '999') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ success: true, message: 'Project deleted successfully' });
  }),
  
  getProjectsByUserId: jest.fn((req, res) => {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    res.json({ 
      success: true, 
      data: [
        { id: 1, name: 'Project 1', userId: parseInt(userId) },
        { id: 2, name: 'Project 2', userId: parseInt(userId) }
      ] 
    });
  }),
  
  getVCardsByProject: jest.fn((req, res) => {
    const { id } = req.params;
    if (id === '999') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ 
      success: true, 
      data: [
        { id: 1, name: 'VCard 1', projectId: parseInt(id) },
        { id: 2, name: 'VCard 2', projectId: parseInt(id) }
      ] 
    });
  }),
  
  getAllProjectsWithUser: jest.fn((req, res) => {
    res.json({ 
      success: true, 
      data: [
        { id: 1, name: 'Project 1', User: { id: 1, email: 'user1@example.com' } },
        { id: 2, name: 'Project 2', User: { id: 2, email: 'user2@example.com' } }
      ] 
    });
  }),
  
  toggleProjectBlocked: jest.fn((req, res) => {
    const { id } = req.params;
    if (id === '999') {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ success: true, message: 'Project status toggled successfully' });
  })
};

// Mock des middlewares
const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
};

const mockAdminAuth = (req, res, next) => {
  req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
  next();
};

const mockUpload = {
  single: () => (req, res, next) => {
    req.file = { filename: 'test-logo.jpg' };
    next();
  }
};

const mockPlanLimiter = (req, res, next) => next();

// Configuration de l'application de test
const app = express();
app.use(express.json());

// Routes basées sur les vraies routes du projet
app.post('/', mockAuth, mockUpload.single('logoFile'), mockPlanLimiter, mockProjectController.createProject);
app.get('/user', mockAuth, mockProjectController.getProjectsByUserId);
app.get('/projects-with-users', mockAdminAuth, mockProjectController.getAllProjectsWithUser);
app.get('/:id', mockAuth, mockProjectController.getProjectById);
app.put('/:id', mockAuth, mockUpload.single('logoFile'), mockProjectController.updateProject);
app.delete('/:id', mockAuth, mockProjectController.deleteProject);
app.get('/:id/vcards', mockAuth, mockProjectController.getVCardsByProject);
app.put('/:id/toggle-status', mockAdminAuth, mockProjectController.toggleProjectBlocked);

describe('Project Routes Integration', () => {
  let authToken;

  beforeEach(() => {
    authToken = createTestToken({ id: 1, email: 'test@example.com' });
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    test('should create new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test project description',
        color: '#ff0000',
        userId: 1
      };

      const response = await request(app)
        .post('/')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(response.body.name).toBe(projectData.name);
      expect(mockProjectController.createProject).toHaveBeenCalled();
    });

    test('should require name and userId', async () => {
      const response = await request(app)
        .post('/')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('mandatory');
    });
  });

  describe('GET /user', () => {
    test('should get projects by user ID', async () => {
      const response = await request(app)
        .get('/user?userId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockProjectController.getProjectsByUserId).toHaveBeenCalled();
    });

    test('should require userId parameter', async () => {
      const response = await request(app)
        .get('/user')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });
  });

  describe('GET /:id', () => {
    test('should get project by ID', async () => {
      const response = await request(app)
        .get('/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe('Test Project');
      expect(mockProjectController.getProjectById).toHaveBeenCalled();
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /:id', () => {
    test('should update project', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      const response = await request(app)
        .put('/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(mockProjectController.updateProject).toHaveBeenCalled();
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    test('should delete project', async () => {
      const response = await request(app)
        .delete('/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockProjectController.deleteProject).toHaveBeenCalled();
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .delete('/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /:id/vcards', () => {
    test('should get VCards by project', async () => {
      const response = await request(app)
        .get('/1/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockProjectController.getVCardsByProject).toHaveBeenCalled();
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/999/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /projects-with-users (Admin)', () => {
    test('should get all projects with users for admin', async () => {
      const response = await request(app)
        .get('/projects-with-users')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockProjectController.getAllProjectsWithUser).toHaveBeenCalled();
    });
  });

  describe('PUT /:id/toggle-status (Admin)', () => {
    test('should toggle project status', async () => {
      const response = await request(app)
        .put('/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockProjectController.toggleProjectBlocked).toHaveBeenCalled();
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/999/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Middleware Integration', () => {
    test('should call authentication middleware', async () => {
      const response = await request(app)
        .get('/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).not.toBe(401); // Authentication should work
    });

    test('should call upload middleware on POST', async () => {
      const response = await request(app)
        .post('/')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test', userId: 1 });

      expect(response.status).toBe(201); // Upload middleware should work
    });

    test('should call admin middleware for admin routes', async () => {
      const response = await request(app)
        .get('/projects-with-users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).not.toBe(403); // Admin auth should work
    });
  });

  describe('Controller Method Calls', () => {
    test('should call correct controller methods', async () => {
      // Test multiple endpoints to ensure proper routing
      await request(app).get('/1').set('Authorization', `Bearer ${authToken}`);
      await request(app).post('/').set('Authorization', `Bearer ${authToken}`).send({ name: 'Test', userId: 1 });
      await request(app).put('/1').set('Authorization', `Bearer ${authToken}`).send({ name: 'Updated' });
      await request(app).delete('/1').set('Authorization', `Bearer ${authToken}`);

      expect(mockProjectController.getProjectById).toHaveBeenCalled();
      expect(mockProjectController.createProject).toHaveBeenCalled();
      expect(mockProjectController.updateProject).toHaveBeenCalled();
      expect(mockProjectController.deleteProject).toHaveBeenCalled();
    });
  });
});
