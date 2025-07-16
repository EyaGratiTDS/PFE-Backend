const request = require('supertest');
const express = require('express');
const customDomainController = require('../../controllers/CustomDomainController');
const { createTestToken, createTestUser, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('dns', () => ({
  resolve: jest.fn(),
  lookup: jest.fn()
}));

const app = express();
app.use(express.json());

// Configuration des routes de test
app.get('/custom-domains', customDomainController.getUserDomains);
app.post('/custom-domains', customDomainController.createCustomDomain);
app.get('/custom-domains/:id', customDomainController.getDomainById);
app.put('/custom-domains/:id', customDomainController.updateDomain);
app.delete('/custom-domains/:id', customDomainController.deleteDomain);
app.post('/custom-domains/:id/verify', customDomainController.verifyDomain);
app.post('/custom-domains/:id/ssl', customDomainController.enableSSL);

describe('CustomDomainController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testDomain;
  let dns;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testDomain = {
      id: 1,
      userId: 1,
      domain: 'example.com',
      subdomain: 'mycard',
      full_domain: 'mycard.example.com',
      status: 'pending',
      is_verified: false,
      ssl_enabled: false,
      dns_records: {
        cname: 'mycard.example.com.cdn.domain.com',
        txt: 'verification-token-123'
      },
      created_at: new Date()
    };
    authToken = createTestToken({ id: 1, email: testUser.email });
    dns = require('dns');

    jest.clearAllMocks();
  });

  describe('GET /custom-domains', () => {
    test('should get user domains successfully', async () => {
      const domains = [
        testDomain,
        { ...testDomain, id: 2, domain: 'another.com' }
      ];

      mockModels.CustomDomain.findAll.mockResolvedValue(domains);

      const response = await request(app)
        .get('/custom-domains')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.CustomDomain.findAll).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter domains by status', async () => {
      mockModels.CustomDomain.findAll.mockResolvedValue([testDomain]);

      const response = await request(app)
        .get('/custom-domains?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.CustomDomain.findAll).toHaveBeenCalledWith({
        where: { userId: 1, status: 'pending' },
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter verified domains', async () => {
      mockModels.CustomDomain.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get('/custom-domains?verified=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.CustomDomain.findAll).toHaveBeenCalledWith({
        where: { userId: 1, is_verified: true },
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('POST /custom-domains', () => {
    test('should create custom domain successfully', async () => {
      const domainData = {
        domain: 'newdomain.com',
        subdomain: 'mycard'
      };

      const createdDomain = {
        ...testDomain,
        ...domainData,
        full_domain: 'mycard.newdomain.com'
      };

      mockModels.CustomDomain.findOne.mockResolvedValue(null); // Domain not exists
      mockModels.CustomDomain.create.mockResolvedValue(createdDomain);

      const response = await request(app)
        .post('/custom-domains')
        .set('Authorization', `Bearer ${authToken}`)
        .send(domainData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.CustomDomain.create).toHaveBeenCalledWith({
        userId: 1,
        domain: domainData.domain,
        subdomain: domainData.subdomain,
        full_domain: 'mycard.newdomain.com',
        status: 'pending',
        dns_records: expect.any(Object)
      });
    });

    test('should validate domain format', async () => {
      const response = await request(app)
        .post('/custom-domains')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          domain: 'invalid-domain',
          subdomain: 'test'
        });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Invalid domain format');
    });

    test('should validate subdomain format', async () => {
      const response = await request(app)
        .post('/custom-domains')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          domain: 'example.com',
          subdomain: 'invalid_subdomain!'
        });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Invalid subdomain format');
    });

    test('should prevent duplicate domains', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);

      const response = await request(app)
        .post('/custom-domains')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          domain: 'example.com',
          subdomain: 'mycard'
        });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Domain already exists');
    });

    test('should generate DNS records', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(null);
      mockModels.CustomDomain.create.mockResolvedValue(testDomain);

      const response = await request(app)
        .post('/custom-domains')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          domain: 'example.com',
          subdomain: 'test'
        });

      expectSuccessResponse(response);
      expect(response.body.data.dns_records).toHaveProperty('cname');
      expect(response.body.data.dns_records).toHaveProperty('txt');
    });
  });

  describe('GET /custom-domains/:id', () => {
    test('should get domain by id', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);

      const response = await request(app)
        .get('/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.domain).toBe(testDomain.domain);
    });

    test('should return 404 for non-existent domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/custom-domains/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not allow access to other users domains', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(mockModels.CustomDomain.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });
  });

  describe('PUT /custom-domains/:id', () => {
    test('should update domain successfully', async () => {
      const updateData = { subdomain: 'newsubdomain' };
      const updatedDomain = {
        ...testDomain,
        ...updateData,
        full_domain: 'newsubdomain.example.com'
      };

      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);
      mockModels.CustomDomain.update.mockResolvedValue([1]);
      mockModels.CustomDomain.findOne.mockResolvedValueOnce(updatedDomain);

      const response = await request(app)
        .put('/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(response.body.data.full_domain).toBe('newsubdomain.example.com');
    });

    test('should not allow updating verified domain', async () => {
      const verifiedDomain = { ...testDomain, is_verified: true };
      mockModels.CustomDomain.findOne.mockResolvedValue(verifiedDomain);

      const response = await request(app)
        .put('/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ domain: 'newdomain.com' });

      expectErrorResponse(response);
      expect(response.body.message).toContain('Cannot modify verified domain');
    });

    test('should regenerate DNS records on domain change', async () => {
      const updateData = { domain: 'newdomain.com' };
      
      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);
      mockModels.CustomDomain.update.mockResolvedValue([1]);

      const response = await request(app)
        .put('/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response);
    });
  });

  describe('DELETE /custom-domains/:id', () => {
    test('should delete domain successfully', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);
      mockModels.CustomDomain.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.CustomDomain.destroy).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });

    test('should not delete verified domain without force flag', async () => {
      const verifiedDomain = { ...testDomain, is_verified: true };
      mockModels.CustomDomain.findOne.mockResolvedValue(verifiedDomain);

      const response = await request(app)
        .delete('/custom-domains/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('Cannot delete verified domain');
    });

    test('should delete verified domain with force flag', async () => {
      const verifiedDomain = { ...testDomain, is_verified: true };
      mockModels.CustomDomain.findOne.mockResolvedValue(verifiedDomain);
      mockModels.CustomDomain.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/custom-domains/1?force=true')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });
  });

  describe('POST /custom-domains/:id/verify', () => {
    test('should verify domain successfully', async () => {
      dns.resolve.mockImplementation((domain, type, callback) => {
        if (type === 'CNAME') {
          callback(null, ['mycard.example.com.cdn.domain.com']);
        } else if (type === 'TXT') {
          callback(null, [['verification-token-123']]);
        }
      });

      const verifiedDomain = { ...testDomain, is_verified: true, status: 'active' };
      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);
      mockModels.CustomDomain.update.mockResolvedValue([1]);
      mockModels.CustomDomain.findOne.mockResolvedValueOnce(verifiedDomain);

      const response = await request(app)
        .post('/custom-domains/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.is_verified).toBe(true);
      expect(mockModels.CustomDomain.update).toHaveBeenCalledWith(
        { is_verified: true, status: 'active' },
        { where: { id: 1, userId: 1 } }
      );
    });

    test('should fail verification for incorrect DNS records', async () => {
      dns.resolve.mockImplementation((domain, type, callback) => {
        callback(new Error('DNS resolution failed'));
      });

      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);

      const response = await request(app)
        .post('/custom-domains/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('DNS verification failed');
    });

    test('should not verify already verified domain', async () => {
      const verifiedDomain = { ...testDomain, is_verified: true };
      mockModels.CustomDomain.findOne.mockResolvedValue(verifiedDomain);

      const response = await request(app)
        .post('/custom-domains/1/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toContain('already verified');
    });
  });

  describe('POST /custom-domains/:id/ssl', () => {
    test('should enable SSL successfully', async () => {
      const verifiedDomain = { ...testDomain, is_verified: true };
      const sslEnabledDomain = { ...verifiedDomain, ssl_enabled: true };
      
      mockModels.CustomDomain.findOne.mockResolvedValue(verifiedDomain);
      mockModels.CustomDomain.update.mockResolvedValue([1]);
      mockModels.CustomDomain.findOne.mockResolvedValueOnce(sslEnabledDomain);

      const response = await request(app)
        .post('/custom-domains/1/ssl')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data.ssl_enabled).toBe(true);
    });

    test('should not enable SSL for unverified domain', async () => {
      mockModels.CustomDomain.findOne.mockResolvedValue(testDomain);

      const response = await request(app)
        .post('/custom-domains/1/ssl')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('Domain must be verified');
    });

    test('should not enable SSL if already enabled', async () => {
      const sslEnabledDomain = { ...testDomain, is_verified: true, ssl_enabled: true };
      mockModels.CustomDomain.findOne.mockResolvedValue(sslEnabledDomain);

      const response = await request(app)
        .post('/custom-domains/1/ssl')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.message).toContain('already enabled');
    });
  });
});
