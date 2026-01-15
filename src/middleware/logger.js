import { ApiLog } from '../database/models/ApiLog.js'
import { UsageStats } from '../database/models/UsageStats.js'
import { connectDB } from '../database/db.js'

export function createLogger() {
  return (req, res, next) => {
    const apiPatterns = [
      /^\/api\//,
      /^\/ai\//,
      /^\/random\//,
      /^\/maker\//,
      /^\/v[1-5]\//,
      /^\/admin\//
    ]
    const isApiRequest = apiPatterns.some(pattern => pattern.test(req.path))
    if (!isApiRequest) return next()
    
    const startTime = Date.now()
    const originalEnd = res.end
    const chunks = []
    
    const originalWrite = res.write
    res.write = function(chunk, ...args) {
      chunks.push(Buffer.from(chunk))
      return originalWrite.call(this, chunk, ...args)
    }
    
    res.end = async function(chunk, ...args) {
      if (chunk) chunks.push(Buffer.from(chunk))
      try {
        await logRequest(req, res, startTime, Buffer.concat(chunks).toString('utf8'))
      } catch (error) {
        console.error('⚠️ Logging failed:', error.message)
      }
      return originalEnd.call(this, chunk, ...args)
    }
    next()
  }
}

async function logRequest(req, res, startTime, responseBody) {
  try {
    await connectDB()
    
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const responseTime = Date.now() - startTime
    const statusCode = res.statusCode
    const success = statusCode >= 200 && statusCode < 300
    
    const userId = req.user?._id || null
    const apiKey = req.apiKey?.key || null
    const apiKeyName = req.apiKey?.name || null
    const userEmail = req.user?.email || null
    const username = req.user?.username || null
    
    const apiLog = new ApiLog({
      requestId,
      endpoint: req.path,
      method: req.method,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
      userId,
      apiKey,
      apiKeyName,
      userAgent: req.headers['user-agent'] || 'unknown',
      userEmail,
      username,
      query: req.query,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'x-api-key': req.headers['x-api-key'] ? '***' : undefined,
        'authorization': req.headers['authorization'] ? '***' : undefined
      },
      statusCode,
      responseTime,
      version: extractVersion(req.path) || 'v1',
      creator: 'Asuma API',
      success,
      error: !success ? truncateError(responseBody) : null,
      errorStack: null,
      dailyUsage: req.tracking?.usageToday || 0,
      dailyLimit: req.tracking?.limitPerDay || 0
    })
    
    await apiLog.save()
    
    const date = new Date().toISOString().split('T')[0]
    const version = extractVersion(req.path) || 'v1'
    
    await UsageStats.findOneAndUpdate(
      {
        date,
        endpoint: req.path,
        method: req.method,
        version
      },
      {
        $inc: {
          totalRequests: 1,
          successRequests: success ? 1 : 0,
          failedRequests: success ? 0 : 1,
          totalResponseTime: responseTime
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    )
    
  } catch (error) {
    console.error('❌ Logging Error:', error.message)
  }
}

function extractVersion(path) {
  const versionMatch = path.match(/^\/(v[1-5])\//)
  return versionMatch ? versionMatch[1] : null
}

function truncateError(errorBody, maxLength = 500) {
  if (!errorBody) return null
  if (typeof errorBody === 'string') return errorBody.substring(0, maxLength)
  try {
    const errorStr = typeof errorBody === 'object' ? (errorBody.error || JSON.stringify(errorBody)) : String(errorBody)
    return errorStr.substring(0, maxLength)
  } catch {
    return 'Error parsing error message'
  }
}
