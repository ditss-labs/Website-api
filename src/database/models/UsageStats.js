import mongoose from 'mongoose';

const usageStatsSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true }, 
  endpoint: { type: String, required: true, index: true },
  method: { type: String, required: true },
  version: { type: String },
  totalRequests: { type: Number, default: 0 },
  successRequests: { type: Number, default: 0 },
  failedRequests: { type: Number, default: 0 },
  totalResponseTime: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

usageStatsSchema.index({ date: 1, endpoint: 1, method: 1, version: 1 }, { unique: true });

export const UsageStats = mongoose.models.UsageStats || mongoose.model('UsageStats', usageStatsSchema);
