const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/create-payment-intent', requireAuth, paymentController.createPaymentIntent);
router.post('/confirm', requireAuth, paymentController.confirmPayment);
router.post('/webhook/stripe', express.raw({type: 'application/json'}), paymentController.handlePaymentWebhook);

module.exports = router;