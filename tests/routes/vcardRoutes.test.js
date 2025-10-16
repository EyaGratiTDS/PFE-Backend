const request = require('supertest');
const express = require('express');

jest.mock('../../controllers/vcardController', () => ({
  createVCard: jest.fn(),
  getVCardsByUserId: jest.fn(),
  getVCardById: jest.fn(),
  updateVCard: jest.fn(),
  deleteVCard: jest.fn(),
  deleteLogo: jest.fn(),
  getVCardByUrl: jest.fn(),
  getAllVCardsWithUsers: jest.fn(),
  toggleVCardStatus: jest.fn()
}));

jest.mock('../../controllers/vcardViewController', () => ({
  registerView: jest.fn()
}));

jest.mock('../../middleware/planLimiter', () => ({
  checkVCardCreation: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuthSuperAdmin: jest.fn((req, res, next) => next())
}));

jest.mock('../../services/cloudinary', () => ({
  upload: {
    fields: jest.fn(() => (req, res, next) => {
      req.files = {
        logoFile: [{ filename: 'logo.png', path: '/uploads/logo.png' }],
        backgroundFile: [{ filename: 'bg.jpg', path: '/uploads/bg.jpg' }],
        faviconFile: [{ filename: 'favicon.ico', path: '/uploads/favicon.ico' }]
      };
      next();
    })
  }
}));

const vcardController = require('../../controllers/vcardController');
const vcardViewController = require('../../controllers/vcardViewController');
const { checkVCardCreation } = require('../../middleware/planLimiter');
const uploadService = require('../../services/cloudinary');
const { requireAuthSuperAdmin } = require('../../middleware/authMiddleware');

const vcardRoutes = require('../../routes/vcardRoutes');

describe('VCard Routes Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    app.use('/vcard', vcardRoutes);
    
    app.use((error, req, res, next) => {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'File too large'
        });
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    checkVCardCreation.mockImplementation((req, res, next) => next());
    requireAuthSuperAdmin.mockImplementation((req, res, next) => next());
    
    uploadService.upload.fields.mockImplementation(() => (req, res, next) => {
      req.files = {
        logoFile: [{ filename: 'logo.png', path: '/uploads/logo.png' }],
        backgroundFile: [{ filename: 'bg.jpg', path: '/uploads/bg.jpg' }],
        faviconFile: [{ filename: 'favicon.ico', path: '/uploads/favicon.ico' }]
      };
      next();
    });
  });

  describe('POST /vcard', () => {
    it('should create a new vcard successfully', async () => {
      const mockVCard = {
        id: 1,
        name: 'Test VCard',
        url: 'test-vcard',
        userId: 1
      };

      vcardController.createVCard.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: mockVCard,
          message: 'VCard created successfully'
        });
      });

      const vcardData = {
        name: 'Test VCard',
        url: 'test-vcard',
        description: 'Test description'
      };

      const response = await request(app)
        .post('/vcard')
        .send(vcardData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCard);
      expect(checkVCardCreation).toHaveBeenCalled();
      expect(vcardController.createVCard).toHaveBeenCalled();
    });

    it('should handle creation errors properly', async () => {
      vcardController.createVCard.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid vcard data'
        });
      });

      const response = await request(app)
        .post('/vcard')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid vcard data');
    });

    it('should handle plan limit exceeded', async () => {
      checkVCardCreation.mockImplementationOnce((req, res) => {
        res.status(429).json({
          success: false,
          message: 'VCard creation limit exceeded'
        });
      });

      const response = await request(app)
        .post('/vcard')
        .send({ name: 'Test VCard' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('VCard creation limit exceeded');
      expect(checkVCardCreation).toHaveBeenCalled();
    });
  });

  describe('GET /vcard', () => {
    it('should get vcards by user id', async () => {
      const mockVCards = [
        { id: 1, name: 'VCard 1', url: 'vcard-1' },
        { id: 2, name: 'VCard 2', url: 'vcard-2' }
      ];

      vcardController.getVCardsByUserId.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockVCards
        });
      });

      const response = await request(app)
        .get('/vcard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCards);
      expect(vcardController.getVCardsByUserId).toHaveBeenCalled();
    });

    it('should handle empty vcard list', async () => {
      vcardController.getVCardsByUserId.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: []
        });
      });

      const response = await request(app)
        .get('/vcard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /vcard/:id', () => {
    it('should get vcard by id', async () => {
      const mockVCard = { id: 1, name: 'Test VCard', url: 'test-vcard' };

      vcardController.getVCardById.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockVCard
        });
      });

      const response = await request(app)
        .get('/vcard/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCard);
      expect(vcardController.getVCardById).toHaveBeenCalled();
    });

    it('should return 404 for non-existent vcard', async () => {
      vcardController.getVCardById.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'VCard not found'
        });
      });

      const response = await request(app)
        .get('/vcard/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('VCard not found');
    });

    it('should handle invalid ID parameter', async () => {
      vcardController.getVCardById.mockImplementation((req, res) => {
        if (isNaN(req.params.id)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid ID parameter'
          });
        }
      });

      const response = await request(app)
        .get('/vcard/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid ID parameter');
    });
  });

  describe('PUT /vcard/:id', () => {
    it('should update vcard with files', async () => {
      const mockUpdatedVCard = {
        id: 1,
        name: 'Updated VCard',
        logo: '/uploads/logo.png'
      };

      vcardController.updateVCard.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUpdatedVCard,
          message: 'VCard updated successfully'
        });
      });

      const response = await request(app)
        .put('/vcard/1')
        .send({
          name: 'Updated VCard',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedVCard);
      expect(vcardController.updateVCard).toHaveBeenCalled();
    });

    it('should update vcard without files', async () => {
      const mockUpdatedVCard = {
        id: 1,
        name: 'Updated VCard'
      };

      vcardController.updateVCard.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUpdatedVCard
        });
      });

      uploadService.upload.fields.mockImplementationOnce(() => (req, res, next) => {
        req.files = {};
        next();
      });

      const response = await request(app)
        .put('/vcard/1')
        .send({
          name: 'Updated VCard',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedVCard);
    });

    it('should handle file upload errors through controller', async () => {
      vcardController.updateVCard.mockImplementation((req, res) => {
        res.status(413).json({
          success: false,
          message: 'File too large'
        });
      });

      const response = await request(app)
        .put('/vcard/1')
        .send({
          name: 'Test VCard'
        })
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('File too large');
      expect(vcardController.updateVCard).toHaveBeenCalled();
    });
  });

  describe('DELETE /vcard/:id', () => {
    it('should delete vcard successfully', async () => {
      vcardController.deleteVCard.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'VCard deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/vcard/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('VCard deleted successfully');
      expect(vcardController.deleteVCard).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      vcardController.deleteVCard.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'VCard not found for deletion'
        });
      });

      const response = await request(app)
        .delete('/vcard/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('VCard not found for deletion');
    });
  });

  describe('DELETE /vcard/delete-logo', () => {
    it('should delete logo successfully', async () => {
      vcardController.deleteLogo.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Logo deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/vcard/delete-logo')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logo deleted successfully');
      expect(vcardController.deleteLogo).toHaveBeenCalled();
    });

    it('should handle logo deletion errors', async () => {
      vcardController.deleteLogo.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'No logo to delete'
        });
      });

      const response = await request(app)
        .delete('/vcard/delete-logo')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No logo to delete');
    });
  });

  describe('GET /vcard/url/:url', () => {
    it('should get vcard by url', async () => {
      const mockVCard = {
        id: 1,
        name: 'Test VCard',
        url: 'test-vcard'
      };

      vcardController.getVCardByUrl.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockVCard
        });
      });

      const response = await request(app)
        .get('/vcard/url/test-vcard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCard);
      expect(vcardController.getVCardByUrl).toHaveBeenCalled();
    });

    it('should return 404 for non-existent url', async () => {
      vcardController.getVCardByUrl.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'VCard not found'
        });
      });

      const response = await request(app)
        .get('/vcard/url/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('VCard not found');
    });
  });

  describe('POST /vcard/:id/views', () => {
    it('should register view successfully', async () => {
      vcardViewController.registerView.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'View registered successfully'
        });
      });

      const response = await request(app)
        .post('/vcard/1/views')
        .send({
          userAgent: 'Test User Agent',
          ipAddress: '127.0.0.1'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('View registered successfully');
      expect(vcardViewController.registerView).toHaveBeenCalled();
    });

    it('should handle view registration errors', async () => {
      vcardViewController.registerView.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid view data'
        });
      });

      const response = await request(app)
        .post('/vcard/1/views')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid view data');
    });
  });

  describe('GET /vcard/admin/vcards-with-users', () => {
    it('should get all vcards with users for admin', async () => {
      const mockVCardsWithUsers = [
        {
          id: 1,
          name: 'VCard 1',
          user: { id: 1, name: 'User 1' }
        },
        {
          id: 2,
          name: 'VCard 2',
          user: { id: 2, name: 'User 2' }
        }
      ];

      vcardController.getAllVCardsWithUsers.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockVCardsWithUsers
        });
      });

      const response = await request(app)
        .get('/vcard/admin/vcards-with-users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCardsWithUsers);
      expect(requireAuthSuperAdmin).toHaveBeenCalled();
      expect(vcardController.getAllVCardsWithUsers).toHaveBeenCalled();
    });

    it('should require admin authentication', async () => {
      requireAuthSuperAdmin.mockImplementationOnce((req, res) => {
        res.status(403).json({
          success: false,
          message: 'Access denied. Super admin required.'
        });
      });

      const response = await request(app)
        .get('/vcard/admin/vcards-with-users')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Super admin required.');
    });
  });

  describe('PUT /vcard/:id/toggle-status', () => {
    it('should toggle vcard status for admin', async () => {
      const mockVCard = {
        id: 1,
        name: 'Test VCard',
        status: 'inactive'
      };

      vcardController.toggleVCardStatus.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockVCard,
          message: 'VCard status updated successfully'
        });
      });

      const response = await request(app)
        .put('/vcard/1/toggle-status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCard);
      expect(requireAuthSuperAdmin).toHaveBeenCalled();
      expect(vcardController.toggleVCardStatus).toHaveBeenCalled();
    });

    it('should require admin authentication for status toggle', async () => {
      requireAuthSuperAdmin.mockImplementationOnce((req, res) => {
        res.status(403).json({
          success: false,  
          message: 'Access denied. Super admin required.'
        });
      });

      const response = await request(app)
        .put('/vcard/1/toggle-status')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Super admin required.');
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      vcardController.getVCardById.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });

      const response = await request(app)
        .get('/vcard/1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });

    it('should handle unexpected errors', async () => {
      vcardController.getVCardById.mockImplementation((req, res, next) => {
        const error = new Error('Unexpected error');
        next(error);
      });

      const response = await request(app)
        .get('/vcard/1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  describe('Route Parameter Validation', () => {
    it('should handle route parameters correctly', async () => {
      vcardController.getVCardById.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: { id: parseInt(req.params.id), name: 'Test VCard' },
          requestedId: req.params.id
        });
      });

      const response = await request(app)
        .get('/vcard/123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requestedId).toBe('123');
    });
  });
});