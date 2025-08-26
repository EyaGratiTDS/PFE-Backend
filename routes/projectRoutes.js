const express = require('express');
const router = express.Router();
const projectController = require('../controllers/ProjectController');
const { requireAuth, requireAuthSuperAdmin } = require('../middleware/authMiddleware');
const uploadService = require('../services/cloudinary');
const { checkProjectCreation } = require('../middleware/planLimiter');

router.post('/', requireAuth, uploadService.upload.single('logoFile'), checkProjectCreation, projectController.createProject);
router.get('/user', requireAuth, projectController.getProjectsByUserId);
router.get('/projects-with-users', requireAuthSuperAdmin, projectController.getAllProjectsWithUser);
router.get('/:id', requireAuth, projectController.getProjectById);
router.put('/:id', requireAuth,uploadService.upload.single('logoFile'), projectController.updateProject);
router.delete('/:id', requireAuth, projectController.deleteProject);
router.get('/:id/vcards', requireAuth, projectController.getVCardsByProject);
router.put('/:id/toggle-status', requireAuthSuperAdmin, projectController.toggleProjectBlocked);

module.exports = router;