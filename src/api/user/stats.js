import express from 'express'
import { User } from '../../database/models/User.js'
import { ApiLog } from '../../database/models/ApiLog.js'
import { requireAuth } from '../../middleware/auth.js'

const router = express.Router()

router.get('/api/user/stats', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user) {
      return res.status(404).json({ status: false, error: 'User not found' })
    }
    
    // Calculate stats
    const today = new Date().toISOString().split('T')[0]
    const todayLogs = await ApiLog.find({
      userId: user._id,
      createdAt: { $gte: new Date(today) }
    })
    
    const stats = {
      totalRequests: user.totalApiCalls || 0,
      todayRequests: todayLogs.length,
      activeKeys: user.apikeys.filter(k => k.status === 'active').length,
      bannedIps: user.apikeys.reduce((sum, key) => sum + key.ips.filter(ip => ip.banned).length, 0),
      totalApiKeys: user.apikeys.length
    }
    
    res.json({
      status: true,
      data: stats
    })
    
  } catch (error) {
    console.error('Get user stats error:', error)
    res.status(500).json({ status: false, error: 'Failed to get stats' })
  }
})

export default (app) => {
  app.use(router)
}
