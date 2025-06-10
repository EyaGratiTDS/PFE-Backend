const { VCard, Pixel, EventTracking } = require('../models');
const { getClientIp } = require('request-ip');
const axios = require('axios');
const UAParser = require('ua-parser-js');
const { encryptToken, decryptToken } = require('../services/cryptoUtils');

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
  if (ip === '127.0.0.1' || ip === '::1') {
    const publicIp = await getPublicIp();
    ip = publicIp || ip;
  }

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
    const data = response.data;
    return data.status === 'success'
      ? {
          country: data.countryCode?.substring(0, 2) || null,
          region: data.regionName?.substring(0, 100) || null,
          city: data.city?.substring(0, 100) || null,
          ip: data.query
        }
      : { country: null, region: null, city: null, ip };
  } catch (error) {
    console.error('Geolocation API error:', error.message);
    return { country: null, region: null, city: null, ip };
  }
};

const normalizeLanguage = (acceptLanguage) => {
  if (!acceptLanguage) return null;
  return acceptLanguage.split(',')[0].split(';')[0].trim();
};

const mapToMetaEvent = (eventType) => {
  const mapping = {
    view: 'ViewContent',
    click: 'CustomizeProduct',
    download: 'Lead',
    share: 'Share',
    heartbeat: 'Heartbeat',
    mouse_move: 'MouseMovement',
    scroll: 'Scroll',
    hover: 'Hover',
    suspicious_activity: 'SuspiciousActivity',
    preference_updated: 'PreferenceUpdated',
    attention_event: 'AttentionEvent'
  };
  return mapping[eventType] || 'CustomEvent';
};

// Fonction pour valider les credentials Meta
const validateMetaCredentials = async (accessToken, accountId) => {
  try {
    if (!accessToken || !accountId) {
      return false;
    }

    // Vérifier que le token a le bon format
    if (!/^EAA[A-Za-z0-9_-]+$/.test(accessToken)) {
      console.error('Invalid Meta access token format');
      return false;
    }

    // Vérifier que l'account ID est numérique
    if (!/^\d+$/.test(accountId)) {
      console.error('Invalid Meta account ID format');
      return false;
    }
    // Tester l'accès à l'API Meta
    const url = `${process.env.META_API_URL}/${process.env.META_API_VERSION}/${accountId}`;
    const response = await axios.get(url, {
      params: {
        access_token: accessToken,
        fields: 'id,name'
      },
      timeout: 5000
    });

    return response.status === 200 && response.data.id;
  } catch (error) {
    console.error('Meta credentials validation failed:', error.response?.data || error.message);
    return false;
  }
};

const createMetaPixel = async (accessToken, accountId, name) => {
  try {
    if (!process.env.META_API_URL || !process.env.META_API_VERSION) {
      console.error('Meta API configuration missing');
      return null;
    }

    // Validation préalable des credentials
    const isValid = await validateMetaCredentials(accessToken, accountId);
    if (!isValid) {
      console.error('Invalid Meta credentials');
      return null;
    }
    console.log("ici");
    // Format correct pour l'API Meta Business
    const url = `${process.env.META_API_URL}/${process.env.META_API_VERSION}/${accountId}/adspixels`;
    const response = await axios.post(url,
      `name=${encodeURIComponent(name)}&access_token=${accessToken}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );
    return response.data.id;
  } catch (error) {
    console.error('Meta Pixel creation error:', error.response?.data || error.message);
    return null;
  }
};

const createPixel = async (req, res) => {
  try {
    const { vcardId, name, metaAccessToken, metaAccountId } = req.body;
    const userId = req.user.id; // Récupération depuis l'authentification

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User identification missing"
      });
    }

    const vcard = await VCard.findOne({
      where: { id: vcardId, userId }
    });
    
    if (!vcard) {
      return res.status(404).json({
        success: false,
        message: 'VCard not found or unauthorized'
      });
    }

    const existingPixel = await Pixel.findOne({ where: { vcardId } });
    if (existingPixel) {
      return res.status(409).json({
        success: false,
        message: 'A pixel already exists for this vCard'
      });
    }

    let metaPixelId = null;
    let encryptedToken = null;

    // Vérification robuste des paramètres Meta
    if (metaAccessToken && metaAccountId) {
      // Validation supplémentaire du format
      if (typeof metaAccessToken !== 'string' || !/^EAA\w+/.test(metaAccessToken)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Meta access token format"
        });
      }

      if (typeof metaAccountId !== 'string' || !/^\d+$/.test(metaAccountId)) {
        return res.status(400).json({
          success: false,
          message: "Meta account ID must be numeric"
        });
      }

      metaPixelId = await createMetaPixel(
        metaAccessToken,
        metaAccountId,
        name || `Pixel-${vcard.name}`
      );

      if (!metaPixelId) {
        return res.status(400).json({
          success: false,
          message: "Failed to create Meta Pixel. Check your credentials."
        });
      }

      // Chiffrement seulement si le token est valide
      encryptedToken = encryptToken(metaAccessToken);
    }

    const pixel = await Pixel.create({
      name: name || `Pixel-${vcard.name}`,
      vcardId,
      metaPixelId,
      metaAccountId,
      encryptedMetaAccessToken: encryptedToken,
      is_active: true
    });

    return res.status(201).json({
      success: true,
      pixel: {
        id: pixel.id,
        name: pixel.name,
        trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
        metaPixelId: pixel.metaPixelId,
        vcardId: pixel.vcardId,
        is_active: pixel.is_active
      }
    });
  } catch (error) {
    console.error('Pixel creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Fonction updatePixel corrigée
const updatePixel = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const { name, is_active, metaAccessToken, metaAccountId } = req.body;

    const pixel = await Pixel.findByPk(pixelId, {
      include: [{ model: VCard, as: 'VCard' }]
    });
    
    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: 'Pixel not found'
      });
    }

    let newMetaPixelId = pixel.metaPixelId;
    let encryptedTokenToSave = pixel.encryptedMetaAccessToken; 

    if (metaAccessToken && metaAccountId) {
      // Validation des paramètres
      if (typeof metaAccessToken !== 'string' || !/^EAA\w+/.test(metaAccessToken)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Meta access token format"
        });
      }

      if (typeof metaAccountId !== 'string' || !/^\d+$/.test(metaAccountId)) {
        return res.status(400).json({
          success: false,
          message: "Meta account ID must be numeric"
        });
      }

      newMetaPixelId = await createMetaPixel(
        metaAccessToken,
        metaAccountId,
        name || pixel.name
      );

      if (!newMetaPixelId) {
        return res.status(400).json({
          success: false,
          message: "Failed to update Meta Pixel"
        });
      }

      encryptedTokenToSave = encryptToken(metaAccessToken);
    }

    await pixel.update({
      name: name || pixel.name,
      metaPixelId: newMetaPixelId,
      metaAccountId: metaAccountId || pixel.metaAccountId,
      encryptedMetaAccessToken: encryptedTokenToSave,
      is_active: typeof is_active === 'boolean' ? is_active : pixel.is_active
    });

    return res.json({
      success: true,
      pixel: {
        id: pixel.id,
        name: pixel.name,
        metaPixelId: pixel.metaPixelId,
        is_active: pixel.is_active
      }
    });
  } catch (error) {
    console.error('Pixel update error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
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
        message: 'Pixel not found'
      });
    }

    // Suppression du pixel Meta si il existe et qu'on a le token chiffré
    if (
      pixel.metaPixelId &&
      pixel.encryptedMetaAccessToken &&
      process.env.META_API_URL &&
      process.env.META_API_VERSION
    ) {
      try {
        const realMetaToken = decryptToken(pixel.encryptedMetaAccessToken);
        if (realMetaToken) {
          const url = `${process.env.META_API_URL}/${process.env.META_API_VERSION}/${pixel.metaPixelId}`;
          await axios.delete(url, {
            params: { access_token: realMetaToken }
          });
        }
      } catch (error) {
        console.error('Meta Pixel deletion error:', error.response?.data || error.message);
      }
    }

    await pixel.destroy();
    return res.json({ success: true, message: 'Pixel deleted' });
  } catch (error) {
    console.error('Pixel deletion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const getUserPixels = async (req, res) => {
  try {
    const { userId } = req.query;
    const pixels = await Pixel.findAll({
      include: [
        {
          model: VCard,
          as: 'VCard',
          where: { userId },
          attributes: ['id', 'name']
        }
      ]
    });

    return res.json({
      success: true,
      pixels: pixels.map((p) => ({
        id: p.id,
        name: p.name,
        vcard: p.VCard,
        metaPixelId: p.metaPixelId,
        is_active: p.is_active,
        created_at: p.created_at
      }))
    });
  } catch (error) {
    console.error('Pixel recovery error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const getPixelById = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const pixel = await Pixel.findByPk(pixelId, {
      include: [{ model: VCard, as: 'VCard' }]
    });

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: 'Pixel not found'
      });
    }

    return res.json({
      success: true,
      pixel: {
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
    console.error('Get pixel error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const trackEvent = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const data = req.method === 'POST' ? req.body : req.query;
    const { eventType, blockId, metadata, value, currency } = data;

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
        console.error('Metadata parsing error:', e);
      }
    }

    const event = await EventTracking.create({
      eventType: eventType || 'view',
      metadata: metaData,
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

    if (pixel.metaPixelId && pixel.encryptedMetaAccessToken && process.env.META_API_URL && process.env.META_API_VERSION) {
      const realMetaToken = decryptToken(pixel.encryptedMetaAccessToken);
      if (realMetaToken) {
        const eventData = {
          event_name: mapToMetaEvent(eventType),
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
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
          // Format correct pour l'API Conversions de Meta
          const url = `${process.env.META_API_URL}/${process.env.META_API_VERSION}/${pixel.metaPixelId}/events`;
          const payload = {
            data: [eventData],
            access_token: realMetaToken
          };

          await axios.post(url, payload, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });
        } catch (error) {
          console.error('Meta Pixel tracking error:', error.response?.data || error.message);
        }
      }
    }

    return sendPixelResponse(res);
  } catch (error) {
    console.error('Event tracking error:', error);
    return sendPixelResponse(res);
  }
};

const sendPixelResponse = (res) => {
  const pixelGif = Buffer.from(
    'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    'base64'
  );
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixelGif.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(pixelGif);
};

const getPixelsByVCard = async (req, res) => {
  try {
    const { vcardId } = req.params;
    const userId = req.user.id; 

    const vcard = await VCard.findOne({ where: { id: vcardId, userId } });
    if (!vcard) {
      return res.status(404).json({
        success: false,
        message: 'VCard not found or unauthorized'
      });
    }

    const pixels = await Pixel.findAll({
      where: { vcardId },
      include: [{ model: VCard, as: 'VCard' }]
    });

    return res.json({
      success: true,
      pixels: pixels.map((p) => ({
        id: p.id,
        name: p.name,
        is_active: p.is_active,
        created_at: p.created_at,
        trackingUrl: `${process.env.API_URL}/pixels/${p.id}/track`,
        metaPixelId: p.metaPixelId,
        vcard: p.VCard
          ? { id: p.VCard.id, name: p.VCard.name }
          : null
      }))
    });
  } catch (error) {
    console.error('Get pixels by vCard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
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
  getPixelsByVCard
};
