const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Permissions insuffisantes',
        requiredRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

module.exports = { requireRole };