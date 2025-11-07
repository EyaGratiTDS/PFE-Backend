const express = require("express");
const router = express.Router();
const {requireAuth} = require("../middleware/authMiddleware");
const { getVCardLimits } = require("../middleware/planLimiter");
const { getBlocksLimits } = require("../middleware/planLimiter");
const { getApiKeyLimits } = require("../middleware/planLimiter");
const { get2FAAccess } = require("../middleware/planLimiter");
const { getProjectLimits } = require("../middleware/planLimiter");
const { getPixelLimits } = require("../middleware/planLimiter");
const { getCustomDomainLimits } = require("../middleware/planLimiter");

router.get('/vcard', requireAuth, getVCardLimits);
router.get('/blocks', requireAuth, getBlocksLimits);
router.get('/api-keys', requireAuth, getApiKeyLimits);
router.get('/2fa-access', requireAuth, get2FAAccess);
router.get('/project', requireAuth, getProjectLimits);
router.get('/pixel', requireAuth, getPixelLimits);
router.get('/custom-domain', requireAuth, getCustomDomainLimits);

module.exports = router;