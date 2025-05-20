const { Op } = require('sequelize');
const axios = require('axios');
const UAParser = require('ua-parser-js');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const os = require('os'); // Module intégré pour obtenir des informations sur le système

// Fonction pour récupérer l'adresse IP externe de la machine
const getPublicIp = async () => {
  try {
    // Utiliser un service qui renvoie votre IP publique
    const response = await axios.get('https://api.ipify.org?format=json', {
      timeout: 3000
    });
    return response.data.ip;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'IP publique:', error.message);
    // Fallback - essayer une autre API
    try {
      const backupResponse = await axios.get('https://api.ip.sb/ip', {
        timeout: 3000
      });
      return backupResponse.data.trim();
    } catch (fallbackError) {
      console.error('Erreur avec l\'API de fallback:', fallbackError.message);
      return null;
    }
  }
};

const getLocationInfo = async (ipAddress) => {
  try {
    // Si adresse locale, récupérer l'IP publique de la machine
    if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
      const publicIp = await getPublicIp();
      
      if (publicIp) {
        // Utiliser l'IP publique pour obtenir les informations de localisation
        const response = await axios.get(`http://ip-api.com/json/${publicIp}?fields=status,country,city,query`, {
          timeout: 5000
        });
        
        if (response.data && response.data.status === 'success') {
          return {
            country: response.data.country,
            city: response.data.city,
            ip: publicIp // Stocker l'IP publique
          };
        }
      }
      
      // Si impossible d'obtenir l'IP publique ou les infos de localisation
      return { 
        country: 'Localhost', 
        city: 'Local',
        ip: ipAddress 
      };
    }
    
    const cleanIp = ipAddress.split(',')[0].trim();

    const response = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=status,country,city,query`, {
      timeout: 5000
    });
    
    if (response.data && response.data.status === 'success') {
      return {
        country: response.data.country,
        city: response.data.city,
        ip: response.data.query || cleanIp 
      };
    }
    
    return {
      country: 'Unknown',
      city: 'Unknown',
      ip: cleanIp
    };
  } catch (error) {
    console.error('Error getting location info:', error.message);
    return {
      country: 'Unknown',
      city: 'Unknown',
      ip: ipAddress
    };
  }
};

const parseUserAgent = (userAgent) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    deviceType: result.device.type || 'desktop',
    os: result.os.name || 'Unknown',
    browser: result.browser.name || 'Unknown'
  };
};

const logActivity = async (userId, activityType, req = {}) => {
  try {
    const rawIp = req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress || 
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);

    if (!rawIp) {
      console.error('No IP address detected');
      return false;
    }

    let cleanedIp = rawIp.split(',')[0].trim();
    
    if (cleanedIp === '::1') {
      cleanedIp = '127.0.0.1';
    }
    
    if (cleanedIp.includes('::ffff:')) {
      cleanedIp = cleanedIp.replace('::ffff:', '');
    }

    const locationInfo = await getLocationInfo(cleanedIp);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceInfo = parseUserAgent(userAgent);

    const logData = {
      userId,
      activityType,
      ipAddress: locationInfo.ip || cleanedIp, 
      userAgent,
      country: locationInfo.country,
      city: locationInfo.city,
      deviceType: deviceInfo.deviceType,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
    };

    await ActivityLog.create(logData);
    return true;
  } catch (error) {
    console.error('Error logging activity:', error);
    return false;
  }
};

const getUserActivities = async (req, res) => {
  try {
    const userId = req.user.isAdmin && req.query.userId 
      ? req.query.userId 
      : req.user.id;
    
    const { 
      limit = 20, 
      offset = 0, 
      type, 
      days, 
      deviceType,
      browser 
    } = req.query;
    
    const where = { userId };
    
    if (type) where.activityType = type;
    if (days) where.created_at = { [Op.gte]: new Date(new Date() - days * 24 * 60 * 60 * 1000) };
    if (deviceType) where.deviceType = deviceType;
    if (browser) where.browser = browser;
    
    const { count, rows: activities } = await ActivityLog.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: formatActivityLogs(activities),
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting user activities:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

const getFailedAttempts = async (req, res) => {
  try {
    const userId = req.user.id;
    const hours = parseInt(req.query.hours) || 1;
    
    const count = await ActivityLog.count({
      where: {
        userId,
        activityType: 'login_failed',
        created_at: {
          [Op.gte]: new Date(new Date() - hours * 60 * 60 * 1000)
        }
      }
    });
    
    res.json({
      success: true,
      count,
      hours
    });
  } catch (error) {
    console.error('Error getting failed attempts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

const getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    
    const activities = await ActivityLog.findAll({
      where: { userId },
      limit,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'activityType', 'created_at']
    });
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error getting recent activities:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

const getActivityDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const activity = await ActivityLog.findOne({
      where: { id, userId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });
    
    if (!activity) {
      return res.status(404).json({ 
        success: false,
        message: 'Activity not found' 
      });
    }
    
    res.json({
      success: true,
      data: formatActivityLogs([activity])[0]
    });
  } catch (error) {
    console.error('Error getting activity details:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

const formatActivityLogs = (logs) => {
  return logs.map(log => ({
    id: log.id,
    activityType: log.activityType,
    ipAddress: log.ipAddress,
    location: log.city ? `${log.city}, ${log.country}` : 'Unknown',
    device: `${log.deviceType} (${log.os}, ${log.browser})`,
    createdAt: log.created_at,
    user: log.user ? {
      id: log.user.id,
      name: log.user.name,
      email: log.user.email
    } : null,
  }));
};

module.exports = {
  logActivity,
  getUserActivities,
  getFailedAttempts,
  getRecentActivities,
  getActivityDetails
};