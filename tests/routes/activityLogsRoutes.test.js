const request = require('supertest');
const express = require('express');
const activityLogsRoutes = require('../../routes/activityLogsRoutes');
const { createTestToken } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const app = express();
app.use(express.json());
app.use('/activity-logs', activityLogsRoutes);

describe('Activity Logs Routes', () => {
  let mockModels;
  let authToken;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    authToken = createTestToken({ id: 1, email: 'test@example.com' });
    jest.clearAllMocks();
  });

  describe('GET /activity-logs', () => {
    test('should get user activities', async () => {
      const logs = [
        {
          id: 1,
          userId: 1,
          action: 'login',
          resource: 'auth',
          timestamp: new Date()
        }
      ];
      
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: logs,
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(1);
    });

    test('should handle errors', async () => {
      mockModels.ActivityLog.findAndCountAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /activity-logs/failed-attempts', () => {
    test('should get failed login attempts', async () => {
      const failedAttempts = [
        {
          id: 1,
          action: 'failed_login',
          details: { reason: 'Invalid credentials' }
        }
      ];
      
      mockModels.ActivityLog.findAll.mockResolvedValue(failedAttempts);

      const response = await request(app)
        .get('/activity-logs/failed-attempts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /activity-logs/recent', () => {
    test('should get recent activities', async () => {
      const recentActivities = [
        {
          id: 1,
          action: 'update',
          resource: 'profile'
        }
      ];
      
      mockModels.ActivityLog.findAll.mockResolvedValue(recentActivities);

      const response = await request(app)
        .get('/activity-logs/recent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /activity-logs/:id', () => {
    test('should get activity details', async () => {
      const log = {
        id: 1,
        action: 'create',
        resource: 'vcard',
        details: { name: 'Test VCard' }
      };
      
      mockModels.ActivityLog.findOne.mockResolvedValue(log);

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.id).toBe(1);
    });

    test('should return 404 for non-existent activity', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/activity-logs/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should prevent accessing other users logs', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue({
        id: 1,
        userId: 2 
      });

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });
});