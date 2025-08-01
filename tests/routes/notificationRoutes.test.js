const request = require('supertest');
const express = require('express');

jest.mock('../../controllers/NotificationController', () => ({
  getUserNotifications: jest.fn(),
  markNotificationAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  deleteNotification: jest.fn()
}));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: jest.fn()
}));

const notificationController = require('../../controllers/NotificationController');
const { requireAuth } = require('../../middleware/authMiddleware');
const notificationRoutes = require('../../routes/notificationRoutes');

describe('Notification Routes Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/notification', notificationRoutes);
    
    app.use((error, req, res, next) => {
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    requireAuth.mockImplementation((req, res, next) => {
      req.user = { 
        id: 1, 
        email: 'user@example.com',
        role: 'user'
      };
      next();
    });
  });

  describe('GET /notification', () => {
    it('should get user notifications successfully', async () => {
      const mockNotifications = [
        {
          id: 1,
          title: 'New VCard Created',
          message: 'Your VCard has been successfully created',
          type: 'success',
          isRead: false,
          createdAt: '2025-08-01T10:15:59.614Z',
          userId: 1
        },
        {
          id: 2,
          title: 'Plan Upgrade',
          message: 'Your plan has been upgraded to Premium',
          type: 'info',
          isRead: true,
          createdAt: '2025-07-31T10:15:59.614Z',
          userId: 1
        },
        {
          id: 3,
          title: 'Payment Failed',
          message: 'Your payment could not be processed',
          type: 'error',
          isRead: false,
          createdAt: '2025-07-30T10:15:59.614Z',
          userId: 1
        }
      ];

      notificationController.getUserNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockNotifications,
          count: mockNotifications.length,
          unreadCount: mockNotifications.filter(n => !n.isRead).length,
          message: 'Notifications retrieved successfully'
        });
      });

      const response = await request(app)
        .get('/notification');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNotifications);
      expect(response.body.count).toBe(3);
      expect(response.body.unreadCount).toBe(2);
      expect(requireAuth).toHaveBeenCalled();
      expect(notificationController.getUserNotifications).toHaveBeenCalled();
    });

    it('should return empty array when user has no notifications', async () => {
      notificationController.getUserNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          count: 0,
          unreadCount: 0,
          message: 'No notifications found'
        });
      });

      const response = await request(app)
        .get('/notification');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
      expect(response.body.unreadCount).toBe(0);
    });

    it('should handle query parameters for pagination', async () => {
      let capturedReq;
      
      notificationController.getUserNotifications.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: [],
          count: 0,
          pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            total: 0
          }
        });
      });

      await request(app)
        .get('/notification')
        .query({ page: '2', limit: '5', type: 'success' });

      expect(capturedReq.query.page).toBe('2');
      expect(capturedReq.query.limit).toBe('5');
      expect(capturedReq.query.type).toBe('success');
    });

    it('should handle authentication failure', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .get('/notification');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(notificationController.getUserNotifications).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /notification/:notificationId/read', () => {
    it('should mark notification as read successfully', async () => {
      const mockUpdatedNotification = {
        id: 1,
        title: 'New VCard Created',
        message: 'Your VCard has been successfully created',
        type: 'success',
        isRead: true,
        readAt: '2025-08-01T11:00:00.000Z',
        createdAt: '2025-08-01T10:15:59.614Z',
        userId: 1
      };

      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUpdatedNotification,
          message: 'Notification marked as read successfully'
        });
      });

      const response = await request(app)
        .patch('/notification/1/read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isRead).toBe(true);
      expect(response.body.data.readAt).toBeDefined();
      expect(requireAuth).toHaveBeenCalled();
      expect(notificationController.markNotificationAsRead).toHaveBeenCalled();
    });

    it('should return 404 when notification not found', async () => {
      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      });

      const response = await request(app)
        .patch('/notification/999/read');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 when trying to mark another user notification', async () => {
      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          message: 'Access denied - Not your notification'
        });
      });

      const response = await request(app)
        .patch('/notification/1/read');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    it('should handle invalid notification ID format', async () => {
      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid notification ID format'
        });
      });

      const response = await request(app)
        .patch('/notification/invalid-id/read');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should pass notification ID to controller', async () => {
      let capturedReq;
      
      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: { id: parseInt(req.params.notificationId), isRead: true }
        });
      });

      await request(app)
        .patch('/notification/123/read');

      expect(capturedReq.params.notificationId).toBe('123');
    });
  });

  describe('PATCH /notification/mark-all-read', () => {
    it('should mark all notifications as read successfully', async () => {
      const mockResult = {
        updatedCount: 5,
        totalNotifications: 10,
        unreadCount: 0
      };

      notificationController.markAllNotificationsAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockResult,
          message: 'All notifications marked as read successfully'
        });
      });

      const response = await request(app)
        .patch('/notification/mark-all-read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBe(5);
      expect(response.body.data.unreadCount).toBe(0);
      expect(requireAuth).toHaveBeenCalled();
      expect(notificationController.markAllNotificationsAsRead).toHaveBeenCalled();
    });

    it('should handle case when no unread notifications exist', async () => {
      const mockResult = {
        updatedCount: 0,
        totalNotifications: 3,
        unreadCount: 0
      };

      notificationController.markAllNotificationsAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockResult,
          message: 'No unread notifications to update'
        });
      });

      const response = await request(app)
        .patch('/notification/mark-all-read');

      expect(response.status).toBe(200);
      expect(response.body.data.updatedCount).toBe(0);
    });

    it('should handle user with no notifications', async () => {
      notificationController.markAllNotificationsAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            updatedCount: 0,
            totalNotifications: 0,
            unreadCount: 0
          },
          message: 'No notifications found for user'
        });
      });

      const response = await request(app)
        .patch('/notification/mark-all-read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /notification/:notificationId', () => {
    it('should delete notification successfully', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Notification deleted successfully',
          data: {
            deletedId: parseInt(req.params.notificationId)
          }
        });
      });

      const response = await request(app)
        .delete('/notification/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      expect(response.body.data.deletedId).toBe(1);
      expect(requireAuth).toHaveBeenCalled();
      expect(notificationController.deleteNotification).toHaveBeenCalled();
    });

    it('should return 404 when notification not found for deletion', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Notification not found for deletion'
        });
      });

      const response = await request(app)
        .delete('/notification/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 when trying to delete another user notification', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          message: 'Access denied - Cannot delete notification of another user'
        });
      });

      const response = await request(app)
        .delete('/notification/1');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle invalid notification ID format for deletion', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid notification ID format'
        });
      });

      const response = await request(app)
        .delete('/notification/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should pass notification ID to delete controller', async () => {
      let capturedReq;
      
      notificationController.deleteNotification.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          message: 'Notification deleted',
          data: { deletedId: parseInt(req.params.notificationId) }
        });
      });

      await request(app)
        .delete('/notification/456');

      expect(capturedReq.params.notificationId).toBe('456');
    });
  });

  describe('Authentication Middleware Tests', () => {
    it('should require authentication for all routes', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication token required'
        });
      });

      const routes = [
        { method: 'get', path: '/notification' },
        { method: 'patch', path: '/notification/1/read' },
        { method: 'patch', path: '/notification/mark-all-read' },
        { method: 'delete', path: '/notification/1' }
      ];

      for (const route of routes) {
        const response = await request(app)[route.method](route.path);
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }

      expect(requireAuth).toHaveBeenCalledTimes(routes.length);
    });

    it('should pass user data through authentication to all controllers', async () => {
      const mockUser = {
        id: 123,
        email: 'testuser@example.com',
        role: 'user'
      };

      let capturedReqs = [];

      requireAuth.mockImplementation((req, res, next) => {
        req.user = mockUser;
        next();
      });

      notificationController.getUserNotifications.mockImplementation((req, res) => {
        capturedReqs.push({ endpoint: 'getUserNotifications', user: req.user });
        res.status(200).json({ success: true, data: [] });
      });

      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        capturedReqs.push({ endpoint: 'markNotificationAsRead', user: req.user });
        res.status(200).json({ success: true, data: {} });
      });

      notificationController.markAllNotificationsAsRead.mockImplementation((req, res) => {
        capturedReqs.push({ endpoint: 'markAllNotificationsAsRead', user: req.user });
        res.status(200).json({ success: true, data: {} });
      });

      notificationController.deleteNotification.mockImplementation((req, res) => {
        capturedReqs.push({ endpoint: 'deleteNotification', user: req.user });
        res.status(200).json({ success: true, data: {} });
      });

      await request(app).get('/notification');
      await request(app).patch('/notification/1/read');
      await request(app).patch('/notification/mark-all-read');
      await request(app).delete('/notification/1');

      expect(capturedReqs).toHaveLength(4);
      capturedReqs.forEach(req => {
        expect(req.user).toEqual(mockUser);
      });
    });

    it('should handle expired token', async () => {
      requireAuth.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      });

      const response = await request(app)
        .get('/notification');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      notificationController.getUserNotifications.mockImplementation((req, res, next) => {
        const error = new Error('Database connection failed');
        next(error);
      });

      const response = await request(app)
        .get('/notification');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database connection failed');
    });

    it('should handle validation errors', async () => {
      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: [
            { field: 'notificationId', message: 'Must be a valid integer' }
          ]
        });
      });

      const response = await request(app)
        .patch('/notification/abc/read');

      expect(response.status).toBe(422);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle service unavailable errors', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(503).json({
          success: false,
          message: 'Notification service temporarily unavailable'
        });
      });

      const response = await request(app)
        .delete('/notification/1');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Route Parameters and Request Body Handling', () => {
    it('should handle route parameters correctly', async () => {
      let capturedParams = [];

      notificationController.markNotificationAsRead.mockImplementation((req, res) => {
        capturedParams.push({ notificationId: req.params.notificationId });
        res.status(200).json({ success: true });
      });

      notificationController.deleteNotification.mockImplementation((req, res) => {
        capturedParams.push({ notificationId: req.params.notificationId });
        res.status(200).json({ success: true });
      });

      await request(app).patch('/notification/123/read');
      await request(app).delete('/notification/456');

      expect(capturedParams).toEqual([
        { notificationId: '123' },
        { notificationId: '456' }
      ]);
    });

    it('should handle non-existent routes', async () => {
      const response = await request(app)
        .get('/notification/nonexistent-endpoint');

      expect(response.status).toBe(404);
    });

    it('should handle wrong HTTP methods', async () => {
      const response = await request(app)
        .post('/notification/1/read');

      expect(response.status).toBe(404);
    });
  });

  describe('Different Notification Types Handling', () => {
    it('should handle different notification types in get request', async () => {
      const mockNotificationsByType = {
        success: [
          { id: 1, type: 'success', title: 'Success notification' }
        ],
        error: [
          { id: 2, type: 'error', title: 'Error notification' }
        ],
        info: [
          { id: 3, type: 'info', title: 'Info notification' }
        ],
        warning: [
          { id: 4, type: 'warning', title: 'Warning notification' }
        ]
      };

      notificationController.getUserNotifications.mockImplementation((req, res) => {
        const requestedType = req.query.type;
        const data = requestedType ? 
          mockNotificationsByType[requestedType] || [] : 
          Object.values(mockNotificationsByType).flat();

        res.status(200).json({
          success: true,
          data,
          count: data.length,
          filterType: requestedType || 'all'
        });
      });

      const response = await request(app)
        .get('/notification')
        .query({ type: 'error' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('error');
      expect(response.body.filterType).toBe('error');
    });
  });
});