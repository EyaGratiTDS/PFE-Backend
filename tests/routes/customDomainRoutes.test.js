const request = require('supertest');
const express = require('express');

jest.mock('../../controllers/CustomDomainController', () => ({
  createCustomDomain: jest.fn(),
  updateCustomDomain: jest.fn(),
  deleteCustomDomain: jest.fn(),
  getUserDomains: jest.fn(),
  getDomainById: jest.fn(),
  verifyDomain: jest.fn(),
  handleDomainRequest: jest.fn(),
  handleNotFound: jest.fn(),
  linkToVCard: jest.fn(),
  unlinkFromVCard: jest.fn(),
  getAllDomains: jest.fn(),
  toggleDomainStatus: jest.fn()
}));

jest.mock('../../middleware/planLimiter', () => ({
  checkCustomDomainCreation: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: jest.fn((req, res, next) => next()),
  requireAuthSuperAdmin: jest.fn((req, res, next) => next())
}));

const customDomainController = require('../../controllers/CustomDomainController');
const { checkCustomDomainCreation } = require('../../middleware/planLimiter');
const { requireAuth, requireAuthSuperAdmin } = require('../../middleware/authMiddleware');

const customDomainRoutes = require('../../routes/customDomainRoutes');

describe('Custom Domain Routes Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    app.use('/custom-domain', customDomainRoutes);
    
    app.use((error, req, res, next) => {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    requireAuth.mockImplementation((req, res, next) => next());
    requireAuthSuperAdmin.mockImplementation((req, res, next) => next());
    checkCustomDomainCreation.mockImplementation((req, res, next) => next());
  });

  describe('GET /custom-domain/domains', () => {
    it('should get all domains', async () => {
      const mockDomains = [
        { id: 1, domain: 'example.com', status: 'active' },
        { id: 2, domain: 'test.com', status: 'pending' }
      ];

      customDomainController.getAllDomains.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockDomains
        });
      });

      const response = await request(app)
        .get('/custom-domain/domains')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDomains);
      expect(customDomainController.getAllDomains).toHaveBeenCalled();
    });

    it('should handle getAllDomains errors', async () => {
      customDomainController.getAllDomains.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve domains'
        });
      });

      const response = await request(app)
        .get('/custom-domain/domains')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to retrieve domains');
    });
  });

  describe('POST /custom-domain', () => {
    it('should create a new custom domain successfully', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        userId: 1,
        status: 'pending'
      };

      customDomainController.createCustomDomain.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: mockDomain,
          message: 'Custom domain created successfully'
        });
      });

      const domainData = {
        domain: 'example.com'
      };

      const response = await request(app)
        .post('/custom-domain')
        .send(domainData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDomain);
      expect(requireAuth).toHaveBeenCalled();
      expect(checkCustomDomainCreation).toHaveBeenCalled();
      expect(customDomainController.createCustomDomain).toHaveBeenCalled();
    });

    it('should handle creation errors properly', async () => {
      customDomainController.createCustomDomain.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid domain format'
        });
      });

      const response = await request(app)
        .post('/custom-domain')
        .send({ domain: 'invalid-domain' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid domain format');
    });

    it('should handle plan limit exceeded', async () => {
      checkCustomDomainCreation.mockImplementationOnce((req, res) => {
        res.status(429).json({
          success: false,
          message: 'Custom domain creation limit exceeded'
        });
      });

      const response = await request(app)
        .post('/custom-domain')
        .send({ domain: 'example.com' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Custom domain creation limit exceeded');
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .post('/custom-domain')
        .send({ domain: 'example.com' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('GET /custom-domain', () => {
    it('should get user domains', async () => {
      const mockUserDomains = [
        { id: 1, domain: 'user1.com', status: 'active' },
        { id: 2, domain: 'user2.com', status: 'pending' }
      ];

      customDomainController.getUserDomains.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUserDomains
        });
      });

      const response = await request(app)
        .get('/custom-domain')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUserDomains);
      expect(requireAuth).toHaveBeenCalled();
      expect(customDomainController.getUserDomains).toHaveBeenCalled();
    });

    it('should handle empty domain list', async () => {
      customDomainController.getUserDomains.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: []
        });
      });

      const response = await request(app)
        .get('/custom-domain')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .get('/custom-domain')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('GET /custom-domain/:id', () => {
    it('should get domain by id', async () => {
      const mockDomain = { 
        id: 1, 
        domain: 'example.com', 
        status: 'active',
        userId: 1
      };

      customDomainController.getDomainById.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockDomain
        });
      });

      const response = await request(app)
        .get('/custom-domain/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDomain);
      expect(requireAuth).toHaveBeenCalled();
      expect(customDomainController.getDomainById).toHaveBeenCalled();
    });

    it('should return 404 for non-existent domain', async () => {
      customDomainController.getDomainById.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Domain not found'
        });
      });

      const response = await request(app)
        .get('/custom-domain/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Domain not found');
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .get('/custom-domain/1')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('PUT /custom-domain/:id', () => {
    it('should update custom domain successfully', async () => {
      const mockUpdatedDomain = {
        id: 1,
        domain: 'updated-example.com',
        status: 'active'
      };

      customDomainController.updateCustomDomain.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockUpdatedDomain,
          message: 'Domain updated successfully'
        });
      });

      const response = await request(app)
        .put('/custom-domain/1')
        .send({
          domain: 'updated-example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedDomain);
      expect(requireAuth).toHaveBeenCalled();
      expect(customDomainController.updateCustomDomain).toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      customDomainController.updateCustomDomain.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid domain data'
        });
      });

      const response = await request(app)
        .put('/custom-domain/1')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid domain data');
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .put('/custom-domain/1')
        .send({ domain: 'example.com' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('DELETE /custom-domain/:id', () => {
    it('should delete custom domain successfully', async () => {
      customDomainController.deleteCustomDomain.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Domain deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/custom-domain/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Domain deleted successfully');
      expect(requireAuth).toHaveBeenCalled();
      expect(customDomainController.deleteCustomDomain).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      customDomainController.deleteCustomDomain.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Domain not found for deletion'
        });
      });

      const response = await request(app)
        .delete('/custom-domain/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Domain not found for deletion');
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .delete('/custom-domain/1')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('POST /custom-domain/:id/verify', () => {
    it('should verify domain successfully', async () => {
      customDomainController.verifyDomain.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Domain verified successfully',
          data: { verified: true }
        });
      });

      const response = await request(app)
        .post('/custom-domain/1/verify')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Domain verified successfully');
      expect(requireAuth).toHaveBeenCalled();
      expect(customDomainController.verifyDomain).toHaveBeenCalled();
    });

    it('should handle verification errors', async () => {
      customDomainController.verifyDomain.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Domain verification failed'
        });
      });

      const response = await request(app)
        .post('/custom-domain/1/verify')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Domain verification failed');
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .post('/custom-domain/1/verify')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('POST /custom-domain/link-to-vcard', () => {
    it('should link domain to vcard successfully', async () => {
      customDomainController.linkToVCard.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Domain linked to VCard successfully'
        });
      });

      const response = await request(app)
        .post('/custom-domain/link-to-vcard')
        .send({
          domainId: 1,
          vcardId: 1
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Domain linked to VCard successfully');
      expect(requireAuth).toHaveBeenCalled();
      expect(customDomainController.linkToVCard).toHaveBeenCalled();
    });

    it('should handle linking errors', async () => {
      customDomainController.linkToVCard.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Invalid linking data'
        });
      });

      const response = await request(app)
        .post('/custom-domain/link-to-vcard')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid linking data');
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .post('/custom-domain/link-to-vcard')
        .send({ domainId: 1, vcardId: 1 })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('POST /custom-domain/:id/unlink', () => {
    it('should unlink domain from vcard successfully', async () => {
      customDomainController.unlinkFromVCard.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Domain unlinked from VCard successfully'
        });
      });

      const response = await request(app)
        .post('/custom-domain/1/unlink')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Domain unlinked from VCard successfully');
      expect(requireAuth).toHaveBeenCalled();
      expect(customDomainController.unlinkFromVCard).toHaveBeenCalled();
    });

    it('should handle unlinking errors', async () => {
      customDomainController.unlinkFromVCard.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Domain is not linked to any VCard'
        });
      });

      const response = await request(app)
        .post('/custom-domain/1/unlink')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Domain is not linked to any VCard');
    });

    it('should require authentication', async () => {
      requireAuth.mockImplementationOnce((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .post('/custom-domain/1/unlink')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('PUT /custom-domain/:id/toggle-status', () => {
    it('should toggle domain status for admin', async () => {
      const mockDomain = {
        id: 1,
        domain: 'example.com',
        status: 'inactive'
      };

      customDomainController.toggleDomainStatus.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: mockDomain,
          message: 'Domain status updated successfully'
        });
      });

      const response = await request(app)
        .put('/custom-domain/1/toggle-status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDomain);
      expect(requireAuthSuperAdmin).toHaveBeenCalled();
      expect(customDomainController.toggleDomainStatus).toHaveBeenCalled();
    });

    it('should require admin authentication for status toggle', async () => {
      requireAuthSuperAdmin.mockImplementationOnce((req, res) => {
        res.status(403).json({
          success: false,
          message: 'Access denied. Super admin required.'
        });
      });

      const response = await request(app)
        .put('/custom-domain/1/toggle-status')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Super admin required.');
    });

    it('should handle toggle status errors', async () => {
      customDomainController.toggleDomainStatus.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Domain not found'
        });
      });

      const response = await request(app)
        .put('/custom-domain/999/toggle-status')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Domain not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      customDomainController.getDomainById.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });

      const response = await request(app)
        .get('/custom-domain/1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });

    it('should handle unexpected errors', async () => {
      customDomainController.getDomainById.mockImplementation((req, res, next) => {
        const error = new Error('Unexpected error');
        next(error);
      });

      const response = await request(app)
        .get('/custom-domain/1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  describe('Route Parameter Validation', () => {
    it('should handle route parameters correctly', async () => {
      customDomainController.getDomainById.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: { id: parseInt(req.params.id), domain: 'example.com' },
          requestedId: req.params.id
        });
      });

      const response = await request(app)
        .get('/custom-domain/123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requestedId).toBe('123');
    });
  });

  describe('Wildcard Routes', () => {
    it('should handle domain requests', async () => {
      customDomainController.handleDomainRequest.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Domain request handled'
        });
      });
    });

    it('should handle not found requests', async () => {
      customDomainController.handleNotFound.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          message: 'Page not found'
        });
      });

    });
  });
});