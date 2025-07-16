const request = require('supertest');
const express = require('express');
const userController = require('../../controllers/userController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/emailService');
jest.mock('../../services/cryptoUtils');

const app = express();
app.use(express.json());

// Configuration des routes de test
app.get('/users', userController.getAllUsers);
app.get('/users/:id', userController.getUserById);
app.put('/users/:id', userController.updateUser);
app.delete('/users/:id', userController.deleteUser);
app.get('/profile', userController.getUserProfile);
app.put('/profile', userController.updateProfile);
app.post('/change-password', userController.changePassword);

describe('UserController', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    // Mock des méthodes User
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    test('should get all users successfully', async () => {
      const users = [testUser, createTestUser({ email: 'user2@test.com' })];
      mockModels.User.findAll.mockResolvedValue(users);

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.User.findAll).toHaveBeenCalledWith({
        attributes: { exclude: ['password'] }
      });
    });

    test('should handle database error', async () => {
      mockModels.User.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });

  describe('GET /users/:id', () => {
    test('should get user by id successfully', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .get('/users/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.email).toBe(testUser.email);
      expect(mockModels.User.findByPk).toHaveBeenCalledWith(1, {
        attributes: { exclude: ['password'] }
      });
    });

    test('should return 404 for non-existent user', async () => {
      mockModels.User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/users/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /users/:id', () => {
    test('should update user successfully', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedUser = { ...testUser, ...updateData };
      
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);
      mockModels.User.findByPk.mockResolvedValueOnce(updatedUser);

      const response = await request(app)
        .put('/users/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(mockModels.User.update).toHaveBeenCalledWith(
        updateData,
        { where: { id: 1 } }
      );
    });

    test('should not allow email update to existing email', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.findOne.mockResolvedValue(createTestUser({ email: 'existing@test.com' }));

      const response = await request(app)
        .put('/users/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'existing@test.com' });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Email already exists');
    });
  });

  describe('DELETE /users/:id', () => {
    test('should delete user successfully', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/users/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.User.destroy).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    test('should return 404 for non-existent user', async () => {
      mockModels.User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete('/users/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /profile', () => {
    test('should get user profile successfully', async () => {
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.email).toBe(testUser.email);
    });
  });

  describe('PUT /profile', () => {
    test('should update profile successfully', async () => {
      const updateData = { name: 'New Profile Name' };
      const updatedUser = { ...testUser, ...updateData };
      
      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);
      mockModels.User.findByPk.mockResolvedValueOnce(updatedUser);

      const response = await request(app)
        .put('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('POST /change-password', () => {
    test('should change password successfully', async () => {
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedNewPassword');

      mockModels.User.findByPk.mockResolvedValue(testUser);
      mockModels.User.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'oldPassword',
          newPassword: 'newPassword123'
        });

      expectSuccessResponse(response);
    });

    test('should reject wrong current password', async () => {
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123'
        });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Current password is incorrect');
    });
  });
});
