const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const createTestToken = (userData = {}) => {
  const defaultUser = {
    id: 1,
    email: 'test@example.com',
    role: 'admin'
  };
  
  const user = { ...defaultUser, ...userData };
  
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
};

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

const createTestPlan = (planData = {}) => {
  const defaultPlan = {
    name: 'Test Plan',
    description: 'Test Plan Description',
    price: 12.00,
    currency: 'USD',
    type: 'Basic',
    features: JSON.stringify(['feature1', 'feature2']),
    is_active: true
  };
  
  return { ...defaultPlan, ...planData };
};

const createTestPixel = (pixelData = {}) => {
  const defaultPixel = {
    name: 'Test Pixel',
    vcardId: 1,
    is_active: true,
    is_blocked: false
  };
  
  return { ...defaultPixel, ...pixelData };
};

const mockExternalServices = () => {
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

  jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
  }));

  jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} })
  }));
};

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
