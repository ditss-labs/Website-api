import mongoose from 'mongoose'

const apiLogSchema = new mongoose.Schema({
  requestId: { type: String, required: true, index: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  ip: { type: String, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  apiKey: { type: String, index: true },
  apiKeyName: { type: String },
  userAgent: { type: String },
  query: { type: mongoose.Schema.Types.Mixed },
  body: { type: mongoose.Schema.Types.Mixed },
  headers: { type: mongoose.Schema.Types.Mixed },
  statusCode: { type: Number },
  responseTime: { type: Number },
  version: { type: String },
  userEmail: { type: String },
  username: { type: String },
  creator: { type: String },
  success: { type: Boolean, default: false },
  error: { type: String },
  errorStack: { type: String },
  dailyUsage: { type: Number },
  dailyLimit: { type: Number },
  createdAt: { type: Date, default: Date.now, index: true, expires: 86400 }
}, { timestamps: true })

apiLogSchema.index({ userId: 1, createdAt: -1 })
apiLogSchema.index({ apiKey: 1, createdAt: -1 })
apiLogSchema.index({ endpoint: 1, createdAt: -1 })
apiLogSchema.index({ success: 1, createdAt: -1 })

export const ApiLog = mongoose.models.ApiLog || mongoose.model('ApiLog', apiLogSchema)
