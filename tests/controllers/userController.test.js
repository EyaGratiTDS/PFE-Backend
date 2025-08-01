const userController = require('../../controllers/userController');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { sendVerificationEmail, sendAccountCreationEmail } = require('../../services/emailService');
const activityLogController = require('../../controllers/ActivityLogController');
const notificationController = require('../../controllers/NotificationController');
const db = require('../../models');

jest.mock('../../models/User');
jest.mock('../../models');
jest.mock('jsonwebtoken');
jest.mock('crypto');
jest.mock('axios');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('fs');
jest.mock('path');
jest.mock('../../services/emailService');
jest.mock('../../controllers/ActivityLogController');
jest.mock('../../controllers/NotificationController');

describe('UserController', () => {
  let req, res, mockUser;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
      user: { id: 1, email: 'test@example.com', role: 'admin' },
      file: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    };

    mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      password: 'hashedPassword',
      isVerified: true,
      isActive: true,
      avatar: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      created_at: new Date(),
      comparePassword: jest.fn(),
      save: jest.fn(),
      destroy: jest.fn(),
      get: jest.fn().mockReturnValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        isVerified: true,
        created_at: new Date(),
        avatar: null,
        Subscription: []
      })
    };

    jest.clearAllMocks();
    
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    process.env.BACKEND_URL = 'http://localhost:3000';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'test';

    db.Subscription = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn()
    };
    
    db.Plan = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Free',
        price: 0
      })
    };
  });

  describe('signUp', () => {
    beforeEach(() => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        recaptchaToken: 'valid-token'
      };
    });

    it('should register a new user successfully', async () => {
      axios.post.mockResolvedValue({
        data: { success: true }
      });

      User.findOne.mockResolvedValue(null);

      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue('verification-token')
      });

      const newUser = { ...mockUser, verificationToken: 'verification-token' };
      User.create.mockResolvedValue(newUser);
      User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(newUser);
      sendVerificationEmail.mockResolvedValue();

      notificationController.sendWelcomeNotification.mockResolvedValue();
      activityLogController.logActivity.mockResolvedValue();

      await userController.signUp(req, res);

      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'admin',
        verificationToken: 'verification-token'
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully. Please check your email.'
      });
    });

    it('should fail if reCAPTCHA validation fails', async () => {
      axios.post.mockResolvedValue({
        data: { success: false }
      });

      await userController.signUp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'reCAPTCHA validation failed.'
      });
    });

    it('should fail if user already exists', async () => {
      axios.post.mockResolvedValue({
        data: { success: true }
      });

      User.findOne.mockResolvedValue(mockUser);

      await userController.signUp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'A user with this email already exists.'
      });
    });

    it('should handle errors during registration', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await userController.signUp(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Registration failed'
      });
    });
  });

  describe('signIn', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      };
    });

    it('should sign in user successfully', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      jwt.sign.mockReturnValue('jwt-token');
      activityLogController.logActivity.mockResolvedValue();

      await userController.signIn(req, res);

      expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('authToken', 'jwt-token', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        token: 'jwt-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role
        },
        requires2FA: false,
        tempToken: undefined
      });
    });

    it('should fail if user does not exist', async () => {
      User.findOne.mockResolvedValue(null);

      await userController.signIn(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email or password'
      });
    });

    it('should fail if account is deactivated', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };
      User.findOne.mockResolvedValue(deactivatedUser);

      await userController.signIn(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your account has been deactivated. Please contact support to reactivate it.'
      });
    });

    it('should fail if password is invalid', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);

      await userController.signIn(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email or password'
      });
    });

    it('should fail if email is not verified', async () => {
      const unverifiedUser = { ...mockUser, isVerified: false };
      User.findOne.mockResolvedValue(unverifiedUser);
      unverifiedUser.comparePassword = jest.fn().mockResolvedValue(true);

      await userController.signIn(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Please verify your email address to activate your account.'
      });
    });

    it('should handle 2FA enabled users', async () => {
      const user2FA = { ...mockUser, twoFactorEnabled: true };
      User.findOne.mockResolvedValue(user2FA);
      user2FA.comparePassword = jest.fn().mockResolvedValue(true);
      jwt.sign.mockReturnValueOnce('temp-token').mockReturnValueOnce('auth-token');
      activityLogController.logActivity.mockResolvedValue();

      await userController.signIn(req, res);

      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        requires2FA: true,
        tempToken: 'temp-token'
      }));
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      req.query.token = 'valid-token';
      const userToVerify = { 
        ...mockUser, 
        isVerified: false, 
        verificationToken: 'valid-token',
        save: jest.fn()
      };
      User.findOne.mockResolvedValue(userToVerify);

      await userController.verifyEmail(req, res);

      expect(userToVerify.isVerified).toBe(true);
      expect(userToVerify.verificationToken).toBe(null);
      expect(userToVerify.save).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/sign-in?verified=true');
    });

    it('should fail with invalid token', async () => {
      req.query.token = 'invalid-token';
      User.findOne.mockResolvedValue(null);

      await userController.verifyEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      await userController.getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          avatar: req.user.avatar
        }
      });
    });

    it('should handle errors', async () => {
      req.user = null;

      await userController.getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve user information'
      });
    });
  });

  describe('updateUser', () => {
    beforeEach(() => {
      req.body = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };
    });

    it('should update user successfully', async () => {
      User.findByPk.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockUser);
      User.update.mockResolvedValue([1]);
      activityLogController.logActivity.mockResolvedValue();

      await userController.updateUser(req, res);

      expect(User.update).toHaveBeenCalledWith(
        {
          name: 'Updated Name',
          email: 'updated@example.com'
        },
        { where: { id: 1 } }
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });

    it('should update user with avatar', async () => {
      req.file = { filename: 'avatar.jpg' };
      const userWithAvatar = { ...mockUser, avatar: '/uploads/old-avatar.jpg' };
      User.findByPk.mockResolvedValueOnce(userWithAvatar).mockResolvedValueOnce(userWithAvatar);
      User.update.mockResolvedValue([1]);
      activityLogController.logActivity.mockResolvedValue();

      path.join.mockReturnValue('/path/to/old-avatar.jpg');
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockReturnValue();

      await userController.updateUser(req, res);

      expect(User.update).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar: '/uploads/avatar.jpg'
        }),
        { where: { id: 1 } }
      );
    });

    it('should fail if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await userController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      req.body = {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword123'
      };
    });

    it('should change password successfully', async () => {
      User.findByPk.mockResolvedValue(mockUser);
      mockUser.comparePassword
        .mockResolvedValueOnce(false) 
        .mockResolvedValueOnce(true); 
      notificationController.sendPasswordChangeNotification.mockResolvedValue();
      activityLogController.logActivity.mockResolvedValue();

      await userController.changePassword(req, res);

      expect(mockUser.password).toBe('newPassword123');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });
    });

    it('should fail if new password is same as current', async () => {
      User.findByPk.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true); 

      await userController.changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'New password must be different from current password'
      });
    });

    it('should fail if current password is incorrect', async () => {
      User.findByPk.mockResolvedValue(mockUser);
      mockUser.comparePassword
        .mockResolvedValueOnce(false) 
        .mockResolvedValueOnce(false); 

      await userController.changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect'
      });
    });
  });

  describe('generateTwoFactorSecret', () => {
    it('should generate 2FA secret successfully', async () => {
      User.findByPk.mockResolvedValue(mockUser);
      speakeasy.generateSecret.mockReturnValue({
        base32: 'secret-base32',
        otpauth_url: 'otpauth://totp/MyApp'
      });
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,qrcode');

      await userController.generateTwoFactorSecret(req, res);

      expect(mockUser.twoFactorSecret).toBe('secret-base32');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          secret: 'secret-base32',
          qrCode: 'data:image/png;base64,qrcode'
        }
      });
    });

    it('should fail if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await userController.generateTwoFactorSecret(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('verifyAndEnableTwoFactor', () => {
    beforeEach(() => {
      req.body = { token: '123456' };
    });

    it('should verify and enable 2FA successfully', async () => {
      const userWith2FASecret = { 
        ...mockUser, 
        twoFactorSecret: 'secret',
        save: jest.fn()
      };
      User.findByPk.mockResolvedValue(userWith2FASecret);
      speakeasy.totp.verify.mockReturnValue(true);
      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue('abcd1234')
      });
      notificationController.sendTwoFactorEnabledNotification.mockResolvedValue();
      activityLogController.logActivity.mockResolvedValue();

      await userController.verifyAndEnableTwoFactor(req, res);

      expect(userWith2FASecret.twoFactorEnabled).toBe(true);
      expect(userWith2FASecret.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          recoveryCodes: expect.any(Array)
        }
      });
    });

    it('should fail with invalid verification code', async () => {
      const userWith2FASecret = { ...mockUser, twoFactorSecret: 'secret' };
      User.findByPk.mockResolvedValue(userWith2FASecret);
      speakeasy.totp.verify.mockReturnValue(false);

      await userController.verifyAndEnableTwoFactor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid verification code'
      });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      activityLogController.logActivity.mockResolvedValue();

      await userController.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('authToken', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      req.body = { password: 'correctPassword' };
    });

    it('should delete account successfully', async () => {
      User.findByPk.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);

      await userController.deleteAccount(req, res);

      expect(mockUser.destroy).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('authToken');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Account deleted successfully'
      });
    });

    it('should fail with incorrect password', async () => {
      User.findByPk.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);

      await userController.deleteAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid password'
      });
    });

    it('should fail if password not provided', async () => {
      req.body = {};

      await userController.deleteAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password is required'
      });
    });
  });

  describe('getAllUsers', () => {
    beforeEach(() => {
      req.query = { page: 1, limit: 10, search: '' };
    });

    it('should get all users successfully', async () => {
      const mockUserData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        isVerified: true,
        created_at: new Date(),
        avatar: null,
        Subscription: []
      };

      const mockUsers = [{
        get: jest.fn().mockReturnValue(mockUserData)
      }];

      User.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockUsers
      });

      await userController.getAllUsers(req, res);

      expect(User.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        limit: 10,
        offset: 0,
        attributes: { exclude: ['password', 'twoFactorSecret'] },
        order: [['created_at', 'DESC']],
        include: [
          {
            model: db.Subscription,
            as: 'Subscription',
            required: false,
            where: { status: 'active' },
            include: [{
              model: db.Plan,
              as: 'Plan',
              attributes: ['id', 'name', 'price']
            }]
          }
        ]
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
        pagination: {
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 10
        }
      });
    });

    it('should handle search parameter', async () => {
      req.query.search = 'test@example.com';
      
      const mockUsers = [{
        get: jest.fn().mockReturnValue({
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'admin',
          isActive: true,
          isVerified: true,
          created_at: new Date(),
          avatar: null,
          Subscription: []
        })
      }];

      User.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockUsers
      });

      await userController.getAllUsers(req, res);

      expect(User.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [require('sequelize').Op.or]: expect.any(Array)
          })
        })
      );
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      User.findAndCountAll.mockRejectedValue(error);

      await userController.getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve users'
      });
    });
  });

  describe('createUser', () => {
    beforeEach(() => {
      req.body = {
        name: 'New User',
        email: 'newuser@example.com',
        role: 'admin',
        password: 'password123'
      };
    });

    it('should create user successfully', async () => {
      User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);
      User.create.mockResolvedValue(mockUser);
      sendAccountCreationEmail.mockResolvedValue();
      notificationController.sendWelcomeNotification.mockResolvedValue();
      activityLogController.logActivity.mockResolvedValue();

      await userController.createUser(req, res);

      expect(User.create).toHaveBeenCalledWith({
        name: 'New User',
        email: 'newuser@example.com',
        role: 'admin',
        password: 'password123',
        isVerified: true,
        isActive: true
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });

    it('should fail if user already exists', async () => {
      User.findOne.mockResolvedValue(mockUser);

      await userController.createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'A user with this email already exists.'
      });
    });
  });

  describe('toggleUserStatus', () => {
    beforeEach(() => {
      req.params = { id: '1' };
      req.body = { isActive: false };
    });

    it('should toggle user status successfully', async () => {
      User.findByPk.mockResolvedValue(mockUser);
      activityLogController.logActivity.mockResolvedValue();

      await userController.toggleUserStatus(req, res);

      expect(mockUser.isActive).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deactivated'
      });
    });

    it('should prevent deactivating superAdmin', async () => {
      const superAdminUser = { ...mockUser, role: 'superAdmin' };
      User.findByPk.mockResolvedValue(superAdminUser);

      await userController.toggleUserStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot deactivate superAdmin'
      });
    });
  });
});