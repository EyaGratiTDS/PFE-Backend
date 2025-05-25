const { Op } = require('sequelize');
const axios = require('axios');
const UAParser = require('ua-parser-js');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const IP_API_PROVIDERS = [
  'https://api.ipify.org?format=json',
  'https://api.ip.sb/ip'
];

const IP_GEOLOCATION_API = 'http://ip-api.com/json/{ip}?fields=status,country,city,query';

const fetchWithFallback = async (urls, options) => {
  for (const url of urls) {
    try {
      const response = await axios.get(url, options);
      return url.includes('ipify') ? response.data.ip : response.data.trim();
    } catch (error) {
      console.error(`API request failed for ${url}:`, error.message);
    }
  }
  return null;
};

const cleanIpAddress = (rawIp) => {
  if (!rawIp) return null;

  return rawIp
    .split(',')[0]
    .trim()
    .replace('::ffff:', '')
    .replace('::1', '127.0.0.1');
};

const getLocationData = async (ip) => {
  if (!ip || ip === '127.0.0.1') {
    const publicIp = await fetchWithFallback(IP_API_PROVIDERS, { timeout: 3000 });
    ip = publicIp || ip;
  }

  try {
    const { data } = await axios.get(
      IP_GEOLOCATION_API.replace('{ip}', ip),
      { timeout: 5000 }
    );

    return data?.status === 'success' ? {
      country: data.country,
      city: data.city,
      ip: data.query || ip
    } : {
      country: 'Unknown',
      city: 'Unknown',
      ip
    };
  } catch (error) {
    console.error('Geolocation API error:', error.message);
    return { country: 'Unknown', city: 'Unknown', ip };
  }
};

const parseUserAgent = (uaHeader) => {
  const { device, os, browser } = new UAParser(uaHeader).getResult();
  return {
    deviceType: device.type || 'desktop',
    os: os.name || 'Unknown',
    browser: browser.name || 'Unknown'
  };
};

const logActivity = async (userId, activityType, req = {}) => {
  try {
    const rawIp = ['x-forwarded-for', 'x-real-ip']
      .map(header => req.headers[header])
      .find(Boolean) || req.socket?.remoteAddress;

    const ipAddress = cleanIpAddress(rawIp);
    if (!ipAddress) {
      console.error('No valid IP detected');
      return false;
    }

    const [locationInfo, userAgentInfo] = await Promise.all([
      getLocationData(ipAddress),
      parseUserAgent(req.headers['user-agent'] || 'Unknown')
    ]);

    await ActivityLog.create({
      userId,
      activityType,
      ipAddress: locationInfo.ip,
      ...locationInfo,
      ...userAgentInfo,
      userAgent: req.headers['user-agent']
    });

    return true;
  } catch (error) {
    console.error('Activity logging failed:', error);
    return false;
  }
};

const buildWhereClause = (userId, query) => {
  const { type, days, deviceType, browser } = query;
  const where = { userId };

  if (type) where.activityType = type;
  if (days) where.created_at = { [Op.gte]: new Date(Date.now() - days * 86400000) };
  if (deviceType) where.deviceType = deviceType;
  if (browser) where.browser = browser;

  return where;
};

const handleActivityResponse = (res, data) => res.json({ success: true, ...data });

const handleActivityError = (res, context) => (error) => {
  console.error(`Activity error (${context}):`, error);
  res.status(500).json({ success: false, message: 'Internal server error' });
};

const getUserActivities = async (req, res) => {
  try {
    const userId = req.user.isAdmin && req.query.userId ? req.query.userId : req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const { count, rows } = await ActivityLog.findAndCountAll({
      where: buildWhereClause(userId, req.query),
      limit: Number(limit),
      offset: Number(offset),
      order: [['created_at', 'DESC']]
    });

    handleActivityResponse(res, {
      data: formatActivityLogs(rows),
      total: count,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    handleActivityError(res, 'fetch activities')(error);
  }
};

const getFailedAttempts = async (req, res) => {
  try {
    const count = await ActivityLog.count({
      where: {
        userId: req.user.id,
        activityType: 'login_failed',
        created_at: { [Op.gte]: new Date(Date.now() - (req.query.hours || 1) * 3600000) }
      }
    });

    handleActivityResponse(res, { count });
  } catch (error) {
    handleActivityError(res, 'fetch failed attempts')(error);
  }
};

const getRecentActivities = async (req, res) => {
  try {
    const activities = await ActivityLog.findAll({
      where: { userId: req.user.id },
      limit: Math.min(Number(req.query.limit) || 5, 100),
      order: [['created_at', 'DESC']],
      attributes: ['id', 'activityType', 'created_at']
    });

    handleActivityResponse(res, { data: activities });
  } catch (error) {
    handleActivityError(res, 'fetch recent activities')(error);
  }
};

const getActivityDetails = async (req, res) => {
  try {
    const activity = await ActivityLog.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });

    activity
      ? handleActivityResponse(res, { data: formatActivityLogs([activity])[0] })
      : res.status(404).json({ success: false, message: 'Activity not found' });
  } catch (error) {
    handleActivityError(res, 'fetch activity details')(error);
  }
};

const formatActivityLogs = (logs) => logs.map(({
  id,
  activityType,
  ipAddress,
  city,
  country,
  deviceType,
  os,
  browser,
  created_at,
  user
}) => ({
  id,
  activityType,
  ipAddress,
  location: city ? `${city}, ${country}` : 'Unknown',
  device: `${deviceType} (${os}, ${browser})`,
  createdAt: created_at,
  user: user ? { id: user.id, name: user.name, email: user.email } : null
}));

module.exports = {
  logActivity,
  getUserActivities,
  getFailedAttempts,
  getRecentActivities,
  getActivityDetails,
  formatActivityLogs
};