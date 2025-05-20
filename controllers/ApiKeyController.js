const ApiKey = require('../models/ApiKey');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { getActiveApiKeyLimit } = require('../middleware/planLimiter');

const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

const hashApiKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

const validateScopes = (scopes) => {
  if (!scopes || scopes.length === 0) return ['*'];
  return Array.isArray(scopes) ? scopes : [scopes];
};

const createApiKey = async (req, res) => {
  try {
    const { name, expiresAt, scopes } = req.body;
    const userId = req.user.id;

    const rawKey = generateApiKey();
    const prefix = rawKey.substring(0, 8);
    const hashedKey = hashApiKey(rawKey);

    const apiKey = await ApiKey.create({
      name,
      userId,
      key: hashedKey,
      prefix,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      scopes: validateScopes(scopes),
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        prefix: apiKey.prefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.created_at
      }
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const listApiKeys = async (req, res) => {
  try {
    const userId = req.user.id;

    const max = await getActiveApiKeyLimit(userId);

    const apiKeys = await ApiKey.findAll({
      where: { userId },
      attributes: ['id', 'name', 'prefix', 'scopes', 'expiresAt', 'isActive', 'lastUsedAt', 'created_at'],
      order: [['created_at', 'ASC']]
    });

    const result = apiKeys.map((key, index) => ({
      ...key.get({ plain: true }),
      isDisabled: max !== Infinity && index >= max
    }));

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('List API keys error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list API keys'
    });
  }
};

const deleteApiKey = async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    await apiKey.destroy();

    return res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete API key'
    });
  }
};

const authenticateWithApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required'
      });
    }

    const hashedKey = hashApiKey(apiKey);
    const apiKeyRecord = await ApiKey.findOne({
      where: {
        key: hashedKey,
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: ['user']
    });

    if (!apiKeyRecord) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired API key'
      });
    }

    await apiKeyRecord.update({ lastUsedAt: new Date() });

    req.apiKey = apiKeyRecord;
    req.user = apiKeyRecord.user;
    next();
  } catch (error) {
    console.error('API key auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const checkApiKeyScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.apiKey.scopes.includes('*') &&
        !req.apiKey.scopes.includes(requiredScope)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient scope. Required: ${requiredScope}`
      });
    }
    next();
  };
};

module.exports = {
  createApiKey,
  listApiKeys,
  deleteApiKey,
  authenticateWithApiKey,
  checkApiKeyScope,
  _internal: {
    generateApiKey,
    hashApiKey,
    validateScopes
  }
};