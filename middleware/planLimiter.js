const VCard = require("../models/Vcard");
const Subscription = require("../models/Subscription");
const Plan = require("../models/Plan");
const Block = require('../models/Block');
const ApiKey = require('../models/ApiKey');
const Project = require('../models/Project');
const Pixel = require('../models/Pixel');

const getCurrentPlan = async (userId) => {
  const activeSubscription = await Subscription.findOne({
    where: { user_id: userId, status: 'active' },
    include: [{ model: Plan, as: 'Plan' }],
  });

  return activeSubscription?.Plan ||
    await Plan.findOne({ where: { name: 'Free', is_active: true } });
};

const parsePlanFeatures = (plan) => {
  try {
    return typeof plan.features === 'string' ?
      JSON.parse(plan.features) :
      (Array.isArray(plan.features) ? plan.features : []);
  } catch (e) {
    console.error('Error parsing features:', e);
    return [];
  }
};

const getResourceLimits = async (userId, resourceConfig) => {
  const plan = await getCurrentPlan(userId);
  if (!plan) throw new Error('Plan not found');

  const features = parsePlanFeatures(plan);
  const resourceFeature = features.find(f =>
    f.toLowerCase().includes(resourceConfig.keyword) &&
    (!resourceConfig.excludeKeyword ||
     !f.toLowerCase().includes(resourceConfig.excludeKeyword))
  );

  let max = resourceConfig.defaultLimit;

  if (resourceFeature?.toLowerCase().includes('unlimited')) {
    max = -1;
  } else if (resourceFeature) {
    const match = resourceFeature.match(/\d+/);
    max = match ? parseInt(match[0], 10) : resourceConfig.defaultLimit;
  }

  let current;
  if (resourceConfig.customCount) {
    current = await resourceConfig.customCount(userId);
  } else {
    current = await resourceConfig.countModel.count({
      where: resourceConfig.query ? { [resourceConfig.query]: userId } : {}
    });
  }

  return { current, max };
};

const checkResourceCreation = (getLimitFunction, resourceName) =>
  async (req, res, next) => {
    try {
      const mockRes = {
        locals: {},
        statusCode: 200,
        status: function(code) { this.statusCode = code; return this; },
        json: (data) => { mockRes.locals.limits = data; }
      };
      console.log(req.user.id);
      await getLimitFunction({ user: { id: req.user.id } }, mockRes);

      if (mockRes.statusCode !== 200) {
        return res.status(mockRes.statusCode).json(mockRes.locals.limits);
      }

      const { current, max } = mockRes.locals.limits;
      if (max !== -1 && current >= max) {
        return res.status(403).json({
          error: `${resourceName} limit reached (${current}/${max})`,
          limitReached: true
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };

const limitConfigs = {
  vcard: {
    keyword: 'vcard',
    excludeKeyword: 'block',
    defaultLimit: 1,
    countModel: VCard,
    query: 'userId'
  },
  project: {
    keyword: 'project',
    defaultLimit: 1,
    countModel: Project,
    query: 'userId'
  },
  block: {
    keyword: 'vcard blocks',
    defaultLimit: 10,
    countModel: Block
  },
  apiKey: {
    keyword: 'api key',
    excludeKeyword: 'unlimited',
    defaultLimit: 1,
    countModel: ApiKey,
    query: 'userId'
  },
  pixel: {
    keyword: 'pixel',
    defaultLimit: 0,
    countModel: Pixel,
    customCount: async (userId) => {
      return await Pixel.count({
        include: [{
          model: VCard,
          as: 'VCard',
          where: { userId },
          attributes: []
        }]
      });
    }
  }
};

const getLimitsHandler = (resourceType) => async (req, res) => {
  try {
    const config = limitConfigs[resourceType];
    const result = await getResourceLimits(req.user.id, config);

    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getActiveResourceLimit = (getLimitFunction, defaultLimit) =>
  async (userId, identifier) => {
    try {
      const mockRes = {
        locals: {},
        statusCode: 200,
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.locals.data = data; }
      };

      await getLimitFunction({
        user: { id: userId },
        query: identifier ? { [identifier.key]: identifier.value } : {}
      }, mockRes);

      if (mockRes.statusCode !== 200 || !mockRes.locals.data) {
        console.warn('Using default limit value');
        return defaultLimit;
      }

      const { max } = mockRes.locals.data;
      return max === -1 ? Infinity : max;
    } catch (error) {
      console.error('Error getting limits:', error);
      return defaultLimit;
    }
  };

module.exports = {
  getVCardLimits: getLimitsHandler('vcard'),
  getProjectLimits: getLimitsHandler('project'),
  getBlocksLimits: getLimitsHandler('block'),
  getApiKeyLimits: getLimitsHandler('apiKey'),
  getPixelLimits: getLimitsHandler('pixel'),

  checkVCardCreation: checkResourceCreation(getLimitsHandler('vcard'), 'VCard'),
  checkProjectCreation: checkResourceCreation(getLimitsHandler('project'), 'Project'),
  checkBlockCreation: checkResourceCreation(getLimitsHandler('block'), 'Block'),
  checkApiKeyCreation: checkResourceCreation(getLimitsHandler('apiKey'), 'API Key'),
  checkPixelCreation: checkResourceCreation(getLimitsHandler('pixel'), 'Pixel'),

  getActiveVCardLimit: getActiveResourceLimit(getLimitsHandler('vcard'), 1),
  getActiveBlockLimit: getActiveResourceLimit(getLimitsHandler('block'), 10),
  getActiveApiKeyLimit: getActiveResourceLimit(getLimitsHandler('apiKey'), 1),
  getActivePixelLimit: getActiveResourceLimit(getLimitsHandler('pixel'), 0),
  get2FAAccess: async (req, res) => {
    try {
      const plan = await getCurrentPlan(req.user.id);
      const has2FA = parsePlanFeatures(plan).some(f =>
        f.toLowerCase().includes('password protection') ||
        f.toLowerCase().includes('2fa')
      );
      res.json({ has2FA });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        error: 'Server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};