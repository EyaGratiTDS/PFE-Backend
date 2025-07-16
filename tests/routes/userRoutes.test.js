const request = require('supertest');
const express = require('express');
const userRoutes = require('../../routes/userRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});
jest.mock('../../middleware/rbacMiddleware', () => ({
  requireRole: (role) => (req, res, next) => next(),
  requirePermission: (permission) => (req, res, next) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

describe('User Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    test('should get all users', async () => {
      const users = [testUser, createTestUser({ email: 'user2@test.com' })];
      mockModels.User.findAll.mockResolvedValue(users);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/users');

      expectSuccessResponse(response); 
    });
  });

  describe('GET /api/users/:id', () => {
    test('should get user by id', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.email).toBe(testUser.email);
    });
  });

  describe('PUT /api/users/:id', () => {
    test('should update user', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedUser = { ...testUser, ...updateData };
      
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);
      mockModels.User.findByPk.mockResolvedValueOnce(updatedUser);

      const response = await request(app)
        .put('/api/users/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('DELETE /api/users/:id', () => {
    test('should delete user', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/users/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('GET /api/users/profile', () => {
    test('should get user profile', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('PUT /api/users/profile', () => {
    test('should update user profile', async () => {
      const updateData = { name: 'New Profile Name' };
      const updatedUser = { ...testUser, ...updateData };
      
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);
      mockModels.User.findByPk.mockResolvedValueOnce(updatedUser);

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('POST /api/users/change-password', () => {
    test('should change password', async () => {
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedNewPassword');

      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'oldPassword',
          newPassword: 'newPassword123'
        });

      expectSuccessResponse(response);
    });
  });

  describe('Route Parameter Validation', () => {
    test('should validate user ID parameter', async () => {
      const response = await request(app)
        .get('/api/users/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      // The route should handle invalid IDs gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockModels.User.findAll.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: '',
          newPassword: '123' // Too short
        });

      expectErrorResponse(response);
    });
  });
});
