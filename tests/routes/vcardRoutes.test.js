const request = require('supertest');
const express = require('express');
const vcardRoutes = require('../../routes/vcardRoutes');
const { 
  createTestToken, 
  createTestUser, 
  createTestVCard, 
  expectSuccessResponse, 
  expectErrorResponse 
} = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => ({
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, email: 'admin@example.com', role: 'superadmin' };
    next();
  }
}));
jest.mock('../../middleware/planLimiter', () => ({
  checkVCardCreation: (req, res, next) => next()
}));
jest.mock('../../services/uploadService', () => ({
  upload: {
    fields: () => (req, res, next) => {
      req.files = {};
      next();
    }
  }
}));

const app = express();
app.use(express.json());
app.use('/vcard', vcardRoutes);

describe('VCard Routes', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testVCard;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    testVCard = createTestVCard({ userId: 1 });
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('POST /vcard', () => {
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
        .post('/vcard')
        .send(vcardData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/vcard')
        .send({});

      expectErrorResponse(response);
    });

    test('should prevent duplicate URLs', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .post('/vcard')
        .send({
          name: 'Test',
          url: testVCard.url
        });

      expectErrorResponse(response);
    });
  });

  describe('GET /vcard', () => {
    test('should get all vcards for authenticated user (mocked)', async () => {
      const vcards = [testVCard, createTestVCard({ userId: 1, url: 'card2' })];
      mockModels.VCard.findAll.mockResolvedValue(vcards);

      const response = await request(app)
        .get('/vcard');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });

    test('should support filtering by status', async () => {
      mockModels.VCard.findAll.mockResolvedValue([testVCard]);

      const response = await request(app)
        .get('/vcard?status=active');

      expectSuccessResponse(response);
    });
  });

  describe('GET /vcard/:id', () => {
    test('should get vcard by id', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/vcard/1');

      expectSuccessResponse(response);
      expect(response.body.data.name).toBe(testVCard.name);
    });

    test('should return 404 for non-existent vcard', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcard/999');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /vcard/:id', () => {
    test('should update vcard', async () => {
      const updateData = { name: 'Updated VCard' };
      const updatedVCard = { ...testVCard, ...updateData };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.update.mockResolvedValue([1]);
      mockModels.VCard.findOne.mockResolvedValueOnce(updatedVCard);

      const response = await request(app)
        .put('/vcard/1')
        .send(updateData);

      expectSuccessResponse(response);
    });

    test('should validate URL uniqueness on update', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.findOne.mockResolvedValueOnce(createTestVCard({ url: 'existing' }));

      const response = await request(app)
        .put('/vcard/1')
        .send({ url: 'existing' });

      expectErrorResponse(response);
    });
  });

  describe('DELETE /vcard/:id', () => {
    test('should delete vcard', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/vcard/1');

      expectSuccessResponse(response);
    });
  });

  describe('GET /vcard/url/:url', () => {
    test('should get vcard by url', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get(`/vcard/url/${testVCard.url}`);

      expectSuccessResponse(response);
      expect(response.body.data.url).toBe(testVCard.url);
    });

    test('should return 404 for unknown url', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcard/url/unknown-url');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /vcard/delete-logo', () => {
    test('should delete logo', async () => {
      const response = await request(app)
        .delete('/vcard/delete-logo');

      expectSuccessResponse(response);
    });
  });

  describe('GET /vcard/admin/vcards-with-users', () => {
    test('should get all vcards with users (admin only)', async () => {
      mockModels.VCard.findAll.mockResolvedValue([
        { ...testVCard, User: testUser }
      ]);

      const response = await request(app)
        .get('/vcard/admin/vcards-with-users')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data[0].User).toBeDefined();
    });
  });

  describe('POST /vcard/:id/views', () => {
    test('should register a vcard view', async () => {
      const vcardViewController = require('../../controllers/vcardViewController');
      vcardViewController.registerView = jest.fn((req, res) => res.status(200).json({ success: true }));

      const response = await request(app)
        .post('/vcard/1/views');

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /vcard/:id/toggle-status', () => {
    test('should toggle vcard status (admin)', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCard.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/vcard/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 if vcard not found (toggle-status)', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put('/vcard/999/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.VCard.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/vcard');

      expectErrorResponse(response);
    });

    test('should validate JSON payload', async () => {
      const response = await request(app)
        .post('/vcard')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expectErrorResponse(response);
    });
  });
});