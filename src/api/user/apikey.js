import express from 'express'
import { User } from '../../database/models/User.js'
import { requireAuth } from '../../middleware/auth.js'

const router = express.Router()

router.get('/api/user/apikeys', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('apikeys')
    res.json({ status: true, data: { apikeys: user.apikeys } })
  } catch (error) {
    console.error('Get API keys error:', error)
    res.status(500).json({ status: false, error: 'Failed to get API keys' })
  }
})

router.post('/api/user/apikeys', requireAuth, async (req, res) => {
  try {
    const { name, limitPerDay } = req.body
    const user = await User.findById(req.user._id)
    const apiKey = await user.createApiKey(name || 'New API Key', limitPerDay || 1000)
    res.status(201).json({
      status: true,
      message: 'API key created successfully',
      data: { apiKey }
    })
  } catch (error) {
    console.error('Create API key error:', error)
    res.status(500).json({ status: false, error: 'Failed to create API key' })
  }
})

router.put('/api/user/apikeys/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const { name, limitPerDay, status } = req.body
    const user = await User.findById(req.user._id)
    const apiKeyIndex = user.apikeys.findIndex(k => k.key === key)
    if (apiKeyIndex === -1) {
      return res.status(404).json({ status: false, error: 'API key not found' })
    }
    if (name !== undefined) user.apikeys[apiKeyIndex].name = name
    if (limitPerDay !== undefined) user.apikeys[apiKeyIndex].limitPerDay = limitPerDay
    if (status !== undefined) user.apikeys[apiKeyIndex].status = status
    await user.save()
    res.json({
      status: true,
      message: 'API key updated successfully',
      data: { apiKey: user.apikeys[apiKeyIndex] }
    })
  } catch (error) {
    console.error('Update API key error:', error)
    res.status(500).json({ status: false, error: 'Failed to update API key' })
  }
})

router.delete('/api/user/apikeys/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const user = await User.findById(req.user._id)
    const apiKeyIndex = user.apikeys.findIndex(k => k.key === key)
    if (apiKeyIndex === -1) {
      return res.status(404).json({ status: false, error: 'API key not found' })
    }
    user.apikeys.splice(apiKeyIndex, 1)
    await user.save()
    res.json({ status: true, message: 'API key deleted successfully' })
  } catch (error) {
    console.error('Delete API key error:', error)
    res.status(500).json({ status: false, error: 'Failed to delete API key' })
  }
})

router.post('/api/user/apikeys/:key/ban-ip', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const { ip, reason } = req.body
    if (!ip) return res.status(400).json({ status: false, error: 'IP address is required' })
    const user = await User.findById(req.user._id)
    const apiKey = user.apikeys.find(k => k.key === key)
    if (!apiKey) return res.status(404).json({ status: false, error: 'API key not found' })
    const ipRecord = await user.banIpOnApiKey(key, ip, reason)
    res.json({
      status: true,
      message: 'IP banned successfully',
      data: { ipRecord }
    })
  } catch (error) {
    console.error('Ban IP error:', error)
    res.status(500).json({ status: false, error: 'Failed to ban IP' })
  }
})

router.post('/api/user/apikeys/:key/unban-ip', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const { ip } = req.body
    if (!ip) return res.status(400).json({ status: false, error: 'IP address is required' })
    const user = await User.findById(req.user._id)
    const apiKey = user.apikeys.find(k => k.key === key)
    if (!apiKey) return res.status(404).json({ status: false, error: 'API key not found' })
    const ipRecord = apiKey.ips.find(r => r.ip === ip)
    if (ipRecord) {
      ipRecord.banned = false
      await user.save()
    }
    res.json({ status: true, message: 'IP unbanned successfully' })
  } catch (error) {
    console.error('Unban IP error:', error)
    res.status(500).json({ status: false, error: 'Failed to unban IP' })
  }
})

router.get('/api/user/apikeys/:key/ips', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const user = await User.findById(req.user._id)
    const apiKey = user.apikeys.find(k => k.key === key)
    if (!apiKey) return res.status(404).json({ status: false, error: 'API key not found' })
    res.json({ status: true, data: { ips: apiKey.ips } })
  } catch (error) {
    console.error('Get IPs error:', error)
    res.status(500).json({ status: false, error: 'Failed to get IPs' })
  }
})

router.get('/api/user/apikeys/:key/stats', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const ApiLog = (await import('../../database/models/ApiLog.js')).ApiLog
    const logs = await ApiLog.find({ apiKey: key })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('endpoint method ip statusCode responseTime createdAt')
    
    const user = await User.findById(req.user._id)
    const apiKey = user.apikeys.find(k => k.key === key)
    if (!apiKey) return res.status(404).json({ status: false, error: 'API key not found' })
    
    res.json({
      status: true,
      data: {
        apiKey,
        recentLogs: logs,
        usageToday: apiKey.usageToday,
        limitPerDay: apiKey.limitPerDay,
        totalUsage: apiKey.totalUsage
      }
    })
  } catch (error) {
    console.error('Get API key stats error:', error)
    res.status(500).json({ status: false, error: 'Failed to get API key statistics' })
  }
})

export default (app) => {
  app.use(router)
                  }
