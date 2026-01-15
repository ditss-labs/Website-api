import express from 'express'
import { User } from '../../database/models/User.js'
import { generateToken } from '../../middleware/auth.js'

const router = express.Router()

// Ganti bagian register
router.post('/api/auth/register', async (req, res) => {
  try {
    const { username, phone, password } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ status: false, error: 'Username and password are required' })
    }
    
    if (password.length < 6) {
      return res.status(400).json({ status: false, error: 'Password must be at least 6 characters' })
    }
    
    // Auto generate email
    const email = `${username}@asuma.my.id`
    
    // Check existing user
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    })
    
    if (existingUser) {
      return res.status(400).json({ status: false, error: 'Username already exists' })
    }
    
    // Create new user
    const user = new User({
      username,
      email,
      phone,
      passwordHash: password,
      role: 'user'
    })
    
    await user.save()
    
    // Create default API key
    const defaultApiKey = await user.createApiKey('Default API Key', 1000)
    
    // Generate token
    const token = generateToken(user._id)
    
    // Set session
    req.session.userId = user._id
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    
    res.json({
      status: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          profileurl: user.profileurl
        },
        apiKey: defaultApiKey.key,
        token
      }
    })
    
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ status: false, error: 'Registration failed' })
  }
})

router.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ status: false, error: 'Username and password are required' })
    }
    const user = await User.findOne({ $or: [{ username }, { email: username }] })
    if (!user) {
      return res.status(401).json({ status: false, error: 'Invalid credentials' })
    }
    if (user.isLocked()) {
      return res.status(423).json({ status: false, error: 'Account is locked. Try again later.' })
    }
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      await user.incLoginAttempts()
      return res.status(401).json({ status: false, error: 'Invalid credentials' })
    }
    await user.resetLoginAttempts()
    user.lastLogin = new Date()
    await user.save()
    const token = generateToken(user._id)
    req.session.userId = user._id
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 })
    res.json({
      status: true,
      message: 'Login successful',
      data: {
        user: { id: user._id, username: user.username, email: user.email, role: user.role },
        token,
        redirect: '/admin/dashboard'
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ status: false, error: 'Login failed' })
  }
})

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ status: false, error: 'Logout failed' })
    res.clearCookie('token')
    res.clearCookie('connect.sid')
    res.json({ status: true, message: 'Logout successful' })
  })
})

router.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ status: false, error: 'Not authenticated' })
    }
    const user = await User.findById(req.session.userId).select('-passwordHash -loginAttempts -lockUntil')
    if (!user) {
      return res.status(404).json({ status: false, error: 'User not found' })
    }
    res.json({ status: true, data: { user } })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ status: false, error: 'Failed to get user data' })
  }
})

export default (app) => {
  app.use(router)
}
