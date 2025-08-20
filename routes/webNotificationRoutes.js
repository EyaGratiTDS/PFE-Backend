
const express = require('express');
const router = express.Router();
const WebNotifications = require('../models/WebNotifications');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendWebNotification } = require('../controllers/webNotificationsController');

router.post("/", requireAuth, async (req, res) => {
  try {
    ///console.log("Received Web Notification Subscription:", req.body);
    //console.log("User from request:", req.user);
    
    const subscription = req.body;
    const userId = req.user.id; 
    
    const webNotificationData = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      expirationTime: subscription.expirationTime,
      userId: userId
    };
    console.log("Web Notification Data:", webNotificationData);
    const webNotification = await WebNotifications.create(webNotificationData);
    res.status(201).json(webNotification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/", sendWebNotification);

module.exports = router;
