const { Client } = require('pg');
const dbConfig = require('./db');

console.log('=== Loading cohort-academicYear-mapping-migration.js ===');

async function migrateCohortAcYrMapping() {
  console.log('=== STARTING CohortAcademicYear → CohortAcYr_Mapping MIGRATION ===');

  const sourceClient = new Client(dbConfig.source);
  const destClient = new Client(dbConfig.destination);

  try {
    await sourceClient.connect();
    console.log('[COHORT_ACYR] Connected to source database');

    await destClient.connect();
    console.log('[COHORT_ACYR] Connected to destination database');

    // STEP 1 — Fetch all rows from source CohortAcademicYear,
    //           INNER JOIN Cohort to get tenantId per row (TenantID is NOT NULL
    //           in destination, so orphaned rows with no Cohort are excluded).
    const fetchQuery = `
      SELECT
        cay."cohortAcademicYearId",
        cay."academicYearId",
        cay."cohortId",
        co."tenantId"
      FROM public."CohortAcademicYear" cay
      INNER JOIN public."Cohort" co
        ON co."cohortId" = cay."cohortId"
      ORDER BY cay."createdAt" desc
    `;

    const { rows } = await sourceClient.query(fetchQuery);
    console.log(`[COHORT_ACYR] Found ${rows.length} CohortAcademicYear records to migrate`);

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        // STEP 2 — Check if the row already exists in destination by CohortAcYrMappingID.
        const checkRes = await destClient.query(
          `SELECT 1 FROM public."CohortAcYr_Mapping" WHERE "CohortAcYrMappingID" = $1 LIMIT 1`,
          [row.cohortAcademicYearId]
        );

        if (checkRes.rows.length === 0) {
          // INSERT — row does not exist yet.
          await destClient.query(
            `INSERT INTO public."CohortAcYr_Mapping"
               ("CohortAcYrMappingID", "AcYrID", "CohortID", "TenantID")
             VALUES ($1, $2, $3, $4)`,
            [
              row.cohortAcademicYearId,  // $1  CohortAcYrMappingID (same UUID preserved)
              row.academicYearId,        // $2  AcYrID
              row.cohortId,              // $3  CohortID
              row.tenantId,              // $4  TenantID (from INNER JOIN Cohort)
            ]
          );
          inserted++;
          console.log(`[COHORT_ACYR] Inserted  CohortAcYrMappingID=${row.cohortAcademicYearId}`);
        } else {
          // UPDATE — row already exists; refresh all columns.
          await destClient.query(
            `UPDATE public."CohortAcYr_Mapping"
             SET "AcYrID"   = $2,
                 "CohortID" = $3,
                 "TenantID" = $4
             WHERE "CohortAcYrMappingID" = $1`,
            [
              row.cohortAcademicYearId,
              row.academicYearId,
              row.cohortId,
              row.tenantId,
            ]
          );
          updated++;
          console.log(`[COHORT_ACYR] Updated   CohortAcYrMappingID=${row.cohortAcademicYearId}`);
        }
      } catch (err) {
        failed++;
        console.error(
          `[COHORT_ACYR] Failed   CohortAcYrMappingID=${row.cohortAcademicYearId}:`,
          err.message
        );
      }
    }

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log({
      total: rows.length,
      inserted,
      updated,
      failed,
    });
    console.log('[COHORT_ACYR] Migration completed successfully');

  } catch (err) {
    console.error('[COHORT_ACYR] Critical error:', err.message);
    throw err;
  } finally {
    await sourceClient.end();
    console.log('[COHORT_ACYR] Disconnected from source database');

    await destClient.end();
    console.log('[COHORT_ACYR] Disconnected from destination database');
  }
}

if (require.main === module) {
  console.log('Running cohort-academicYear-mapping-migration.js directly');
  migrateCohortAcYrMapping().catch((err) => {
    console.error('Migration failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = migrateCohortAcYrMapping;
