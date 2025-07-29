const request = require('supertest');
const express = require('express');
const blockController = require('../../controllers/blockController');
const { createTestToken, createTestUser, createTestVCard, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/uploadService');

const app = express();
app.use(express.json());

app.get('/block', blockController.getBlocksByVcardId[1]);
app.get('/block/:id', blockController.getBlockById);
app.post('/block', blockController.createBlock);
app.put('/block/:id', blockController.updateBlock);
app.delete('/block/:id', blockController.deleteBlock);
app.get('/block/admin', blockController.getBlocksByVcardIdAdmin);
app.put('/block/:id/toggle-status', blockController.toggleBlock);

describe('BlockController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testVCard;
  let testBlock;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    testVCard = createTestVCard({ userId: 1 });
    testBlock = {
      id: 1,
      vcardId: 1,
      type: 'text',
      content: { text: 'Hello World' },
      position: 1,
      is_active: true,
      status: true, 
      update: jest.fn().mockResolvedValue({ ...testBlock }), 
      destroy: jest.fn().mockResolvedValue(true) 
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    mockModels.VCard.findOne = jest.fn();
    mockModels.Block.findOne = jest.fn();
    mockModels.Block.findAll = jest.fn();
    mockModels.Block.count = jest.fn();
    mockModels.Block.create = jest.fn();
    mockModels.Block.update = jest.fn();
    mockModels.Block.findByPk = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('GET /block', () => {
    test('should get all block for vcard', async () => {
      const block = [
        testBlock,
        { ...testBlock, id: 2, type: 'image', position: 2 }
      ];

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.findAll.mockResolvedValue(block);

      const response = await request(app)
        .get('/block?vcardId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.Block.findAll).toHaveBeenCalledWith({
        where: { vcardId: 1, is_active: true },
        order: [['position', 'ASC']]
      });
    });

    test('should return error if vcard not owned by user', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/block?vcardId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404);
      expect(response.body.message).toContain('VCard not found');
    });

    test('should require vcardId parameter', async () => {
      const response = await request(app)
        .get('/block')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 400);
      expect(response.body.message).toContain('VCard ID is required');
    });
  });

  describe('GET /block/:id', () => {
    test('should get block by id', async () => {
      mockModels.Block.findByPk.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/block/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.type).toBe('text');
    });

    test('should return 404 for non-existent block', async () => {
      mockModels.Block.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/block/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /block', () => {
    test('should create text block successfully', async () => {
      const blockData = {
        vcardId: 1,
        type: 'text',
        content: { text: 'New text block' }
      };

      const createdBlock = { ...blockData, id: 1, position: 1 };
      
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.count.mockResolvedValue(0);
      mockModels.Block.create.mockResolvedValue(createdBlock);

      const response = await request(app)
        .post('/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData);

      expectSuccessResponse(response, 201);
      expect(mockModels.Block.create).toHaveBeenCalledWith({
        ...blockData,
        position: 1
      });
    });

    test('should create image block successfully', async () => {
      const blockData = {
        vcardId: 1,
        type: 'image',
        content: { 
          url: 'https://example.com/image.jpg',
          alt: 'Test image'
        }
      };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.count.mockResolvedValue(2);
      mockModels.Block.create.mockResolvedValue({ ...blockData, id: 1, position: 3 });

      const response = await request(app)
        .post('/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData);

      expectSuccessResponse(response);
    });

    test('should create contact block successfully', async () => {
      const blockData = {
        vcardId: 1,
        type: 'contact',
        content: {
          phone: '+1234567890',
          email: 'test@example.com',
          address: '123 Test St'
        }
      };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.count.mockResolvedValue(0);
      mockModels.Block.create.mockResolvedValue({ ...blockData, id: 1, position: 1 });

      const response = await request(app)
        .post('/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData);

      expectSuccessResponse(response);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response, 400);
    });

    test('should validate block type', async () => {
      const blockData = {
        vcardId: 1,
        type: 'invalid_type',
        content: {}
      };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .post('/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData);

      expectErrorResponse(response, 400);
      expect(response.body.message).toContain('Invalid block type');
    });
  });

  describe('PUT /block/:id', () => {
    test('should update block successfully', async () => {
      const updateData = {
        content: { text: 'Updated text' }
      };

      const updatedBlock = { ...testBlock, ...updateData };

      mockModels.Block.findByPk.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      testBlock.update.mockResolvedValue(updatedBlock);

      const response = await request(app)
        .put('/block/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(testBlock.update).toHaveBeenCalledWith(updateData);
    });

    test('should not allow type change', async () => {
      mockModels.Block.findByPk.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .put('/block/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'image' });

      expectErrorResponse(response, 400);
      expect(response.body.message).toContain('Block type cannot be changed');
    });
  });

  describe('DELETE /block/:id', () => {
    test('should delete block successfully', async () => {
      mockModels.Block.findByPk.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .delete('/block/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
      expect(testBlock.destroy).toHaveBeenCalled();
    });
  });

  describe('GET /block/admin', () => {
    test('should get all block for vcard', async () => {
      const block = [
        testBlock,
        { ...testBlock, id: 2, type: 'image', position: 2 }
      ];

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.findAll.mockResolvedValue(block);

      const response = await request(app)
        .get('/block/admin?vcardId=1') // Correction de la route
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.Block.findAll).toHaveBeenCalledWith({
        where: { vcardId: 1, status: true },
        order: [['createdAt', 'ASC']]
      });
    });

    test('should return error if vcard not owned by user', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/block/admin?vcardId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404);
      expect(response.body.message).toContain('VCard not found');
    });

    test('should require vcardId parameter', async () => {
      const response = await request(app)
        .get('/block/admin')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 400);
      expect(response.body.message).toContain('vcardId is required');
    });
  });

  describe('PUT /block/:id/toggle-status', () => {
    test('should toggle block status', async () => {
      mockModels.Block.findByPk.mockResolvedValue(testBlock);
      testBlock.update.mockResolvedValue({ ...testBlock, status: false });

      const response = await request(app)
        .put('/block/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.newStatus).toBe(false);
      expect(testBlock.update).toHaveBeenCalledWith({ status: false });
    });
  });
});