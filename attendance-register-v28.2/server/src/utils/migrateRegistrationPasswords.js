import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const rounds = 12;

async function run() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_CREDENTIAL_MIGRATION !== 'true') {
    throw new Error('Refusing credential migration in production unless ALLOW_CREDENTIAL_MIGRATION=true is explicitly set for a controlled maintenance window.');
  }

  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.collection('registrationrequests');
  const cursor = collection.find({ password: { $type: 'string' }, passwordHash: { $exists: false } });
  let migrated = 0;

  for await (const request of cursor) {
    const password = request.password;
    if (!password || password.length < 1) {
      throw new Error(`Registration request ${request._id} has an empty password and requires manual review.`);
    }
    const passwordHash = await bcrypt.hash(password, rounds);
    await collection.updateOne(
      { _id: request._id, password: password },
      { $set: { passwordHash }, $unset: { password: '' } }
    );
    migrated += 1;
  }

  console.log(`Migrated ${migrated} legacy registration request credential(s).`);
}

run()
  .catch((error) => {
    console.error('[Migration] Registration password migration failed', {
      category: 'REGISTRATION_PASSWORD_MIGRATION_FAILURE',
      errorCode: typeof error?.code === 'string' ? error.code.slice(0, 80) : 'MIGRATION_ERROR',
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
