const jwt = require('jsonwebtoken');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {

    const token = (req.cookies && req.cookies.jwt) || 
    (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
      return res.status(401).json({ message: 'Authentification requise' });
    }
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decodedToken.id);
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }
    req.authInfo = {
      userId: user.id,
      isAdmin: user.isAdmin,
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    req.user = user;
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Session invalide ou expirée' });
  }
};

const requireAuthSuperAdmin = async (req, res, next) => {
  try {
    const token = (req.cookies && req.cookies.jwt) || 
    (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
      return res.status(401).json({ message: 'Authentification requise' });
    }
    
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findByPk(decodedToken.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    if (user.role !== 'superAdmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé. Privilèges Super-admin requis.' 
      });
    }

    req.authInfo = {
      userId: user.id,
      isAdmin: user.isAdmin,
      role: user.role,
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    req.user = user;
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Session invalide ou expirée' });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'superAdmin') {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Super-admin privileges required' 
    });
  }
};



module.exports = { requireAuth, requireAuthSuperAdmin, requireSuperAdmin };