const request = require('supertest');
const express = require('express');
const vcardController = require('../../controllers/vcardController');
const { createTestToken, createTestUser, createTestVCard } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/uploadService', () => ({
  upload: jest.fn(),
  deleteFileIfExists: jest.fn()
}));
jest.mock('../../services/generateUrl', () => ({
  generateUniqueUrl: jest.fn()
}));
jest.mock('path');
jest.mock('fs');

describe('VCardController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testVCard;
  let app;

  beforeAll(() => {
    // Configuration de l'app Express
    app = express();
    app.use(express.json());
    
    // Middleware pour simuler req.files
    app.use((req, res, next) => {
      req.files = req.files || {};
      next();
    });
    
    // Configuration des routes
    app.post("/vcard", vcardController.createVCard);
    app.get("/vcard", vcardController.getVCardsByUserId);
    app.get("/vcard/:id", vcardController.getVCardById);
    app.put("/vcard/:id", vcardController.updateVCard);
    app.delete("/vcard/:id", vcardController.deleteVCard);
    app.post("/vcard/delete-logo", vcardController.deleteLogo);
    app.get("/vcard/url/:url", vcardController.getVCardByUrl);
    app.get("/admin/vcards", vcardController.getAllVCardsWithUsers);
    app.patch("/admin/vcard/:id/toggle", vcardController.toggleVCardStatus);
  });

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    testVCard = createTestVCard({ 
      userId: 1,
      id: 1,
      name: 'Test VCard',
      description: 'Test Description',
      logo: null,
      favicon: null,
      background_type: 'color',
      background_value: '#ffffff'
    });
    authToken = createTestToken({ id: 1, email: testUser.email });

    // Mock des services
    const { generateUniqueUrl } = require('../../services/generateUrl');
    generateUniqueUrl.mockReturnValue('test-unique-url');

    const { deleteFileIfExists } = require('../../services/uploadService');
    deleteFileIfExists.mockImplementation(() => {});

    // Mock de fs et path
    const fs = require('fs');
    const path = require('path');
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.unlinkSync = jest.fn();
    path.join = jest.fn().mockReturnValue('/mock/path');

    // Initialisation des mocks de modèles
    mockModels.VCard.findAll = jest.fn();
    mockModels.VCard.findByPk = jest.fn();
    mockModels.VCard.findOne = jest.fn();
    mockModels.VCard.create = jest.fn();
    mockModels.VCard.update = jest.fn();
    mockModels.VCard.destroy = jest.fn();
    mockModels.VCard.count = jest.fn();
    mockModels.User.findByPk = jest.fn();
    mockModels.Plan.findOne = jest.fn();
    mockModels.Subscription.findAll = jest.fn();

    jest.clearAllMocks();
  });

  afterAll((done) => {
    setTimeout(done, 100);
  });

  describe('GET /vcard', () => {
    test('should get all vcard for user', async () => {
      mockModels.VCard.findAll.mockResolvedValue([testVCard]);

      const response = await request(app)
        .get('/vcard')
        .query({ userId: 1 });

      expect(response.status).toBe(200);
      expect(mockModels.VCard.findAll).toHaveBeenCalledWith({
        where: { 
          userId: '1', 
          status: false 
        }
      });
    });

    test('should return error when userId is missing', async () => {
      const response = await request(app)
        .get('/vcard');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID is required');
    });
  });

  describe('GET /vcard/:id', () => {
    test('should get vcard by id', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/vcard/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(testVCard.name);
    });

    test('should return 404 for non-existent vcard', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcard/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('VCard not found');
    });
  });

  describe('POST /vcard', () => {
    test('should create vcard successfully', async () => {
      const vcardData = {
        name: 'New VCard',
        description: 'Test Description',
        userId: 1
      };

      const createdVCard = { 
        ...vcardData, 
        id: 1,
        url: 'test-unique-url',
        createdAt: new Date()
      };
      
      mockModels.VCard.create.mockResolvedValue(createdVCard);
      mockModels.User.findByPk.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/vcard')
        .send(vcardData);

      expect(response.status).toBe(201);
      expect(response.body.vcard.name).toBe(vcardData.name);
      expect(response.body.message).toBe('VCard created successfully');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/vcard')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("The 'name' and 'userId' fields are mandatory");
    });

    test('should return 404 when user not found', async () => {
      mockModels.User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/vcard')
        .send({ name: 'Test', userId: 999 });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('PUT /vcard/:id', () => {
    test('should update vcard successfully without files', (done) => {
      const updateData = { 
        name: 'Updated VCard',
        description: 'Updated Description',
        is_active: 'true'
      };
      
      const updatedVCard = { ...testVCard, ...updateData };

      mockModels.VCard.findByPk
        .mockResolvedValueOnce(testVCard)
        .mockResolvedValueOnce(updatedVCard);
      
      mockModels.VCard.update.mockResolvedValue([1]);

      request(app)
        .put('/vcard/1')
        .send(updateData)
        .end((err, response) => {
          try {
            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
            expect(mockModels.VCard.update).toHaveBeenCalledWith(
              expect.objectContaining({
                name: updateData.name,
                description: updateData.description,
                is_active: updateData.is_active
              }),
              { where: { id: '1' } }
            );
            done();
          } catch (error) {
            done(error);
          }
        });
    });

    test('should update vcard with logo file', (done) => {
      const updateData = { 
        name: 'Updated VCard'
      };
      
      const updatedVCard = { ...testVCard, ...updateData, logo: '/uploads/new-logo.jpg' };

      mockModels.VCard.findByPk
        .mockResolvedValueOnce(testVCard)
        .mockResolvedValueOnce(updatedVCard);
      
      mockModels.VCard.update.mockResolvedValue([1]);

      // Mock req.files pour simuler l'upload de fichier
      const originalApp = app;
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.files = {
          logoFile: [{ filename: 'new-logo.jpg' }]
        };
        next();
      });
      testApp.put("/vcard/:id", vcardController.updateVCard);

      request(testApp)
        .put('/vcard/1')
        .send(updateData)
        .end((err, response) => {
          try {
            expect(response.status).toBe(200);
            expect(mockModels.VCard.update).toHaveBeenCalledWith(
              expect.objectContaining({
                name: updateData.name,
                logo: '/uploads/new-logo.jpg'
              }),
              { where: { id: '1' } }
            );
            done();
          } catch (error) {
            done(error);
          }
        });
    });

    test('should return 404 for non-existent vcard', (done) => {
      mockModels.VCard.findByPk.mockResolvedValue(null);

      request(app)
        .put('/vcard/999')
        .send({ name: 'Updated' })
        .end((err, response) => {
          try {
            expect(response.status).toBe(404);
            expect(response.body.message).toBe('VCard not found');
            done();
          } catch (error) {
            done(error);
          }
        });
    });

    test('should return 404 when update affects no rows', (done) => {
      mockModels.VCard.findByPk.mockResolvedValue(testVCard);
      mockModels.VCard.update.mockResolvedValue([0]);

      request(app)
        .put('/vcard/1')
        .send({ name: 'Updated' })
        .end((err, response) => {
          try {
            expect(response.status).toBe(404);
            expect(response.body.message).toBe('VCard not found');
            done();
          } catch (error) {
            done(error);
          }
        });
    });
  });

  describe('DELETE /vcard/:id', () => {
    test('should delete vcard successfully', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(testVCard);
      mockModels.VCard.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/vcard/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('VCard and associated files deleted successfully');
      expect(mockModels.VCard.destroy).toHaveBeenCalledWith({
        where: { id: '1' }
      });
    });

    test('should return 404 for non-existent vcard', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete('/vcard/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('VCard not found');
    });
  });

  describe('POST /vcard/delete-logo', () => {
    test('should delete logo successfully', async () => {
      const response = await request(app)
        .post('/vcard/delete-logo')
        .send({ logoPath: '/uploads/logo.jpg' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logo successfully removed.');
    });

    test('should return 400 when logoPath is missing', async () => {
      const response = await request(app)
        .post('/vcard/delete-logo')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Missing logo path.');
    });

    test('should return 404 when logo file not found', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);

      const response = await request(app)
        .post('/vcard/delete-logo')
        .send({ logoPath: '/uploads/nonexistent.jpg' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Logo not found.');
    });
  });

  describe('GET /vcard/url/:url', () => {
    test('should get vcard by url successfully', async () => {
      const mockVCard = {
        ...testVCard,
        is_active: true,
        Users: {
          Subscription: [{
            Plan: { 
              name: 'Free',
              features: ['1 vCard', '10 vCard blocks']
            }
          }]
        },
        get: jest.fn(() => testVCard)
      };

      mockModels.VCard.findOne.mockResolvedValue(mockVCard);
      mockModels.VCard.count.mockResolvedValue(1);
      mockModels.Plan.findOne.mockResolvedValue({
        name: 'Free',
        features: ['1 vCard', '10 vCard blocks']
      });

      const response = await request(app)
        .get('/vcard/url/test-url');

      expect(response.status).toBe(200);
      expect(response.body.maxBlocksAllowed).toBe(10);
    });

    test('should return 404 for non-existent vcard url', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcard/url/non-existent');

      expect(response.status).toBe(404);
    });

    test('should return 403 for inactive vcard', async () => {
      const inactiveVCard = { ...testVCard, is_active: false };
      mockModels.VCard.findOne.mockResolvedValue(inactiveVCard);

      const response = await request(app)
        .get('/vcard/url/test-url');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('VCard disabled');
      expect(response.body.isNotActive).toBe(true);
    });
  });

  describe('GET /admin/vcards', () => {
    test('should get all vcards with users', async () => {
      const mockVCards = [{
        ...testVCard,
        Users: testUser
      }];

      mockModels.VCard.findAll.mockResolvedValue(mockVCards);

      const response = await request(app)
        .get('/admin/vcards');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCards);
    });
  });

  describe('PATCH /admin/vcard/:id/toggle', () => {
    test('should toggle vcard status successfully', async () => {
      const mockVCard = { ...testVCard, status: false };
      mockModels.VCard.findByPk.mockResolvedValue(mockVCard);
      mockModels.VCard.update.mockResolvedValue([1]);

      const response = await request(app)
        .patch('/admin/vcard/1/toggle');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('VCard activated successfully');
      expect(response.body.newStatus).toBe(true);
    });

    test('should return 404 when vcard not found', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .patch('/admin/vcard/999/toggle');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('VCard not found');
    });
  });
});