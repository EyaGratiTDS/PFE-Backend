const Pixel = require('../models');
const EventTracking = require('../models/EventTracking');
const VCard = require('../models/Vcard');
const geoip = require('geoip-lite');
const { getClientIp } = require('request-ip');

const trackEvent = async (req, res) => {
  const { pixelId } = req.params;
  const { eventType = 'view', blockId, duration, metadata } = req.query;

  try {
    const pixel = await Pixel.findOne({
      where: { id: pixelId, is_active: true },
      include: [{
        model: VCard,
        as: 'VCard'
      }]
    });

    if (!pixel) return sendPixelResponse(res);

    const ip = getClientIp(req);
    const geo = geoip.lookup(ip) || {};
    const userAgent = req.headers['user-agent'];

    // Extraire les informations du navigateur
    let deviceType = 'Desktop';
    if (userAgent) {
      if (/Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent)) {
        deviceType = 'Mobile';
      } else if (/Tablet|iPad/i.test(userAgent)) {
        deviceType = 'Tablet';
      }
    }

    await EventTracking.create({
      pixelId,
      eventType,
      blockId: blockId || null,
      duration: duration || null,
      metadata: metadata ? JSON.parse(metadata) : null,
      userAgent,
      ipAddress: ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      deviceType,
      os: getOS(userAgent),
      browser: getBrowser(userAgent),
      language: req.headers['accept-language'] || null,
      vcardId: pixel.VCard.id
    });

    sendPixelResponse(res);

  } catch (error) {
    console.error("Tracking error:", error);
    sendPixelResponse(res);
  }
};

// Fonctions utilitaires pour détecter OS et navigateur
const getOS = (userAgent) => {
  if (!userAgent) return 'Unknown';
  
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Mac OS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iOS|iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  
  return 'Unknown';
};

const getBrowser = (userAgent) => {
  if (!userAgent) return 'Unknown';
  
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Safari/i.test(userAgent)) return 'Safari';
  if (/Edge/i.test(userAgent)) return 'Edge';
  if (/Opera|OPR/i.test(userAgent)) return 'Opera';
  if (/MSIE|Trident/i.test(userAgent)) return 'Internet Explorer';
  
  return 'Unknown';
};

const sendPixelResponse = (res) => {
  const pixel = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, max-age=0',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(pixel);
};

module.exports = {
  trackEvent
};