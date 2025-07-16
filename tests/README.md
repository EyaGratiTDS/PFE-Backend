# Tests Unitaires - ProjetPFE

Ce projet utilise **Jest** comme framework de test pour assurer la qualité et la fiabilité du code.

## 🚀 Installation et Configuration

### Prérequis
- Node.js (v18.10.0 ou supérieur)
- npm ou yarn

### Installation des dépendances de test
```bash
npm install --save-dev jest supertest sqlite3 @types/jest
```

## 📋 Scripts de Test Disponibles

### Tests principaux
```bash
# Exécuter tous les tests
npm test

# Exécuter les tests en mode watch (redémarrage automatique)
npm run test:watch

# Exécuter les tests avec couverture de code
npm run test:coverage

# Exécuter les tests en mode CI (pour les pipelines)
npm run test:ci
```

### Tests spécifiques
```bash
# Exécuter les tests d'un fichier spécifique
npm test -- authMiddleware.test.js

# Exécuter les tests d'un dossier spécifique
npm test -- tests/controllers/

# Exécuter les tests avec un pattern
npm test -- --testNamePattern="should create user"
```

## 📁 Structure des Tests

```
tests/
├── setup.js                    # Configuration globale des tests
├── utils/
│   ├── testHelpers.js          # Utilitaires pour les tests
│   └── mockModels.js           # Modèles mock pour les tests
├── controllers/
│   ├── planController.test.js  # Tests du contrôleur des plans
│   └── pixelController.test.js # Tests du contrôleur des pixels
├── middleware/
│   └── authMiddleware.test.js  # Tests du middleware d'authentification
├── routes/
│   ├── authRoutes.test.js      # Tests des routes d'authentification
│   └── planRoutes.test.js      # Tests des routes des plans
├── services/
│   └── cryptoUtils.test.js     # Tests des services de cryptographie
└── models/
    └── models.test.js          # Tests des modèles Sequelize
```

## 🔧 Configuration Jest

Le fichier `jest.config.js` contient la configuration principale :

```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js', 
    'routes/**/*.js',
    'services/**/*.js',
    'models/**/*.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
```

## 🎯 Types de Tests Inclus

### 1. Tests de Middleware
- **Authentification** : Validation des tokens JWT, vérification des rôles
- **Autorisations** : Tests des permissions (admin, superAdmin)
- **Gestion d'erreurs** : Validation des réponses d'erreur

### 2. Tests de Contrôleurs
- **Plans** : CRUD complet, validation des données, recherche
- **Pixels** : Création, mise à jour, tracking d'événements
- **Intégrations externes** : Mock des services tiers (Meta, Stripe)

### 3. Tests de Routes
- **Authentification Google** : Flow OAuth, redirections
- **API REST** : Validation des endpoints, codes de statut
- **Middleware de protection** : Tests d'autorisation

### 4. Tests de Services
- **Cryptographie** : Chiffrement/déchiffrement, hashage de mots de passe
- **Génération de tokens** : Sécurité, unicité
- **Gestion d'erreurs** : Robustesse

### 5. Tests de Modèles
- **Validation des données** : Champs requis, contraintes
- **Associations** : Relations entre modèles
- **Types de données** : JSON, ENUM, validations

## 📊 Couverture de Code

Pour générer un rapport de couverture détaillé :

```bash
npm run test:coverage
```

Le rapport sera généré dans le dossier `coverage/` avec :
- **Rapport HTML** : `coverage/lcov-report/index.html`
- **Rapport texte** : Affiché dans le terminal
- **Fichier LCOV** : `coverage/lcov.info`

### Objectifs de Couverture
- **Lignes** : > 80%
- **Fonctions** : > 85%
- **Branches** : > 75%
- **Statements** : > 80%

## 🧪 Utilitaires de Test

### Helpers Disponibles
```javascript
// Création d'objets de test
const user = await createTestUser({ role: 'admin' });
const vcard = createTestVCard({ userId: user.id });
const plan = createTestPlan({ type: 'premium' });

// Génération de tokens
const token = createTestToken({ id: 1, role: 'admin' });

// Assertions personnalisées
expectSuccessResponse(response);
expectErrorResponse(response, 400, 'Validation error');
expectUnauthorizedError(response);
```

### Mock des Services Externes
```javascript
// Mock automatique des services
mockExternalServices();

// APIs mockées :
// - Stripe (paiements)
// - SendGrid (emails)
// - Meta Pixel (tracking)
// - Services de géolocalisation
```

## 🔍 Debugging des Tests

### Mode Debug
```bash
# Exécuter un test spécifique en mode debug
node --inspect-brk node_modules/.bin/jest --runInBand planController.test.js

# Avec timeout étendu
npm test -- --testTimeout=30000
```

### Logs et Erreurs
```bash
# Tests avec logs détaillés
npm test -- --verbose

# Afficher les erreurs complètes
npm test -- --no-coverage --verbose
```

## 🚨 Bonnes Pratiques

### 1. Nommage des Tests
```javascript
describe('PlanController', () => {
  describe('createPlan', () => {
    test('should create plan with valid data', () => {
      // Test implementation
    });
    
    test('should return 400 for invalid data', () => {
      // Test implementation
    });
  });
});
```

### 2. Isolation des Tests
- Chaque test est indépendant
- Base de données nettoyée avant chaque test
- Mocks réinitialisés automatiquement

### 3. Tests Asynchrones
```javascript
// Utiliser async/await
test('should create user', async () => {
  const user = await models.User.create(userData);
  expect(user.id).toBeDefined();
});

// Gérer les promesses rejetées
test('should handle errors', async () => {
  await expect(invalidOperation()).rejects.toThrow('Error message');
});
```

### 4. Mocks et Stubs
```javascript
// Mock d'une fonction
jest.spyOn(models.User, 'findAll').mockResolvedValue([]);

// Mock d'un module complet
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} })
}));
```

## 📈 Métriques et Rapports

### Tests en CI/CD
```bash
# Mode CI (sans watch, avec coverage)
npm run test:ci
```

### Intégration avec GitLab/GitHub
```yaml
test:
  script:
    - npm ci
    - npm run test:ci
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## 🔄 Mise à Jour des Tests

### Ajouter de Nouveaux Tests
1. Créer le fichier dans le bon dossier (`tests/controllers/`, `tests/routes/`, etc.)
2. Suivre la convention de nommage : `*.test.js`
3. Utiliser les helpers existants
4. Vérifier la couverture

### Maintenir les Tests
- Mettre à jour les tests lors des changements d'API
- Ajouter des tests pour les nouvelles fonctionnalités
- Refactoriser les tests obsolètes
- Maintenir les mocks à jour

## 📞 Support

Pour toute question sur les tests :
1. Consulter la documentation Jest : https://jestjs.io/docs/
2. Vérifier les exemples dans `tests/utils/testHelpers.js`
3. Consulter les tests existants comme référence
