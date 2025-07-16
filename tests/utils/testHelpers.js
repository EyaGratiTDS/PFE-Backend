const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Crée un token JWT valide pour les tests
 */
const createTestToken = (userData = {}) => {
  const defaultUser = {
    id: 1,
    email: 'test@example.com',
    role: 'admin'
  };
  
  const user = { ...defaultUser, ...userData };
  
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
};

/**
 * Crée un utilisateur de test
 */
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: await bcrypt.hash('password123', 10),
    role: 'admin',
    isVerified: true
  };
  
  return { ...defaultUser, ...userData };
};

/**
 * Crée une vCard de test
 */
const createTestVCard = (vcardData = {}) => {
  const defaultVCard = {
    name: 'Test VCard',
    description: 'Test Description',
    url: 'test-vcard',
    userId: 1,
    is_active: true,
    status: true
  };
  
  return { ...defaultVCard, ...vcardData };
};

/**
 * Crée un plan de test
 */
const createTestPlan = (planData = {}) => {
  const defaultPlan = {
    name: 'Test Plan',
    description: 'Test Plan Description',
    price: 9.99,
    currency: 'USD',
    type: 'premium',
    features: JSON.stringify(['feature1', 'feature2']),
    is_active: true
  };
  
  return { ...defaultPlan, ...planData };
};

/**
 * Crée un pixel de test
 */
const createTestPixel = (pixelData = {}) => {
  const defaultPixel = {
    name: 'Test Pixel',
    vcardId: 1,
    is_active: true,
    is_blocked: false
  };
  
  return { ...defaultPixel, ...pixelData };
};

/**
 * Mock des services externes
 */
const mockExternalServices = () => {
  // Mock Stripe
  jest.mock('stripe', () => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_test123' })
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub_test123' }),
      cancel: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' })
    }
  }));

  // Mock SendGrid
  jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
  }));

  // Mock Axios pour les APIs externes
  jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} })
  }));
};

/**
 * Assertions personnalisées pour les réponses API
 */
const expectSuccessResponse = (response, expectedData = null) => {
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('success', true);
  if (expectedData) {
    expect(response.body).toMatchObject(expectedData);
  }
};

const expectErrorResponse = (response, expectedStatus, expectedMessage = null) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', false);
  if (expectedMessage) {
    expect(response.body.message).toContain(expectedMessage);
  }
};

const expectValidationError = (response, field = null) => {
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('success', false);
  if (field) {
    expect(response.body.message).toContain(field);
  }
};

const expectUnauthorizedError = (response) => {
  expect(response.status).toBe(401);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body.message).toMatch(/auth|token|login/i);
};

const expectForbiddenError = (response) => {
  expect(response.status).toBe(403);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body.message).toMatch(/forbidden|permission|access/i);
};

const expectNotFoundError = (response, resource = null) => {
  expect(response.status).toBe(404);
  expect(response.body).toHaveProperty('success', false);
  if (resource) {
    expect(response.body.message).toContain(resource);
  }
};

module.exports = {
  createTestToken,
  createTestUser,
  createTestVCard,
  createTestPlan,
  createTestPixel,
  mockExternalServices,
  expectSuccessResponse,
  expectErrorResponse,
  expectValidationError,
  expectUnauthorizedError,
  expectForbiddenError,
  expectNotFoundError
};
