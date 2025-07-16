const request = require('supertest');
const express = require('express');
const activityLogsRoutes = require('../../routes/activityLogsRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/activity-logs', activityLogsRoutes);

describe('Activity Logs Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /api/activity-logs', () => {
    test('should get activity logs', async () => {
      const logs = [
        {
          id: 1,
          userId: 1,
          action: 'create',
          resource: 'vcard',
          timestamp: new Date()
        }
      ];
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: logs,
        count: 1
      });

      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
    });

    test('should filter logs by action', async () => {
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/api/activity-logs?action=create')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should filter logs by resource', async () => {
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/api/activity-logs?resource=vcard')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should filter logs by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get(`/api/activity-logs?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should paginate logs', async () => {
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/api/activity-logs?page=2&limit=20')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should sort logs by timestamp', async () => {
      mockModels.ActivityLog.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0
      });

      const response = await request(app)
        .get('/api/activity-logs?sortBy=timestamp&sortOrder=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /api/activity-logs', () => {
    test('should create activity log', async () => {
      const logData = {
        action: 'create',
        resource: 'vcard',
        resourceId: '1',
        details: { name: 'Test VCard' }
      };

      const createdLog = {
        id: 1,
        ...logData,
        userId: 1,
        timestamp: new Date()
      };

      mockModels.ActivityLog.create.mockResolvedValue(createdLog);

      const response = await request(app)
        .post('/api/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(logData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });

    test('should validate action field', async () => {
      const response = await request(app)
        .post('/api/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'invalid_action',
          resource: 'vcard'
        });

      expectErrorResponse(response);
    });
  });

  describe('GET /api/activity-logs/:id', () => {
    test('should get activity log by id', async () => {
      const log = {
        id: 1,
        userId: 1,
        action: 'create',
        resource: 'vcard'
      };
      mockModels.ActivityLog.findOne.mockResolvedValue(log);

      const response = await request(app)
        .get('/api/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent log', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/activity-logs/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not access other user logs', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue({
        id: 1,
        userId: 2
      });

      const response = await request(app)
        .get('/api/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/activity-logs/:id', () => {
    test('should delete activity log', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue({
        id: 1,
        userId: 1
      });
      mockModels.ActivityLog.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should not delete other user logs', async () => {
      mockModels.ActivityLog.findOne.mockResolvedValue({
        id: 1,
        userId: 2
      });

      const response = await request(app)
        .delete('/api/activity-logs/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/activity-logs/bulk', () => {
    test('should bulk delete logs', async () => {
      const logIds = [1, 2, 3];
      mockModels.ActivityLog.destroy.mockResolvedValue(3);

      const response = await request(app)
        .delete('/api/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: logIds });

      expectSuccessResponse(response);
    });

    test('should validate bulk delete request', async () => {
      const response = await request(app)
        .delete('/api/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });

    test('should limit bulk delete size', async () => {
      const tooManyIds = Array.from({ length: 1001 }, (_, i) => i + 1);

      const response = await request(app)
        .delete('/api/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: tooManyIds });

      expectErrorResponse(response);
    });
  });

  describe('DELETE /api/activity-logs/cleanup', () => {
    test('should cleanup old logs', async () => {
      mockModels.ActivityLog.destroy.mockResolvedValue(10);

      const response = await request(app)
        .delete('/api/activity-logs/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 30 });

      expectSuccessResponse(response);
    });

    test('should use default cleanup period', async () => {
      mockModels.ActivityLog.destroy.mockResolvedValue(5);

      const response = await request(app)
        .delete('/api/activity-logs/cleanup')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should validate cleanup days parameter', async () => {
      const response = await request(app)
        .delete('/api/activity-logs/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: -1 });

      expectErrorResponse(response);
    });
  });

  describe('GET /api/activity-logs/stats', () => {
    test('should get activity statistics', async () => {
      mockModels.ActivityLog.count.mockResolvedValue(100);
      mockModels.ActivityLog.findAll
        .mockResolvedValueOnce([
          { action: 'create', count: 50 },
          { action: 'update', count: 30 }
        ])
        .mockResolvedValueOnce([
          { resource: 'vcard', count: 60 },
          { resource: 'project', count: 40 }
        ]);

      const response = await request(app)
        .get('/api/activity-logs/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should filter stats by date range', async () => {
      mockModels.ActivityLog.count.mockResolvedValue(20);
      mockModels.ActivityLog.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/activity-logs/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expectSuccessResponse(response);
    });
  });

  describe('GET /api/activity-logs/export', () => {
    test('should export logs as CSV', async () => {
      const logs = [
        {
          id: 1,
          action: 'create',
          resource: 'vcard',
          timestamp: new Date(),
          toJSON: () => ({
            id: 1,
            action: 'create',
            resource: 'vcard',
            timestamp: new Date()
          })
        }
      ];
      mockModels.ActivityLog.findAll.mockResolvedValue(logs);

      const response = await request(app)
        .get('/api/activity-logs/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    test('should export logs as JSON', async () => {
      const logs = [
        {
          id: 1,
          action: 'create',
          resource: 'vcard'
        }
      ];
      mockModels.ActivityLog.findAll.mockResolvedValue(logs);

      const response = await request(app)
        .get('/api/activity-logs/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ format: 'json' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    test('should validate export format', async () => {
      const response = await request(app)
        .get('/api/activity-logs/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ format: 'invalid' });

      expectErrorResponse(response);
    });

    test('should limit export size', async () => {
      const response = await request(app)
        .get('/api/activity-logs/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10001 });

      expectErrorResponse(response);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.ActivityLog.findAndCountAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle invalid date formats', async () => {
      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: 'invalid-date',
          endDate: '2024-01-31'
        });

      expectErrorResponse(response);
    });

    test('should handle bulk operation errors', async () => {
      mockModels.ActivityLog.destroy.mockRejectedValue(new Error('Bulk delete failed'));

      const response = await request(app)
        .delete('/api/activity-logs/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: [1, 2, 3] });

      expectErrorResponse(response);
    });
  });
});
