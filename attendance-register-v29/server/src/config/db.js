import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

/**
 * Connects to MongoDB using the URI from environment variables.
 * Exits the process on failure since the API cannot function without a DB.
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('[DB] MONGO_URI is not defined in your .env file.');
    process.exit(1);
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
    console.error('[DB] Initial connection failed:', err.message);
    process.exit(1);
  }
}

export default connectDB;
