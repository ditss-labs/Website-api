import jwt from 'jsonwebtoken'
import { User } from '../database/models/User.js'

export const requireAuth = async (req, res, next) => {
  try {
    if (req.session.userId) {
      req.user = await User.findById(req.session.userId)
      if (req.user) return next()
    }
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ status: false, error: 'Authentication required', redirect: '/login' })
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ditss-the-token-jwt-sikrit')
    req.user = await User.findById(decoded.userId)
    if (!req.user) return res.status(401).json({ status: false, error: 'User not found', redirect: '/login' })
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ status: false, error: 'Invalid token', redirect: '/login' })
    if (error.name === 'TokenExpiredError') return res.status(401).json({ status: false, error: 'Token expired', redirect: '/login' })
    res.status(500).json({ status: false, error: 'Authentication failed' })
  }
}

export const checkAuth = async (req, res, next) => {
    try {
        // Cek session
        if (req.session.userId) {
            req.user = await User.findById(req.session.userId);
            if (req.user) return next();
        }
        
        // Cek token dari cookie
        const token = req.cookies?.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ditss-the-token-jwt-sikrit');
            req.user = await User.findById(decoded.userId);
            if (req.user) {
                // Set session untuk request berikutnya
                req.session.userId = req.user._id;
                return next();
            }
        }
        
        next(); // Lanjut tanpa error untuk public routes
    } catch (error) {
        console.error('Auth check error:', error.message);
        next();
    }
};

// Middleware untuk protect dashboard
export const requireAuthForDashboard = async (req, res, next) => {
    try {
        if (req.session.userId) {
            req.user = await User.findById(req.session.userId);
            if (req.user) return next();
        }
        
        const token = req.cookies?.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ditss-the-token-jwt-sikrit');
            req.user = await User.findById(decoded.userId);
            if (req.user) {
                req.session.userId = req.user._id;
                return next();
            }
        }
        
        // Redirect ke login jika tidak authenticated
        return res.redirect('/login');
    } catch (error) {
        return res.redirect('/login');
    }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ status: false, error: 'Admin access required' })
  next()
}

export const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'ditss-the-token-jwt-sikrit', { expiresIn: '7d' })
}
