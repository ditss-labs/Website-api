import jwt from 'jsonwebtoken'
import { User } from '../database/models/User.js'

// Middleware untuk proteksi dashboard
export const requireAuthForDashboard = async (req, res, next) => {
  try {
    // 1. Cek session
    if (req.session.userId) {
      req.user = await User.findById(req.session.userId)
      if (req.user && req.user.isActive) {
        return next()
      }
    }
    
    // 2. Cek token dari cookie
    const token = req.cookies?.auth_token
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ditss-the-token-jwt-sikrit-2026-asuma-api')
        req.user = await User.findById(decoded.userId)
        if (req.user && req.user.isActive) {
          // Set session untuk next request
          req.session.userId = req.user._id
          return next()
        }
      } catch (error) {
        // Token invalid, clear cookie
        res.clearCookie('auth_token')
      }
    }
    
    // 3. Jika tidak ada auth, redirect ke login
    if (req.accepts('html')) {
      return res.redirect('/login')
    }
    
    // Untuk API request, return JSON
    res.status(401).json({ 
      status: false, 
      error: 'Authentication required',
      redirect: '/login'
    })
    
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.redirect('/login')
  }
}

// Middleware untuk API routes
export const requireAuth = async (req, res, next) => {
  try {
    if (req.session.userId) {
      req.user = await User.findById(req.session.userId)
      if (req.user) return next()
    }
    
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ status: false, error: 'Authentication required' })
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ditss-the-token-jwt-sikrit-2026-asuma-api')
    req.user = await User.findById(decoded.userId)
    
    if (!req.user) {
      return res.status(401).json({ status: false, error: 'User not found' })
    }
    
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ status: false, error: 'Invalid token' })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: false, error: 'Token expired' })
    }
    
    res.status(500).json({ status: false, error: 'Authentication failed' })
  }
}

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ status: false, error: 'Admin access required' })
  }
  next()
}

export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'ditss-the-token-jwt-sikrit-2026-asuma-api',
    { expiresIn: '7d' }
  )
}
