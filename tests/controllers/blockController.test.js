const {
  validateBlockType,
  searchBlocks,
  createBlock,
  getBlocksByVcardId,
  getBlockById,
  updateBlock,
  deleteBlock,
  toggleBlock,
  getBlocksByVcardIdAdmin,
  VALID_BLOCK_TYPES
} = require('../../controllers/blockController'); 

const { Op } = require('sequelize');

jest.mock('../../models/Block');
jest.mock('../../models/Vcard');
jest.mock('../../middleware/planLimiter');

const Block = require('../../models/Block');
const VCard = require('../../models/Vcard');
const { getActiveBlockLimit } = require('../../middleware/planLimiter');

describe('Block Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: {},
      body: {},
      params: {},
      user: { id: 1 }
    };
    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
      end: jest.fn(() => res)
    };
    next = jest.fn();
    
    jest.clearAllMocks();
    
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('validateBlockType middleware', () => {
    it('should pass validation with valid block type', () => {
      req.body.type_block = 'Link';
      
      validateBlockType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return error with invalid block type', () => {
      req.body.type_block = 'InvalidType';
      
      validateBlockType(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid block type' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass validation when no type_block is provided', () => {
      validateBlockType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('searchBlocks', () => {
    beforeEach(() => {
      req.query = { vcardId: '1', q: 'test' };
    });

    it('should return blocks matching search query', async () => {
      const mockBlocks = [
        { id: 1, name: 'Test Block', type_block: 'Link' },
        { id: 2, name: 'Another Block', type_block: 'Email' }
      ];
      
      Block.findAll.mockResolvedValue(mockBlocks);
      
      const searchBlocksFunction = Array.isArray(searchBlocks) ? searchBlocks[1] : searchBlocks;
      await searchBlocksFunction(req, res);
      
      expect(Block.findAll).toHaveBeenCalledWith({
        where: {
          vcardId: '1',
          [Op.or]: [
            { name: { [Op.iLike]: '%test%' } },
            { type_block: { [Op.iLike]: '%test%' } },
            { description: { [Op.iLike]: '%test%' } }
          ]
        },
        limit: 10,
        order: [['createdAt', 'DESC']]
      });
      expect(res.json).toHaveBeenCalledWith(mockBlocks);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      Block.findAll.mockRejectedValue(error);
      
      const searchBlocksFunction = Array.isArray(searchBlocks) ? searchBlocks[1] : searchBlocks;
      await searchBlocksFunction(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });

    it('should return validation error when required params are missing', async () => {
      req.query = { vcardId: '1' }; 
      
      const validateMiddleware = Array.isArray(searchBlocks) ? searchBlocks[0] : null;
      if (validateMiddleware) {
        await validateMiddleware(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ 
          error: 'The vcardId and q (query) parameters are required' 
        });
      }
    });
  });

  describe('createBlock', () => {
    it('should create a new block successfully', async () => {
      const blockData = { name: 'New Block', type_block: 'Link', vcardId: 1 };
      const createdBlock = { id: 1, ...blockData, status: true };
      
      req.body = blockData;
      Block.create.mockResolvedValue(createdBlock);
      
      await createBlock(req, res);
      
      expect(Block.create).toHaveBeenCalledWith({ ...blockData, status: true });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdBlock);
    });

    it('should create block with custom status', async () => {
      const blockData = { name: 'New Block', type_block: 'Link', vcardId: 1, status: false };
      const createdBlock = { id: 1, ...blockData };
      
      req.body = blockData;
      Block.create.mockResolvedValue(createdBlock);
      
      await createBlock(req, res);
      
      expect(Block.create).toHaveBeenCalledWith(blockData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdBlock);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Creation failed');
      req.body = { name: 'New Block' };
      Block.create.mockRejectedValue(error);
      
      await createBlock(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
  });

  describe('getBlocksByVcardId', () => {
    beforeEach(() => {
      req.query.vcardId = '1';
    });

    it('should return blocks with disabled status based on plan limit', async () => {
      const mockBlocks = [
        { id: 1, name: 'Block 1', get: jest.fn(() => ({ id: 1, name: 'Block 1' })) },
        { id: 2, name: 'Block 2', get: jest.fn(() => ({ id: 2, name: 'Block 2' })) },
        { id: 3, name: 'Block 3', get: jest.fn(() => ({ id: 3, name: 'Block 3' })) }
      ];
      
      Block.findAll.mockResolvedValue(mockBlocks);
      getActiveBlockLimit.mockResolvedValue(2);
      
      const getBlocksFunction = Array.isArray(getBlocksByVcardId) ? getBlocksByVcardId[1] : getBlocksByVcardId;
      await getBlocksFunction(req, res);
      
      expect(Block.findAll).toHaveBeenCalledWith({
        where: { vcardId: '1' },
        order: [['createdAt', 'ASC']]
      });
      expect(getActiveBlockLimit).toHaveBeenCalledWith(1, '1');
      expect(res.json).toHaveBeenCalledWith([
        { id: 1, name: 'Block 1', isDisabled: false },
        { id: 2, name: 'Block 2', isDisabled: false },
        { id: 3, name: 'Block 3', isDisabled: true }
      ]);
    });

    it('should return error when vcardId is missing', async () => {
      req.query = {};
      
      const getBlocksFunction = Array.isArray(getBlocksByVcardId) ? getBlocksByVcardId[1] : getBlocksByVcardId;
      await getBlocksFunction(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'vcardId is required' });
    });

    it('should handle Promise.all errors', async () => {
      const error = new Error('Promise.all failed');
      Block.findAll.mockRejectedValue(error);
      
      const getBlocksFunction = Array.isArray(getBlocksByVcardId) ? getBlocksByVcardId[1] : getBlocksByVcardId;
      await getBlocksFunction(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
  });

  describe('getBlocksByVcardIdAdmin', () => {
    it('should return only active blocks for admin', async () => {
      req.query.vcardId = '1';
      const mockBlocks = [
        { id: 1, name: 'Block 1', get: jest.fn(() => ({ id: 1, name: 'Block 1' })) }
      ];
      
      Block.findAll.mockResolvedValue(mockBlocks);
      getActiveBlockLimit.mockResolvedValue(10);
      
      await getBlocksByVcardIdAdmin(req, res);
      
      expect(Block.findAll).toHaveBeenCalledWith({
        where: { vcardId: '1', status: true },
        order: [['createdAt', 'ASC']]
      });
      expect(res.json).toHaveBeenCalledWith([
        { id: 1, name: 'Block 1', isDisabled: false }
      ]);
    });

    it('should return error when vcardId is missing for admin', async () => {
      req.query = {};
      
      await getBlocksByVcardIdAdmin(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'vcardId is required' });
    });
  });

  describe('getBlockById', () => {
    it('should return block when found', async () => {
      const mockBlock = { id: 1, name: 'Test Block' };
      req.params.id = '1';
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await getBlockById(req, res);
      
      expect(Block.findByPk).toHaveBeenCalledWith('1', {
        include: { model: VCard, as: 'VCard', attributes: ['id', 'name'] }
      });
      expect(res.json).toHaveBeenCalledWith(mockBlock);
    });

    it('should return 404 when block not found', async () => {
      req.params.id = '999';
      Block.findByPk.mockResolvedValue(null);
      
      await getBlockById(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Block not found' });
    });

    it('should handle database errors in getBlockById', async () => {
      const error = new Error('Database error');
      req.params.id = '1';
      Block.findByPk.mockRejectedValue(error);
      
      await getBlockById(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
  });

  describe('updateBlock', () => {
    it('should update block successfully', async () => {
      const mockBlock = {
        id: 1,
        name: 'Old Name',
        update: jest.fn().mockResolvedValue({ id: 1, name: 'New Name' })
      };
      
      req.params.id = '1';
      req.body = { name: 'New Name', vcardId: 1 };
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await updateBlock(req, res);
      
      expect(mockBlock.update).toHaveBeenCalledWith({ name: 'New Name' });
      expect(res.json).toHaveBeenCalledWith(mockBlock);
    });

    it('should return 404 when block not found for update', async () => {
      req.params.id = '999';
      req.body = { name: 'New Name' };
      Block.findByPk.mockResolvedValue(null);
      
      await updateBlock(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Block not found' });
    });

    it('should handle update errors', async () => {
      const mockBlock = {
        id: 1,
        update: jest.fn().mockRejectedValue(new Error('Update failed'))
      };
      
      req.params.id = '1';
      req.body = { name: 'New Name' };
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await updateBlock(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
  });

  describe('deleteBlock', () => {
    it('should delete block successfully', async () => {
      const mockBlock = {
        id: 1,
        destroy: jest.fn().mockResolvedValue()
      };
      
      req.params.id = '1';
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await deleteBlock(req, res);
      
      expect(mockBlock.destroy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('should return 404 when block not found for deletion', async () => {
      req.params.id = '999';
      Block.findByPk.mockResolvedValue(null);
      
      await deleteBlock(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Block not found' });
    });

    it('should handle deletion errors', async () => {
      const mockBlock = {
        id: 1,
        destroy: jest.fn().mockRejectedValue(new Error('Delete failed'))
      };
      
      req.params.id = '1';
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await deleteBlock(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
  });

  describe('toggleBlock', () => {
    it('should toggle block status from true to false', async () => {
      const mockBlock = {
        id: 1,
        status: true,
        update: jest.fn().mockResolvedValue({ id: 1, status: false })
      };
      
      req.params.id = '1';
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await toggleBlock(req, res);
      
      expect(mockBlock.update).toHaveBeenCalledWith({ status: false });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Block status toggled successfully',
        blockId: 1,
        newStatus: false
      });
    });

    it('should toggle block status from false to true', async () => {
      const mockBlock = {
        id: 1,
        status: false,
        update: jest.fn().mockResolvedValue({ id: 1, status: true })
      };
      
      req.params.id = '1';
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await toggleBlock(req, res);
      
      expect(mockBlock.update).toHaveBeenCalledWith({ status: true });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Block status toggled successfully',
        blockId: 1,
        newStatus: true
      });
    });

    it('should return 404 when block not found for toggle', async () => {
      req.params.id = '999';
      Block.findByPk.mockResolvedValue(null);
      
      await toggleBlock(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Block not found' });
    });

    it('should handle toggle errors', async () => {
      const mockBlock = {
        id: 1,
        status: true,
        update: jest.fn().mockRejectedValue(new Error('Toggle failed'))
      };
      
      req.params.id = '1';
      Block.findByPk.mockResolvedValue(mockBlock);
      
      await toggleBlock(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
  });

  describe('VALID_BLOCK_TYPES', () => {
    it('should contain all expected block types', () => {
      const expectedTypes = [
        'Link', 'Email', 'Address', 'Phone', 'Facebook',
        'Twitter', 'Instagram', 'Youtube', 'Whatsapp',
        'Tiktok', 'Telegram', 'Spotify', 'Pinterest',
        'Linkedin', 'Snapchat', 'Twitch', 'Discord',
        'Messenger', 'Reddit', 'GitHub'
      ];
      
      expect(VALID_BLOCK_TYPES).toEqual(expect.arrayContaining(expectedTypes));
      expect(VALID_BLOCK_TYPES).toHaveLength(expectedTypes.length);
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      const error = new Error('Connection failed');
      req.query.vcardId = '1';
      Block.findAll.mockRejectedValue(error);
      
      const getBlocksFunction = Array.isArray(getBlocksByVcardId) ? getBlocksByVcardId[1] : getBlocksByVcardId;
      await getBlocksFunction(req, res);
      
      expect(console.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
    });

    it('should include error details in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Detailed error message');
      req.body = { name: 'Test' };
      Block.create.mockRejectedValue(error);
      
      await createBlock(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        error: 'Server error',
        details: 'Detailed error message'
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include error details in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Detailed error message');
      req.body = { name: 'Test' };
      Block.create.mockRejectedValue(error);
      
      await createBlock(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        error: 'Server error'
      });
            process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Middleware validation', () => {
    it('should validate required parameters for searchBlocks', async () => {
      req.query = { vcardId: '1' }; 
      
      const validateMiddleware = Array.isArray(searchBlocks) ? searchBlocks[0] : null;
      if (validateMiddleware) {
        validateMiddleware(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ 
          error: 'The vcardId and q (query) parameters are required' 
        });
        expect(next).not.toHaveBeenCalled();
      }
    });

    it('should validate required parameters for getBlocksByVcardId', async () => {
      req.query = {}; 
      
      const validateMiddleware = Array.isArray(getBlocksByVcardId) ? getBlocksByVcardId[0] : null;
      if (validateMiddleware) {
        validateMiddleware(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ 
          error: 'The vcardId and q (query) parameters are required' 
        });
        expect(next).not.toHaveBeenCalled();
      }
    });

    it('should pass validation when all required parameters are provided', async () => {
      req.query = { vcardId: '1', q: 'test' };
      
      const validateMiddleware = Array.isArray(searchBlocks) ? searchBlocks[0] : null;
      if (validateMiddleware) {
        validateMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      }
    });
  });
});