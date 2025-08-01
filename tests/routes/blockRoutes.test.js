const request = require('supertest');
const express = require('express');

jest.mock('../../controllers/blockController', () => ({
  searchBlocks: jest.fn(),
  createBlock: jest.fn(),
  getBlocksByVcardId: jest.fn(),
  getBlocksByVcardIdAdmin: jest.fn(),
  getBlockById: jest.fn(),
  updateBlock: jest.fn(),
  deleteBlock: jest.fn(),
  toggleBlock: jest.fn(),
  validateBlockType: jest.fn()
}));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuthSuperAdmin: jest.fn()
}));

const blockController = require('../../controllers/blockController');
const { requireAuthSuperAdmin } = require('../../middleware/authMiddleware');
const blockRoutes = require('../../routes/blockRoutes');

describe('Block Routes Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/block', blockRoutes);
    
    app.use((error, req, res, next) => {
      if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON format'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    requireAuthSuperAdmin.mockImplementation((req, res, next) => {
      req.user = { id: 1, email: 'admin@example.com', role: 'super_admin' };
      next();
    });

    blockController.validateBlockType.mockImplementation((req, res, next) => {
      next();
    });
  });

  describe('GET /block/search', () => {
    it('should search blocks successfully', async () => {
      const mockSearchResults = [
        {
          id: 1,
          type: 'text',
          content: 'Sample text block',
          vcardId: 1,
          isActive: true,
          createdAt: '2025-07-31T10:15:59.614Z'
        },
        {
          id: 2,
          type: 'image',
          content: 'https://example.com/image.jpg',
          vcardId: 2,
          isActive: true,
          createdAt: '2025-07-31T10:15:59.614Z'
        }
      ];

      blockController.searchBlocks.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockSearchResults,
          count: mockSearchResults.length,
          message: 'Blocks found successfully'
        });
      });

      const response = await request(app)
        .get('/block/search')
        .query({ q: 'sample', type: 'text' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSearchResults);
      expect(response.body.count).toBe(2);
      expect(blockController.searchBlocks).toHaveBeenCalled();
    });

    it('should return empty results when no blocks match search', async () => {
      blockController.searchBlocks.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          count: 0,
          message: 'No blocks found'
        });
      });

      const response = await request(app)
        .get('/block/search')
        .query({ q: 'nonexistent' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle search with invalid parameters', async () => {
      blockController.searchBlocks.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid search parameters'
        });
      });

      const response = await request(app)
        .get('/block/search')
        .query({ type: 'invalid_type' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /block', () => {
    it('should create a block successfully', async () => {
      const mockBlock = {
        id: 1,
        type: 'text',
        content: 'New text block',
        vcardId: 1,
        isActive: true,
        createdAt: '2025-07-31T10:15:59.614Z'
      };

      blockController.createBlock.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: mockBlock,
          message: 'Block created successfully'
        });
      });

      const response = await request(app)
        .post('/block')
        .send({
          type: 'text',
          content: 'New text block',
          vcardId: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBlock);
      expect(blockController.validateBlockType).toHaveBeenCalled();
      expect(blockController.createBlock).toHaveBeenCalled();
    });

    it('should fail when block type validation fails', async () => {
      blockController.validateBlockType.mockImplementation((req, res, next) => {
        res.status(400).json({
          success: false,
          message: 'Invalid block type'
        });
      });

      const response = await request(app)
        .post('/block')
        .send({
          type: 'invalid_type',
          content: 'Some content'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid block type');
    });

    it('should fail when required fields are missing', async () => {
      blockController.createBlock.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Type and content are required'
        });
      });

      const response = await request(app)
        .post('/block')
        .send({
          content: 'Missing type field'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /block', () => {
    it('should get blocks by vcard ID successfully', async () => {
      const mockBlocks = [
        {
          id: 1,
          type: 'text',
          content: 'Text block 1',
          vcardId: 1,
          isActive: true,
          createdAt: '2025-07-31T10:15:59.614Z'
        },
        {
          id: 2,
          type: 'image',
          content: 'https://example.com/image.jpg',
          vcardId: 1,
          isActive: true,
          createdAt: '2025-07-31T10:15:59.614Z'
        }
      ];

      blockController.getBlocksByVcardId.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockBlocks,
          count: mockBlocks.length
        });
      });

      const response = await request(app)
        .get('/block')
        .query({ vcardId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBlocks);
      expect(response.body.count).toBe(2);
      expect(blockController.getBlocksByVcardId).toHaveBeenCalled();
    });

    it('should return empty array when no blocks found for vcard', async () => {
      blockController.getBlocksByVcardId.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          count: 0
        });
      });

      const response = await request(app)
        .get('/block')
        .query({ vcardId: 999 });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle missing vcardId parameter', async () => {
      blockController.getBlocksByVcardId.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'vcardId parameter is required'
        });
      });

      const response = await request(app)
        .get('/block');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /block/admin', () => {
    it('should get blocks by vcard ID for admin successfully', async () => {
      const mockBlocks = [
        {
          id: 1,
          type: 'text',
          content: 'Admin text block',
          vcardId: 1,
          isActive: true,
          createdAt: '2025-07-31T10:15:59.614Z',
          user: { email: 'user@example.com' }
        },
        {
          id: 2,
          type: 'image',
          content: 'https://example.com/admin-image.jpg',
          vcardId: 1,
          isActive: false,
          createdAt: '2025-07-31T10:15:59.614Z',
          user: { email: 'user@example.com' }
        }
      ];

      blockController.getBlocksByVcardIdAdmin.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockBlocks,
          count: mockBlocks.length
        });
      });

      const response = await request(app)
        .get('/block/admin')
        .query({ vcardId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBlocks);
      expect(blockController.getBlocksByVcardIdAdmin).toHaveBeenCalled();
    });

    it('should handle admin access with additional data', async () => {
      blockController.getBlocksByVcardIdAdmin.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          count: 0,
          metadata: {
            totalActive: 0,
            totalInactive: 0,
            lastUpdated: '2025-07-31T10:15:59.614Z'
          }
        });
      });

      const response = await request(app)
        .get('/block/admin')
        .query({ vcardId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.metadata).toBeDefined();
    });
  });

  describe('GET /block/:id', () => {
    it('should get block by ID successfully', async () => {
      const mockBlock = {
        id: 1,
        type: 'text',
        content: 'Single text block',
        vcardId: 1,
        isActive: true,
        createdAt: '2025-07-31T10:15:59.614Z'
      };

      blockController.getBlockById.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockBlock
        });
      });

      const response = await request(app)
        .get('/block/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBlock);
      expect(blockController.getBlockById).toHaveBeenCalled();
    });

    it('should return 404 when block not found', async () => {
      blockController.getBlockById.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Block not found'
        });
      });

      const response = await request(app)
        .get('/block/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should handle invalid block ID format', async () => {
      blockController.getBlockById.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid block ID format'
        });
      });

      const response = await request(app)
        .get('/block/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /block/:id', () => {
    it('should update block successfully', async () => {
      const mockUpdatedBlock = {
        id: 1,
        type: 'text',
        content: 'Updated text block',
        vcardId: 1,
        isActive: true,
        updatedAt: '2025-07-31T10:15:59.614Z'
      };

      blockController.updateBlock.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUpdatedBlock,
          message: 'Block updated successfully'
        });
      });

      const response = await request(app)
        .put('/block/1')
        .send({
          type: 'text',
          content: 'Updated text block'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedBlock);
      expect(blockController.validateBlockType).toHaveBeenCalled();
      expect(blockController.updateBlock).toHaveBeenCalled();
    });

    it('should fail when validation fails during update', async () => {
      blockController.validateBlockType.mockImplementation((req, res, next) => {
        res.status(400).json({
          success: false,
          message: 'Invalid block type for update'
        });
      });

      const response = await request(app)
        .put('/block/1')
        .send({
          type: 'invalid_type',
          content: 'Some content'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 when updating non-existent block', async () => {
      blockController.updateBlock.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Block not found for update'
        });
      });

      const response = await request(app)
        .put('/block/999')
        .send({
          type: 'text',
          content: 'Updated content'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /block/:id', () => {
    it('should delete block successfully', async () => {
      blockController.deleteBlock.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Block deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/block/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      expect(blockController.deleteBlock).toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent block', async () => {
      blockController.deleteBlock.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Block not found for deletion'
        });
      });

      const response = await request(app)
        .delete('/block/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle deletion with dependencies', async () => {
      blockController.deleteBlock.mockImplementation((req, res) => {
        res.status(409).json({
          success: false,
          message: 'Cannot delete block with existing dependencies'
        });
      });

      const response = await request(app)
        .delete('/block/1');

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('dependencies');
    });
  });

  describe('PUT /block/:id/toggle-status', () => {
    it('should toggle block status successfully (super admin)', async () => {
      const mockToggledBlock = {
        id: 1,
        type: 'text',
        content: 'Text block',
        vcardId: 1,
        isActive: false, 
        updatedAt: '2025-07-31T10:15:59.614Z'
      };

      blockController.toggleBlock.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockToggledBlock,
          message: 'Block status updated successfully'
        });
      });

      const response = await request(app)
        .put('/block/1/toggle-status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockToggledBlock);
      expect(requireAuthSuperAdmin).toHaveBeenCalled();
      expect(blockController.toggleBlock).toHaveBeenCalled();
    });

    it('should fail when user is not super admin', async () => {
      requireAuthSuperAdmin.mockImplementation((req, res, next) => {
        res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      });

      const response = await request(app)
        .put('/block/1/toggle-status');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Super admin');
    });

    it('should return 404 when toggling non-existent block', async () => {
      blockController.toggleBlock.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Block not found for status toggle'
        });
      });

      const response = await request(app)
        .put('/block/999/toggle-status');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Block Type Validation Middleware', () => {
    it('should validate text block type', async () => {
      let capturedReq;
      
      blockController.validateBlockType.mockImplementation((req, res, next) => {
        capturedReq = req;
        if (req.body.type === 'text' && typeof req.body.content === 'string') {
          next();
        } else {
          res.status(400).json({
            success: false,
            message: 'Invalid text block format'
          });
        }
      });

      blockController.createBlock.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: { id: 1, type: 'text', content: req.body.content }
        });
      });

      const response = await request(app)
        .post('/block')
        .send({
          type: 'text',
          content: 'Valid text content'
        });

      expect(response.status).toBe(201);
      expect(capturedReq.body.type).toBe('text');
    });

    it('should validate image block type', async () => {
      blockController.validateBlockType.mockImplementation((req, res, next) => {
        if (req.body.type === 'image' && req.body.content.startsWith('http')) {
          next();
        } else {
          res.status(400).json({
            success: false,
            message: 'Invalid image block format'
          });
        }
      });

      blockController.createBlock.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: { id: 1, type: 'image', content: req.body.content }
        });
      });

      const response = await request(app)
        .post('/block')
        .send({
          type: 'image',
          content: 'https://example.com/image.jpg'
        });

      expect(response.status).toBe(201);
    });

    it('should reject unsupported block types', async () => {
      blockController.validateBlockType.mockImplementation((req, res, next) => {
        const validTypes = ['text', 'image', 'video', 'link'];
        if (!validTypes.includes(req.body.type)) {
          res.status(400).json({
            success: false,
            message: `Unsupported block type: ${req.body.type}`
          });
        } else {
          next();
        }
      });

      const response = await request(app)
        .post('/block')
        .send({
          type: 'unsupported_type',
          content: 'Some content'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Unsupported block type');
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      blockController.getBlockById.mockImplementation((req, res, next) => {
        const error = new Error('Database connection failed');
        next(error);
      });

      const response = await request(app)
        .get('/block/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database connection failed');
    });

    it('should handle validation errors during creation', async () => {
      blockController.validateBlockType.mockImplementation((req, res, next) => {
        res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: [
            { field: 'type', message: 'Type is required' },
            { field: 'content', message: 'Content cannot be empty' }
          ]
        });
      });

      const response = await request(app)
        .post('/block')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toHaveLength(2);
    });
  });

  describe('Query Parameters Handling', () => {
    it('should pass query parameters to search controller', async () => {
      let capturedReq;
      
      blockController.searchBlocks.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(200).json({
          success: true,
          data: [],
          query: req.query
        });
      });

      await request(app)
        .get('/block/search')
        .query({ 
          q: 'search term', 
          type: 'text', 
          vcardId: '123',
          limit: '10',
          offset: '0'
        });

      expect(capturedReq.query.q).toBe('search term');
      expect(capturedReq.query.type).toBe('text');
      expect(capturedReq.query.vcardId).toBe('123');
      expect(capturedReq.query.limit).toBe('10');
      expect(capturedReq.query.offset).toBe('0');
    });

    it('should handle missing query parameters gracefully', async () => {
      blockController.searchBlocks.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [],
          message: 'Search completed with default parameters'
        });
      });

      const response = await request(app)
        .get('/block/search');

      expect(response.status).toBe(200);
    });
  });

  describe('Request Body Validation', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/block')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid JSON format');
    });

    it('should pass request body to controllers correctly', async () => {
      let capturedReq;
      
      blockController.createBlock.mockImplementation((req, res) => {
        capturedReq = req;
        res.status(201).json({
          success: true,
          data: { id: 1, ...req.body }
        });
      });

      const testData = {
        type: 'text',
        content: 'Test content',
        vcardId: 123,
        metadata: { priority: 'high' }
      };

      await request(app)
        .post('/block')
        .send(testData);

      expect(capturedReq.body).toEqual(testData);
    });
  });
});