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
    
    const user = await User.findByPk(decodedToken.id);
    
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
    console.error('Erreur d\'authentification:', error);
    return res.status(401).json({ message: 'Session invalide ou expirée' });
  }
};

module.exports = { requireAuth };