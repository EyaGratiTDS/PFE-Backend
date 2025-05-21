const express = require('express');
const router = express.Router();
const projectController = require('../controllers/ProjectController');
const { requireAuth } = require('../middleware/authMiddleware');
const uploadService = require('../services/uploadService');
const { checkProjectCreation } = require('../middleware/planLimiter');

router.post('/', requireAuth, uploadService.upload.single('logoFile'),   checkProjectCreation, projectController.createProject);
router.get('/user', requireAuth, projectController.getProjectsByUserId);
router.get('/:id', requireAuth, projectController.getProjectById);
router.put('/:id', requireAuth,uploadService.upload.single('logoFile'), projectController.updateProject);
router.delete('/:id', requireAuth, projectController.deleteProject);
router.get('/:id/vcards', requireAuth, projectController.getVCardsByProject);


module.exports = router;