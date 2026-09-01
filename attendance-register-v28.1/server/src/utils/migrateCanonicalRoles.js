import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const uri = process.env.MONGO_URI;
const confirmed = process.env.ALLOW_ROLE_MODEL_MIGRATION === 'true';
const dryRun = process.env.ROLE_MIGRATION_DRY_RUN === 'true';
const LEGACY_ROLE_MAP = Object.freeze({ hod: 'super_admin', faculty: 'admin', student: 'user' });
const CANONICAL_ROLES = new Set(['super_admin', 'admin', 'user']);

function parseAdminReviewMap(value) {
  if (!value) return new Map();
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('ROLE_MIGRATION_ADMIN_MAP must be valid JSON, for example {"<userId>":"admin"}.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ROLE_MIGRATION_ADMIN_MAP must be a JSON object keyed by Mongo user id.');
  }
  const map = new Map();
  for (const [id, role] of Object.entries(parsed)) {
    if (!mongoose.isValidObjectId(id)) throw new Error(`ROLE_MIGRATION_ADMIN_MAP contains an invalid user id: ${id}`);
    if (!CANONICAL_ROLES.has(role)) throw new Error(`ROLE_MIGRATION_ADMIN_MAP target must be one of: ${[...CANONICAL_ROLES].join(', ')}.`);
    map.set(id, role);
  }
  return map;
}

async function run() {
  if (!uri) throw new Error('MONGO_URI is required.');
  if (!confirmed) {
    throw new Error('Refusing role migration. Set ALLOW_ROLE_MODEL_MIGRATION=true only after backing up and reviewing the role plan.');
  }
  if (process.env.NODE_ENV === 'production' && !confirmed) {
    throw new Error('Refusing production role migration without explicit confirmation.');
  }

  const adminReviewMap = parseAdminReviewMap(process.env.ROLE_MIGRATION_ADMIN_MAP);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
    connectTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
  });

  const users = mongoose.connection.collection('users');
  const counts = Object.fromEntries(await Promise.all(
    [...Object.keys(LEGACY_ROLE_MAP), 'admin'].map(async (role) => [role, await users.countDocuments({ role })])
  ));
  console.log(`Role migration inventory: ${JSON.stringify(counts)}`);

  const ambiguousAdminIds = await users.find({ role: 'admin' }, { projection: { _id: 1 } }).toArray();
  const unmappedAdminIds = ambiguousAdminIds
    .map(({ _id }) => String(_id))
    .filter((id) => !adminReviewMap.has(id));
  if (unmappedAdminIds.length > 0) {
    throw new Error(
      `${unmappedAdminIds.length} role=admin record(s) require explicit review because older deployments used admin for a different privilege tier. ` +
      'Provide ROLE_MIGRATION_ADMIN_MAP={"<userId>":"admin"|"super_admin"} for every such record, or resolve the records manually before retrying.'
    );
  }

  const operations = [];
  for (const [legacyRole, canonicalRole] of Object.entries(LEGACY_ROLE_MAP)) {
    if (counts[legacyRole] > 0) {
      operations.push({ updateMany: { filter: { role: legacyRole }, update: { $set: { role: canonicalRole } } } });
    }
  }
  for (const [id, targetRole] of adminReviewMap) {
    operations.push({ updateOne: { filter: { _id: new mongoose.Types.ObjectId(id), role: 'admin' }, update: { $set: { role: targetRole } } } });
  }

  if (dryRun) {
    console.log(`Dry run: ${operations.length} role operation(s) would be applied. No records changed.`);
    return;
  }
  if (operations.length === 0) {
    console.log('No legacy role records require changes. Migration is already complete.');
    return;
  }
  const result = await users.bulkWrite(operations, { ordered: true });
  console.log(`Role migration complete. matched=${result.matchedCount ?? result.nMatched ?? 0}, modified=${result.modifiedCount ?? result.nModified ?? 0}.`);
}

try {
  await run();
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
