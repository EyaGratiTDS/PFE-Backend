const express = require('express');
const router = express.Router();
const { checkCustomDomainCreation } = require("../middleware/planLimiter"); 
const {
  createCustomDomain,
  updateCustomDomain,
  deleteCustomDomain,
  getUserDomains,
  getDomainById,
  verifyDomain,
  handleDomainRequest,
  handleNotFound,
  linkToVCard,
  unlinkFromVCard
} = require('../controllers/CustomDomainController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/', requireAuth, checkCustomDomainCreation, createCustomDomain);
router.get('/', requireAuth, getUserDomains);
router.get('/:id', requireAuth, getDomainById);
router.put('/:id', requireAuth, updateCustomDomain);
router.delete('/:id', requireAuth, deleteCustomDomain);
router.post('/:id/verify', requireAuth, verifyDomain);
router.post('/link-to-vcard', requireAuth, linkToVCard);
router.post('/:id/unlink', requireAuth, unlinkFromVCard);

router.get('/', handleDomainRequest);
router.get('*', handleNotFound); 

module.exports = router;