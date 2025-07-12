const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/ApiKeyController');
const { requireAuth } = require('../middleware/authMiddleware');
const { checkApiKeyCreation } = require('../middleware/planLimiter');

router.post('/', requireAuth, checkApiKeyCreation, apiKeyController.createApiKey);
router.get('/', requireAuth, apiKeyController.listApiKeys);
router.get('/all', apiKeyController.listAllApiKeys);
router.delete('/:id', requireAuth, apiKeyController.deleteApiKey);
router.put('/:id/toggle-status', apiKeyController.toggleApiKeyStatus);

module.exports = router;