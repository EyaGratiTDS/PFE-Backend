const express = require('express');
const router = express.Router();
const visitorController = require('../controllers/VisiteurController');

router.post('/track', visitorController.trackVisitor);
router.post('/track-exit', visitorController.trackVisitorExit);
router.get('/stats', visitorController.getAudienceStats);

module.exports = router;