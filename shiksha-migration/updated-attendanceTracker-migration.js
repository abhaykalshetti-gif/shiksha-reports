const { Client } = require('pg');
const dbConfig = require('./db');

console.log('=== Loading attendance-tracker-migration.js ===');

function pad2(n) {
  return String(n).padStart(2, '0');
}

async function migrateAttendanceTracker() {
  console.log('=== STARTING ATTENDANCE TRACKER MIGRATION ===');
  const sourceClient = new Client(dbConfig.attendance_source); // Using same source as assessment
  const destClient = new Client(dbConfig.attendance_destination); // Using same destination as assessment

  try {
    await sourceClient.connect();
    console.log('[ATND] Connected to source');
    await destClient.connect();
    console.log('[ATND] Connected to destination');

    // Pull all attendance rows with precomputed year, month, day
    const res = await sourceClient.query(`
      SELECT 
        a."attendanceDate"::date AS attendance_date,
        EXTRACT(YEAR FROM a."attendanceDate")::int AS year_num,
        EXTRACT(MONTH FROM a."attendanceDate")::int AS month_num,
        TO_CHAR(a."attendanceDate", 'DD') AS day_str,
        a.attendance,
        a."userId",
        a."tenantId",
        a."contextId",
        a.context,
        a.absentReason,
      FROM public."Attendance" a
      WHERE a."attendanceDate" IS NOT NULL 
        AND a."userId" IS NOT NULL
    `);
    console.log(`[ATND] Fetched ${res.rows.length} rows`);

    // Group by (tenantId, context, contextId, userId, Year, Month)
    const groups = new Map();
    for (const r of res.rows) {
      const year = r.year_num;
      const month = r.month_num;
      const dayCol = r.day_str; // already zero-padded ('01'-'31')
      if (!year || !month || !dayCol) continue;
      const key = [r.tenantId || '', r.context || '', r.contextId || '', r.userId || '', year, month].join('|');
      if (!groups.has(key)) {
        groups.set(key, {
          tenantId: r.tenantId || null,
          context: r.context || null,
          contextId: r.contextId || null,
          userId: r.userId,
          year,
          month,
          days: {},
absentReasons: {}

        });
      }
      const g = groups.get(key);
      g.days[dayCol] = r.attendance || null;
    }
    
    // absent reason (new)
if (r.absentReason) {
  g.absentReasons[`${dayCol}_AbsentReason`] = r.absentReason;
}

    console.log(`[ATND] Groups to upsert: ${groups.size}`);
    if (groups.size === 0 && res.rows.length > 0) {
      console.log('[ATND] Sample row for debugging:', res.rows[0]);
    }

    let processed = 0;
    for (const [, g] of groups) {
      await upsertOne(destClient, g);
      processed += 1;
      // For single-record testing, uncomment:
      console.log('[ATND] 🛑 Stopping after one group for testing');
      // break;
    }

    console.log(`[ATND] Done. Upserted ${processed} monthly aggregates`);
  } catch (e) {
    console.error('[ATND] Fatal error', e);
  } finally {
    await sourceClient.end();
    await destClient.end();
    console.log('[ATND] Disconnected');
  }
}

// Update-if-exists (by natural key), else insert
async function upsertOne(client, g) {
  const keyParams = [g.tenantId, g.context, g.contextId, g.userId, g.year, g.month];

  // Build dynamic SET for update with provided day columns only
  const setFrags = [];
  const setVals = [];
 
  let idx = 1;

Object.entries(g.days).forEach(([col, val]) => {
  setFrags.push(`"${col}" = $${idx++}`);
  setVals.push(val);
});

Object.entries(g.absentReasons).forEach(([col, val]) => {
  setFrags.push(`"${col}" = $${idx++}`);
  setVals.push(val);
});

  if (setFrags.length > 0) {
    const updateSql = `
      UPDATE public."AttendanceTracker"
      SET ${setFrags.join(', ')}
      WHERE "TenantID" = $${setVals.length + 1}
        AND "Context" = $${setVals.length + 2}
        AND "ContextID" = $${setVals.length + 3}
        AND "UserID" = $${setVals.length + 4}
        AND "Year" = $${setVals.length + 5}
        AND "Month" = $${setVals.length + 6}
    `;

    const updParams = [...setVals, ...keyParams];
    const updRes = await client.query(updateSql, updParams);
    if (updRes.rowCount > 0) return; // updated successfully
  }

  // Need to insert
  const dayCols = Object.keys(g.days).sort();
const reasonCols = Object.keys(g.absentReasons).sort();

const cols = [
  '"TenantID"', '"Context"', '"ContextID"', '"UserID"', '"Year"', '"Month"',
  ...dayCols.map(c => `"${c}"`),
  ...reasonCols.map(c => `"${c}"`)
];

const vals = [
  g.tenantId, g.context, g.contextId, g.userId, g.year, g.month,
  ...dayCols.map(c => g.days[c]),
  ...reasonCols.map(c => g.absentReasons[c])
];

  const placeholders = vals.map((_, i) => `$${i + 1}`);

  const insertSql = `
    INSERT INTO public."AttendanceTracker" (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
  `;
  await client.query(insertSql, vals);
}

if (require.main === module) {
  console.log('Running attendance-tracker-migration.js directly');
  migrateAttendanceTracker().catch(err => {
    console.error('Attendance tracker migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrateAttendanceTracker };