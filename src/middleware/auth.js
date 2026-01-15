import jwt from 'jsonwebtoken'
import { User } from '../database/models/User.js'

// Simple middleware untuk protect dashboard
export const requireAuthForDashboard = async (req, res, next) => {
  try {
    // Debug log
    console.log('🔍 Auth Check - Session:', req.session);
    console.log('🔍 Auth Check - Session ID:', req.session?.id);
    console.log('🔍 Auth Check - User ID in session:', req.session?.userId);
    
    // Cek session langsung
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('-passwordHash');
      if (user) {
        console.log('✅ User found in session:', user.username);
        req.user = user;
        return next();
      } else {
        console.log('❌ User not found in DB, clearing session');
        req.session.destroy();
        return res.redirect('/login');
      }
    }
    
    // Cek cookie token (fallback)
    const token = req.cookies?.auth_token || req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-change-this');
        const user = await User.findById(decoded.userId);
        
        if (user) {
          // Set session untuk next request
          req.session.userId = user._id;
          req.user = user;
          console.log('✅ User authenticated via token:', user.username);
          return next();
        }
      } catch (error) {
        console.error('❌ Token verification failed:', error.message);
      }
    }
    
    console.log('❌ No valid authentication found, redirecting to login');
    
    // Untuk HTML request, redirect ke login
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    
    // Untuk API request, return JSON error
    return res.status(401).json({ 
      status: false, 
      error: 'Authentication required',
      redirect: '/login'
    });
    
  } catch (error) {
    console.error('🔥 Auth middleware error:', error);
    
    // Clear invalid session
    if (req.session) {
      req.session.destroy();
    }
    
    res.clearCookie('auth_token');
    res.clearCookie('connect.sid');
    
    return res.redirect('/login');
  }
};

// Middleware untuk API routes (strict)
export const requireAuth = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      req.user = await User.findById(req.session.userId);
      if (req.user) return next();
    }
    
    // Cek token dari header atau cookie
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.auth_token || 
                  req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ 
        status: false, 
        error: 'Authentication token required' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-change-this');
    req.user = await User.findById(decoded.userId);
    
    if (!req.user) {
      return res.status(401).json({ 
        status: false, 
        error: 'User not found' 
      });
    }
    
    // Set session untuk consistency
    if (req.session) {
      req.session.userId = req.user._id;
    }
    
    next();
  } catch (error) {
    console.error('API Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        status: false, 
        error: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        status: false, 
        error: 'Token expired' 
      });
    }
    
    res.status(500).json({ 
      status: false, 
      error: 'Authentication failed' 
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      status: false, 
      error: 'Admin access required' 
    });
  }
  next();
};

export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-jwt-secret-change-this',
    { expiresIn: '7d' }
  );
};
