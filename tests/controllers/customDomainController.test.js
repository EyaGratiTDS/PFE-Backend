const request = require('supertest');
const express = require('express');
const customDomainRoutes = require('../../routes/customDomainRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Correction du chemin d'import du middleware
jest.mock('../../middleware/authMiddleware', () => {
  return {
    requireAuth: jest.fn((req, res, next) => {
      req.user = { id: 1, email: 'test@example.com', role: 'user' };
      next();
    }),
    requireAuthSuperAdmin: jest.fn((req, res, next) => {
      if (req.user.role === 'superadmin') return next();
      res.status(403).json({ error: 'Forbidden' });
    })
  };
});

jest.mock('../../models', () => require('../utils/mockModels'));

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
    authToken = createTestToken({ 
      id: 1, 
      email: testUser.email,
      role: 'user' 
    });
    
    jest.clearAllMocks();
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
  });

  describe('GET /custom-domain/domains', () => {
    test('should get all domains (admin access)', async () => {
      // Créer un token admin
      const adminToken = createTestToken({ 
        id: 1, 
        email: testUser.email,
        role: 'superadmin' 
      });

      const domains = [
        { id: 1, domain: 'admin1.com', userId: 1 },
        { id: 2, domain: 'admin2.com', userId: 2 }
      ];
      
      mockModels.CustomDomain.findAll.mockResolvedValue(domains);

      const response = await request(app)
        .get('/custom-domain/domains')
        .set('Authorization', `Bearer ${adminToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
    });

    test('should deny access for non-admin users', async () => {
      const domains = [
        { id: 1, domain: 'admin1.com', userId: 1 }
      ];
      
      mockModels.CustomDomain.findAll.mockResolvedValue(domains);

      const response = await request(app)
        .get('/custom-domain/domains')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Forbidden');
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
  });

  describe('POST /custom-domain/link-to-vcard', () => {
    test('should link domain to vCard', async () => {
      const linkData = {
        domainId: 1,
        vcardId: 1
      };

      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true)
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

    test('should prevent linking other user domains', async () => {
      const linkData = {
        domainId: 1,
        vcardId: 1
      };

      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 2,
        update: jest.fn()
      });

      const response = await request(app)
        .post('/custom-domain/link-to-vcard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(linkData);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /custom-domain/:id/unlink', () => {
    test('should unlink domain from vCard', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        vcardId: 1,
        update: jest.fn().mockResolvedValue(true)
      });

      const response = await request(app)
        .post('/custom-domain/1/unlink')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should prevent unlinking other user domains', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 2, 
        vcardId: 1
      });

      const response = await request(app)
        .post('/custom-domain/1/unlink')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /custom-domain/:id/toggle-status', () => {
    test('should toggle domain status (admin access)', async () => {
      const adminToken = createTestToken({ 
        id: 1, 
        email: testUser.email,
        role: 'superadmin' 
      });

      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        status: 'active',
        update: jest.fn().mockResolvedValue({ status: 'suspended' })
      });

      const response = await request(app)
        .put('/custom-domain/1/toggle-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });

      expectSuccessResponse(response);
      expect(response.body.data.status).toBe('suspended');
    });

    test('should deny access for non-admin users', async () => {
      mockModels.CustomDomain.findByPk.mockResolvedValue({
        id: 1,
        userId: 1,
        status: 'active'
      });

      const response = await request(app)
        .put('/custom-domain/1/toggle-status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'suspended' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Forbidden');
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
  });
});