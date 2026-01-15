import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const ipTrackingSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  endpoints: [{ type: String, max: 10 }],
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  banned: { type: Boolean, default: false }
})

const apiKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, default: 'Default API Key' },
  createdAt: { type: Date, default: Date.now },
  limitPerDay: { type: Number, default: 1000, min: 1, max: 100000 },
  usageToday: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: Date.now },
  ips: [ipTrackingSchema],
  status: { type: String, enum: ['active', 'revoked', 'suspended'], default: 'active' },
  totalUsage: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  webhookUrl: { type: String, default: '' },
  allowedOrigins: [{ type: String }]
}, { timestamps: true })

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone: { type: String, trim: true, sparse: true },
  passwordHash: { type: String, required: true },
  profileurl: { type: String, default: 'https://cdn.asuma.my.id/profil.jpg' },
  apikeys: [apiKeySchema],
  role: { type: String, enum: ['user', 'admin', 'premium', 'moderator'], default: 'user' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  totalApiCalls: { type: Number, default: 0 },
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' },
    expiresAt: Date,
    features: {
      maxApiKeys: { type: Number, default: 3 },
      maxDailyRequests: { type: Number, default: 1000 },
      ipTracking: { type: Boolean, default: true },
      customRateLimit: { type: Boolean, default: false }
    }
  },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true })

userSchema.index({ 'apikeys.key': 1 })
userSchema.index({ email: 1 })
userSchema.index({ username: 1 })

userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next()
  try {
    const salt = await bcrypt.genSalt(10)
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
    next()
  } catch (error) { next(error) }
})

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash)
}

userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now())
}

userSchema.methods.incLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1
    this.lockUntil = undefined
  } else {
    this.loginAttempts += 1
    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 30 * 60 * 1000
    }
  }
  await this.save()
}

userSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0
  this.lockUntil = undefined
  this.lastLogin = new Date()
  await this.save()
}

userSchema.methods.createApiKey = async function(name = 'Default', limitPerDay = 1000) {
  const crypto = await import('crypto')
  const key = `asuma-${crypto.randomBytes(24).toString('hex')}`
  const apiKey = {
    key,
    name,
    createdAt: new Date(),
    limitPerDay,
    usageToday: 0,
    lastUsedAt: new Date(),
    ips: [],
    status: 'active'
  }
  this.apikeys.push(apiKey)
  await this.save()
  return apiKey
}

userSchema.methods.getApiKey = function(apiKeyString) {
  return this.apikeys.find(k => k.key === apiKeyString)
}

userSchema.methods.banIpOnApiKey = async function(apiKeyString, ip, reason = '') {
  const apiKey = this.getApiKey(apiKeyString)
  if (!apiKey) return null
  let ipRecord = apiKey.ips.find(r => r.ip === ip)
  if (ipRecord) {
    ipRecord.banned = true
    ipRecord.lastSeen = new Date()
  } else {
    ipRecord = { ip, endpoints: [], firstSeen: new Date(), lastSeen: new Date(), banned: true }
    apiKey.ips.push(ipRecord)
  }
  await this.save()
  return ipRecord
}

userSchema.methods.trackApiUsage = async function(apiKeyString, endpoint, ip) {
  const apiKey = this.getApiKey(apiKeyString)
  if (!apiKey) return false
  const now = new Date()
  const lastUsed = new Date(apiKey.lastUsedAt)
  if (lastUsed.toDateString() !== now.toDateString()) {
    apiKey.usageToday = 0
  }
  apiKey.usageToday += 1
  apiKey.totalUsage += 1
  apiKey.lastUsedAt = now
  let ipRecord = apiKey.ips.find(r => r.ip === ip)
  if (!ipRecord) {
    ipRecord = { ip, endpoints: [], firstSeen: now, lastSeen: now, banned: false }
    apiKey.ips.push(ipRecord)
  } else {
    ipRecord.lastSeen = now
  }
  if (!ipRecord.endpoints.includes(endpoint)) {
    if (ipRecord.endpoints.length >= 10) ipRecord.endpoints.shift()
    ipRecord.endpoints.push(endpoint)
  }
  this.totalApiCalls += 1
  await this.save()
  return { apiKey, ipRecord, usageToday: apiKey.usageToday, limitPerDay: apiKey.limitPerDay }
}

export const User = mongoose.models.User || mongoose.model('User', userSchema)
