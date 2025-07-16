const { Sequelize } = require('sequelize');

// Mock des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_ACCESS_EXPIRATION = '1h';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.API_URL = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ENCRYPTION_KEY = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 caractères pour AES-256

// Mock des modèles pour éviter l'utilisation de la vraie base de données
jest.mock('../models', () => require('./utils/mockModels'));

// Mock de la base de données
const mockSequelize = new (require('sequelize')).Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

jest.mock('../database/sequelize', () => mockSequelize);
jest.mock('../database/db', () => mockSequelize);

// Configuration de la base de données de test
const testSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  define: {
    timestamps: true,
    underscored: false
  }
});

global.testDb = testSequelize;

// Configuration Jest globale
beforeAll(async () => {
  // Initialiser la base de données de test
  await testSequelize.authenticate();
});

afterAll(async () => {
  // Nettoyer après tous les tests
  await testSequelize.close();
});

beforeEach(async () => {
  // Nettoyer les données entre les tests
  jest.clearAllMocks();
});
