import express from 'express'
import { User } from '../../database/models/User.js'
import { ApiLog } from '../../database/models/ApiLog.js'
import { UsageStats } from '../../database/models/UsageStats.js'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'

const router = express.Router()

router.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const activeUsers = await User.countDocuments({ isActive: true })
    const totalApiKeys = await User.aggregate([{ $project: { count: { $size: "$apikeys" } } }, { $group: { _id: null, total: { $sum: "$count" } } }])
    const today = new Date().toISOString().split('T')[0]
    const todayStats = await UsageStats.aggregate([
      { $match: { date: today } },
      { $group: { _id: null, totalRequests: { $sum: "$totalRequests" }, successRequests: { $sum: "$successRequests" }, failedRequests: { $sum: "$failedRequests" } } }
    ])
    res.json({
      status: true,
      data: {
        users: { total: totalUsers, active: activeUsers },
        apiKeys: totalApiKeys[0]?.total || 0,
        today: todayStats[0] || { totalRequests: 0, successRequests: 0, failedRequests: 0 },
        recentActivity: await ApiLog.find().sort({ createdAt: -1 }).limit(10).select('endpoint method ip statusCode responseTime createdAt')
      }
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    res.status(500).json({ status: false, error: 'Failed to get admin stats' })
  }
})

router.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query
    const skip = (page - 1) * limit
    const query = search ? { $or: [{ username: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] } : {}
    const users = await User.find(query).select('-passwordHash -apikeys.ips').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
    const total = await User.countDocuments(query)
    res.json({
      status: true,
      data: {
        users,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
      }
    })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ status: false, error: 'Failed to get users' })
  }
})

router.get('/api/admin/logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type = 'all' } = req.query
    const skip = (page - 1) * limit
    let query = {}
    if (type === 'success') query.success = true
    if (type === 'error') query.success = false
    const logs = await ApiLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('userId', 'username email')
    const total = await ApiLog.countDocuments(query)
    res.json({
      status: true,
      data: {
        logs,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
      }
    })
  } catch (error) {
    console.error('Get logs error:', error)
    res.status(500).json({ status: false, error: 'Failed to get logs' })
  }
})

export default (app) => {
  app.use(router)
}
