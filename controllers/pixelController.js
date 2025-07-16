const { VCard, Pixel, EventTracking } = require('../models');
const { getClientIp } = require('request-ip');
const axios = require('axios'); 
const UAParser = require('ua-parser-js');
const User = require('../models/User');

const parseUserAgent = (uaHeader) => {
  if (!uaHeader) return { deviceType: 'Unknown', os: 'Unknown', browser: 'Unknown' };
  
  const parser = new UAParser(uaHeader);
  const result = parser.getResult();
  
  return {
    deviceType: result.device.type || 'desktop',
    os: result.os.name || 'Unknown',
    browser: result.browser.name || 'Unknown'
  };
};

const cleanIpAddress = (rawIp) => {
  if (!rawIp) return null;
  
  if (rawIp === '::1') return '127.0.0.1';
  
  return rawIp.split(',')[0].trim().replace('::ffff:', '');
};

const getPublicIp = async () => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 2000 });
    return response.data.ip;
  } catch (error) {
    console.error('Failed to get public IP:', error.message);
    return null;
  }
};

const getLocationData = async (ip) => {
  if (ip === '127.0.0.1') {
    const publicIp = await getPublicIp();
    ip = publicIp || ip;
  }

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
    const data = response.data;
    
    return data.status === 'success' ? {
      country: data.countryCode,
      region: data.regionName,
      city: data.city,
      ip: data.query
    } : {
      country: null,
      region: null,
      city: null,
      ip
    };
  } catch (error) {
    console.error(error.message);
    return { 
      country: null, 
      region: null, 
      city: null, 
      ip 
    };
  }
};

const normalizeLanguage = (acceptLanguage) => {
  if (!acceptLanguage) return null;
  return acceptLanguage.split(',')[0].split(';')[0].trim();
};

const mapToMetaEvent = (eventType) => {
  const mapping = {
    'view': 'ViewContent',
    'click': 'CustomizeProduct',
    'download': 'Lead',
    'share': 'Share',
    'heartbeat': 'Heartbeat',
    'mouse_move': 'MouseMovement',
    'scroll': 'Scroll',
    'hover': 'Hover',
    'suspicious_activity': 'SuspiciousActivity',
    'preference_updated': 'PreferenceUpdated',
    'attention_event': 'AttentionEvent'
  };
  return mapping[eventType] || 'CustomEvent';
};

const createMetaPixel = async (accessToken, accountId, name) => {
  try {
    const url = `${process.env.META_API_URL}/${process.env.META_API_VERSION}/${accountId}/adspixels`;
    const response = await axios.post(url, {
      name,
      access_token: accessToken
    });
    return response.data.id;
  } catch (error) {
    console.error('Meta Pixel creation error:', error.response?.data || error.message);
    return null;
  }
};

const createPixel = async (req, res) => {
  try {
    const { vcardId, name, userId, metaAccessToken, metaAccountId } = req.body;
    
    const vcard = await VCard.findOne({ where: { id: vcardId, userId } });
    if (!vcard) {
      return res.status(404).json({ 
        success: false,
        message: "VCard not found or unauthorized" 
      });
    }

    const existingPixel = await Pixel.findOne({ where: { vcardId } });
    if (existingPixel) {
      return res.status(409).json({
        success: false,
        message: "A pixel already exists for this vCard"
      });
    }

    let metaPixelId = null;
    if (metaAccessToken && metaAccountId) {
      metaPixelId = await createMetaPixel(
        metaAccessToken,
        metaAccountId,
        name || `Pixel-${vcard.name}`
      );
    }

    const pixel = await Pixel.create({
      name: name || `Pixel - ${vcard.name}`,
      vcardId,
      metaPixelId,
      is_active: true
    });

    res.status(201).json({
      success: true,
      pixel: {
        id: pixel.id,
        name: pixel.name,
        trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
        metaPixelId,
        vcardId: pixel.vcardId,
        is_active: pixel.is_active
      }
    });

  } catch (error) {
    console.error("Pixel creation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const updatePixel = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const { name, is_active, metaAccessToken } = req.body;

    const pixel = await Pixel.findByPk(pixelId, {
      include: [{ model: VCard, as: "VCard" }]
    });

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found"
      });
    }

    if (pixel.metaPixelId && metaAccessToken) {
      try {
        const url = `${process.env.META_API_URL}/${pixel.metaPixelId}`;
        await axios.post(url, {
          name: name || pixel.name,
          access_token: metaAccessToken
        });
      } catch (error) {
        console.error("Meta Pixel update error:", error.response?.data || error.message);
      }
    }

    await pixel.update({
      name: name || pixel.name,
      is_active: typeof is_active === 'boolean' ? is_active : pixel.is_active
    });

    res.json({
      success: true,
      pixel: {
        id: pixel.id,
        name: pixel.name,
        metaPixelId: pixel.metaPixelId,
        is_active: pixel.is_active
      }
    });

  } catch (error) {
    console.error("Pixel update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const deletePixel = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const pixel = await Pixel.findByPk(pixelId);

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found"
      });
    }

    if (pixel.metaPixelId && process.env.META_SYSTEM_ACCESS_TOKEN) {
      try {
        const url = `${process.env.META_API_URL}/${pixel.metaPixelId}`;
        await axios.delete(url, {
          params: { access_token: process.env.META_SYSTEM_ACCESS_TOKEN }
        });
      } catch (error) {
        console.error("Meta Pixel deletion error:", error.response?.data || error.message);
      }
    }

    await pixel.destroy();
    res.json({ success: true, message: "Pixel deleted" });

  } catch (error) {
    console.error("Pixel deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const getUserPixels = async (req, res) => {
  try {
    const { userId } = req.query;
    const pixels = await Pixel.findAll({
      include: [{
        model: VCard,
        as: "VCard",
        where: { 
          userId,
          is_active: true  
        },
        attributes: ['id', 'name', 'is_active', 'status']
      }]
    });

    res.json({
      success: true,
      pixels: pixels.map(p => ({
        id: p.id,
        name: p.name,
        vcard: p.VCard,
        metaPixelId: p.metaPixelId,
        is_active: p.is_active,
        created_at: p.created_at
      }))
    });

  } catch (error) {
    console.error("Pixel recovery error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const getPixelById = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const pixel = await Pixel.findByPk(pixelId, {
      include: [{ model: VCard, as: "VCard" }]
    });

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found"
      });
    }

    res.json({
      success: true,
      data: {
        id: pixel.id,
        name: pixel.name,
        metaPixelId: pixel.metaPixelId,
        is_active: pixel.is_active,
        trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
        vcard: {
          id: pixel.VCard.id,
          name: pixel.VCard.name
        },
        created_at: pixel.created_at
      }
    });

  } catch (error) {
    console.error("Get pixel error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const trackEvent = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const data = req.body;
    
    const { 
      eventType = 'view', 
      blockId, 
      duration, 
      metadata,
      value,
      currency
    } = data;

    const pixel = await Pixel.findByPk(pixelId);
    if (!pixel || !pixel.is_active) {
      return sendPixelResponse(res);
    }

    let clientIp = getClientIp(req);
    clientIp = cleanIpAddress(clientIp);

    const locationData = await getLocationData(clientIp);
    
    const userAgent = req.headers['user-agent'] || '';
    const userAgentInfo = parseUserAgent(userAgent);
    
    const acceptLanguage = req.headers['accept-language'] || '';
    const primaryLanguage = normalizeLanguage(acceptLanguage);

    let metaData = {};
    if (metadata) {
      try {
        metaData = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch (e) {
        console.error("Metadata parsing error:", e);
      }
    }

    const event = await EventTracking.create({
      eventType,
      metadata: metaData,
      duration,
      blockId,
      pixelId: pixel.id,
      userAgent,
      ipAddress: locationData.ip || clientIp,
      country: locationData.country,
      region: locationData.region,
      city: locationData.city,
      deviceType: userAgentInfo.deviceType,
      os: userAgentInfo.os,
      browser: userAgentInfo.browser,
      language: primaryLanguage,
      source: 'internal_tracking'
    });

    if (pixel.metaPixelId && process.env.META_SYSTEM_ACCESS_TOKEN) {
      const eventData = {
        event_name: mapToMetaEvent(eventType),
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: userAgent
        },
        custom_data: {
          ...metaData,
          event_id: event.id,
          vcard_id: pixel.vcardId
        }
      };

      if (value && currency) {
        eventData.custom_data.value = value;
        eventData.custom_data.currency = currency;
      }

      try {
        const url = `${process.env.META_API_URL}/${pixel.metaPixelId}/events`;
        await axios.post(url, {
          data: [eventData],
          access_token: process.env.META_SYSTEM_ACCESS_TOKEN
        });
      } catch (error) {
        console.error("Meta Pixel tracking error:", error.response?.data || error.message);
      }
    }

    sendPixelResponse(res);

  } catch (error) {
    console.error("Event tracking error:", error);
    sendPixelResponse(res);
  }
};

const sendPixelResponse = (res) => {
  const pixel = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(pixel);
};

const getPixelsByVCard = async (req, res) => {
  try {
    const { vcardId } = req.params;
    const userId = req.user.id;
    
    const vcard = await VCard.findOne({ where: { id: vcardId, userId } });
    if (!vcard) {
      return res.status(404).json({ 
        success: false,
        message: "VCard not found or unauthorized" 
      });
    }

    const pixels = await Pixel.findAll({ 
      where: { 
        vcardId,
        is_active: true 
      }
    });

    res.json({ 
      success: true, 
      pixels: pixels.map(p => ({
        id: p.id,
        name: p.name,
        is_active: p.is_active,
        created_at: p.created_at,
        trackingUrl: `${process.env.API_URL}/pixels/${p.id}/track`,
      }))
    });
  } catch (error) {
    console.error("Get pixels by vCard error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const getPixels = async (req, res) => {
  try {
    const pixels = await Pixel.findAll({
      include: [
        {
          model: VCard,
          as: 'VCard',
          attributes: ['id', 'name', 'url'],
          include: [
            {
              model: User, 
              as: 'Users',  
              attributes: ['id', 'name', 'email']
            }
          ]
        }
      ],
      attributes: [
        'id',
        'name',
        'metaPixelId',
        'is_active',
        'is_blocked',
        'created_at'
      ]
    });

    const formattedPixels = pixels.map(pixel => ({
      id: pixel.id,
      name: pixel.name,
      metaPixelId: pixel.metaPixelId,
      is_active: pixel.is_active,
      is_blocked: pixel.is_blocked,
      created_at: pixel.created_at,
      vcard: pixel.VCard ? {
        id: pixel.VCard.id,
        name: pixel.VCard.name,
        url: pixel.VCard.url, 
        user: {
          id: pixel.VCard.Users.id,  
          name: pixel.VCard.Users.name,
          email: pixel.VCard.Users.email
        }
      } : null 
    }));

    res.status(200).json({
      success: true,
      data: formattedPixels
    });
  } catch (error) {
    console.error("Error fetching pixels:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const toggleBlocked = async (req, res) => {
  try {
    const { id  } = req.params;
    const pixel = await Pixel.findByPk(id);

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found"
      });
    }

    await pixel.update({ 
      is_blocked: !pixel.is_blocked 
    });

    res.json({
      success: true,
      data: {
        id: pixel.id,
        name: pixel.name,
        is_blocked: pixel.is_blocked,
        message: `Pixel ${pixel.is_blocked ? 'blocked' : 'unblocked'} successfully`
      }
    });

  } catch (error) {
    console.error("Pixel toggle blocked error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

module.exports = {
  createPixel,
  updatePixel,
  deletePixel,
  getUserPixels,
  getPixelById,
  trackEvent,
  getPixelsByVCard,
  getPixels,
  toggleBlocked
};