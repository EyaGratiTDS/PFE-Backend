const express = require('express');
const router = express.Router();
const pixelController = require('../controllers/pixelController');
const eventTrackingController = require('../controllers/eventTrackingController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/', requireAuth, pixelController.createPixel);
router.put('/:pixelId', requireAuth, pixelController.updatePixel);
router.delete('/:pixelId', requireAuth, pixelController.deletePixel);
router.get('/user', requireAuth, pixelController.getUserPixels);
router.get('/track/:pixelId', eventTrackingController.trackEvent);
router.get('/:pixelId', requireAuth, pixelController.getPixelById);

module.exports = router;