const request = require('supertest');
const express = require('express');
const customDomainRoutes = require('../../routes/customDomainRoutes');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../middleware/authMiddleware', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/custom-domains', customDomainRoutes);

describe('Custom Domain Routes', () => {
  let mockModels;
  let authToken;
  let testUser;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /api/custom-domains', () => {
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
        .get('/api/custom-domains')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
    });

    test('should filter domains by status', async () => {
      mockModels.CustomDomain.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/custom-domains?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should filter verified domains', async () => {
      mockModels.CustomDomain.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/custom-domains?verified=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /api/custom-domains', () => {
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
        .post('/api/custom-domains')
        .set('Authorization', `Bearer ${authToken}`)
        .send(domainData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
    });

    test('should validate domain format', async () => {
      const response = await request(app)
        .post('/api/custom-domains')
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
        .post('/api/custom-domains')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          domain: 'example.com',
          subdomain: 'mycard'
        });

      expectErrorResponse(response);
    });
  });

  describe('GET /api/custom-domains/:id', () => {
    test('should get domain by id', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        userId: 1
      });

      const response = await request(app)
        .get('/api/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/custom-domains/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/custom-domains/:id', () => {
    test('should update domain', async () => {
      const updateData = { subdomain: 'newsubdomain' };
      
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: false
      });
      mockModels.CustomDomain.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/api/custom-domains/1')
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
        .put('/api/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ domain: 'newdomain.com' });

      expectErrorResponse(response);
    });
  });

  describe('DELETE /api/custom-domains/:id', () => {
    test('should delete domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: false
      });
      mockModels.CustomDomain.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/custom-domains/1')
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
        .delete('/api/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });

  describe('POST /api/custom-domains/:id/verify', () => {
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
        .post('/api/custom-domains/1/verify')
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
        .post('/api/custom-domains/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /api/custom-domains/:id/ssl', () => {
    test('should enable SSL', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: true,
        ssl_enabled: false
      });
      mockModels.CustomDomain.update.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/custom-domains/1/ssl')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should not enable SSL for unverified domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        is_verified: false
      });

      const response = await request(app)
        .post('/api/custom-domains/1/ssl')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockModels.CustomDomain.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/custom-domains')
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
        .post('/api/custom-domains/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
    });
  });
});
