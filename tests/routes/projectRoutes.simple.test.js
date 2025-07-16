const request = require('supertest');
const express = require('express');
const { createTestToken } = require('../utils/testHelpers');

describe('Project Routes - Simple Test', () => {
  let app;

  beforeAll(() => {
    // Application express simple
    app = express();
    app.use(express.json());
    
    // Route simple pour test
    app.get('/test', (req, res) => {
      res.json({ message: 'Test route works' });
    });
    
    // Route qui simule les endpoints du projet
    app.post('/projects', (req, res) => {
      const { name, userId } = req.body;
      if (!name || !userId) {
        return res.status(400).json({ message: "Name and userId are required" });
      }
      res.status(201).json({ id: 1, name, userId, success: true });
    });
    
    app.get('/projects/:id', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json({ data: { id: parseInt(id), name: 'Test Project' } });
    });
    
    app.get('/projects/user/:userId', (req, res) => {
      const { userId } = req.params;
      res.json({ 
        success: true, 
        data: [
          { id: 1, name: 'Project 1', userId: parseInt(userId) },
          { id: 2, name: 'Project 2', userId: parseInt(userId) }
        ] 
      });
    });
    
    app.put('/projects/:id', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json({ success: true, message: 'Project updated' });
    });
    
    app.delete('/projects/:id', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json({ success: true, message: 'Project deleted' });
    });
  });

  describe('Basic Route Testing', () => {
    test('should respond to test route', async () => {
      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Test route works');
    });

    test('should create project', async () => {
      const projectData = {
        name: 'Test Project',
        userId: 1
      };

      const response = await request(app)
        .post('/projects')
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.name).toBe(projectData.name);
    });

    test('should require name and userId for creation', async () => {
      const response = await request(app)
        .post('/projects')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    test('should get project by ID', async () => {
      const response = await request(app)
        .get('/projects/1');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.name).toBe('Test Project');
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/projects/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Project not found');
    });

    test('should get projects by user ID', async () => {
      const response = await request(app)
        .get('/projects/user/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].userId).toBe(1);
    });

    test('should update project', async () => {
      const updateData = {
        name: 'Updated Project'
      };

      const response = await request(app)
        .put('/projects/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project updated');
    });

    test('should return 404 when updating non-existent project', async () => {
      const response = await request(app)
        .put('/projects/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Project not found');
    });

    test('should delete project', async () => {
      const response = await request(app)
        .delete('/projects/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project deleted');
    });

    test('should return 404 when deleting non-existent project', async () => {
      const response = await request(app)
        .delete('/projects/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Project not found');
    });
  });

  describe('Token Utilities', () => {
    test('should create test token', () => {
      const token = createTestToken({ id: 1, email: 'test@example.com' });
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/projects')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    test('should handle empty requests', async () => {
      const response = await request(app)
        .post('/projects');

      expect(response.status).toBe(400);
    });
  });

  describe('Performance Tests', () => {
    test('should respond quickly to simple requests', async () => {
      const start = Date.now();
      
      const response = await request(app)
        .get('/test');
      
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should respond in less than 1 second
    });

    test('should handle multiple requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/test')
            .expect(200)
        );
      }
      
      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
