const request = require('supertest');
const express = require('express');
const vcardController = require('../../controllers/vcardController');
const { createTestToken, createTestUser, createTestVCard, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/uploadService');

const app = express();
app.use(express.json());

// Configuration des routes de test
app.get('/vcards', vcardController.getAllVCards);
app.get('/vcards/:id', vcardController.getVCardById);
app.post('/vcards', vcardController.createVCard);
app.put('/vcards/:id', vcardController.updateVCard);
app.delete('/vcards/:id', vcardController.deleteVCard);
app.get('/vcards/:id/qr', vcardController.generateQRCode);
app.post('/vcards/:id/duplicate', vcardController.duplicateVCard);

describe('VCardController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testVCard;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testVCard = createTestVCard({ userId: 1 });
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /vcards', () => {
    test('should get all vcards for user', async () => {
      const vcards = [testVCard, createTestVCard({ userId: 1, url: 'card2' })];
      mockModels.VCard.findAll.mockResolvedValue(vcards);

      const response = await request(app)
        .get('/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.VCard.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: expect.any(Array)
      });
    });

    test('should filter vcards by status', async () => {
      mockModels.VCard.findAll.mockResolvedValue([testVCard]);

      const response = await request(app)
        .get('/vcards?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.VCard.findAll).toHaveBeenCalledWith({
        where: { userId: 1, status: true },
        include: expect.any(Array)
      });
    });
  });

  describe('GET /vcards/:id', () => {
    test('should get vcard by id', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/vcards/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe(testVCard.name);
    });

    test('should return 404 for non-existent vcard', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcards/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not allow access to other users vcards', async () => {
      const otherUserVCard = createTestVCard({ userId: 2 });
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcards/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /vcards', () => {
    test('should create vcard successfully', async () => {
      const vcardData = {
        name: 'New VCard',
        description: 'Test Description',
        url: 'unique-url'
      };

      const createdVCard = { ...vcardData, id: 1, userId: 1 };
      mockModels.VCard.findOne.mockResolvedValue(null); // URL not exists
      mockModels.VCard.create.mockResolvedValue(createdVCard);

      const response = await request(app)
        .post('/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vcardData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.VCard.create).toHaveBeenCalledWith({
        ...vcardData,
        userId: 1
      });
    });

    test('should reject duplicate URL', async () => {
      const vcardData = {
        name: 'New VCard',
        url: 'existing-url'
      };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .post('/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vcardData);

      expectErrorResponse(response);
      expect(response.body.message).toContain('URL already exists');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });
  });

  describe('PUT /vcards/:id', () => {
    test('should update vcard successfully', async () => {
      const updateData = { name: 'Updated VCard' };
      const updatedVCard = { ...testVCard, ...updateData };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.update.mockResolvedValue([1]);
      mockModels.VCard.findOne.mockResolvedValueOnce(updatedVCard);

      const response = await request(app)
        .put('/vcards/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(mockModels.VCard.update).toHaveBeenCalledWith(
        updateData,
        { where: { id: 1, userId: 1 } }
      );
    });

    test('should not allow URL update to existing URL', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.findOne.mockResolvedValueOnce(createTestVCard({ url: 'existing' }));

      const response = await request(app)
        .put('/vcards/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'existing' });

      expectErrorResponse(response);
    });
  });

  describe('DELETE /vcards/:id', () => {
    test('should delete vcard successfully', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/vcards/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.VCard.destroy).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });
  });

  describe('GET /vcards/:id/qr', () => {
    test('should generate QR code successfully', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/vcards/1/qr')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('qrCode');
    });
  });

  describe('POST /vcards/:id/duplicate', () => {
    test('should duplicate vcard successfully', async () => {
      const duplicatedVCard = { ...testVCard, id: 2, name: 'Copy of ' + testVCard.name };
      
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.create.mockResolvedValue(duplicatedVCard);

      const response = await request(app)
        .post('/vcards/1/duplicate')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.VCard.create).toHaveBeenCalled();
    });
  });
});
