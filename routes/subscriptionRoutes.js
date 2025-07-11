const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/SubscriptionController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/current', requireAuth, subscriptionController.getUserSubscription);
router.post('/cancel', requireAuth, subscriptionController.cancelSubscription);
router.get('/history', requireAuth, subscriptionController.getUserSubscriptions);
router.get('/status', requireAuth, subscriptionController.getSubscriptionStatus);
router.get('/all', subscriptionController.getAllSubscriptions);
router.put('/:id/CancelByAdmin', subscriptionController.cancelSubscriptionByAdmin);


module.exports = router;