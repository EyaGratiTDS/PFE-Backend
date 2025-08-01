const request = require('supertest');
const express = require('express');

jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    randomBytes: jest.fn(),
    createHash: actualCrypto.createHash,
    createHmac: actualCrypto.createHmac,
    pbkdf2: actualCrypto.pbkdf2,
    pbkdf2Sync: actualCrypto.pbkdf2Sync
  };
});

jest.mock('../../models/User', () => ({
  findByEmail: jest.fn()
}));

jest.mock('../../services/emailService', () => ({
  sendResetPasswordEmail: jest.fn()
}));

jest.mock('../../controllers/ActivityLogController', () => ({
  logActivity: jest.fn()
}));

jest.mock('../../controllers/NotificationController', () => ({
  sendPasswordChangeNotification: jest.fn()
}));

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn(),
  hash: jest.fn()
}));

jest.mock('../../database/db', () => ({
  execute: jest.fn(),
  promise: jest.fn(() => ({
    execute: jest.fn()
  }))
}));

const User = require('../../models/User');
const { sendResetPasswordEmail } = require('../../services/emailService');
const ActivityLogController = require('../../controllers/ActivityLogController');
const notificationController = require('../../controllers/NotificationController');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../database/db');
const passwordRoutes = require('../../routes/passwordRoutes');

jest.setTimeout(15000); 

describe('Password Routes Integration Tests', () => {
  let app;
  let server;

  beforeAll(() => {
    app = express();
    
    app.use((req, res, next) => {
      if (req.headers['content-type'] === 'application/json') {
        express.json()(req, res, (err) => {
          if (err) {
            return res.status(400).json({ message: 'Invalid JSON format' });
          }
          next();
        });
      } else {
        next();
      }
    });
    
    app.use(express.json());
    app.use('/password', passwordRoutes);
    
    app.use((error, req, res, next) => {
      if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ message: 'Invalid JSON format' });
      }
      res.status(500).json({
        message: error.message || 'An error occurred. Please try again.'
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    bcrypt.genSalt.mockResolvedValue('mock-salt');
    bcrypt.hash.mockResolvedValue('hashed-password-123');
    ActivityLogController.logActivity.mockResolvedValue();
    notificationController.sendPasswordChangeNotification.mockResolvedValue();
  });

  describe('POST /password/forgot-password', () => {
    const validEmail = 'test@example.com';
    const mockUser = {
      id: 1,
      email: validEmail,
      name: 'Test User'
    };

    it('should return 400 if email is not provided', async () => {
      const response = await request(app)
        .post('/password/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email is required');
    });

    it('should return 404 if user is not found', async () => {
      User.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('We don\'t recognize that email.');
    });

    it('should successfully send reset password email', async () => {
      const mockToken = 'mock-reset-token-12345';
      
      User.findByEmail.mockResolvedValue(mockUser);
      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken)
      });
      db.execute.mockResolvedValue([]);
      sendResetPasswordEmail.mockResolvedValue();

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: validEmail });

      expect(response.status).toBe(200);
      expect(User.findByEmail).toHaveBeenCalledWith(validEmail);
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(sendResetPasswordEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        `http://localhost:5173/reset-password?token=${mockToken}`
      );
    });

    it('should handle User.findByEmail error', async () => {
      User.findByEmail.mockRejectedValue(new Error('Database connection error'));

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: validEmail });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('An error occurred. Please try again.');
    });

    it('should handle email service error', async () => {
      User.findByEmail.mockResolvedValue(mockUser);
      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-token')
      });
      db.execute.mockResolvedValue([]);
      sendResetPasswordEmail.mockRejectedValue(new Error('Email service unavailable'));

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: validEmail });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('An error occurred. Please try again.');
    });

    it('should handle malformed email addresses', async () => {
      const malformedEmails = ['invalid-email', '@domain.com', 'user@'];
      User.findByEmail.mockResolvedValue(null);

      for (const email of malformedEmails) {
        const response = await request(app)
          .post('/password/forgot-password')
          .send({ email });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('We don\'t recognize that email.');
      }
    });

    it('should handle empty or null email', async () => {
      const invalidEmails = ['', null, undefined];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/password/forgot-password')
          .send({ email });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Email is required');
      }
    });

    it('should pass email exactly to User.findByEmail', async () => {
      const testEmails = [
        'test@example.com',
        'user.name+tag@domain.co.uk',
        'test123@subdomain.example.org'
      ];

      User.findByEmail.mockResolvedValue(null);

      for (const email of testEmails) {
        await request(app)
          .post('/password/forgot-password')
          .send({ email });

        expect(User.findByEmail).toHaveBeenCalledWith(email);
      }
    });

    it('should generate unique reset tokens', async () => {
      const tokens = ['token1', 'token2', 'token3'];
      let tokenIndex = 0;

      User.findByEmail.mockResolvedValue(mockUser);
      crypto.randomBytes.mockImplementation(() => ({
        toString: jest.fn().mockReturnValue(tokens[tokenIndex++])
      }));
      db.execute.mockResolvedValue([]);
      sendResetPasswordEmail.mockResolvedValue();

      for (let i = 0; i < tokens.length; i++) {
        await request(app)
          .post('/password/forgot-password')
          .send({ email: validEmail });

        expect(sendResetPasswordEmail).toHaveBeenCalledWith(
          mockUser.email,
          mockUser.name,
          `http://localhost:5173/reset-password?token=${tokens[i]}`
        );
      }
    });

    it('should handle database execution error', async () => {
      User.findByEmail.mockResolvedValue(mockUser);
      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue('mock-token')
      });
      db.execute.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: validEmail });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('An error occurred. Please try again.');
    });
  });

  describe('POST /password/reset-password', () => {
    const validToken = 'valid-reset-token';
    const newPassword = 'newSecurePassword123';
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User'
    };

    beforeEach(() => {
      db.promise.mockReturnValue({
        execute: jest.fn()
      });
    });

    it('should return 400 if token is not provided', async () => {
      const response = await request(app)
        .post('/password/reset-password')
        .send({ newPassword });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Token and new password are required');
    });

    it('should return 400 if new password is not provided', async () => {
      const response = await request(app)
        .post('/password/reset-password')
        .send({ token: validToken });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Token and new password are required');
    });

    it('should return 400 if both token and password are missing', async () => {
      const response = await request(app)
        .post('/password/reset-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Token and new password are required');
    });

    it('should successfully reset password', async () => {
      const mockDbExecute = jest.fn()
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([]);

      db.promise.mockReturnValue({
        execute: mockDbExecute
      });

      const response = await request(app)
        .post('/password/reset-password')
        .send({ token: validToken, newPassword });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Your password has been reset successfully.');
      expect(ActivityLogController.logActivity).toHaveBeenCalledWith(
        mockUser.id,
        'password_reset_success',
        expect.any(Object)
      );
    });

    it('should handle invalid or expired token', async () => {
      const mockDbExecute = jest.fn().mockResolvedValue([[]]);
      
      db.promise.mockReturnValue({
        execute: mockDbExecute
      });

      const response = await request(app)
        .post('/password/reset-password')
        .send({ token: 'invalid-token', newPassword });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid or expired token.');
    });

    it('should handle notification error but still succeed', async () => {
      const mockDbExecute = jest.fn()
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([]);

      db.promise.mockReturnValue({
        execute: mockDbExecute
      });

      notificationController.sendPasswordChangeNotification.mockRejectedValue(
        new Error('Notification service error')
      );

      const response = await request(app)
        .post('/password/reset-password')
        .send({ token: validToken, newPassword });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Your password has been reset successfully.');
    });

    it('should handle bcrypt error', async () => {
      const mockDbExecute = jest.fn().mockResolvedValueOnce([[mockUser]]);
      
      db.promise.mockReturnValue({
        execute: mockDbExecute
      });
      
      bcrypt.genSalt.mockRejectedValue(new Error('Bcrypt error'));

      const response = await request(app)
        .post('/password/reset-password')
        .send({ token: validToken, newPassword });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('An error occurred. Please try again.');
    });

    it('should handle database connection error', async () => {
      const mockDbExecute = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      
      db.promise.mockReturnValue({
        execute: mockDbExecute
      });

      const response = await request(app)
        .post('/password/reset-password')
        .send({ token: validToken, newPassword });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('An error occurred. Please try again.');
    });

    it('should handle different password types', async () => {
      const passwordTypes = [
        'SimplePassword123',
        'Complex!P@ssw0rd#2023',
        'very_long_password_with_underscores_123456789'
      ];

      for (const password of passwordTypes) {
        const mockDbExecute = jest.fn()
          .mockResolvedValueOnce([[mockUser]])
          .mockResolvedValueOnce([]);

        db.promise.mockReturnValue({
          execute: mockDbExecute
        });

        bcrypt.hash.mockResolvedValue(`hashed-${password}`);

        const response = await request(app)
          .post('/password/reset-password')
          .send({ token: validToken, newPassword: password });

        expect(response.status).toBe(200);
        expect(bcrypt.hash).toHaveBeenCalledWith(password, 'mock-salt');
      }
    });

    it('should pass request object to activity logging', async () => {
      const mockDbExecute = jest.fn()
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([]);

      db.promise.mockReturnValue({
        execute: mockDbExecute
      });

      let capturedRequest;
      ActivityLogController.logActivity.mockImplementation((userId, action, req) => {
        capturedRequest = req;
        return Promise.resolve();
      });

      await request(app)
        .post('/password/reset-password')
        .set('User-Agent', 'Test-Agent')
        .set('X-Forwarded-For', '192.168.1.1')
        .send({ token: validToken, newPassword });

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest.body).toEqual({ token: validToken, newPassword });
    });

    it('should handle concurrent reset attempts', async () => {
      const mockDbExecute = jest.fn()
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([]);

      db.promise.mockReturnValue({
        execute: mockDbExecute
      });

      const requests = Array(3).fill().map(() => 
        request(app)
          .post('/password/reset-password')
          .send({ token: validToken, newPassword })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      User.findByEmail.mockImplementation(() => {
        throw new Error('Unexpected synchronous error');
      });

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('An error occurred. Please try again.');
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/password/forgot-password')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid JSON format');
    });

    it('should handle very large request bodies', async () => {
      const largeEmail = 'a'.repeat(1000) + '@example.com';
      User.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: largeEmail });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('We don\'t recognize that email.');
    });
  });

  describe('Content Type and Request Handling', () => {
    it('should handle different content types', async () => {
      User.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/password/forgot-password')
        .set('Content-Type', 'application/json')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(404);
    });

    it('should handle missing content type header', async () => {
      User.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/password/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(404);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/password/forgot-password')
        .send();

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email is required');
    });
  });

  describe('HTTP Methods and Routes', () => {
    it('should handle wrong HTTP methods', async () => {
      const wrongMethods = [
        { method: 'get', path: '/password/forgot-password' },
        { method: 'put', path: '/password/forgot-password' },
        { method: 'delete', path: '/password/forgot-password' },
        { method: 'get', path: '/password/reset-password' },
        { method: 'put', path: '/password/reset-password' },
        { method: 'delete', path: '/password/reset-password' }
      ];

      for (const test of wrongMethods) {
        const response = await request(app)[test.method](test.path);
        expect(response.status).toBe(404);
      }
    });

    it('should handle non-existent routes', async () => {
      const nonExistentRoutes = [
        '/password/nonexistent',
        '/password/forgot',
        '/password/reset',
        '/password/change-password'
      ];

      for (const route of nonExistentRoutes) {
        const response = await request(app)
          .post(route)
          .send({});
        expect(response.status).toBe(404);
      }
    });
  });

  describe('Complete Password Reset Flow', () => {
    it('should simulate complete password reset flow', async () => {
      const userEmail = 'flowtest@example.com';
      const resetToken = 'flow-test-token-123';
      const newPassword = 'NewSecurePassword123';
      
      const mockUser = {
        id: 99,
        email: userEmail,
        name: 'Flow Test User'
      };

      User.findByEmail.mockResolvedValue(mockUser);
      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue(resetToken)
      });
      db.execute.mockResolvedValue([]);
      sendResetPasswordEmail.mockResolvedValue();

      const forgotResponse = await request(app)
        .post('/password/forgot-password')
        .send({ email: userEmail });

      expect(forgotResponse.status).toBe(200);

      const mockDbExecute = jest.fn()
        .mockResolvedValueOnce([[mockUser]])
        .mockResolvedValueOnce([]);

      db.promise.mockReturnValue({
        execute: mockDbExecute
      });

      const resetResponse = await request(app)
        .post('/password/reset-password')
        .send({ token: resetToken, newPassword });

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.message).toBe('Your password has been reset successfully.');
    });
  });
});