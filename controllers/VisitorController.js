const axios = require('axios');
const { Op } = require('sequelize');
const User = require('../models/User');

const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.connection?.socket?.remoteAddress;
};

exports.trackVisitor = async (req, res) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const language = req.headers['accept-language']?.split(',')[0] || 'en-US';
    const entryTime = new Date();

    let location = 'Unknown';
    try {
      const response = await axios.get(`https://ipapi.co/${ip}/json/`);
      if (response.data.city && response.data.country_name) {
        location = `${response.data.city}, ${response.data.country_name}`;
      }
    } catch (error) {
      console.error('Location API error:', error.message);
    }

    let browser = 'Unknown';
    let os = 'Unknown';
    
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

    const visitor = await User.create({
      role: 'user',
      ipAddress: ip,
      location,
      language,
      browser,
      os,
      entryTime,
      visitCount: 1,
      lastVisit: entryTime
    });

    res.json({ visitorId: visitor.id });
  } catch (error) {
    console.error('Tracking error:', error);
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

    visitor.exitTime = exitTime;
    
    if (visitor.entryTime) {
      const entryTime = new Date(visitor.entryTime);
      const duration = Math.floor((exitTime - entryTime) / 1000);
      visitor.duration = duration;
    }
    
    await visitor.save();
    res.json({ success: true, duration: visitor.duration });
  } catch (error) {
    console.error('Exit tracking error:', error);
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
      totalVisits,
      avgDuration: avgDuration?.avgDuration || 0
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};