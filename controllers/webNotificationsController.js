const webPush = require('web-push');
const User = require('../models/User');
const WebNotifications = require('../models/WebNotifications');

webPush.setVapidDetails(
  'mailto:eyagrati02@gmail.com',
  process.env.PUBLIC_KEY,
  process.env.PRIVATE_KEY
);

exports.sendWebNotification = async (req, res) => {
  try {
    const { userId, url, message } = req.body;
    const user = await User.findByPk(userId, { include: 'WebNotifications' });

    if (!user || !user.WebNotifications || user.WebNotifications.length === 0) {
      return res.status(404).json({ message: 'No web notifications found for this user.' });
    }

    const payload = JSON.stringify({
      title: message.title || 'New Message',
      body: message.body || 'This is a new notification',
      data: { url: url || '/' }
    });

    const results = [];
    const subscriptionsToRemove = [];

    for (const subscription of user.WebNotifications) {
      try {
        let keys = typeof subscription.keys === 'string' ? JSON.parse(subscription.keys) : subscription.keys;

        const subscriptionData = {
          endpoint: subscription.endpoint,
          keys: keys
        };

        await webPush.sendNotification(subscriptionData, payload);
        results.push({ endpoint: subscription.endpoint, status: 'sent' });
      } catch (error) {
        console.error('Error sending web notification:', error);
        results.push({ endpoint: subscription.endpoint, status: 'failed', error: error.message });
        if (error.statusCode === 410 || error.statusCode === 404) {
          subscriptionsToRemove.push(subscription.id);
        }
      }
    }

    if (subscriptionsToRemove.length > 0) {
      await WebNotifications.destroy({ where: { id: subscriptionsToRemove } });
    }

    res.status(200).json({
      success: true,
      message: 'Web notifications processed',
      results
    });
  } catch (error) {
    console.error('Error in sendWebNotification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
