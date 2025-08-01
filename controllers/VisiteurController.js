const axios = require('axios');
const { Op } = require('sequelize');
const UAParser = require('ua-parser-js');
const sequelize = require('../database/sequelize'); 
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
      if (process.env.NODE_ENV !== 'test') {
        console.error(`API request failed for ${url}:`, error.message)
      };
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

const getClientIp = (req) => {
  const rawIp = ['x-forwarded-for', 'x-real-ip']
    .map(header => req.headers[header])
    .find(Boolean) || req.socket?.remoteAddress;
  return cleanIpAddress(rawIp);
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
    return { country: 'Unknown', city: 'Unknown', ip };
  }
};

const parseUserAgent = (uaHeader) => {
  const parser = new UAParser(uaHeader);
  const { browser, os } = parser.getResult();
  return {
    browser: browser.name || 'Unknown',
    os: os.name || 'Unknown',
    deviceType: parser.getDevice().type || 'desktop'
  };
};

exports.trackVisitor = async (req, res) => {
  try {
    const rawIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const language = req.headers['accept-language']?.split(',')[0] || 'en-US';
    
    const entryTime = req.body.entryTime ? new Date(req.body.entryTime) : new Date();

    const locationData = await getLocationData(rawIp);
    const location = locationData.city !== 'Unknown' 
      ? `${locationData.city}, ${locationData.country}` 
      : 'Unknown';

    const { browser, os, deviceType } = parseUserAgent(userAgent);

    const existingVisitor = await User.findOne({
      where: { 
        ipAddress: locationData.ip,
        role: 'user'
      },
      order: [['lastVisit', 'DESC']] 
    });

    let visitor;
    if (existingVisitor) {
      existingVisitor.visitCount += 1;
      existingVisitor.lastVisit = new Date(); 
      
      if (!existingVisitor.entryTime) {
        existingVisitor.entryTime = entryTime;
      }
      
      existingVisitor.location = location; 
      existingVisitor.language = language;
      existingVisitor.browser = browser;
      existingVisitor.os = os;
      existingVisitor.deviceType = deviceType;
      
      await existingVisitor.save();
      visitor = existingVisitor;
    } else {
      visitor = await User.create({
        role: 'user',
        ipAddress: locationData.ip,
        location,
        language,
        browser,
        os,
        deviceType,
        entryTime,
        lastVisit: new Date(),
        visitCount: 1
      });
    }

    res.json({ visitorId: visitor.id });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.trackVisitorExit = async (req, res) => {
  try {
    const { visitorId } = req.body;
    const exitTime = new Date();
    
    const visitor = await User.findByPk(visitorId);
    if (!visitor || visitor.role !== 'user') {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    if (visitor.entryTime) {
      const entry = new Date(visitor.entryTime);
      const duration = Math.floor((exitTime - entry) / 1000); 
      visitor.duration = duration;
    }
    
    visitor.exitTime = exitTime;
    await visitor.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAudienceStats = async (req, res) => {
  try {
    const totalVisitors = await User.count({ 
      where: { 
        role: 'user'
      } 
    });
    
    const totalVisits = await User.sum('visitCount', { 
      where: { 
        role: 'user'
      } 
    });
    
    const avgDuration = await User.findOne({
      where: { 
        role: 'user',
        duration: { [Op.ne]: null }
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('duration')), 'avgDuration']
      ],
      raw: true
    });

    res.json({
      totalVisitors,
      totalVisits: totalVisits || 0,
      avgDuration: avgDuration?.avgDuration || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getVisitorDetails = async (req, res) => {
  try {
    const { visitorId } = req.params;
    
    const visitor = await User.findByPk(visitorId, {
      attributes: [
        'id',
        'ipAddress',
        'location',
        'language',
        'browser',
        'os',
        'deviceType',
        'entryTime',
        'exitTime',
        'duration',
        'visitCount',
        'lastVisit'
      ]
    });

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    res.json({
      success: true,
      data: {
        ...visitor.get({ plain: true }),
        isActive: !visitor.exitTime
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};