const crypto = require('crypto');
const VCard = require('../models/Vcard');
const VcardView = require('../models/VcardView');
const User = require('../models/User');
const notificationController = require('./NotificationController');

const generateFingerprint = (req) => {
  return crypto.createHash('sha256')
    .update(`${req.ip}-${req.headers['user-agent']}`)
    .digest('hex');
};

exports.registerView = async (req, res) => {
  try {
    const vcard = await VCard.findOne({
      where: { id: req.params.id }
    });
    
    if (!vcard) return res.status(404).json({ message: "VCard not found" });

    if (req.user?.id && vcard.userId === req.user.id) {
      return res.json({
        views: vcard.views,
        message: "Creator view - not counted"
      });
    }

    const identifier = req.user?.id 
      ? `user-${req.user.id}` 
      : generateFingerprint(req);

    const existingView = await VcardView.findOne({ 
      where: {
        vcardId: vcard.id,
        fingerprint: identifier
      }
    });

    let isNewView = false;
    
    if (!existingView) {
      await VcardView.create({
        vcardId: vcard.id,
        userId: req.user?.id || null,
        fingerprint: identifier
      });

      await vcard.increment('views');
      await vcard.reload();
      isNewView = true;
    }

    try {
      let viewerName = 'Anonymous';
      
      if (req.user?.id) {
        const viewer = await User.findByPk(req.user.id);
        viewerName = viewer.name;
      }

      await notificationController.sendVcardViewNotification(
        vcard.userId, 
        viewerName, 
        vcard.id,
        vcard.name
      );
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.json({
      views: vcard.views,
      isNewView: isNewView
    });

  } catch (error) {
    console.error('Error registering view:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
};