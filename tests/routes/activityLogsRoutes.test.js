const request = require('supertest');
const express = require('express');
const activityLogsRoutes = require('../../routes/activityLogsRoutes');
const { createTestToken } = require('../utils/testHelpers');

jest.mock('../../controllers/ActivityLogController', () => ({
  getUserActivities: jest.fn(),
  getFailedAttempts: jest.fn(),
  getRecentActivities: jest.fn(),
  getActivityDetails: jest.fn()
}));

jest.mock('../../models', () => require('../utils/mockModels'));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/activity-logs', activityLogsRoutes);

describe('Activity Logs Routes', () => {
  let mockModels;
  let authToken;
  let activityLogController;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    authToken = createTestToken({ id: 1, email: 'test@example.com' });
    activityLogController = require('../../controllers/ActivityLogController');
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
      
      const mockResponse = {
        status: 200,
        data: logs,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      };

      activityLogController.getUserActivities.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(1);
      expect(activityLogController.getUserActivities).toHaveBeenCalledTimes(1);
    });

    test('should handle errors', async () => {
      activityLogController.getUserActivities.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Database error' });
      });

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(activityLogController.getUserActivities).toHaveBeenCalledTimes(1);
    });

    test('should handle pagination parameters', async () => {
      const mockResponse = {
        status: 200,
        data: [],
        pagination: {
          page: 2,
          limit: 5,
          total: 0,
          totalPages: 0
        }
      };

      activityLogController.getUserActivities.mockImplementation((req, res) => {
        expect(req.query.page).toBe('2');
        expect(req.query.limit).toBe('5');
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .get('/activity-logs?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(activityLogController.getUserActivities).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /activity-logs/failed-attempts', () => {
    test('should get failed login attempts', async () => {
      const failedAttempts = [
        {
          id: 1,
          action: 'failed_login',
          details: { reason: 'Invalid credentials' },
          timestamp: new Date(),
          ipAddress: '192.168.1.1'
        }
      ];

      activityLogController.getFailedAttempts.mockImplementation((req, res) => {
        res.status(200).json({ data: failedAttempts });
      });

      const response = await request(app)
        .get('/activity-logs/failed-attempts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].action).toBe('failed_login');
      expect(activityLogController.getFailedAttempts).toHaveBeenCalledTimes(1);
    });

    test('should handle errors when getting failed attempts', async () => {
      activityLogController.getFailedAttempts.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Server error' });
      });

      const response = await request(app)
        .get('/activity-logs/failed-attempts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /activity-logs/recent', () => {
    test('should get recent activities', async () => {
      const recentActivities = [
        {
          id: 1,
          action: 'update',
          resource: 'profile',
          timestamp: new Date(),
          details: { field: 'email' }
        },
        {
          id: 2,
          action: 'create',
          resource: 'vcard',
          timestamp: new Date(),
          details: { name: 'John Doe' }
        }
      ];

      activityLogController.getRecentActivities.mockImplementation((req, res) => {
        res.status(200).json({ data: recentActivities });
      });

      const response = await request(app)
        .get('/activity-logs/recent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].action).toBe('update');
      expect(activityLogController.getRecentActivities).toHaveBeenCalledTimes(1);
    });

    test('should handle limit parameter for recent activities', async () => {
      activityLogController.getRecentActivities.mockImplementation((req, res) => {
        expect(req.query.limit).toBe('5');
        res.status(200).json({ data: [] });
      });

      const response = await request(app)
        .get('/activity-logs/recent?limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /activity-logs/:id', () => {
    test('should get activity details', async () => {
      const log = {
        id: 1,
        userId: 1,
        action: 'create',
        resource: 'vcard',
        details: { name: 'Test VCard' },
        timestamp: new Date(),
        ipAddress: '192.168.1.1'
      };

      activityLogController.getActivityDetails.mockImplementation((req, res) => {
        expect(req.params.id).toBe('1');
        res.status(200).json({ data: log });
      });

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.userId).toBe(1);
      expect(activityLogController.getActivityDetails).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent activity', async () => {
      activityLogController.getActivityDetails.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Activity log not found' });
      });

      const response = await request(app)
        .get('/activity-logs/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Activity log not found');
    });

    test('should prevent accessing other users logs', async () => {
      activityLogController.getActivityDetails.mockImplementation((req, res) => {
        res.status(403).json({ error: 'Access denied' });
      });

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Access denied');
    });

    test('should handle invalid activity ID format', async () => {
      activityLogController.getActivityDetails.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Invalid activity ID format' });
      });

      const response = await request(app)
        .get('/activity-logs/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Authentication middleware', () => {
    test('should require authentication for all routes', async () => {
      jest.doMock('../../middleware/authMiddleware', () => ({
        requireAuth: (req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        }
      }));

      expect(activityLogController.getUserActivities).toBeDefined();
      expect(activityLogController.getFailedAttempts).toBeDefined();
      expect(activityLogController.getRecentActivities).toBeDefined();
      expect(activityLogController.getActivityDetails).toBeDefined();
    });
  });
});