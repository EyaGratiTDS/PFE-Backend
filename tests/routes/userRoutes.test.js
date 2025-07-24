const request = require('supertest');
const express = require('express');
const userRoutes = require('../../routes/userRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  },
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, email: 'admin@example.com', role: 'superadmin' };
    next();
  },
  requireSuperAdmin: (req, res, next) => next(),
}));

const app = express();
app.use(express.json());
app.use('/users', userRoutes);

describe('User Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('POST /users/sign-up', () => {
    test('should sign up a user', async () => {
      mockModels.User.create.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/users/sign-up')
        .send({ email: testUser.email, password: 'testpass' });

      expectSuccessResponse(response);
    });
  });

  describe('GET /users/verify-email', () => {
    test('should verify email', async () => {
      mockModels.User.findOne.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);

      const response = await request(app)
        .get('/users/verify-email?token=validtoken');

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/sign-in', () => {
    test('should sign in a user', async () => {
      mockModels.User.findOne.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/users/sign-in')
        .send({ email: testUser.email, password: 'testpass' });

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/logout', () => {
    test('should logout user', async () => {
      const response = await request(app)
        .post('/users/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/add-user', () => {
    test('should add a user', async () => {
      mockModels.User.create.mockResolvedValue({ ...testUser, id: 2 });

      const response = await request(app)
        .post('/users/add-user')
        .send({ email: 'newuser@test.com', password: 'pass123' });

      expectSuccessResponse(response);
    });
  });

  describe('GET /users/me', () => {
    test('should get current user', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.email).toBe(testUser.email);
    });
  });

  describe('PUT /users/me', () => {
    test('should update current user', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);
      mockModels.User.findByPk.mockResolvedValueOnce({ ...testUser, name: 'Updated' });

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' });

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/change-password', () => {
    test('should change password', async () => {
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedNewPassword');

      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: 'old', newPassword: 'newstrongpass' });

      expectSuccessResponse(response);
    });
  });

  describe('GET /users/two-factor/status', () => {
    test('should get two-factor status', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .get('/users/two-factor/status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/two-factor/generate', () => {
    test('should generate two-factor secret', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/users/two-factor/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/two-factor/verify', () => {
    test('should verify and enable two-factor', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/users/two-factor/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: '123456' });

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/two-factor/disable', () => {
    test('should disable two-factor', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/users/two-factor/disable')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /users/two-factor/login', () => {
    test('should verify two-factor login', async () => {
      mockModels.User.findOne.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/users/two-factor/login')
        .send({ email: testUser.email, token: '123456' });

      expectSuccessResponse(response);
    });
  });

  describe('DELETE /users/me', () => {
    test('should delete current user', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/users/me')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('GET /users/superadmin/users', () => {
    test('should get all users as superadmin', async () => {
      const users = [testUser, createTestUser({ email: 'admin2@test.com' })];
      mockModels.User.findAll.mockResolvedValue(users);

      const response = await request(app)
        .get('/users/superadmin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('PUT /users/superadmin/users/:id/status', () => {
    test('should toggle user status as superadmin', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/users/superadmin/users/1/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'inactive' });

      expectSuccessResponse(response);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockModels.User.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/users/superadmin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle validation errors on change password', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('');

      const response = await request(app)
        .post('/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: '', newPassword: '123' });

      expectErrorResponse(response);
    });
  });
});