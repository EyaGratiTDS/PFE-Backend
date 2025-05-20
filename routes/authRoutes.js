const express = require('express');
const router = express.Router();
const passport = require('passport');

router.get('/google', 
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account consent' 
  })
);

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/sign-in',
    session: false
  }),
  (req, res) => {
    if (!req.user || !req.user.token) {
      return res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    }
    
    const token = encodeURIComponent(req.user.token);
    const user = encodeURIComponent(JSON.stringify(req.user.user));
    
    res.redirect(`${process.env.FRONTEND_URL}/sign-in?token=${token}&user=${user}`);
  }
);

module.exports = router;