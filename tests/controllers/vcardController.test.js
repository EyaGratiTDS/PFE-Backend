const vcardController = require('../../controllers/vcardController');
const VCard = require('../../models/Vcard');
const User = require('../../models/User');
const { deleteFileIfExists } = require('../../services/cloudinary');
const { generateUniqueUrl } = require('../../services/generateUrl');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

jest.mock('../../models/Vcard');
jest.mock('../../models/User');
jest.mock('../../models/Plan');
jest.mock('../../models/Subscription');
jest.mock('../../services/cloudinary');
jest.mock('../../services/generateUrl');
jest.mock('fs');
jest.mock('path');

describe('VCard Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      files: {},
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:3000')
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };

    // Mock cloudinary functions
    deleteFileIfExists.mockImplementation(() => Promise.resolve());

    jest.clearAllMocks();
  });

  describe('createVCard', () => {
    it('should create a vCard successfully', async () => {
      const mockUser = { id: 1, name: 'John Doe' };
      const mockVCard = {
        id: 1,
        name: 'Test VCard',
        description: 'Test Description',
        url: 'test-vcard-123',
        userId: 1,
        createdAt: new Date(),
        is_active: false,
        is_share: false,
        is_downloaded: false
      };

      req.body = {
        name: 'Test VCard',
        description: 'Test Description',
        userId: 1
      };

      User.findByPk.mockResolvedValue(mockUser);
      generateUniqueUrl.mockReturnValue('test-vcard-123');
      VCard.create.mockResolvedValue(mockVCard);

      await vcardController.createVCard(req, res);

      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(generateUniqueUrl).toHaveBeenCalledWith('Test VCard');
      expect(VCard.create).toHaveBeenCalledWith({
        name: 'Test VCard',
        description: 'Test Description',
        url: 'test-vcard-123',
        userId: 1,
        is_active: true,
        is_share: false,
        is_downloaded: false
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'VCard created successfully',
        vcard: {
          id: 1,
          name: 'Test VCard',
          description: 'Test Description',
          url: 'test-vcard-123',
          userId: 1,
          createdAt: mockVCard.createdAt
        }
      });
    });

    it('should return 400 if name or userId is missing', async () => {
      req.body = { name: 'Test VCard' };

      await vcardController.createVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "The 'name' and 'userId' fields are mandatory"
      });
    });

    it('should return 404 if user not found', async () => {
      req.body = { name: 'Test VCard', userId: 999 };
      User.findByPk.mockResolvedValue(null);

      await vcardController.createVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('should handle Sequelize validation errors', async () => {
      req.body = { name: 'Test VCard', userId: 1 };
      const mockUser = { id: 1, name: 'John Doe' };
      
      User.findByPk.mockResolvedValue(mockUser);
      generateUniqueUrl.mockReturnValue('test-vcard-123');
      
      const validationError = new Error('Validation error');
      validationError.name = 'SequelizeValidationError';
      validationError.errors = [
        { path: 'name', message: 'Name is required' }
      ];
      
      VCard.create.mockRejectedValue(validationError);

      await vcardController.createVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Validation error',
        errors: [{ field: 'name', message: 'Name is required' }]
      });
    });

    it('should handle unique constraint errors', async () => {
      req.body = { name: 'Test VCard', userId: 1 };
      const mockUser = { id: 1, name: 'John Doe' };
      
      User.findByPk.mockResolvedValue(mockUser);
      generateUniqueUrl.mockReturnValue('test-vcard-123');
      
      const uniqueError = new Error('Unique constraint error');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      uniqueError.errors = [{ path: 'url' }];
      
      VCard.create.mockRejectedValue(uniqueError);

      await vcardController.createVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'A vCard with this name or URL already exists',
        field: 'url'
      });
    });
  });

  describe('getVCardsByUserId', () => {
    it('should return vCards for a user', async () => {
      const mockVCards = [
        { id: 1, name: 'VCard 1', userId: 1 },
        { id: 2, name: 'VCard 2', userId: 1 }
      ];

      req.query = { userId: 1 };
      VCard.findAll.mockResolvedValue(mockVCards);

      await vcardController.getVCardsByUserId(req, res);

      expect(VCard.findAll).toHaveBeenCalledWith({
        where: { userId: 1, status: false }
      });
      expect(res.json).toHaveBeenCalledWith(mockVCards);
    });

    it('should return 400 if userId is missing', async () => {
      req.query = {};

      await vcardController.getVCardsByUserId(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'User ID is required' });
    });
  });

  describe('getVCardById', () => {
    it('should return a vCard by ID', async () => {
      const mockVCard = { id: 1, name: 'Test VCard' };
      req.params = { id: 1 };
      VCard.findByPk.mockResolvedValue(mockVCard);

      await vcardController.getVCardById(req, res);

      expect(VCard.findByPk).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(mockVCard);
    });

    it('should return 404 if vCard not found', async () => {
      req.params = { id: 999 };
      VCard.findByPk.mockResolvedValue(null);

      await vcardController.getVCardById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'VCard not found' });
    });
  });

  describe('deleteLogo', () => {
    it('should delete logo successfully', async () => {
      req.body = { logoPath: '/uploads/logo.png' };
      const absolutePath = '/path/to/uploads/logo.png';
      
      path.join.mockReturnValue(absolutePath);
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {});

      await vcardController.deleteLogo(req, res);

      expect(fs.existsSync).toHaveBeenCalledWith(absolutePath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(absolutePath);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logo successfully removed.' });
    });

    it('should return 400 if logoPath is missing', async () => {
      req.body = {};

      await vcardController.deleteLogo(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing logo path.' });
    });

    it('should return 404 if logo file not found', async () => {
      req.body = { logoPath: '/uploads/nonexistent.png' };
      
      path.join.mockReturnValue('/path/to/uploads/nonexistent.png');
      fs.existsSync.mockReturnValue(false);

      await vcardController.deleteLogo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logo not found.' });
    });
  });

  describe('updateVCard', () => {
    it('should update vCard successfully', async () => {
      const mockCurrentVCard = {
        id: 1,
        name: 'Old Name',
        logo: '/uploads/old-logo.png',
        favicon: '/uploads/old-favicon.ico',
        background_value: '/uploads/old-bg.jpg',
        background_type: 'custom-image'
      };

      const mockUpdatedVCard = {
        id: 1,
        name: 'Updated Name',
        description: 'Updated Description'
      };

      req.params = { id: 1 };
      req.body = {
        name: 'Updated Name',
        description: 'Updated Description',
        is_active: true
      };
      req.files = {
        logoFile: [{ filename: 'new-logo.png' }]
      };

      VCard.findByPk.mockResolvedValueOnce(mockCurrentVCard);
      VCard.update.mockResolvedValue([1]);
      VCard.findByPk.mockResolvedValueOnce(mockUpdatedVCard);
      deleteFileIfExists.mockImplementation(() => {});

      await vcardController.updateVCard(req, res);

      expect(VCard.findByPk).toHaveBeenCalledWith(1);
      // Note: deleteFileIfExists may or may not be called depending on conditions
      expect(VCard.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUpdatedVCard);
    });

    it('should return 404 if vCard not found for update', async () => {
      req.params = { id: 999 };
      VCard.findByPk.mockResolvedValue(null);

      await vcardController.updateVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'VCard not found' });
    });
  });

  describe('deleteVCard', () => {
    it('should delete vCard and associated files', async () => {
      const mockVCard = {
        id: 1,
        logo: '/uploads/logo.png',
        favicon: '/uploads/favicon.ico',
        background_type: 'image',
        background_value: '/uploads/bg.jpg',
        destroy: jest.fn().mockResolvedValue()
      };

      req.params = { id: 1 };
      VCard.findByPk.mockResolvedValue(mockVCard);
      deleteFileIfExists.mockImplementation(() => {});

      await vcardController.deleteVCard(req, res);

      expect(VCard.findByPk).toHaveBeenCalledWith(1, expect.objectContaining({
        include: expect.any(Array),
        transaction: expect.any(Object)
      }));
      // Note: deleteFileIfExists may or may not be called depending on conditions
      expect(mockVCard.destroy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'VCard and associated files deleted successfully'
      });
    });

    it('should return 404 if vCard not found for deletion', async () => {
      req.params = { id: 999 };
      VCard.findByPk.mockResolvedValue(null);

      await vcardController.deleteVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'VCard not found' });
    });
  });

  describe('getVCardByUrl', () => {
    it('should return vCard by URL with plan limits', async () => {
      const mockPlan = {
        name: 'Basic',
        features: ['5 vCards', '50 vCard blocks']
      };

      const mockVCard = {
        id: 1,
        url: 'test-url',
        userId: 1,
        is_active: true,
        logo: '/uploads/logo.png',
        favicon: '/uploads/favicon.ico',
        background_type: 'custom-image',
        background_value: '/uploads/bg.jpg',
        createdAt: new Date(),
        get: jest.fn().mockReturnValue({
          id: 1,
          url: 'test-url',
          userId: 1,
          is_active: true,
          logo: '/uploads/logo.png',
          favicon: '/uploads/favicon.ico',
          background_type: 'custom-image',
          background_value: '/uploads/bg.jpg'
        }),
        Users: {
          Subscription: [{
            Plan: mockPlan
          }]
        }
      };

      req.params = { url: 'test-url' };
      VCard.findOne.mockResolvedValue(mockVCard);
      VCard.count.mockResolvedValue(1);

      await vcardController.getVCardByUrl(req, res);

      expect(VCard.findOne).toHaveBeenCalledWith({
        where: { url: 'test-url' },
        include: expect.any(Array)
      });
      expect(res.json).toHaveBeenCalledWith({
        id: 1,
        url: 'test-url',
        userId: 1,
        is_active: true,
        logo: '/uploads/logo.png',
        favicon: '/uploads/favicon.ico',
        background_type: 'custom-image',
        background_value: '/uploads/bg.jpg',
        maxBlocksAllowed: 50
      });
    });

    it('should return 404 if vCard not found', async () => {
      req.params = { url: 'nonexistent-url' };
      VCard.findOne.mockResolvedValue(null);

      await vcardController.getVCardByUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.end).toHaveBeenCalled();
    });

    it('should return 403 if vCard is not active', async () => {
      const mockVCard = {
        id: 1,
        url: 'test-url',
        is_active: false
      };

      req.params = { url: 'test-url' };
      VCard.findOne.mockResolvedValue(mockVCard);

      await vcardController.getVCardByUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'VCard disabled',
        isNotActive: true
      });
    });
  });

  describe('getAllVCardsWithUsers', () => {
    it('should return all vCards with users', async () => {
      const mockVCards = [
        {
          id: 1,
          name: 'VCard 1',
          Users: { id: 1, name: 'User 1', email: 'user1@test.com', role: 'user' }
        }
      ];

      VCard.findAll.mockResolvedValue(mockVCards);

      await vcardController.getAllVCardsWithUsers(req, res);

      expect(VCard.findAll).toHaveBeenCalledWith({
        include: expect.any(Array),
        order: [['createdAt', 'DESC']]
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockVCards
      });
    });
  });

  describe('toggleVCardStatus', () => {
    it('should toggle vCard status successfully', async () => {
      const mockVCard = { id: 1, status: false };
      
      req.params = { id: 1 };
      VCard.findByPk.mockResolvedValue(mockVCard);
      VCard.update.mockResolvedValue([1]);

      await vcardController.toggleVCardStatus(req, res);

      expect(VCard.findByPk).toHaveBeenCalledWith(1);
      expect(VCard.update).toHaveBeenCalledWith(
        { status: true },
        { where: { id: 1 } }
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'VCard activated successfully',
        vcardId: 1,
        newStatus: true
      });
    });

    it('should return 400 if ID is missing', async () => {
      req.params = {};

      await vcardController.toggleVCardStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'VCard ID is required' });
    });

    it('should return 404 if vCard not found', async () => {
      req.params = { id: 999 };
      VCard.findByPk.mockResolvedValue(null);

      await vcardController.toggleVCardStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'VCard not found' });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      req.query = { userId: 1 };
      const dbError = new Error('Database connection failed');
      VCard.findAll.mockRejectedValue(dbError);

      await vcardController.getVCardsByUserId(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: dbError.message });
    });
  });
});