const request = require('supertest');
const express = require('express');
const notificationRouter = require('../../routes/notificationRoutes'); // Import du routeur
const Notification = require('../../models/Notification');

// Création de l'application Express pour les tests
const app = express();
app.use(express.json());
app.use('/notifications', notificationRouter); // Montage du routeur sur le chemin de base

// Mock du modèle Notification
jest.mock('../../models/Notification');

// Mock du middleware d'authentification
jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'user123' };
    next();
  }
}));

// Mock WebSocket
global.wsBroadcastToUser = jest.fn();

describe('Notification Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /notifications', () => {
    it('should fetch user notifications successfully', async () => {
      const mockNotifications = [
        { id: 1, message: 'Test 1' },
        { id: 2, message: 'Test 2' }
      ];
      
      Notification.findAll.mockResolvedValue(mockNotifications);
      Notification.count.mockResolvedValue(5);

      const res = await request(app)
        .get('/notifications')
        .query({ limit: 10, offset: 0, unreadOnly: 'true' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: mockNotifications,
        meta: { totalUnread: 5 }
      });
    });

    it('should handle errors when fetching notifications', async () => {
      Notification.findAll.mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/notifications');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });

  describe('PATCH /notifications/:notificationId/read', () => {
    it('should mark notification as read', async () => {
      const mockNotification = { id: 'notif123' };
      Notification.markAsRead.mockResolvedValue(mockNotification);

      const res = await request(app)
        .patch('/notifications/notif123/read');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: mockNotification
      });
      expect(global.wsBroadcastToUser).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ type: 'NOTIFICATION_READ' })
      );
    });

    it('should handle not found error', async () => {
      Notification.markAsRead.mockResolvedValue(null);

      const res = await request(app)
        .patch('/notifications/invalid-id/read');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Notification not found');
    });
  });

  describe('PATCH /notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      Notification.markAllAsRead.mockResolvedValue([5]);

      const res = await request(app)
        .patch('/notifications/mark-all-read');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        markedCount: 5
      });
      expect(global.wsBroadcastToUser).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ type: 'ALL_NOTIFICATIONS_READ' })
      );
    });

    it('should handle database errors', async () => {
      Notification.markAllAsRead.mockRejectedValue(new Error('Update failed'));

      const res = await request(app)
        .patch('/notifications/mark-all-read');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Update failed');
    });
  });

  describe('DELETE /notifications/:notificationId', () => {
    it('should delete notification successfully', async () => {
      Notification.destroy.mockResolvedValue(1);

      const res = await request(app)
        .delete('/notifications/notif123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Notification deleted'
      });
      expect(global.wsBroadcastToUser).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ type: 'NOTIFICATION_DELETED' })
      );
    });

    it('should handle not found error', async () => {
      Notification.destroy.mockResolvedValue(0);

      const res = await request(app)
        .delete('/notifications/invalid-id');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Notification not found');
    });
  });
});