const request = require('supertest');
const express = require('express');

jest.mock('../../models/ActivityLog', () => ({
  findAndCountAll: jest.fn(),
  count: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn()
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
  findAll: jest.fn()
}));

jest.mock('axios', () => ({
  get: jest.fn()
}));

jest.mock('ua-parser-js', () => {
  return jest.fn().mockImplementation(() => ({
    getResult: () => ({
      device: { type: 'desktop' },
      os: { name: 'Windows' },
      browser: { name: 'Chrome' }
    })
  }));
});

const activityLogController = require('../../controllers/ActivityLogController');
const ActivityLog = require('../../models/ActivityLog');
const User = require('../../models/User');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  req.user = { id: 1, isAdmin: false };
  next();
});

app.get('/activity-logs', activityLogController.getUserActivities);
app.get('/activity-logs/failed-attempts', activityLogController.getFailedAttempts);
app.get('/activity-logs/recent', activityLogController.getRecentActivities);
app.get('/activity-logs/:id', activityLogController.getActivityDetails);

describe('ActivityLogController', () => {
  let authToken;
  let testUser;
  let testActivityLog;

  beforeEach(() => {
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

      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: logs,
        count: logs.length
      });

      const response = await request(app)
        .get('/activity-logs?limit=20&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter logs by activity type', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [testActivityLog],
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs?type=login')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1, activityType: 'login' },
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });

    test('should handle pagination correctly', async () => {
      const logs = Array.from({ length: 5 }, (_, i) => ({
        ...testActivityLog,
        id: i + 1
      }));

      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: logs,
        count: 25
      });

      const response = await request(app)
        .get('/activity-logs?limit=5&offset=10')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.total).toBe(25);
      expect(response.body.limit).toBe(5);
      expect(response.body.offset).toBe(10);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 5,
        offset: 10,
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter by multiple criteria', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [testActivityLog],
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs?type=login&deviceType=desktop&browser=Chrome')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { 
          userId: 1, 
          activityType: 'login',
          deviceType: 'desktop',
          browser: 'Chrome'
        },
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter by days parameter', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [testActivityLog],
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs?days=7')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { 
          userId: 1,
          created_at: expect.any(Object)
        },
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('GET /activity-logs/failed-attempts', () => {
    test('should get failed login attempts', async () => {
      ActivityLog.count.mockResolvedValue(3);

      const response = await request(app)
        .get('/activity-logs/failed-attempts?hours=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.count).toBe(3);
      expect(ActivityLog.count).toHaveBeenCalledWith({
        where: {
          userId: 1,
          activityType: 'login_failed',
          created_at: expect.any(Object)
        }
      });
    });

    test('should use default hours if not provided', async () => {
      ActivityLog.count.mockResolvedValue(5);

      const response = await request(app)
        .get('/activity-logs/failed-attempts')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.count).toBe(5);
      expect(ActivityLog.count).toHaveBeenCalledWith({
        where: {
          userId: 1,
          activityType: 'login_failed',
          created_at: expect.any(Object)
        }
      });
    });

    test('should handle custom time range', async () => {
      ActivityLog.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/activity-logs/failed-attempts?hours=24')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.count).toBe(2);
    });
  });

  describe('GET /activity-logs/recent', () => {
    test('should get recent activities', async () => {
      ActivityLog.findAll.mockResolvedValue([testActivityLog]);

      const response = await request(app)
        .get('/activity-logs/recent?limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
      expect(ActivityLog.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'activityType', 'created_at']
      });
    });

    test('should use default limit if not provided', async () => {
      ActivityLog.findAll.mockResolvedValue([testActivityLog]);

      const response = await request(app)
        .get('/activity-logs/recent')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'activityType', 'created_at']
      });
    });

    test('should limit maximum results to 100', async () => {
      ActivityLog.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/activity-logs/recent?limit=200')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 100,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'activityType', 'created_at']
      });
    });
  });

  describe('GET /activity-logs/:id', () => {
    test('should get activity details by id', async () => {
      ActivityLog.findOne.mockResolvedValue({
        ...testActivityLog,
        user: testUser
      });

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(ActivityLog.findOne).toHaveBeenCalledWith({
        where: { id: '1', userId: 1 },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }]
      });
    });

    test('should return 404 for non-existent log', async () => {
      ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/activity-logs/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Activity not found');
    });

    test('should only return logs for current user', async () => {
      ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(ActivityLog.findOne).toHaveBeenCalledWith({
        where: { id: '1', userId: 1 }, 
        include: expect.any(Array)
      });
    });
  });

  describe('Admin functionality', () => {
    let adminApp;

    beforeEach(() => {
      adminApp = express();
      adminApp.use(express.json());
      
      adminApp.use((req, res, next) => {
        req.user = { id: 1, isAdmin: true };
        next();
      });

      adminApp.get('/activity-logs', activityLogController.getUserActivities);
    });

    test('admin should be able to view other user activities', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [testActivityLog],
        count: 1
      });

      const response = await request(adminApp)
        .get('/activity-logs?userId=2')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: '2' },
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors in getUserActivities', async () => {
      ActivityLog.findAndCountAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });

    test('should handle database errors in getFailedAttempts', async () => {
      ActivityLog.count.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/activity-logs/failed-attempts')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });

    test('should handle database errors in getRecentActivities', async () => {
      ActivityLog.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/activity-logs/recent')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });

    test('should handle database errors in getActivityDetails', async () => {
      ActivityLog.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  describe('Data formatting', () => {
    test('should format activity logs correctly', async () => {
      const rawLog = {
        id: 1,
        activityType: 'login',
        ipAddress: '192.168.1.1',
        city: 'New York',
        country: 'US',
        deviceType: 'desktop',
        os: 'Windows',
        browser: 'Chrome',
        created_at: new Date('2024-01-01T10:00:00Z'),
        user: null
      };

      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [rawLog],
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      const formattedLog = response.body.data[0];
      
      expect(formattedLog).toEqual({
        id: 1,
        activityType: 'login',
        ipAddress: '192.168.1.1',
        location: 'New York, US',
        device: 'desktop (Windows, Chrome)',
        createdAt: rawLog.created_at.toISOString(),
        user: null
      });
    });

    test('should handle logs without location data', async () => {
      const rawLog = {
        id: 1,
        activityType: 'login',
        ipAddress: '192.168.1.1',
        city: null,
        country: 'Unknown',
        deviceType: 'desktop',
        os: 'Windows',
        browser: 'Chrome',
        created_at: new Date(),
        user: null
      };

      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [rawLog],
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      const formattedLog = response.body.data[0];
      expect(formattedLog.location).toBe('Unknown');
    });

    test('should handle logs with user information', async () => {
      const rawLog = {
        id: 1,
        activityType: 'login',
        ipAddress: '192.168.1.1',
        city: 'Paris',
        country: 'France',
        deviceType: 'mobile',
        os: 'iOS',
        browser: 'Safari',
        created_at: new Date(),
        user: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com'
        }
      };

      ActivityLog.findOne.mockResolvedValue(rawLog);

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      const formattedLog = response.body.data;
      
      expect(formattedLog.user).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      });
      expect(formattedLog.location).toBe('Paris, France');
      expect(formattedLog.device).toBe('mobile (iOS, Safari)');
    });
  });

  describe('Query parameter validation', () => {
    test('should handle invalid limit values', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/activity-logs?limit=invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: NaN, 
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });

    test('should handle string offset values', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/activity-logs?offset=10')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 20,
        offset: 10,
        order: [['created_at', 'DESC']]
      });
    });

    test('should handle negative offset values', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/activity-logs?offset=-5')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 20,
        offset: -5,
        order: [['created_at', 'DESC']]
      });
    });

    test('should handle very large limit values', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/activity-logs?limit=99999')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 99999,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('Authentication edge cases', () => {
    test('should handle missing user in request', async () => {
      const noUserApp = express();
      noUserApp.use(express.json());
      
      noUserApp.use((req, res, next) => {
        req.user = null;
        next();
      });

      noUserApp.get('/activity-logs', activityLogController.getUserActivities);

      const response = await request(noUserApp)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });
  });

  describe('Integration with buildWhereClause', () => {
    test('should properly handle complex filtering', async () => {
      ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [testActivityLog],
        count: 1
      });

      const response = await request(app)
        .get('/activity-logs?type=login&days=30&deviceType=desktop&browser=Chrome')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      
      const expectedWhere = expect.objectContaining({
        userId: 1,
        activityType: 'login',
        deviceType: 'desktop',
        browser: 'Chrome',
        created_at: expect.any(Object)
      });

      expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith({
        where: expectedWhere,
        limit: 20,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });
  });
});