import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

/**
 * Connects to MongoDB using the URI from environment variables.
 * Throws a safe initialization error so the server entrypoint controls exit
 * behavior and maintenance scripts can handle the failure themselves.
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    const error = new Error('MONGO_URI is required before the API can start.');
    error.code = 'DATABASE_CONFIGURATION_ERROR';
    throw error;
  }

  try {
    const timeoutMs = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000,
      connectTimeoutMS: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] Connection error after initial connect:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected.');
    });
  } catch (err) {
    const error = new Error('MongoDB could not be reached during startup.');
    error.code = 'DATABASE_CONNECTION_ERROR';
    error.cause = err;
    throw error;
  }
}

export default connectDB;
