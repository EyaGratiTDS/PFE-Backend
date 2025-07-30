jest.mock('../../models', () => ({
  CustomDomain: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn()
  },
  Users: {
    findByPk: jest.fn()
  },
  VCard: {
    findOne: jest.fn(),
    findByPk: jest.fn()
  }
}));

jest.mock('dns', () => ({
  promises: {
    resolveCname: jest.fn(),
    resolveTxt: jest.fn()
  }
}));

const {
  createCustomDomain,
  updateCustomDomain,
  deleteCustomDomain,
  getUserDomains,
  getDomainById,
  verifyDomain,
  handleDomainRequest,
  handleNotFound,
  linkToVCard,
  unlinkFromVCard,
  getAllDomains,
  toggleDomainStatus
} = require('../../controllers/customDomainController');

const { Op } = require('sequelize');
const db = require('../../models');
const dns = require('dns').promises;

describe('Custom Domain Controller', () => {
  let req, res, mockDomain, mockUser, mockVCard;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
      user: { id: 123 },
      hostname: 'example.com',
      path: '/'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    };

    mockDomain = {
      id: 1,
      domain: 'example.com',
      userId: 123,
      custom_index_url: 'https://custom-index.com',
      custom_not_found_url: 'https://custom-404.com',
      vcardId: 1,
      status: 'pending',
      cname_target: 'target.example.com',
      verification_code: 'verify123',
      created_at: new Date(),
      update: jest.fn().mockResolvedValue(),
      destroy: jest.fn().mockResolvedValue()
    };

    mockUser = {
      id: 123,
      name: 'John Doe',
      email: 'john@example.com'
    };

    mockVCard = {
      id: 1,
      name: 'John Business Card',
      url: 'john-card',
      userId: 123,
      Users: mockUser
    };

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createCustomDomain', () => {
    test('should create custom domain successfully', async () => {
      req.body = {
        domain: 'example.com',
        custom_index_url: 'https://custom-index.com',
        custom_not_found_url: 'https://custom-404.com',
        vcardId: 1
      };

      db.CustomDomain.findOne.mockResolvedValue(null);
      db.VCard.findOne.mockResolvedValue(mockVCard);
      db.CustomDomain.create.mockResolvedValue(mockDomain);

      await createCustomDomain(req, res);

      expect(db.CustomDomain.findOne).toHaveBeenCalledWith({
        where: { domain: 'example.com' }
      });

      expect(db.VCard.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 123 }
      });

      expect(db.CustomDomain.create).toHaveBeenCalledWith({
        domain: 'example.com',
        userId: 123,
        custom_index_url: 'https://custom-index.com',
        custom_not_found_url: 'https://custom-404.com',
        vcardId: 1,
        status: 'pending'
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain created successfully",
        domain: mockDomain,
        dns_instructions: {
          cname: {
            name: '@',
            value: mockDomain.cname_target
          },
          txt: {
            name: `_vcard-verify.${mockDomain.domain}`,
            value: mockDomain.verification_code
          }
        }
      });
    });

    test('should return 400 when domain is missing', async () => {
      req.body = {};

      await createCustomDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain is required"
      });
    });

    test('should return 400 for invalid custom index URL', async () => {
      req.body = {
        domain: 'example.com',
        custom_index_url: 'invalid-url'
      };

      await createCustomDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid custom index URL"
      });
    });

    test('should return 400 for invalid custom 404 URL', async () => {
      req.body = {
        domain: 'example.com',
        custom_not_found_url: 'invalid-url'
      };

      await createCustomDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid custom 404 URL"
      });
    });

    test('should return 409 when domain already exists', async () => {
      req.body = { domain: 'example.com' };
      db.CustomDomain.findOne.mockResolvedValue(mockDomain);

      await createCustomDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain already exists"
      });
    });

    test('should return 404 when vCard not found', async () => {
      req.body = {
        domain: 'example.com',
        vcardId: 999
      };

      db.CustomDomain.findOne.mockResolvedValue(null);
      db.VCard.findOne.mockResolvedValue(null);

      await createCustomDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "vCard not found or unauthorized"
      });
    });

    test('should create domain without vCard when vcardId is not provided', async () => {
      req.body = { domain: 'example.com' };

      db.CustomDomain.findOne.mockResolvedValue(null);
      db.CustomDomain.create.mockResolvedValue(mockDomain);

      await createCustomDomain(req, res);

      expect(db.CustomDomain.create).toHaveBeenCalledWith({
        domain: 'example.com',
        userId: 123,
        custom_index_url: undefined,
        custom_not_found_url: undefined,
        vcardId: null,
        status: 'pending'
      });
    });
  });

  describe('updateCustomDomain', () => {
    test('should update custom domain successfully', async () => {
      req.params.id = '1';
      req.body = {
        custom_index_url: 'https://new-index.com',
        vcardId: 2
      };

      const updatedDomain = { ...mockDomain, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(updatedDomain);
      db.VCard.findOne.mockResolvedValue(mockVCard);

      await updateCustomDomain(req, res);

      expect(db.CustomDomain.findOne).toHaveBeenCalledWith({
        where: { id: '1', userId: 123 }
      });

      expect(updatedDomain.update).toHaveBeenCalledWith({
        domain: mockDomain.domain,
        custom_index_url: 'https://new-index.com',
        custom_not_found_url: mockDomain.custom_not_found_url,
        vcardId: 2,
        status: mockDomain.status
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain updated successfully",
        domain: updatedDomain
      });
    });

    test('should return 404 when domain not found', async () => {
      req.params.id = '999';
      db.CustomDomain.findOne.mockResolvedValue(null);

      await updateCustomDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain not found"
      });
    });

    test('should reset status to pending when domain changes', async () => {
      req.params.id = '1';
      req.body = { domain: 'new-domain.com' };

      const updatedDomain = { ...mockDomain, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(updatedDomain);

      await updateCustomDomain(req, res);

      expect(updatedDomain.update).toHaveBeenCalledWith({
        domain: 'new-domain.com',
        custom_index_url: mockDomain.custom_index_url,
        custom_not_found_url: mockDomain.custom_not_found_url,
        vcardId: mockDomain.vcardId,
        status: 'pending'
      });
    });
  });

  describe('deleteCustomDomain', () => {
    test('should delete custom domain successfully', async () => {
      req.params.id = '1';
      const domainToDelete = { ...mockDomain, destroy: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(domainToDelete);

      await deleteCustomDomain(req, res);

      expect(db.CustomDomain.findOne).toHaveBeenCalledWith({
        where: { id: '1', userId: 123 }
      });

      expect(domainToDelete.destroy).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain deleted successfully"
      });
    });

    test('should return 404 when domain not found', async () => {
      req.params.id = '999';
      db.CustomDomain.findOne.mockResolvedValue(null);

      await deleteCustomDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain not found"
      });
    });
  });

  describe('getUserDomains', () => {
    test('should return user domains successfully', async () => {
      const domains = [
        {
          ...mockDomain,
          Users: mockUser,
          vcard: mockVCard
        }
      ];
      db.CustomDomain.findAll.mockResolvedValue(domains);

      await getUserDomains(req, res);

      expect(db.CustomDomain.findAll).toHaveBeenCalledWith({
        where: { userId: 123, status: { [Op.ne]: 'blocked' } },
        include: [
          {
            model: db.Users,
            attributes: ['id', 'email'],
            as: 'Users'
          },
          {
            model: db.VCard,
            attributes: ['id', 'name', 'url'],
            as: 'vcard',
            required: false
          }
        ]
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        domains
      });
    });
  });

  describe('verifyDomain', () => {
    test('should verify domain successfully', async () => {
      req.params.id = '1';
      const domainToVerify = { ...mockDomain, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(domainToVerify);

      dns.resolveCname.mockResolvedValue([mockDomain.cname_target]);
      dns.resolveTxt.mockResolvedValue([[mockDomain.verification_code]]);

      await verifyDomain(req, res);

      expect(domainToVerify.update).toHaveBeenCalledWith({ status: 'active' });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain verified and activated",
        domain: domainToVerify
      });
    });

    test('should fail verification when DNS not configured', async () => {
      req.params.id = '1';
      const domainToVerify = { ...mockDomain, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(domainToVerify);

      dns.resolveCname.mockResolvedValue(['wrong-target.com']);
      dns.resolveTxt.mockResolvedValue([['wrong-code']]);

      await verifyDomain(req, res);

      expect(domainToVerify.update).toHaveBeenCalledWith({ status: 'failed' });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "DNS not configured properly",
        details: {
          cname: false,
          txt: false,
          instructions: {
            cname: {
              name: '@',
              value: mockDomain.cname_target
            },
            txt: {
              name: `_vcard-verify.${mockDomain.domain}`,
              value: mockDomain.verification_code
            }
          }
        }
      });
    });

    test('should handle DNS timeout', async () => {
      req.params.id = '1';
      const domainToVerify = { ...mockDomain, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(domainToVerify);

      dns.resolveCname.mockImplementation(() => new Promise(() => {}));
      dns.resolveTxt.mockImplementation(() => new Promise(() => {}));

      await verifyDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(408);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "DNS verification timed out",
        error: "DNS servers responded too slowly"
      });
    });

    test('should return 404 when domain not found', async () => {
      req.params.id = '999';
      db.CustomDomain.findOne.mockResolvedValue(null);

      await verifyDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain not found"
      });
    });
  });

  describe('handleDomainRequest', () => {
    test('should redirect to custom index URL for root path', async () => {
      req.hostname = 'example.com';
      req.path = '/';

      const activeDomain = {
        ...mockDomain,
        status: 'active',
        custom_index_url: 'https://custom-index.com'
      };
      db.CustomDomain.findOne.mockResolvedValue(activeDomain);

      await handleDomainRequest(req, res);

      expect(res.redirect).toHaveBeenCalledWith(301, 'https://custom-index.com');
    });

    test('should redirect to vCard when available', async () => {
      req.hostname = 'example.com';
      req.path = '/';

      const activeDomain = {
        ...mockDomain,
        status: 'active',
        custom_index_url: null, 
        vcard: mockVCard
      };
      db.CustomDomain.findOne.mockResolvedValue(activeDomain);

      await handleDomainRequest(req, res);

      expect(res.redirect).toHaveBeenCalledWith(301, `/vcards/${mockVCard.url}`);
    });

    test('should redirect to custom 404 URL when no vCard', async () => {
      req.hostname = 'example.com';
      req.path = '/some-path';

      const activeDomain = {
        ...mockDomain,
        status: 'active',
        vcard: null,
        custom_not_found_url: 'https://custom-404.com'
      };
      db.CustomDomain.findOne.mockResolvedValue(activeDomain);

      await handleDomainRequest(req, res);

      expect(res.redirect).toHaveBeenCalledWith(302, 'https://custom-404.com');
    });

    test('should return 404 when domain not configured', async () => {
      req.hostname = 'unknown.com';
      db.CustomDomain.findOne.mockResolvedValue(null);

      await handleDomainRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('404 - Page Not Found'));
    });
  });

  describe('linkToVCard', () => {
    test('should link domain to vCard successfully', async () => {
      req.body = { domainId: 1, vcardId: 1 };

      const activeDomain = { ...mockDomain, status: 'active', update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne
        .mockResolvedValueOnce(activeDomain)
        .mockResolvedValueOnce(null);
      db.VCard.findOne.mockResolvedValue(mockVCard);

      await linkToVCard(req, res);

      expect(activeDomain.update).toHaveBeenCalledWith({ vcardId: 1 });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain successfully linked to vCard",
        domain: activeDomain,
        vcard: mockVCard
      });
    });

    test('should return 404 when domain not found', async () => {
      req.body = { domainId: 999, vcardId: 1 };
      db.CustomDomain.findOne.mockResolvedValue(null);

      await linkToVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain not found or unauthorized"
      });
    });

    test('should return 400 when domain is not active', async () => {
      req.body = { domainId: 1, vcardId: 1 };

      const inactiveDomain = { ...mockDomain, status: 'pending' };
      db.CustomDomain.findOne.mockResolvedValue(inactiveDomain);

      await linkToVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain must be active to link to vCard"
      });
    });

    test('should return 400 when vCard already linked to another domain', async () => {
      req.body = { domainId: 1, vcardId: 1 };

      const activeDomain = { ...mockDomain, status: 'active' };
      const existingDomain = { ...mockDomain, id: 2 };
      
      db.CustomDomain.findOne
        .mockResolvedValueOnce(activeDomain)
        .mockResolvedValueOnce(existingDomain);
      db.VCard.findOne.mockResolvedValue(mockVCard);

      await linkToVCard(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "This vCard is already linked to another domain"
      });
    });
  });

  describe('unlinkFromVCard', () => {
    test('should unlink domain from vCard successfully', async () => {
      req.params.id = '1';

      const linkedDomain = { ...mockDomain, vcardId: 1, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(linkedDomain);

      await unlinkFromVCard(req, res);

      expect(linkedDomain.update).toHaveBeenCalledWith({ vcardId: null });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain unlinked from vCard",
        domain: linkedDomain
      });
    });

    test('should handle domain without vCard link', async () => {
      req.params.id = '1';

      const unlinkedDomain = { ...mockDomain, vcardId: null };
      db.CustomDomain.findOne.mockResolvedValue(unlinkedDomain);

      await unlinkFromVCard(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain unlinked from vCard",
        domain: unlinkedDomain
      });
    });
  });

  describe('getDomainById', () => {
    test('should get domain by ID successfully', async () => {
      req.params.id = '1';

      const domainWithIncludes = {
        ...mockDomain,
        vcard: mockVCard,
        Users: mockUser
      };
      db.CustomDomain.findOne.mockResolvedValue(domainWithIncludes);

      await getDomainById(req, res);

      expect(db.CustomDomain.findOne).toHaveBeenCalledWith({
        where: { id: '1', userId: 123 },
        include: [
          {
            model: db.VCard,
            attributes: ['id', 'name', 'url'],
            as: 'vcard'
          },
          {
            model: db.Users,
            attributes: ['id', 'email'],
            as: 'Users'
          }
        ]
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: domainWithIncludes
      });
    });

    test('should return 404 when domain not found', async () => {
      req.params.id = '999';
      db.CustomDomain.findOne.mockResolvedValue(null);

      await getDomainById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain not found or unauthorized"
      });
    });
  });

  describe('getAllDomains', () => {
    test('should get all domains successfully', async () => {
      const domains = [{
        ...mockDomain,
        Users: mockUser,
        vcard: {
          ...mockVCard,
          Users: mockUser
        }
      }];
      
      db.CustomDomain.findAll.mockResolvedValue(domains);

      await getAllDomains(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{
          id: mockDomain.id,
          domain: mockDomain.domain,
          status: mockDomain.status,
          created_at: mockDomain.created_at,
          custom_index_url: mockDomain.custom_index_url,
          custom_not_found_url: mockDomain.custom_not_found_url,
          user: {
            id: mockUser.id,
            name: mockUser.name,
            email: mockUser.email
          },
          vcard: {
            id: mockVCard.id,
            name: mockVCard.name,
            url: mockVCard.url,
            user: {
              id: mockUser.id,
              name: mockUser.name,
              email: mockUser.email
            }
          }
        }]
      });
    });
  });

  describe('toggleDomainStatus', () => {
    test('should toggle domain status successfully', async () => {
      req.params.id = '1';
      req.body.status = 'active';

      const domainToToggle = { ...mockDomain, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(domainToToggle);

      await toggleDomainStatus(req, res);

      expect(domainToToggle.update).toHaveBeenCalledWith({ status: 'active' });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Domain status updated to active",
        domain: domainToToggle
      });
    });

    test('should return 400 for invalid status', async () => {
      req.params.id = '1';
      req.body.status = 'invalid-status';

      await toggleDomainStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid status. Allowed values: pending, active, failed, blocked"
      });
    });

    test('should return 404 when domain not found', async () => {
      req.params.id = '999';
      req.body.status = 'active';
      db.CustomDomain.findOne.mockResolvedValue(null);

      await toggleDomainStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Domain not found"
      });
    });
  });

  describe('handleNotFound', () => {
    test('should redirect to custom 404 URL when available', async () => {
      req.hostname = 'example.com';

      const activeDomain = {
        ...mockDomain,
        status: 'active',
        custom_not_found_url: 'https://custom-404.com'
      };
      db.CustomDomain.findOne.mockResolvedValue(activeDomain);

      await handleNotFound(req, res);

      expect(res.redirect).toHaveBeenCalledWith(302, 'https://custom-404.com');
    });

    test('should return default 404 when no custom URL', async () => {
      req.hostname = 'example.com';
      db.CustomDomain.findOne.mockResolvedValue(null);

      await handleNotFound(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('404 - Page Not Found'));
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      req.body = { domain: 'example.com' };
      const error = new Error('Database connection failed');
      db.CustomDomain.findOne.mockRejectedValue(error);

      await createCustomDomain(req, res);

      expect(console.error).toHaveBeenCalledWith("Error creating custom domain:", error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });

    test('should handle DNS errors in verification', async () => {
      req.params.id = '1';
      const domainToVerify = { ...mockDomain, update: jest.fn().mockResolvedValue() };
      db.CustomDomain.findOne.mockResolvedValue(domainToVerify);

      const dnsError = new Error('DNS lookup failed');
      dns.resolveCname.mockRejectedValue(dnsError);

      await verifyDomain(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error",
        error: "DNS lookup failed"
      });
    });
  });
});