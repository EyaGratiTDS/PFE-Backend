const request = require('supertest');
const express = require('express');
const notificationController = require('../../controllers/NotificationController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/emailService');

const app = express();
app.use(express.json());

app.get('/notification', notificationController.getUserNotifications);
app.put('/notification/:notificationId/read', notificationController.markNotificationAsRead);
app.put('/notification/read-all', notificationController.markAllNotificationsAsRead);
app.delete('/notification/:notificationId', notificationController.deleteNotification);

describe('NotificationController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testNotification;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    testNotification = {
      id: 1,
      userId: 1,
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      is_read: false,
      created_at: new Date(),
      get: jest.fn().mockReturnThis(),
      toJSON: jest.fn().mockReturnValue({
        id: 1,
        userId: 1,
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info',
        is_read: false,
        created_at: new Date()
      })
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    global.wsBroadcastToUser = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('GET /notification', () => {
    test('should get all notifications for user', async () => {
      const notifications = [
        testNotification,
        { ...testNotification, id: 2, type: 'warning' }
      ];

      mockModels.Notification.findAll.mockResolvedValue(notifications);
      mockModels.Notification.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/notification')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.totalUnread).toBe(1);
      expect(mockModels.Notification.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 10,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter unread notifications', async () => {
      mockModels.Notification.findAll.mockResolvedValue([testNotification]);
      mockModels.Notification.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/notification?unreadOnly=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Notification.findAll).toHaveBeenCalledWith({
        where: { userId: 1, is_read: false },
        limit: 10,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });

    test('should support pagination', async () => {
      const notifications = Array.from({ length: 5 }, (_, i) => ({
        ...testNotification,
        id: i + 1
      }));

      mockModels.Notification.findAll.mockResolvedValue(notifications.slice(0, 3));
      mockModels.Notification.count.mockResolvedValue(2); 

      const response = await request(app)
        .get('/notification?page=1&limit=3')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(3);
      expect(mockModels.Notification.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        limit: 3,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('PUT /notification/:notificationId/read', () => {
    test('should mark notification as read', async () => {
      mockModels.Notification.markAsRead = jest.fn().mockResolvedValue(testNotification);

      const response = await request(app)
        .put('/notification/1/read')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Notification.markAsRead).toHaveBeenCalledWith(1);
      expect(global.wsBroadcastToUser).toHaveBeenCalledWith(1, {
        type: 'NOTIFICATION_READ',
        notificationId: 1,
        timestamp: expect.any(String)
      });
    });

    test('should return 404 for non-existent notification', async () => {
      mockModels.Notification.markAsRead = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put('/notification/999/read')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Notification not found');
    });
  });

  describe('PUT /notification/read-all', () => {
    test('should mark all notifications as read', async () => {
      mockModels.Notification.markAllAsRead = jest.fn().mockResolvedValue([3]);

      const response = await request(app)
        .put('/notification/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.markedCount).toBe(3);
      expect(mockModels.Notification.markAllAsRead).toHaveBeenCalledWith(1);
      expect(global.wsBroadcastToUser).toHaveBeenCalledWith(1, {
        type: 'ALL_NOTIFICATIONS_READ',
        timestamp: expect.any(String)
      });
    });

    test('should handle case when no unread notifications', async () => {
      mockModels.Notification.markAllAsRead = jest.fn().mockResolvedValue([0]);

      const response = await request(app)
        .put('/notification/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.markedCount).toBe(0);
    });
  });

  describe('DELETE /notification/:notificationId', () => {
    test('should delete notification successfully', async () => {
      mockModels.Notification.destroy = jest.fn().mockResolvedValue(1);

      const response = await request(app)
        .delete('/notification/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toBe('Notification deleted');
      expect(mockModels.Notification.destroy).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
      expect(global.wsBroadcastToUser).toHaveBeenCalledWith(1, {
        type: 'NOTIFICATION_DELETED',
        notificationId: 1
      });
    });

    test('should return 404 for non-existent notification', async () => {
      mockModels.Notification.destroy = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .delete('/notification/999')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Notification not found');
    });
  });
});