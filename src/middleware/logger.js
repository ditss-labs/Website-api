
import { ApiLog } from '../database/models/ApiLog.js';
import { UsageStats } from '../database/models/UsageStats.js';
import { connectDB } from '../database/db.js';

export function createLogger() {
  return (req, res, next) => {
    const apiPatterns = [
      /^\/docs\//,           // /api/*
      /^\/ai\//,            // /ai/*
      /^\/random\//,        // /random/*
      /^\/maker\//,         // /maker/*
      /^\/v[1-5]\//,        // /v1/, /v2/, /v3/, /v4/, /v5/
      /^\/admiin\//          // /admin/*
    ];
    
    const isApiRequest = apiPatterns.some(pattern => pattern.test(req.path));
    if (!isApiRequest) {
      return next();
    }
    const startTime = Date.now();
    
    const originalEnd = res.end;
    const chunks = [];
    
    const originalWrite = res.write;
    res.write = function(chunk, ...args) {
      chunks.push(Buffer.from(chunk));
      return originalWrite.call(this, chunk, ...args);
    };
    
    res.end = async function(chunk, ...args) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
      
      try {
        await logRequest(req, res, startTime, Buffer.concat(chunks).toString('utf8'));
      } catch (error) {
        console.error('⚠️ Logging failed:', error.message);
      }
      
      return originalEnd.call(this, chunk, ...args);
    };
    
    next();
  };
}

async function logRequest(req, res, startTime, responseBody) {
  try {
    await connectDB();
    
    const requestId = req.headers['x-vercel-id'] || `asuma-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 300;
    
    console.log(`📝 Logging API: ${req.method} ${req.path} (${statusCode})`);
    const apiLog = new ApiLog({
      requestId,
      endpoint: req.path,
      method: req.method,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
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
      apiKey: req.apiKeyId || null,
      creator: 'DitssGanteng',
      success,
      error: !success && responseBody ? 
        (typeof responseBody === 'string' ? responseBody.substring(0, 500) : 
         (responseBody.error || JSON.stringify(responseBody)).substring(0, 500)) : 
        null,
      errorStack: null
    });
    
    await apiLog.save();
    const date = new Date().toISOString().split('T')[0];
    const version = extractVersion(req.path) || 'v1';
    
    await UsageStats.findOneAndUpdate(
      {
        date,
        endpoint: req.path,
        method: req.method,
        version: version
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
    );
    
    console.log(`✅ API Log saved: ${apiLog._id}`);
    
  } catch (error) {
    console.error('❌ Logging Error:', error.message);
  }
}
function extractVersion(path) {
  const versionMatch = path.match(/^\/(v[1-5])\//);
  return versionMatch ? versionMatch[1] : null;
          }
