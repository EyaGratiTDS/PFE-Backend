const { VCard, Pixel, EventTracking } = require('../models');
const { getClientIp } = require('request-ip');
const axios = require('axios'); 
const UAParser = require('ua-parser-js');
const User = require('../models/User');

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

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

// Fonction pour mapper les types d'événements vers les valeurs ENUM autorisées
const mapEventType = (eventType) => {
  // Types d'événements autorisés dans l'ENUM
  const validEventTypes = [
    'view', 'click', 'download', 'share', 'heartbeat', 
    'mouse_move', 'scroll', 'hover', 'suspicious_activity', 
    'preference_updated', 'attention_event'
  ];

  const eventMapping = {
    'page_visible': 'view',
    'page_hidden': 'view', 
    'visibility_change': 'view',
    'page_load': 'view',
    'page_unload': 'view',
    'button_click': 'click',
    'link_click': 'click',
    'element_click': 'click',
    'contact_download': 'download',
    'vcard_download': 'download',
    'social_share': 'share',
    'email_share': 'share',
    'link_share': 'share',
    'mouse_movement': 'mouse_move',
    'scroll_event': 'scroll',
    'element_hover': 'hover',
    'suspicious': 'suspicious_activity',
    'anomaly': 'suspicious_activity',
    'preference_change': 'preference_updated',
    'setting_update': 'preference_updated',
    'attention': 'attention_event',
    'focus': 'attention_event'
  };
  
  // Retourner la valeur mappée ou la valeur originale si elle est valide
  const mappedType = eventMapping[eventType] || eventType;
  
  // Si le type mappé n'est pas valide, retourner 'view' par défaut
  return validEventTypes.includes(mappedType) ? mappedType : 'view';
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

// =============================================================================
// CONTRÔLEURS PIXEL - CRUD SIMPLIFIÉ
// =============================================================================

const createPixel = async (req, res) => {
  try {
    const { vcardId, name, userId, metaPixelId } = req.body;
    
    // Vérifier que la vCard appartient à l'utilisateur
    const vcard = await VCard.findOne({ where: { id: vcardId, userId } });
    if (!vcard) {
      return res.status(404).json({ 
        success: false,
        message: "VCard not found or unauthorized" 
      });
    }

    // Vérifier qu'un pixel n'existe pas déjà pour cette vCard
    const existingPixel = await Pixel.findOne({ where: { vcardId } });
    if (existingPixel) {
      return res.status(409).json({
        success: false,
        message: "A pixel already exists for this vCard"
      });
    }

    // Créer le pixel
    const pixel = await Pixel.create({
      name: name || `Pixel - ${vcard.name}`,
      vcardId,
      is_active: true,
      metaPixelId
    });

    res.status(201).json({
      success: true,
      data: {
        id: pixel.id,
        name: pixel.name,
        trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
        vcardId: pixel.vcardId,
        is_active: pixel.is_active,
        created_at: pixel.created_at,
        metaPixelId: pixel.metaPixelId
      }
    });

  } catch (error) {
    console.error("Create pixel error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const updatePixel = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const { name, is_active, metaPixelId } = req.body;

    const pixel = await Pixel.findByPk(pixelId, {
      include: [{ model: VCard, as: "VCard" }]
    });

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found"
      });
    }

    // Mise à jour simple du pixel
    await pixel.update({
      name: name || pixel.name,
      is_active: typeof is_active === 'boolean' ? is_active : pixel.is_active,
      metaPixelId: metaPixelId || pixel.metaPixelId
    });

    res.json({
      success: true,
      data: {
        id: pixel.id,
        name: pixel.name,
        is_active: pixel.is_active,
        trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
        vcardId: pixel.vcardId,
        metaPixelId: pixel.metaPixelId
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

    // Suppression simple du pixel
    await pixel.destroy();
    
    res.json({ 
      success: true, 
      message: "Pixel deleted successfully" 
    });

  } catch (error) {
    console.error("Pixel deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// =============================================================================
// CONTRÔLEURS DE CONSULTATION
// =============================================================================

const getPixelById = async (req, res) => {
  try {
    const { pixelId } = req.params;
    
    const pixel = await Pixel.findByPk(pixelId, {
      include: [{ 
        model: VCard, 
        as: "VCard",
        attributes: ['id', 'name', 'url']
      }]
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
        is_active: pixel.is_active,
        is_blocked: pixel.is_blocked,
        trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
        vcard: pixel.VCard,
        created_at: pixel.created_at,
        metaPixelId: pixel.metaPixelId
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

const getPixelsByVCard = async (req, res) => {
  try {
    const { vcardId } = req.params;
    const vcard = await VCard.findOne({ where: { id: vcardId } });
    if (!vcard) {
      return res.status(404).json({ 
        success: false,
        message: "VCard not found or unauthorized" 
      });
    }

    // Récupérer le pixel de cette vCard
    const pixel = await Pixel.findOne({ 
      where: { vcardId }
    });

    if (!pixel) {
      return res.status(404).json({ 
        success: false,
        message: "No pixel found for this vCard" 
      });
    }
    res.json({ 
      success: true, 
      data: {
        id: pixel.id,
        name: pixel.name,
        is_active: pixel.is_active,
        is_blocked: pixel.is_blocked,
        created_at: pixel.created_at,
        metaPixelId: pixel.metaPixelId,
        trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
      }
    });
  } catch (error) {
    console.error("Get pixels by vCard error:", error);
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
      data: pixels.map(p => ({
        id: p.id,
        name: p.name,
        vcard: p.VCard,
        is_active: p.is_active,
        is_blocked: p.is_blocked,
        created_at: p.created_at,
        metaPixelId: p.metaPixelId,
        trackingUrl: `${process.env.API_URL}/pixels/${p.id}/track`
      }))
    });

  } catch (error) {
    console.error("Get user pixels error:", error);
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
        'is_active',
        'is_blocked',
        'created_at'
      ]
    });

    const formattedPixels = pixels.map(pixel => ({
      id: pixel.id,
      name: pixel.name,
      is_active: pixel.is_active,
      is_blocked: pixel.is_blocked,
      created_at: pixel.created_at,
      trackingUrl: `${process.env.API_URL}/pixels/${pixel.id}/track`,
      metaPixelId: pixel.metaPixelId,
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

// =============================================================================
// CONTRÔLEUR DE TRACKING
// =============================================================================

const trackEvent = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const data = req.body;
    
    const { 
      eventType = 'view', 
      blockId, 
      duration, 
      metadata
    } = data;

    // Mapper le type d'événement vers une valeur ENUM autorisée
    const mappedEventType = mapEventType(eventType);

    // Vérifier si le pixel existe et est actif
    const pixel = await Pixel.findByPk(pixelId);
    if (!pixel || !pixel.is_active || pixel.is_blocked) {
      return sendPixelResponse(res);
    }

    // Récupérer et nettoyer l'IP
    let clientIp = getClientIp(req);
    clientIp = cleanIpAddress(clientIp);

    // Obtenir les données de localisation
    const locationData = await getLocationData(clientIp);
    
    // Parser le User-Agent
    const userAgent = req.headers['user-agent'] || '';
    const userAgentInfo = parseUserAgent(userAgent);
    
    // Normaliser la langue
    const acceptLanguage = req.headers['accept-language'] || '';
    const primaryLanguage = normalizeLanguage(acceptLanguage);

    // Parser les métadonnées
    let metaData = {};
    if (metadata) {
      try {
        metaData = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch (e) {
        console.error("Metadata parsing error:", e);
      }
    }

    // Enregistrer l'événement en base de données
    await EventTracking.create({
      eventType: mappedEventType,
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

    console.log(`Event tracked: ${eventType} -> ${mappedEventType} for pixel ${pixelId}`);
    
    // Retourner le pixel de tracking
    sendPixelResponse(res);

  } catch (error) {
    console.error("Track event error:", error);
    sendPixelResponse(res);
  }
};

// =============================================================================
// CONTRÔLEURS ADMIN
// =============================================================================

const toggleBlocked = async (req, res) => {
  try {
    const { id } = req.params;
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

// =============================================================================
// EXPORTS
// =============================================================================

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
