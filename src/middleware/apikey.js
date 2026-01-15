import { User } from '../database/models/User.js'
import fs from 'fs'
import path from 'path'

const rateLimitCache = new Map()
const settingsPath = path.join(process.cwd(), 'src', 'settings.json')

function loadSettings() {
  try {
    const data = fs.readFileSync(settingsPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return null
  }
}

function parseRateLimit(rateLimitString) {
  if (rateLimitString === 'unlimited') return { maxRequests: Infinity, windowMs: 0 }
  const match = rateLimitString.match(/^(\d+)\/(minute|hour|day)$/)
  if (!match) return { maxRequests: 50, windowMs: 60 * 1000 }
  const [, maxRequests, unit] = match
  let windowMs
  switch (unit) {
    case 'minute': windowMs = 60 * 1000; break
    case 'hour': windowMs = 60 * 60 * 1000; break
    case 'day': windowMs = 24 * 60 * 60 * 1000; break
    default: windowMs = 60 * 1000
  }
  return { maxRequests: parseInt(maxRequests), windowMs }
}

function checkOldApiKeySystem(apikey) {
  const settings = loadSettings()
  if (!settings || !settings.apiSettings || !settings.apiSettings.apikey) return false
  const apikeyConfig = settings.apiSettings.apikey[apikey]
  if (!apikeyConfig || !apikeyConfig.enabled) return false
  if (apikeyConfig.rateLimit === 'unlimited') return true
  const { maxRequests, windowMs } = parseRateLimit(apikeyConfig.rateLimit)
  const now = Date.now()
  const key = `${apikey}_${Math.floor(now / windowMs)}`
  if (!rateLimitCache.has(key)) rateLimitCache.set(key, { count: 0, resetTime: now + windowMs })
  const limitData = rateLimitCache.get(key)
  if (now > limitData.resetTime) {
    limitData.count = 0
    limitData.resetTime = now + windowMs
  }
  if (limitData.count >= maxRequests) return false
  limitData.count++
  return true
}

export async function validateApiKey(req, res, next) {
  const { apikey } = req.query
  if (!apikey) {
    const settings = loadSettings()
    return res.status(401).json({
      status: false,
      creator: settings?.apiSettings?.creator || "Asuma API",
      error: "API key required",
      message: "Please provide a valid API key in query parameters"
    })
  }
  
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'
  const endpoint = req.path
  
  const user = await User.findOne({ 'apikeys.key': apikey })
  
  if (user && user.apikeys && user.apikeys.length > 0) {
    const apiKeyObj = user.apikeys.find(k => k.key === apikey)
    
    if (!apiKeyObj) {
      return res.status(403).json({
        status: false,
        creator: "Asuma API",
        error: "Invalid API key",
        message: "The provided API key is not valid"
      })
    }
    
    if (apiKeyObj.status !== 'active') {
      return res.status(403).json({
        status: false,
        creator: "Asuma API",
        error: "API key inactive",
        message: `This API key is ${apiKeyObj.status}`
      })
    }
    
    const ipRecord = apiKeyObj.ips.find(r => r.ip === clientIp)
    if (ipRecord?.banned) {
      return res.status(403).json({
        status: false,
        creator: "Asuma API",
        error: "IP banned",
        message: "Your IP address has been banned from using this API key"
      })
    }
    
    if (apiKeyObj.usageToday >= apiKeyObj.limitPerDay) {
      return res.status(429).json({
        status: false,
        creator: "Asuma API",
        error: "Daily limit exceeded",
        message: `Daily limit of ${apiKeyObj.limitPerDay} requests reached`,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    }
    
    const rateLimitKey = `${apikey}_${clientIp}`
    const now = Date.now()
    const windowMs = 60 * 1000
    const maxPerMinute = 60
    
    if (!rateLimitCache.has(rateLimitKey)) {
      rateLimitCache.set(rateLimitKey, { count: 0, resetTime: now + windowMs })
    }
    
    const rateData = rateLimitCache.get(rateLimitKey)
    if (now > rateData.resetTime) {
      rateData.count = 0
      rateData.resetTime = now + windowMs
    }
    
    if (rateData.count >= maxPerMinute) {
      return res.status(429).json({
        status: false,
        creator: "Asuma API",
        error: "Rate limit exceeded",
        message: "Too many requests from your IP",
        resetIn: Math.ceil((rateData.resetTime - now) / 1000)
      })
    }
    
    rateData.count++
    const tracking = await user.trackApiUsage(apikey, endpoint, clientIp)
    req.user = user
    req.apiKey = apiKeyObj
    req.tracking = tracking
    
    return next()
  } else {
    const oldSystemValid = checkOldApiKeySystem(apikey)
    if (!oldSystemValid) {
      return res.status(403).json({
        status: false,
        creator: "Asuma API",
        error: "Invalid API key",
        message: "The provided API key is not valid"
      })
    }
    return next()
  }
}

export function createApiKeyMiddleware() {
  return async (req, res, next) => {
    const settings = loadSettings()
    if (!settings || !settings.apiSettings) return next()
    if (settings.apiSettings.requireApikey === false) return next()
    return validateApiKey(req, res, next)
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, data] of rateLimitCache.entries()) {
    if (now > data.resetTime) rateLimitCache.delete(key)
  }
}, 60000)
