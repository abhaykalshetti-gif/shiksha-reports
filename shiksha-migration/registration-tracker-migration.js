const { Client } = require('pg');
const dbConfig = require('./db');

console.log('=== Loading registration-tracker-migration.js ===');

function isUUID(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function migrateRegistrationTracker() {
  console.log('=== STARTING REGISTRATION TRACKER MIGRATION ===');
  const sourceClient = new Client(dbConfig.source);
  const destClient = new Client(dbConfig.destination);

  try {
    await sourceClient.connect();
    console.log('[REG TRACKER] Connected to source database');
    await destClient.connect();
    console.log('[REG TRACKER] Connected to destination database');

    // Join UserTenantMapping with UserRolesMapping to get complete registration data
    
    const query = `
      SELECT 
        utm."userId",
        utm."tenantId",
        utm."createdAt" AS tenant_regn_date,
        urm."roleId",
        urm."createdAt" AS role_assigned_date
      FROM public."UserTenantMapping" utm
      INNER JOIN public."UserRolesMapping" urm 
        ON utm."userId" = urm."userId" 
        AND utm."tenantId" = urm."tenantId"
      WHERE utm."userId" IS NOT NULL 
        AND utm."tenantId" IS NOT NULL
        AND urm."roleId" IS NOT NULL
        AND utm."tenantId" = '914ca990-9b45-4385-a06b-05054f35d0b9'
    `;

    const res = await sourceClient.query(query);
    console.log(`[REG TRACKER] Found ${res.rows.length} registration records.`);
    let processed = 0;
    for (const row of res.rows) {
      await upsertRegistrationTracker(destClient, row);
      processed += 1;
      console.log(`[REG TRACKER] Processed ${processed}/${res.rows.length} - User: ${row.userId}, Role: ${row.roleId}, Tenant: ${row.tenantId}`);
      // For testing one item, uncomment below
      // break;
    }

    console.log(`[REG TRACKER] ✅ REGISTRATION DATA UPDATED SUCCESSFULLY! Processed ${processed} records`);
  } catch (err) {
    console.error('[REG TRACKER] Critical error:', err);
  } finally {
    await sourceClient.end();
    await destClient.end();
    console.log('[REG TRACKER] Disconnected from databases');
  }
}

async function upsertRegistrationTracker(destClient, row) {
  const userId = row.userId;
  const roleId = row.roleId;
  const tenantId = row.tenantId;

  if (!userId || !roleId || !tenantId) {
    console.warn('[REG TRACKER] Skipping row due to missing required fields', { userId, roleId, tenantId });
    return;
  }

  // Use the earliest date as platform registration date (could be tenant or role assignment)
  const platformRegnDate = row.tenant_regn_date || row.role_assigned_date || null;
  const tenantRegnDate = row.tenant_regn_date || null;
  const isActive = true; // Default to active

  // Check if record exists based on (UserID, RoleID, TenantID)
  const existing = await destClient.query(
    'SELECT "REGID" FROM public."RegistrationTracker" WHERE "UserID"=$1 AND "RoleID"=$2 AND "TenantID"=$3 LIMIT 1',
    [userId, roleId, tenantId]
  );

  if (existing.rows.length > 0) {
    // Update existing record
    const updateSql = `
      UPDATE public."RegistrationTracker"
      SET "PlatformRegnDate"=$4,
          "TenantRegnDate"=$5,
          "IsActive"=$6
      WHERE "UserID"=$1 AND "RoleID"=$2 AND "TenantID"=$3
    `;
    await destClient.query(updateSql, [userId, roleId, tenantId, platformRegnDate, tenantRegnDate, isActive]);
    return;
  }

  // Insert new record
  const insertSql = `
    INSERT INTO public."RegistrationTracker" (
      "UserID", "RoleID", "TenantID", "PlatformRegnDate", "TenantRegnDate", "IsActive"
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `;
  await destClient.query(insertSql, [userId, roleId, tenantId, platformRegnDate, tenantRegnDate, isActive]);
}

if (require.main === module) {
  console.log('Running registration-tracker-migration.js directly');
  migrateRegistrationTracker().catch(err => {
    console.error('RegistrationTracker migration failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { migrateRegistrationTracker };