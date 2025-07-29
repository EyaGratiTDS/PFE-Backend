const request = require('supertest');
const express = require('express');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendAccountCreationEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$2b$10$hashedPassword'),
  genSalt: jest.fn().mockResolvedValue('$2b$10$salt'),
  compareSync: jest.fn().mockReturnValue(true),
  hashSync: jest.fn().mockReturnValue('$2b$10$hashedPassword')
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ id: 1, email: 'test@example.com' })
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-random-string')
  })
}));

jest.mock('multer', () => {
  const multer = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => next())
  }));
  multer.diskStorage = jest.fn();
  return multer;
});

jest.mock('../../controllers/ActivityLogController', () => ({
  logActivity: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../controllers/NotificationController', () => ({
  sendWelcomeNotification: jest.fn().mockResolvedValue(true),
  sendPasswordChangeNotification: jest.fn().mockResolvedValue(true),
  sendTwoFactorEnabledNotification: jest.fn().mockResolvedValue(true),
  sendTwoFactorDisabledNotification: jest.fn().mockResolvedValue(true)
}));

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(() => ({
    base32: 'TEST_SECRET_BASE32',
    otpauth_url: 'otpauth://totp/Test?secret=TEST_SECRET_BASE32'
  })),
  totp: {
    verify: jest.fn().mockReturnValue(true)
  }
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQRCode')
}));

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({
    data: { success: true }
  })
}));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'admin' };
    next();
  },
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'superAdmin' };
    next();
  },
  requireSuperAdmin: (req, res, next) => {
    if (req.user.role !== 'superAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  }
}));

const userController = require('../../controllers/userController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

describe('UserController', () => {
  let app;
  let server;
  let mockModels;
  let authToken;
  let testUser;
  let bcrypt;
  let speakeasy;
  let axios;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    app.post('/users/sign-up', userController.signUp);
    app.get('/users/verify-email', userController.verifyEmail);
    app.post('/users/sign-in', userController.signIn);
    app.post('/users/logout', userController.logout);
    app.post('/users/add-user', userController.createUser);
    app.get('/users/me', userController.getCurrentUser);
    app.put('/users/me', userController.upload.single('avatar'), userController.updateUser);
    app.post('/users/change-password', userController.changePassword);
    app.get('/users/two-factor/status', userController.getTwoFactorStatus);
    app.post('/users/two-factor/generate', userController.generateTwoFactorSecret);
    app.post('/users/two-factor/verify', userController.verifyAndEnableTwoFactor);
    app.post('/users/two-factor/disable', userController.disableTwoFactor);
    app.post('/users/two-factor/login', userController.verifyTwoFactorLogin);
    app.delete('/users/me', userController.deleteAccount);
    app.get('/users/superadmin/users', userController.getAllUsers);
    app.put('/users/superadmin/users/:id/status', userController.toggleUserStatus);

    app.get('/users', userController.getAllUsers);
    app.post('/users', userController.createUser);
    app.put('/users/:id/toggle', userController.toggleUserStatus);
    app.get('/profile', userController.getCurrentUser);
    app.put('/profile', userController.updateUser);
    app.post('/change-password', userController.changePassword);
    app.delete('/profile', userController.deleteAccount);
    app.post('/logout', userController.logout);
    app.post('/sign-up', userController.signUp);
    app.post('/sign-in', userController.signIn);
    app.get('/verify-email', userController.verifyEmail);
    app.post('/generate-2fa', userController.generateTwoFactorSecret);
    app.post('/enable-2fa', userController.verifyAndEnableTwoFactor);
    app.post('/disable-2fa', userController.disableTwoFactor);
    app.post('/verify-2fa', userController.verifyTwoFactorLogin);
    app.get('/2fa-status', userController.getTwoFactorStatus);
  });

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    bcrypt = require('bcryptjs');
    speakeasy = require('speakeasy');
    axios = require('axios');

    bcrypt.compare.mockClear();
    bcrypt.hash.mockClear();
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('$2b$10$hashedPassword');

    testUser.comparePassword = jest.fn().mockResolvedValue(true);
    testUser.save = jest.fn().mockResolvedValue();
    testUser.destroy = jest.fn().mockResolvedValue();
    
    Object.defineProperty(testUser, 'password', {
      set: jest.fn(),
      get: jest.fn().mockReturnValue('hashedPassword'),
      configurable: true
    });

    jest.clearAllMocks();
    
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('$2b$10$hashedPassword');
    axios.post.mockResolvedValue({ data: { success: true } });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('GET /users', () => {
    test('should get all users successfully', async () => {
      const users = [testUser, createTestUser({ email: 'user2@test.com' })];
      const mockResult = {
        count: 2,
        rows: users
      };
      
      mockModels.User.findAndCountAll.mockResolvedValue(mockResult);
      mockModels.Plan.findOne.mockResolvedValue({
        id: 1,
        name: 'Free',
        price: 0
      });

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    test('should handle database error', async () => {
      mockModels.User.findAndCountAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000);

      expectErrorResponse(response);
    });
  });

  describe('POST /users', () => {
    test('should create user successfully', async () => {
      const newUser = { 
        name: 'New User', 
        email: 'new@test.com', 
        role: 'admin',
        password: 'password123'
      };
      
      mockModels.User.findOne.mockResolvedValue(null);
      mockModels.User.create.mockResolvedValue({ 
        id: 3, 
        ...newUser,
        isActive: true,
        isVerified: true,
        created_at: new Date()
      });

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newUser)
        .timeout(5000);

      expectSuccessResponse(response, 201);
      expect(response.body.data.email).toBe(newUser.email);
    });

    test('should return error for existing email', async () => {
      const newUser = { 
        name: 'New User', 
        email: 'existing@test.com', 
        role: 'admin',
        password: 'password123'
      };
      
      mockModels.User.findOne.mockResolvedValue({ id: 1, ...newUser });

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newUser)
        .timeout(5000);

      expectErrorResponse(response, 400);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('PUT /users/:id/toggle', () => {
    test('should toggle user status successfully', async () => {
      mockModels.User.findByPk.mockResolvedValue({
        ...testUser,
        save: jest.fn().mockResolvedValue()
      });

      const response = await request(app)
        .put('/users/1/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false })
        .timeout(5000);

      expectSuccessResponse(response);
      expect(response.body.message).toContain('deactivated');
    });

    test('should prevent deactivating superAdmin', async () => {
      const superAdmin = { 
        ...testUser, 
        role: 'superAdmin',
        save: jest.fn().mockResolvedValue()
      };
      mockModels.User.findByPk.mockResolvedValue(superAdmin);

      const response = await request(app)
        .put('/users/1/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false })
        .timeout(5000);

      expectErrorResponse(response, 403);
    });
  });

  describe('GET /profile', () => {
    test('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000);

      expectSuccessResponse(response);
    });
  });

  describe('PUT /profile', () => {
    test('should update profile successfully', async () => {
      const updateData = { name: 'Updated Name' };
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .timeout(5000);

      expectSuccessResponse(response);
    });

    test('should handle update error', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .put('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .timeout(5000);

      expectErrorResponse(response);
    });
  });

  describe('POST /change-password', () => {
    test('should change password successfully', async () => {
      const userWithMethods = {
        ...testUser,
        comparePassword: jest.fn()
          .mockResolvedValueOnce(true) 
          .mockResolvedValueOnce(false), 
        save: jest.fn().mockResolvedValue(),
        password: 'oldHashedPassword'
      };
      
      Object.defineProperty(userWithMethods, 'password', {
        set: jest.fn(),
        get: jest.fn().mockReturnValue('oldHashedPassword'),
        configurable: true
      });
      
      mockModels.User.findByPk.mockResolvedValue(userWithMethods);

      const response = await request(app)
        .post('/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'oldPassword',
          newPassword: 'newPassword123'
        })
        .timeout(5000);

      expectSuccessResponse(response);
    });

    test('should reject wrong current password', async () => {
      const userWithMethods = {
        ...testUser,
        comparePassword: jest.fn()
          .mockResolvedValueOnce(false) 
          .mockResolvedValueOnce(false),
        save: jest.fn().mockResolvedValue()
      };

      mockModels.User.findByPk.mockResolvedValue(userWithMethods);

      const response = await request(app)
        .post('/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123'
        })
        .timeout(5000);

      expectErrorResponse(response, 401);
      expect(response.body.message).toContain('incorrect');
    });

    test('should reject same password', async () => {
      const userWithMethods = {
        ...testUser,
        comparePassword: jest.fn()
          .mockResolvedValueOnce(true) 
          .mockResolvedValueOnce(true), 
        save: jest.fn().mockResolvedValue()
      };

      mockModels.User.findByPk.mockResolvedValue(userWithMethods);

      const response = await request(app)
        .post('/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'samePassword',
          newPassword: 'samePassword'
        })
        .timeout(5000);

      expectErrorResponse(response, 400);
      expect(response.body.message).toContain('must be different');
    });
  });

  describe('DELETE /profile', () => {
    test('should delete account successfully', async () => {
      const userWithMethods = {
        ...testUser,
        comparePassword: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue()
      };
      
      mockModels.User.findByPk.mockResolvedValue(userWithMethods);

      const response = await request(app)
        .delete('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'correctPassword' })
        .timeout(5000);

      expectSuccessResponse(response);
    });

    test('should reject deletion with wrong password', async () => {
      const userWithMethods = {
        ...testUser,
        comparePassword: jest.fn().mockResolvedValue(false),
        destroy: jest.fn().mockResolvedValue()
      };
      
      mockModels.User.findByPk.mockResolvedValue(userWithMethods);

      const response = await request(app)
        .delete('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'wrongPassword' })
        .timeout(5000);

      expectErrorResponse(response, 401);
    });
  });

  describe('POST /logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000);

      expectSuccessResponse(response);
    });
  });

  describe('POST /sign-up', () => {
    test('should sign up successfully', async () => {
      const signupData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        recaptchaToken: 'valid-token'
      };

      const crypto = require('crypto');
      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue('verification-token-123')
      });

      axios.post.mockResolvedValue({
        data: { success: true }
      });

      mockModels.User.findOne.mockResolvedValue(null);
      
      const createdUser = {
        id: 1,
        name: signupData.name,
        email: signupData.email,
        role: 'admin',
        verificationToken: 'verification-token-123',
        save: jest.fn().mockResolvedValue()
      };
      
      mockModels.User.create.mockResolvedValue(createdUser);
      mockModels.User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(createdUser);

      const response = await request(app)
        .post('/sign-up')
        .send(signupData)
        .timeout(5000);

      expectSuccessResponse(response, 201);
    });

    test('should reject invalid reCAPTCHA', async () => {
      axios.post.mockResolvedValue({
        data: { success: false }
      });

      const response = await request(app)
        .post('/sign-up')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          recaptchaToken: 'invalid-token'
        })
        .timeout(5000);

      expectErrorResponse(response, 400);
    });

    test('should reject existing email', async () => {
      axios.post.mockResolvedValue({
        data: { success: true }
      });

      mockModels.User.findOne.mockResolvedValue({
        id: 1,
        email: 'existing@example.com'
      });

      const response = await request(app)
        .post('/sign-up')
        .send({
          name: 'Test User',
          email: 'existing@example.com',
          password: 'password123',
          recaptchaToken: 'valid-token'
        })
        .timeout(5000);

      expectErrorResponse(response, 400);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /sign-in', () => {
    test('should sign in successfully', async () => {
      const userWithMethods = {
        ...testUser,
        comparePassword: jest.fn().mockResolvedValue(true),
        isActive: true,
        isVerified: true,
        twoFactorEnabled: false
      };

      mockModels.User.findOne.mockResolvedValue(userWithMethods);

      const response = await request(app)
        .post('/sign-in')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .timeout(5000);

      expectSuccessResponse(response);
      expect(response.body.token).toBeDefined();
    });

    test('should reject invalid email', async () => {
      mockModels.User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/sign-in')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        })
        .timeout(5000);

      expectErrorResponse(response, 401);
    });
  });

  describe('2FA Functions', () => {
    test('POST /generate-2fa should generate secret', async () => {
      mockModels.User.findByPk.mockResolvedValue({
        ...testUser,
        save: jest.fn().mockResolvedValue()
      });
      
      const response = await request(app)
        .post('/generate-2fa')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('secret');
      expect(response.body.data).toHaveProperty('qrCode');
    });

    test('POST /enable-2fa should enable 2FA with valid token', async () => {
      const userWith2FA = {
        ...testUser,
        twoFactorSecret: 'TEST_SECRET',
        save: jest.fn().mockResolvedValue()
      };
      
      mockModels.User.findByPk.mockResolvedValue(userWith2FA);
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/enable-2fa')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: '123456' })
        .timeout(5000);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('recoveryCodes');
    });

    test('POST /disable-2fa should disable 2FA', async () => {
      const userWith2FA = { 
        ...testUser, 
        twoFactorEnabled: true,
        save: jest.fn().mockResolvedValue()
      };
      mockModels.User.findByPk.mockResolvedValue(userWith2FA);

      const response = await request(app)
        .post('/disable-2fa')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000);

      expectSuccessResponse(response);
    });

    test('GET /2fa-status should return 2FA status', async () => {
      mockModels.User.findByPk.mockResolvedValue({ 
        ...testUser, 
        twoFactorEnabled: true 
      });

      const response = await request(app)
        .get('/2fa-status')
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000);

      expectSuccessResponse(response);
      expect(response.body.data.enabled).toBe(true);
    });

    test('POST /verify-2fa should verify 2FA login', async () => {
      const jwt = require('jsonwebtoken');
      const tempToken = 'temp-token';
      
      jwt.verify.mockReturnValue({ id: 1, needs2FA: true });
      jwt.sign.mockReturnValue('final-token');
      
      mockModels.User.findByPk.mockResolvedValue({ 
        ...testUser, 
        twoFactorSecret: 'TEST_SECRET',
        twoFactorEnabled: true,
        save: jest.fn().mockResolvedValue()
      });
      speakeasy.totp.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/verify-2fa')
        .send({ token: '123456', tempToken })
        .timeout(5000);

      expectSuccessResponse(response);
      expect(response.body).toHaveProperty('token');
    });
  });
});