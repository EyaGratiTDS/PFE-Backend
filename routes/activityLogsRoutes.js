const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/ActivityLogController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.requireAuth, activityLogController.getUserActivities);
router.get('/failed-attempts', authMiddleware.requireAuth,  activityLogController.getFailedAttempts);
router.get('/recent', authMiddleware.requireAuth, activityLogController.getRecentActivities);
router.get('/:id', authMiddleware.requireAuth, activityLogController.getActivityDetails);

module.exports = router;