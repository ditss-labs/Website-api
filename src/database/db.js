import mongoose from 'mongoose'
const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('Please define MONGODB_URI environment variable')

let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    const opts = { bufferCommands: true, maxPoolSize: 10, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000 }
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB Connected')
      return mongoose
    }).catch((error) => {
      console.error('❌ MongoDB Connection Error:', error.message)
      throw error
    })
  }
  try {
    cached.conn = await cached.promise
    return cached.conn
  } catch (error) {
    cached.promise = null
    throw error
  }
}
