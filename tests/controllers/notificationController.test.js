const request = require('supertest');
const express = require('express');
const notificationController = require('../../controllers/NotificationController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/emailService');

const app = express();
app.use(express.json());

// Configuration des routes de test
app.get('/notifications', notificationController.getNotifications);
app.post('/notifications', notificationController.createNotification);
app.put('/notifications/:id/read', notificationController.markAsRead);
app.put('/notifications/read-all', notificationController.markAllAsRead);
app.delete('/notifications/:id', notificationController.deleteNotification);

describe('NotificationController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testNotification;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testNotification = {
      id: 1,
      userId: 1,
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      is_read: false,
      createdAt: new Date()
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /notifications', () => {
    test('should get all notifications for user', async () => {
      const notifications = [
        testNotification,
        { ...testNotification, id: 2, type: 'warning' }
      ];

      mockModels.Notification.findAll.mockResolvedValue(notifications);

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.Notification.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: [['createdAt', 'DESC']]
      });
    });

    test('should filter unread notifications', async () => {
      mockModels.Notification.findAll.mockResolvedValue([testNotification]);

      const response = await request(app)
        .get('/notifications?unread=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Notification.findAll).toHaveBeenCalledWith({
        where: { userId: 1, is_read: false },
        order: [['createdAt', 'DESC']]
      });
    });

    test('should filter by type', async () => {
      mockModels.Notification.findAll.mockResolvedValue([testNotification]);

      const response = await request(app)
        .get('/notifications?type=info')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Notification.findAll).toHaveBeenCalledWith({
        where: { userId: 1, type: 'info' },
        order: [['createdAt', 'DESC']]
      });
    });

    test('should support pagination', async () => {
      const notifications = Array.from({ length: 5 }, (_, i) => ({
        ...testNotification,
        id: i + 1
      }));

      mockModels.Notification.findAndCountAll.mockResolvedValue({
        rows: notifications.slice(0, 3),
        count: 5
      });

      const response = await request(app)
        .get('/notifications?page=1&limit=3')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 3,
        total: 5,
        pages: 2
      });
    });
  });

  describe('POST /notifications', () => {
    test('should create notification successfully', async () => {
      const notificationData = {
        title: 'New Notification',
        message: 'This is a new notification',
        type: 'success'
      };

      const createdNotification = {
        ...testNotification,
        ...notificationData
      };

      mockModels.Notification.create.mockResolvedValue(createdNotification);

      const response = await request(app)
        .post('/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.Notification.create).toHaveBeenCalledWith({
        userId: 1,
        ...notificationData
      });
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
      expect(response.body.message).toContain('Title and message are required');
    });

    test('should validate notification type', async () => {
      const response = await request(app)
        .post('/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
          message: 'Test message',
          type: 'invalid_type'
        });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Invalid notification type');
    });

    test('should set default type as info', async () => {
      const notificationData = {
        title: 'Test Notification',
        message: 'Test message'
      };

      mockModels.Notification.create.mockResolvedValue({
        ...testNotification,
        ...notificationData,
        type: 'info'
      });

      const response = await request(app)
        .post('/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData);

      expectSuccessResponse(response);
      expect(mockModels.Notification.create).toHaveBeenCalledWith({
        userId: 1,
        ...notificationData,
        type: 'info'
      });
    });
  });

  describe('PUT /notifications/:id/read', () => {
    test('should mark notification as read', async () => {
      mockModels.Notification.findOne.mockResolvedValue(testNotification);
      mockModels.Notification.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/notifications/1/read')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Notification.update).toHaveBeenCalledWith(
        { is_read: true },
        { where: { id: 1, userId: 1 } }
      );
    });

    test('should return 404 for non-existent notification', async () => {
      mockModels.Notification.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put('/notifications/999/read')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not mark already read notification', async () => {
      const readNotification = { ...testNotification, is_read: true };
      mockModels.Notification.findOne.mockResolvedValue(readNotification);

      const response = await request(app)
        .put('/notifications/1/read')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toContain('already marked as read');
      expect(mockModels.Notification.update).not.toHaveBeenCalled();
    });
  });

  describe('PUT /notifications/read-all', () => {
    test('should mark all notifications as read', async () => {
      mockModels.Notification.update.mockResolvedValue([3]);

      const response = await request(app)
        .put('/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Notification.update).toHaveBeenCalledWith(
        { is_read: true },
        { where: { userId: 1, is_read: false } }
      );
      expect(response.body.message).toContain('3 notifications marked as read');
    });

    test('should handle case when no unread notifications', async () => {
      mockModels.Notification.update.mockResolvedValue([0]);

      const response = await request(app)
        .put('/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toContain('No unread notifications');
    });
  });

  describe('DELETE /notifications/:id', () => {
    test('should delete notification successfully', async () => {
      mockModels.Notification.findOne.mockResolvedValue(testNotification);
      mockModels.Notification.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/notifications/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Notification.destroy).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });

    test('should return 404 for non-existent notification', async () => {
      mockModels.Notification.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/notifications/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
