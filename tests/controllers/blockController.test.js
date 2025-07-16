const request = require('supertest');
const express = require('express');
const blockController = require('../../controllers/blockController');
const { createTestToken, createTestUser, createTestVCard, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/uploadService');

const app = express();
app.use(express.json());

// Configuration des routes de test
app.get('/blocks', blockController.getAllBlocks);
app.get('/blocks/:id', blockController.getBlockById);
app.post('/blocks', blockController.createBlock);
app.put('/blocks/:id', blockController.updateBlock);
app.delete('/blocks/:id', blockController.deleteBlock);
app.put('/blocks/:id/position', blockController.updateBlockPosition);
app.post('/blocks/:id/duplicate', blockController.duplicateBlock);

describe('BlockController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testVCard;
  let testBlock;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testVCard = createTestVCard({ userId: 1 });
    testBlock = {
      id: 1,
      vcardId: 1,
      type: 'text',
      content: { text: 'Hello World' },
      position: 1,
      is_active: true
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /blocks', () => {
    test('should get all blocks for vcard', async () => {
      const blocks = [
        testBlock,
        { ...testBlock, id: 2, type: 'image', position: 2 }
      ];

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.findAll.mockResolvedValue(blocks);

      const response = await request(app)
        .get('/blocks?vcardId=1')
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
        .get('/blocks?vcardId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('VCard not found');
    });

    test('should require vcardId parameter', async () => {
      const response = await request(app)
        .get('/blocks')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('VCard ID is required');
    });
  });

  describe('GET /blocks/:id', () => {
    test('should get block by id', async () => {
      mockModels.Block.findOne.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .get('/blocks/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.type).toBe('text');
    });

    test('should return 404 for non-existent block', async () => {
      mockModels.Block.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/blocks/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /blocks', () => {
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
        .post('/blocks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
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
        .post('/blocks')
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
        .post('/blocks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData);

      expectSuccessResponse(response);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expectErrorResponse(response);
    });

    test('should validate block type', async () => {
      const blockData = {
        vcardId: 1,
        type: 'invalid_type',
        content: {}
      };

      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .post('/blocks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData);

      expectErrorResponse(response);
      expect(response.body.message).toContain('Invalid block type');
    });
  });

  describe('PUT /blocks/:id', () => {
    test('should update block successfully', async () => {
      const updateData = {
        content: { text: 'Updated text' }
      };

      const updatedBlock = { ...testBlock, ...updateData };

      mockModels.Block.findOne.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.update.mockResolvedValue([1]);
      mockModels.Block.findOne.mockResolvedValueOnce(updatedBlock);

      const response = await request(app)
        .put('/blocks/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(mockModels.Block.update).toHaveBeenCalledWith(
        updateData,
        { where: { id: 1 } }
      );
    });

    test('should not allow type change', async () => {
      mockModels.Block.findOne.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .put('/blocks/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'image' });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Block type cannot be changed');
    });
  });

  describe('DELETE /blocks/:id', () => {
    test('should delete block successfully', async () => {
      mockModels.Block.findOne.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.update.mockResolvedValue([1]);

      const response = await request(app)
        .delete('/blocks/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.Block.update).toHaveBeenCalledWith(
        { is_active: false },
        { where: { id: 1 } }
      );
    });
  });

  describe('PUT /blocks/:id/position', () => {
    test('should update block position successfully', async () => {
      mockModels.Block.findOne.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/blocks/1/position')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ position: 5 });

      expectSuccessResponse(response);
      expect(mockModels.Block.update).toHaveBeenCalledWith(
        { position: 5 },
        { where: { id: 1 } }
      );
    });

    test('should validate position value', async () => {
      mockModels.Block.findOne.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);

      const response = await request(app)
        .put('/blocks/1/position')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ position: -1 });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Position must be a positive number');
    });
  });

  describe('POST /blocks/:id/duplicate', () => {
    test('should duplicate block successfully', async () => {
      const duplicatedBlock = {
        ...testBlock,
        id: 2,
        position: 2
      };

      mockModels.Block.findOne.mockResolvedValue(testBlock);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.Block.count.mockResolvedValue(1);
      mockModels.Block.create.mockResolvedValue(duplicatedBlock);

      const response = await request(app)
        .post('/blocks/1/duplicate')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.Block.create).toHaveBeenCalledWith({
        vcardId: testBlock.vcardId,
        type: testBlock.type,
        content: testBlock.content,
        position: 2,
        is_active: true
      });
    });
  });
});
