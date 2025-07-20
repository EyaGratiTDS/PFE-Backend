const request = require('supertest');
const express = require('express');
const activityLogController = require('../../controllers/ActivityLogController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));

const app = express();
app.use(express.json());

app.get('/activity-logs', activityLogController.getActivityLogs);
app.post('/activity-logs', activityLogController.createActivityLog);
app.get('/activity-logs/:id', activityLogController.getActivityLogById);
app.delete('/activity-logs/:id', activityLogController.deleteActivityLog);
app.delete('/activity-logs/bulk', activityLogController.bulkDeleteLogs);
app.get('/activity-logs/stats/summary', activityLogController.getActivitySummary);

describe('ActivityLogController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testActivityLog;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testActivityLog = {
      id: 1,
      userId: 1,
      action: 'vcard.create',
      entityType: 'VCard',
      entityId: 1,
      details: {
        vcardName: 'Test VCard',
        vcardUrl: 'test-vcard'
      },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      sessionId: 'session_123',
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
          action: 'vcard.update',
          details: { vcardName: 'Updated VCard' }
        }
      ];

      mockModels.ActivityLog.findAll.mockResolvedValue(logs);

      const response = await request(app)
        .get('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.ActivityLog.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: [['created_at', 'DESC']],
        limit: 100
      });
    });

    test('should filter logs by action', async () => {
      mockModels.ActivityLog.findAll.mockResolvedValue([testActivityLog]);

      const response = await request(app)
        .get('/activity-logs?action=vcard.create')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.ActivityLog.findAll).toHaveBeenCalledWith({
        where: { userId: 1, action: 'vcard.create' },
        order: [['created_at', 'DESC']],
        limit: 100
      });
    });

    test('should filter logs by entity type', async () => {
      mockModels.ActivityLog.findAll.mockResolvedValue([testActivityLog]);

      const response = await request(app)
        .get('/activity-logs?entityType=VCard')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.ActivityLog.findAll).toHaveBeenCalledWith({
        where: { userId: 1, entityType: 'VCard' },
        order: [['created_at', 'DESC']],
        limit: 100
      });
    });

    test('should filter logs by date range', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      mockModels.ActivityLog.findAll.mockResolvedValue([testActivityLog]);

      const response = await request(app)
        .get(`/activity-logs?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should support pagination', async () => {
      const logs = Array.from({ length: 5 }, (_, i) => ({
        ...testActivityLog,
        id: i + 1
      }));

      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: logs.slice(0, 3),
        count: 5
      });

      const response = await request(app)
        .get('/activity-logs?page=1&limit=3')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 3,
        total: 5,
        pages: 2
      });
    });

    test('should support search in details', async () => {
      mockModels.ActivityLog.findAll.mockResolvedValue([testActivityLog]);

      const response = await request(app)
        .get('/activity-logs?search=Test VCard')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /activity-logs', () => {
    test('should create activity log successfully', async () => {
      const logData = {
        action: 'plan.upgrade',
        entityType: 'Plan',
        entityId: 2,
        details: {
          fromPlan: 'Free',
          toPlan: 'Premium'
        }
      };

      const createdLog = {
        ...testActivityLog,
        ...logData
      };

      mockModels.ActivityLog.create.mockResolvedValue(createdLog);

      const response = await request(app)
        .post('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '203.0.113.1')
        .set('User-Agent', 'Test Browser')
        .send(logData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.ActivityLog.create).toHaveBeenCalledWith({
        userId: 1,
        action: logData.action,
        entityType: logData.entityType,
        entityId: logData.entityId,
        details: logData.details,
        ipAddress: '203.0.113.1',
        userAgent: 'Test Browser',
        sessionId: expect.any(String)
      });
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
      expect(response.body.message).toContain('Action is required');
    });

    test('should validate action format', async () => {
      const response = await request(app)
        .post('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'invalid-action-format',
          entityType: 'VCard'
        });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Invalid action format');
    });

    test('should auto-generate session ID if not provided', async () => {
      const logData = {
        action: 'user.login',
        entityType: 'User',
        entityId: 1
      };

      mockModels.ActivityLog.create.mockResolvedValue({
        ...testActivityLog,
        ...logData,
        sessionId: 'auto_generated_session_id'
      });

      const response = await request(app)
        .post('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(logData);

      expectSuccessResponse(response);
    });

    test('should sanitize sensitive information in details', async () => {
      const logData = {
        action: 'user.password_change',
        entityType: 'User',
        entityId: 1,
        details: {
          oldPassword: 'secret123',
          newPassword: 'newsecret456',
          timestamp: new Date().toISOString()
        }
      };

      mockModels.ActivityLog.create.mockResolvedValue(testActivityLog);

      const response = await request(app)
        .post('/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(logData);

      expectSuccessResponse(response);
      
      const createCall = mockModels.ActivityLog.create.mock.calls[0][0];
      expect(createCall.details).not.toHaveProperty('oldPassword');
      expect(createCall.details).not.toHaveProperty('newPassword');
    });
  });

  describe('GET /activity-logs/:id', () => {
    test('should get activity log by id', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(testActivityLog);

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.action).toBe(testActivityLog.action);
    });

    test('should return 404 for non-existent log', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/activity-logs/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not allow access to other users logs', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(mockModels.ActivityLog.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });
  });

  describe('DELETE /activity-logs/:id', () => {
    test('should delete activity log successfully', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(testActivityLog);
      mockModels.ActivityLog.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.ActivityLog.destroy).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });

    test('should return 404 for non-existent log', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/activity-logs/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /activity-logs/bulk', () => {
    test('should bulk delete logs by IDs', async () => {
      const logIds = [1, 2, 3];
      mockModels.ActivityLog.destroy.mockResolvedValue(3);

      const response = await request(app)
        .delete('/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: logIds });

      expectSuccessResponse(response);
      expect(mockModels.ActivityLog.destroy).toHaveBeenCalledWith({
        where: {
          id: { [expect.any(Symbol)]: logIds },
          userId: 1
        }
      });
      expect(response.body.message).toContain('3 logs deleted');
    });

    test('should bulk delete logs by date range', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      mockModels.ActivityLog.destroy.mockResolvedValue(15);

      const response = await request(app)
        .delete('/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ startDate, endDate });

      expectSuccessResponse(response);
      expect(response.body.message).toContain('15 logs deleted');
    });

    test('should bulk delete logs by action type', async () => {
      mockModels.ActivityLog.destroy.mockResolvedValue(5);

      const response = await request(app)
        .delete('/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'vcard.view' });

      expectSuccessResponse(response);
      expect(response.body.message).toContain('5 logs deleted');
    });

    test('should validate bulk delete parameters', async () => {
      const response = await request(app)
        .delete('/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
      expect(response.body.message).toContain('At least one filter criteria is required');
    });
  });

  describe('GET /activity-logs/stats/summary', () => {
    test('should get activity summary successfully', async () => {
      mockModels.ActivityLog.count
        .mockResolvedValueOnce(5)   
        .mockResolvedValueOnce(25)  
        .mockResolvedValueOnce(100) 
        .mockResolvedValueOnce(500);

      mockModels.ActivityLog.findAll.mockResolvedValue([
        { action: 'vcard.create', count: 10 },
        { action: 'vcard.view', count: 150 },
        { action: 'vcard.update', count: 25 }
      ]);

      const response = await request(app)
        .get('/activity-logs/stats/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toEqual({
        counts: {
          today: 5,
          thisWeek: 25,
          thisMonth: 100,
          allTime: 500
        },
        topActions: [
          { action: 'vcard.view', count: 150 },
          { action: 'vcard.update', count: 25 },
          { action: 'vcard.create', count: 10 }
        ],
        recentActivity: expect.any(Array)
      });
    });

    test('should get activity summary for specific date range', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';

      mockModels.ActivityLog.count.mockResolvedValue(75);
      mockModels.ActivityLog.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get(`/activity-logs/stats/summary?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should get entity type breakdown', async () => {
      mockModels.ActivityLog.count.mockResolvedValue(100);
      mockModels.ActivityLog.findAll
        .mockResolvedValueOnce([]) 
        .mockResolvedValueOnce([   
          { entityType: 'VCard', count: 80 },
          { entityType: 'User', count: 15 },
          { entityType: 'Plan', count: 5 }
        ]);

      const response = await request(app)
        .get('/activity-logs/stats/summary?includeEntityTypes=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('entityTypes');
    });

    test('should get hourly activity distribution', async () => {
      mockModels.ActivityLog.count.mockResolvedValue(100);
      mockModels.ActivityLog.findAll
        .mockResolvedValueOnce([]) 
        .mockResolvedValueOnce(Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: Math.floor(Math.random() * 10)
        })));

      const response = await request(app)
        .get('/activity-logs/stats/summary?period=hourly')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('hourlyDistribution');
    });
  });
});
