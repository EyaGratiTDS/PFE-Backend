const express = require("express");
const router = express.Router();
const vcardController = require("../controllers/vcardController");
const vcardViewController = require('../controllers/vcardViewController');
const { checkVCardCreation } = require("../middleware/planLimiter"); 
const uploadService = require('../services/uploadService');

router.post("/",  checkVCardCreation, vcardController.createVCard);
router.get("/", vcardController.getVCardsByUserId);
router.get("/:id", vcardController.getVCardById);
router.delete('/delete-logo',  vcardController.deleteLogo);
router.get('/admin/vcards-with-users', vcardController.getAllVCardsWithUsers);

router.put("/:id", uploadService.upload.fields([
  { name: 'logoFile', maxCount: 1 }, 
  { name: 'backgroundFile', maxCount: 1 },
  { name: 'faviconFile', maxCount: 1 }
]), vcardController.updateVCard);

router.delete("/:id",  vcardController.deleteVCard);
router.get("/url/:url", vcardController.getVCardByUrl);
router.post('/:id/views', vcardViewController.registerView);
router.put('/:id/toggle-status', vcardController.toggleVCardStatus);


module.exports = router;