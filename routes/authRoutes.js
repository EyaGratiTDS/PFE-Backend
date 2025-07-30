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
    failureRedirect: `${process.env.FRONTEND_URL}/sign-in?error=auth_failed`,
    session: false
  }),
  (req, res) => {
    try {
      if (!req.user || !req.user.token) {
        console.error('Auth callback failed: No user or token');
        return res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      }
      
      const token = encodeURIComponent(req.user.token);
      const user = encodeURIComponent(JSON.stringify(req.user.user));
      
      res.redirect(`${process.env.FRONTEND_URL}/auth/handler?token=${token}&user=${user}&auth=success`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=callback_failed`);
    }
  }
);

module.exports = router;