import express from 'express'
import { User } from '../../database/models/User.js'
import { generateToken } from '../../middleware/auth.js'

const router = express.Router()

// Check authentication status
router.get('/api/auth/check', async (req, res) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('-passwordHash');
      
      if (user) {
        return res.json({ 
          status: true, 
          loggedIn: true, 
          user,
          redirect: '/admin/dashboard'
        });
      }
    }
    
    res.json({ 
      status: true, 
      loggedIn: false 
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.json({ 
      status: false, 
      loggedIn: false,
      error: 'Server error'
    });
  }
});

// Login
router.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        status: false, 
        error: 'Username and password are required' 
      });
    }
    
    // Find user by username or email
    let user = await User.findOne({ username });
    
    if (!user) {
      // Try email
      user = await User.findOne({ 
        email: username.includes('@') ? username : `${username}@asuma.my.id` 
      });
    }
    
    if (!user) {
      return res.status(401).json({ 
        status: false, 
        error: 'Invalid credentials' 
      });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        status: false, 
        error: 'Invalid credentials' 
      });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Create session
    req.session.userId = user._id;
    req.session.save(); // Save session immediately
    
    // Generate token (optional)
    const token = generateToken(user._id);
    
    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: false, // false for localhost, true for production
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
    
    console.log('✅ Login successful for user:', user.username);
    console.log('✅ Session created:', req.session.id);
    
    res.json({
      status: true,
      message: 'Login successful',
      data: {
        user: { 
          id: user._id, 
          username: user.username, 
          email: user.email, 
          role: user.role,
          profileurl: user.profileurl
        },
        token,
        redirect: '/admin/dashboard'
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      status: false, 
      error: 'Login failed' 
    });
  }
});

// Register
router.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, phone } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        status: false, 
        error: 'Username and password are required' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        status: false, 
        error: 'Password must be at least 6 characters' 
      });
    }
    
    // Auto-generate email if not provided
    const userEmail = email || `${username}@asuma.my.id`;
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email: userEmail }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        status: false, 
        error: 'Username already exists' 
      });
    }
    
    // Create user
    const user = new User({
      username,
      email: userEmail,
      phone,
      passwordHash: password,
      role: 'user'
    });
    
    await user.save();
    
    // Create default API key
    const defaultApiKey = await user.createApiKey('Default API Key', 1000);
    
    // Create session
    req.session.userId = user._id;
    req.session.save();
    
    // Generate token
    const token = generateToken(user._id);
    
    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
    
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
        token,
        redirect: '/admin/dashboard'
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      status: false, 
      error: 'Registration failed' 
    });
  }
});

// Logout
router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    
    res.clearCookie('auth_token');
    res.clearCookie('connect.sid');
    
    res.json({
      status: true,
      message: 'Logout successful',
      redirect: '/login'
    });
  });
});

// Get current user
router.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        status: false, 
        error: 'Not authenticated' 
      });
    }
    
    const user = await User.findById(req.session.userId)
      .select('-passwordHash -loginAttempts -lockUntil');
    
    if (!user) {
      return res.status(404).json({ 
        status: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ 
      status: true, 
      data: { user } 
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      status: false, 
      error: 'Failed to get user data' 
    });
  }
});

export default (app) => {
  app.use(router);
};
