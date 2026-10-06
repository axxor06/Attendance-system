import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const confirmed = process.env.ALLOW_LEGACY_AGE_CLEANUP === 'true';
const uri = process.env.MONGO_URI;
if (!uri) throw new Error('MONGO_URI is required.');
if (process.env.NODE_ENV === 'production' && !confirmed) throw new Error('Refusing production cleanup without ALLOW_LEGACY_AGE_CLEANUP=true. Back up first.');

await mongoose.connect(uri, { serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000) });
const collection = mongoose.connection.collection('users');
const legacyCount = await collection.countDocuments({ age: { $exists: true }, dateOfBirth: { $exists: false } });
console.log(`Found ${legacyCount} legacy user records with age but no dateOfBirth.`);
console.log('No DOB values are invented. Obtain verified dates from the institution before setting dateOfBirth.');
if (confirmed && legacyCount > 0) {
  const result = await collection.updateMany({ age: { $exists: true } }, { $unset: { age: '' } });
  console.log(`Removed obsolete age fields from ${result.modifiedCount} records after explicit confirmation.`);
}
await mongoose.disconnect();
