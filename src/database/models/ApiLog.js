import mongoose from 'mongoose';

const apiLogSchema = new mongoose.Schema({
  requestId: { type: String, required: true, index: true },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  ip: { type: String },
  userAgent: { type: String },
  query: { type: mongoose.Schema.Types.Mixed },
  body: { type: mongoose.Schema.Types.Mixed },
  headers: { type: mongoose.Schema.Types.Mixed },
  statusCode: { type: Number },
  responseTime: { type: Number },
  version: { type: String },
  apiKey: { type: String, index: true },
  creator: { type: String },
  success: { type: Boolean, default: false },
  error: { type: String },
  errorStack: { type: String },
  createdAt: { type: Date, default: Date.now, index: true }
});

export const ApiLog = mongoose.models.ApiLog || mongoose.model('ApiLog', apiLogSchema);
