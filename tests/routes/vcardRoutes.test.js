const request = require('supertest');
const express = require('express');
const vcardRoutes = require('../../routes/vcardRoutes');
const { createTestToken, createTestUser, createTestVCard, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/vcards', vcardRoutes);

describe('VCard Routes', () => {
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

  describe('GET /api/vcards', () => {
    test('should get all vcards for authenticated user', async () => {
      const vcards = [testVCard, createTestVCard({ userId: 1, url: 'card2' })];
      mockModels.VCard.findAll.mockResolvedValue(vcards);

      const response = await request(app)
        .get('/api/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });

    test('should support filtering by status', async () => {
      mockModels.VCard.findAll.mockResolvedValue([testVCard]);

      const response = await request(app)
        .get('/api/vcards?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should support pagination', async () => {
      const vcards = Array.from({ length: 5 }, (_, i) => createTestVCard({ 
        userId: 1, 
        url: `card${i}` 
      }));
      
      mockModels.VCard.findAndCountAll.mockResolvedValue({
        rows: vcards.slice(0, 2),
        count: 5
      });

      const response = await request(app)
        .get('/api/vcards?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 5,
        pages: 3
      });
    });
  });

  describe('POST /api/vcards', () => {
    test('should create new vcard', async () => {
      const vcardData = {
        name: 'New VCard',
        description: 'Test Description',
        url: 'unique-url'
      };

      const createdVCard = { ...vcardData, id: 1, userId: 1 };
      mockModels.VCard.findOne.mockResolvedValue(null);
      mockModels.VCard.create.mockResolvedValue(createdVCard);

      const response = await request(app)
        .post('/api/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vcardData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });

    test('should prevent duplicate URLs', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .post('/api/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
          url: testVCard.url
        });

      expectErrorResponse(response);
    });
  });

  describe('GET /api/vcards/:id', () => {
    test('should get vcard by id', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/api/vcards/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe(testVCard.name);
    });

    test('should return 404 for non-existent vcard', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/vcards/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/vcards/:id', () => {
    test('should update vcard', async () => {
      const updateData = { name: 'Updated VCard' };
      const updatedVCard = { ...testVCard, ...updateData };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.update.mockResolvedValue([1]);
      mockModels.VCard.findOne.mockResolvedValueOnce(updatedVCard);

      const response = await request(app)
        .put('/api/vcards/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });

    test('should validate URL uniqueness on update', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.findOne.mockResolvedValueOnce(createTestVCard({ url: 'existing' }));

      const response = await request(app)
        .put('/api/vcards/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'existing' });

      expectErrorResponse(response);
    });
  });

  describe('DELETE /api/vcards/:id', () => {
    test('should delete vcard', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/vcards/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('GET /api/vcards/:id/qr', () => {
    test('should generate QR code', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/api/vcards/1/qr')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('qrCode');
    });

    test('should handle different QR formats', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/api/vcards/1/qr?format=png&size=200')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /api/vcards/:id/duplicate', () => {
    test('should duplicate vcard', async () => {
      const duplicatedVCard = { ...testVCard, id: 2, name: 'Copy of ' + testVCard.name };
      
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.create.mockResolvedValue(duplicatedVCard);

      const response = await request(app)
        .post('/api/vcards/1/duplicate')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/vcards/:id/share', () => {
    test('should share vcard via email', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      
      const emailService = require('../../services/emailService');
      emailService.sendVCardShare = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/vcards/1/share')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          email: 'recipient@example.com',
          message: 'Check out my vCard!'
        });

      expectSuccessResponse(response);
      expect(emailService.sendVCardShare).toHaveBeenCalled();
    });
  });

  describe('GET /api/vcards/:id/analytics', () => {
    test('should get vcard analytics', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.count.mockResolvedValue(150);
      mockModels.VCardView.findAll.mockResolvedValue([
        { createdAt: new Date(), ipAddress: '192.168.1.1' }
      ]);

      const response = await request(app)
        .get('/api/vcards/1/analytics')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('totalViews');
      expect(response.body.data).toHaveProperty('recentViews');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.VCard.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/vcards')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should validate JSON payload', async () => {
      const response = await request(app)
        .post('/api/vcards')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expectErrorResponse(response);
    });
  });
});
