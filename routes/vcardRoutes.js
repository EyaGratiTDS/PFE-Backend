const express = require("express");
const router = express.Router();
const vcardController = require("../controllers/vcardController");
const vcardViewController = require('../controllers/vcardViewController');
const { checkVCardCreation } = require("../middleware/planLimiter"); 
const uploadService = require('../services/cloudinary');
const { requireAuthSuperAdmin } = require('../middleware/authMiddleware');

router.post("/", requireAuth, checkVCardCreation, vcardController.createVCard);
router.get("/", requireAuth, vcardController.getVCardsByUserId);
router.get("/:id", requireAuth, vcardController.getVCardById);
router.delete('/delete-logo', requireAuth, vcardController.deleteLogo);
router.get('/admin/vcards-with-users', requireAuthSuperAdmin, vcardController.getAllVCardsWithUsers);

router.put("/:id", uploadService.upload.fields([
  { name: 'logoFile', maxCount: 1 }, 
  { name: 'backgroundFile', maxCount: 1 },
  { name: 'faviconFile', maxCount: 1 }
]), vcardController.updateVCard);

router.delete("/:id", requireAuth, vcardController.deleteVCard);
router.get("/url/:url", vcardController.getVCardByUrl);
router.post('/:id/views', vcardViewController.registerView);
router.put('/:id/toggle-status', requireAuthSuperAdmin, vcardController.toggleVCardStatus);


module.exports = router;