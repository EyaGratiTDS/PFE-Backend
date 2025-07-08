const express = require('express');
const router = express.Router();
const blockController = require('../controllers/blockController');

router.get('/search', blockController.searchBlocks);
router.post('/', blockController.validateBlockType, blockController.createBlock);
router.get('/', blockController.getBlocksByVcardId);
router.get('/admin', blockController.getBlocksByVcardIdAdmin);
router.get('/:id', blockController.getBlockById);
router.put('/:id', blockController.validateBlockType, blockController.updateBlock);
router.delete('/:id', blockController.deleteBlock);
router.put('/:id/toggle-status', blockController.toggleBlock);

module.exports = router;