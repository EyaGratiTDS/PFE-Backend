const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');


router.post('/sign-up', userController.signUp);
router.get('/verify-email', userController.verifyEmail);
router.post('/sign-in', userController.signIn);
router.post('/logout',authMiddleware.requireAuth, userController.logout);
router.post('/add-user', userController.createUser);
router.get('/me',authMiddleware.requireAuth, userController.getCurrentUser);
router.put('/me', authMiddleware.requireAuth, userController.upload.single('avatar'), userController.updateUser);
router.post('/change-password', authMiddleware.requireAuth, userController.changePassword);
router.get('/two-factor/status', authMiddleware.requireAuth, userController.getTwoFactorStatus);
router.post('/two-factor/generate', authMiddleware.requireAuth, userController.generateTwoFactorSecret);
router.post('/two-factor/verify', authMiddleware.requireAuth, userController.verifyAndEnableTwoFactor);
router.post('/two-factor/disable', authMiddleware.requireAuth, userController.disableTwoFactor);
router.post('/two-factor/login', userController.verifyTwoFactorLogin);
router.delete('/me', authMiddleware.requireAuth, userController.deleteAccount);
router.get('/superadmin/users', authMiddleware.requireAuth, authMiddleware.requireSuperAdmin, userController.getAllUsers);
router.put('/superadmin/users/:id/status', authMiddleware.requireAuth, authMiddleware.requireSuperAdmin, userController.toggleUserStatus);

module.exports = router;