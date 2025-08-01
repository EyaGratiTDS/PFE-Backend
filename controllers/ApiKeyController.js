const ApiKey = require('../models/ApiKey');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { getActiveApiKeyLimit } = require('../middleware/planLimiter');
const db = require('../models');
const User = require('../models/User');

const CRYPTO_CONFIG = {
  keyLength: 32,
  encoding: 'hex',
  hashAlgorithm: 'sha256'
};

const RESPONSE_MESSAGES = {
  created: 'API key created successfully',
  notFound: 'API key not found',
  deleted: 'API key deleted successfully',
  authRequired: 'API key is required',
  invalidKey: 'Invalid or expired API key',
  insufficientScope: 'Insufficient scope. Required:'
};

const generateSecureKey = () => crypto.randomBytes(CRYPTO_CONFIG.keyLength).toString(CRYPTO_CONFIG.encoding);
const hashKey = key => crypto.createHash(CRYPTO_CONFIG.hashAlgorithm).update(key).digest(CRYPTO_CONFIG.encoding);
const normalizeScopes = scopes => (scopes?.length ? [].concat(scopes) : ['*']);

const handleResponse = (res, status, data) => res.status(status).json({ success: status < 400, ...data });
const handleError = (res, context, error) => {
  return handleResponse(res, 500, {
    message: `Failed to ${context}`,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

const createApiKey = async (req, res) => {
  try {
    const { name, expiresAt, scopes } = req.body;
    const rawKey = generateSecureKey();
    
    const apiKey = await ApiKey.create({
      name,
      userId: req.user.id,
      key: hashKey(rawKey),
      prefix: rawKey.slice(0, 8),
      expiresAt: expiresAt && new Date(expiresAt),
      scopes: normalizeScopes(scopes),
      isActive: true
    });

    return handleResponse(res, 201, {
      message: RESPONSE_MESSAGES.created,
      data: {
        ...apiKey.get({ plain: true }),
        key: rawKey,
        createdAt: apiKey.created_at
      }
    });
  } catch (error) {
    return handleError(res, 'create API key', error);
  }
};

const listApiKeys = async (req, res) => {
  try {
    const maxLimit = await getActiveApiKeyLimit(req.user.id);
    const apiKeys = await ApiKey.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'name', 'prefix', 'scopes', 'expiresAt', 'isActive', 'lastUsedAt', 'created_at'],
      order: [['created_at', 'ASC']]
    });

    const sortedKeys = [...apiKeys].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const result = sortedKeys.map((key, index) => ({
      ...key.get({ plain: true }),
      isDisabled: maxLimit !== Infinity && index >= maxLimit
    }));

    return handleResponse(res, 200, { data: result });
  } catch (error) {
    return handleError(res, 'list API keys', error);
  }
};

const deleteApiKey = async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({ 
      where: { id: req.params.id, userId: req.user.id } 
    });

    if (!apiKey) return handleResponse(res, 404, { message: RESPONSE_MESSAGES.notFound });

    await apiKey.destroy();
    return handleResponse(res, 200, { message: RESPONSE_MESSAGES.deleted });
  } catch (error) {
    return handleError(res, 'delete API key', error);
  }
};

const authenticateWithApiKey = async (req, _, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return next({ status: 401, message: RESPONSE_MESSAGES.authRequired });

    const apiKeyRecord = await ApiKey.findOne({
      where: {
        key: hashKey(apiKey),
        isActive: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      },
      include: { association: 'user', attributes: ['id', 'email', 'role'] }
    });

    if (!apiKeyRecord) return next({ status: 403, message: RESPONSE_MESSAGES.invalidKey });

    await apiKeyRecord.update({ lastUsedAt: new Date() });
    req.apiKey = apiKeyRecord;
    req.user = apiKeyRecord.user;
    next();
  } catch (error) {
    next({ status: 500, message: 'Authentication error', error });
  }
};

const checkApiKeyScope = requiredScope => (req, res, next) => {
  const { scopes } = req.apiKey;
  if (!scopes.includes('*') && !scopes.includes(requiredScope)) {
    return handleResponse(res, 403, {
      message: `${RESPONSE_MESSAGES.insufficientScope} ${requiredScope}`
    });
  }
  next();
};

const listAllApiKeys = async (req, res) => {
  try {
    const apikeys = await ApiKey.findAll({
      include: [
        {
          model: User,
          as: 'Users',  
          attributes: ['id', 'name', 'email'] 
        }
      ],
      order: [['created_at', 'DESC']] 
    });
    res.json({
      success: true,
      count: apikeys.length,
      data: apikeys
    });
  } catch (error) {
    console.error('Error retrieving apikeys with users:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const toggleApiKeyStatus = async (req, res) => {
  try {
    const apiKey = await ApiKey.findByPk(req.params.id);
    
    if (!apiKey) {
      return handleResponse(res, 404, { message: RESPONSE_MESSAGES.notFound });
    }

    await apiKey.update({ isActive: !apiKey.isActive });

    return handleResponse(res, 200, { 
      message: `API key ${apiKey.isActive ? 'enabled' : 'disabled'} successfully`,
      data: { isActive: apiKey.isActive }
    });
  } catch (error) {
    return handleError(res, 'toggle API key status', error);
  }
};

const errorHandler = (err, _, res, __) => {
  const status = err.status || 500;
  return handleResponse(res, status, {
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
};

module.exports = {
  createApiKey,
  listApiKeys,
  deleteApiKey,
  authenticateWithApiKey,
  checkApiKeyScope,
  errorHandler,
  listAllApiKeys,
  toggleApiKeyStatus,
  hashKey,
  _internal: { generateSecureKey, hashKey, normalizeScopes }
};