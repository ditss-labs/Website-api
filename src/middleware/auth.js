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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-change-this')
    req.user = await User.findById(decoded.userId)
    if (!req.user) return res.status(401).json({ status: false, error: 'User not found', redirect: '/login' })
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ status: false, error: 'Invalid token', redirect: '/login' })
    if (error.name === 'TokenExpiredError') return res.status(401).json({ status: false, error: 'Token expired', redirect: '/login' })
    res.status(500).json({ status: false, error: 'Authentication failed' })
  }
}

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ status: false, error: 'Admin access required' })
  next()
}

export const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-jwt-secret-change-this', { expiresIn: '7d' })
}
