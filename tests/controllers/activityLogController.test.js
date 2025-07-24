const request = require('supertest');
const express = require('express');
const activityLogController = require('../../controllers/ActivityLogController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));

const app = express();
app.use(express.json());

// Middleware pour simuler l'authentification
app.use((req, res, next) => {
  req.user = { id: 1, isAdmin: false };
  next();
});

// Routes corrigées pour matcher les exports du contrôleur
app.get('/activity-logs', activityLogController.getUserActivities);
app.get('/activity-logs/failed-attempts', activityLogController.getFailedAttempts);
app.get('/activity-logs/recent', activityLogController.getRecentActivities);
app.get('/activity-logs/:id', activityLogController.getActivityDetails);

describe('ActivityLogController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testActivityLog;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    testActivityLog = {
      id: 1,
      userId: 1,
      activityType: 'login',
      ipAddress: '192.168.1.1',
      country: 'US',
      city: 'New York',
      deviceType: 'desktop',
      os: 'Windows',
      browser: 'Chrome',
      created_at: new Date()
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /activity-logs', () => {
    test('should get user activity logs successfully', async () => {
      const logs = [
        testActivityLog,
        {
          ...testActivityLog,
          id: 2,
          activityType: 'password_change'
        }
      ];

      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: logs,
        count: logs.length
      });

      const response = await request(app)
        .get('/activity-logs?limit=20&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter logs by activity type', async () => {
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [testActivityLog],
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs?type=login')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1, activityType: 'login' },
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('GET /activity-logs/failed-attempts', () => {
    test('should get failed login attempts', async () => {
      mockModels.ActivityLog.count.mockResolvedValue(3);

      const response = await request(app)
        .get('/activity-logs/failed-attempts?hours=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.count).toBe(3);
      expect(mockModels.ActivityLog.count).toHaveBeenCalledWith({
        where: {
          userId: 1,
          activityType: 'login_failed',
          created_at: expect.anything()
        }
      });
    });
  });

  describe('GET /activity-logs/recent', () => {
    test('should get recent activities', async () => {
      mockModels.ActivityLog.findAll.mockResolvedValue([testActivityLog]);

      const response = await request(app)
        .get('/activity-logs/recent?limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
      expect(mockModels.ActivityLog.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'activityType', 'created_at']
      });
    });
  });

  describe('GET /activity-logs/:id', () => {
    test('should get activity details by id', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue({
        ...testActivityLog,
        user: testUser
      });

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    test('should return 404 for non-existent log', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/activity-logs/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.ActivityLog.findAndCountAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });
});