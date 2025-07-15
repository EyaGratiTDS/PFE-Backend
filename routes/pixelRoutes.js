const express = require('express');
const router = express.Router();
const pixelController = require('../controllers/pixelController');
const { requireAuth, requireAuthSuperAdmin } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const trackLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 100, 
  message: {
    success: false,
    message: "Too many tracking requests"
  }
});

router.put('/:id/toggle-status', requireAuthSuperAdmin, pixelController.toggleBlocked);
router.post('/', requireAuth, pixelController.createPixel);
router.put('/:pixelId', requireAuth, pixelController.updatePixel);
router.delete('/:pixelId', requireAuth, pixelController.deletePixel);
router.get('/pixels', requireAuthSuperAdmin, pixelController.getPixels);
router.get('/user', requireAuth, pixelController.getUserPixels);
router.get('/:pixelId', requireAuth, pixelController.getPixelById);
router.get('/vcard/:vcardId', requireAuth, pixelController.getPixelsByVCard);

router.get('/:pixelId/track', trackLimiter, pixelController.trackEvent);
router.post('/:pixelId/track', trackLimiter, pixelController.trackEvent);

module.exports = router;