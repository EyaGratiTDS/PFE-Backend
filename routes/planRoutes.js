const express = require('express');
const router = express.Router();
const planController = require('../controllers/PlanController');
const { requireAuthSuperAdmin } = require('../middleware/authMiddleware');

router.get('/', planController.getAllPlans);
router.get('/free', planController.getFreePlan);
router.get('/search', planController.searchPlans);
router.post('/', planController.validatePlanType, planController.createPlan);
router.get('/:id', planController.getPlanById);
router.put('/:id', planController.validatePlanType, planController.updatePlan);
router.delete('/:id', planController.deletePlan);
router.patch('/:id/toggle-status', requireAuthSuperAdmin, planController.togglePlanStatus);

module.exports = router;