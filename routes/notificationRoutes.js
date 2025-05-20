const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/', notificationController.getUserNotifications);
router.patch('/:notificationId/read', notificationController.markNotificationAsRead);
router.patch('/mark-all-read', notificationController.markAllNotificationsAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;