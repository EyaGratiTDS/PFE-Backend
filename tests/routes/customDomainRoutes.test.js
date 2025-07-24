const request = require('supertest');
const express = require('express');
const customDomainRoutes = require('../../routes/customDomainRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/planLimiter', () => ({
  checkCustomDomainCreation: (req, res, next) => next()
}));
jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  },
  requireAuthSuperAdmin: (req, res, next) => {
    req.user = { id: 1, role: 'superadmin', email: 'admin@example.com' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/custom-domain', customDomainRoutes);

describe('Custom Domain Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    const { createMockModels } = require('../utils/mockModels');
    mockModels = createMockModels();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /custom-domain/domains', () => {
    test('should get all domains for super admin', async () => {
      const domains = [
        {
          id: 1,
          userId: 1,
          domain: 'example.com',
          subdomain: 'mycard',
          status: 'active'
        },
        {
          id: 2,
          userId: 2,
          domain: 'example2.com',
          subdomain: 'mycard2',
          status: 'pending'
        }
      ];
      mockModels.CustomDomain.findAll.mockResolvedValue(domains);

      const response = await request(app)
        .get('/custom-domain/domains')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });

    test('should return empty array when no domains exist', async () => {
      mockModels.CustomDomain.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/custom-domain/domains')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /custom-domain', () => {
    test('should get user domains', async () => {
      const domains = [
        {
          id: 1,
          userId: 1,
          domain: 'example.com',
          subdomain: 'mycard',
          status: 'active'
        }
      ];
      mockModels.CustomDomain.findAll.mockResolvedValue(domains);

      const response = await request(app)
        .get('/custom-domain')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
    });

    test('should filter domains by status', async () => {
      mockModels.CustomDomain.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/custom-domain?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should filter verified domains', async () => {
      mockModels.CustomDomain.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/custom-domain?verified=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /custom-domain', () => {
    test('should create new domain', async () => {
      const domainData = {
        domain: 'newdomain.com',
        subdomain: 'mycard'
      };

      mockModels.CustomDomain.findOne.mockResolvedValue(null);
      mockModels.CustomDomain.create.mockResolvedValue({
        id: 1,
        ...domainData,
        userId: 1,
        full_domain: 'mycard.newdomain.com'
      });

      const response = await request(app)
        .post('/custom-domain')
        .set('Authorization', `Bearer ${authToken}`)
        .send(domainData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should validate domain format', async () => {
      const response = await request(app)
        .post('/custom-domain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          domain: 'invalid-domain',
          subdomain: 'test'
        });

      expectErrorResponse(response);
    });

    test('should prevent duplicate domains', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        subdomain: 'mycard'
      });

      const response = await request(app)
        .post('/custom-domain')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          domain: 'example.com',
          subdomain: 'mycard'
        });

      expectErrorResponse(response);
    });
  });

  describe('GET /custom-domain/:id', () => {
    test('should get domain by id', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        userId: 1
      });

      const response = await request(app)
        .get('/custom-domain/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/custom-domain/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /custom-domain/:id', () => {
    test('should update domain', async () => {
      const updateData = { subdomain: 'newsubdomain' };
      
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: false
      });
      mockModels.CustomDomain.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/custom-domain/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });

    test('should not allow updating verified domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: true
      });

      const response = await request(app)
        .put('/custom-domain/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ domain: 'newdomain.com' });

      expectErrorResponse(response);
    });
  });

  describe('DELETE /custom-domain/:id', () => {
    test('should delete domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: false
      });
      mockModels.CustomDomain.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/custom-domain/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should not delete verified domain without force', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: true
      });

      const response = await request(app)
        .delete('/custom-domain/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });

  describe('POST /custom-domain/:id/verify', () => {
    test('should verify domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: false,
        dns_records: {
          cname: 'test.cdn.domain.com',
          txt: 'verification-token'
        }
      });
      mockModels.CustomDomain.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/custom-domain/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should not verify already verified domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: true
      });

      const response = await request(app)
        .post('/custom-domain/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /custom-domain/link-to-vcard', () => {
    test('should link domain to vCard', async () => {
      const linkData = {
        domainId: 1,
        vCardId: 1
      };

      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        update: jest.fn()
      });
      mockModels.VCard.findByPk.mockResolvedValue({
        id: 1,
        userId: 1
      });

      const response = await request(app)
        .post('/custom-domain/link-to-vcard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(linkData);

      expectSuccessResponse(response);
    });

    test('should prevent linking to non-owned vCard', async () => {
      const linkData = {
        domainId: 1,
        vCardId: 2
      };

      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        update: jest.fn()
      });
      mockModels.VCard.findByPk.mockResolvedValue({
        id: 2,
        userId: 2 
      });

      const response = await request(app)
        .post('/custom-domain/link-to-vcard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(linkData);

      expectErrorResponse(response);
      expect(response.status).toBe(403);
    });
  });

  describe('POST /custom-domain/:id/unlink', () => {
    test('should unlink domain from vCard', async () => {
      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        vCardId: 1,
        update: jest.fn()
      });

      const response = await request(app)
        .post('/custom-domain/1/unlink')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should handle unlink when not linked', async () => {
      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        vCardId: null,
        update: jest.fn()
      });

      const response = await request(app)
        .post('/custom-domain/1/unlink')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('PUT /custom-domain/:id/toggle-status', () => {
    test('should toggle domain status as super admin', async () => {
      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        status: 'active',
        update: jest.fn().mockResolvedValue([1])
      });

      const response = await request(app)
        .put('/custom-domain/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'suspended' });

      expectSuccessResponse(response);
      expect(response.body.data.status).toBe('suspended');
    });

    test('should not allow non-super admins to toggle status', async () => {
      const originalImplementation = require('../../middleware/authMiddleware').requireAuthSuperAdmin;
      jest.spyOn(require('../../middleware/authMiddleware'), 'requireAuthSuperAdmin')
        .mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

      const response = await request(app)
        .put('/custom-domain/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      
      jest.spyOn(require('../../middleware/authMiddleware'), 'requireAuthSuperAdmin')
        .mockImplementation(originalImplementation);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.CustomDomain.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/custom-domain')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });

    test('should handle DNS verification errors', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: false
      });

      jest.doMock('dns', () => ({
        resolve: jest.fn((domain, type, callback) => {
          callback(new Error('DNS resolution failed'));
        })
      }));

      const response = await request(app)
        .post('/custom-domain/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });
});