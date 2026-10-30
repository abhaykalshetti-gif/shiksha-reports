const { Client } = require('pg');
const dbConfig = require('./db');
const axios = require('axios');

console.log('=== Loading assessment-tracker-migration.js ===');

function isUUID(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

// Cache for userId -> tenantId lookups
const userIdToTenantId = new Map();

async function getTenantIdForUser(sourceClient, userId) {
  if (!userId) return null;
  if (userIdToTenantId.has(userId)) return userIdToTenantId.get(userId);
  
  try {
    // Try different possible table name variations
    const possibleQueries = [
      'SELECT "tenantId" FROM public."UserTenantMapping" WHERE "userId" = $1 LIMIT 1',
      'SELECT "tenantId" FROM public.usertenantmapping WHERE "userId" = $1 LIMIT 1',
      'SELECT "tenantId" FROM public."userTenantMapping" WHERE "userId" = $1 LIMIT 1'
    ];
    
    for (const query of possibleQueries) {
      try {
        const res = await sourceClient.query(query, [userId]);
        if (res.rows.length > 0) {
          const tenantId = res.rows[0].tenantId;
          console.log(`[ASSESSMENT TRACKER] Found tenantId: ${tenantId} for user: ${userId} using query: ${query}`);
          userIdToTenantId.set(userId, tenantId);
          return tenantId;
        }
      } catch (queryError) {
        // Try next query variation
        continue;
      }
    }
    
    console.warn(`[ASSESSMENT TRACKER] No tenantId found in any table variation for user: ${userId}`);
    userIdToTenantId.set(userId, null);
    return null;
  } catch (e) {
    console.warn('[ASSESSMENT TRACKER] Error fetching tenantId for user', userId, e.message);
    userIdToTenantId.set(userId, null);
    return null;
  }
}

async function getAssessmentData(assessmentId) {
  try {
    const baseUrl = 'https://lap.prathamdigital.org/';
    if (!baseUrl) {
      console.warn('[ASSESSMENT TRACKER] MIDDLEWARE_SERVICE_BASE_URL not configured, using default values');
      return { 
        name: 'Unknown Assessment',
        type: 'Assessment'
      };
    }

    if (!assessmentId) {
      throw new Error('Identifier is required for API call');
    }

    const url = new URL('action/composite/v3/search', baseUrl);

    const apiResponse = await axios.post(
      url.toString(),
      {
        request: {
          filters: {
            identifier: [assessmentId],
          },
        },
      },
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const questionSet = apiResponse.data.result?.QuestionSet?.[0];
    const assessmentName = questionSet?.name || 'Unknown Assessment';
    const assessmentType = questionSet?.assessmentType || 'Assessment';
    
    console.log(`[ASSESSMENT TRACKER] Assessment data for ${assessmentId}:`);
    console.log(`  - Name: ${assessmentName}`);
    console.log(`  - Type: ${assessmentType}`);
    
    return {
      name: assessmentName,
      type: assessmentType
    };
  } catch (error) {
    console.error(
      '[ASSESSMENT TRACKER] Error fetching assessment data for assessmentId:',
      assessmentId,
      error.message,
    );
    return { 
      name: 'Unknown Assessment',
      type: 'Assessment'
    }; // Fallback to default values
  }
}

async function migrateAssessmentTracker() {
  console.log('=== STARTING ASSESSMENT TRACKER MIGRATION ===');
  // const sourceClient = new Client(dbConfig.source);
  // const destClient = new Client(dbConfig.destination);
  const sourceClient = new Client(dbConfig.source); // Using same source as assessment
  const destClient = new Client(dbConfig.destination); // Using same destination as assessment

  try {
    await sourceClient.connect();
    console.log('[ASSESSMENT TRACKER] Connected to source database');
    await destClient.connect();
    console.log('[ASSESSMENT TRACKER] Connected to destination database');

    const assessmentsRes = await sourceClient.query(`
      SELECT
        "assessmentTrackingId",
        "userId",
        "courseId",
        "contentId",
        "assessmentSummary",
        "timeSpent",
        "attemptId",
        "tenantId",
        "totalScore",
        "totalMaxScore"
      FROM public.assessment_tracking
      WHERE "userId" in ('559dd229-332c-4e0c-a40a-902b7ac5a4bc',
'f7e24377-2e76-4a23-9aae-9b52396118ec',
'536839b5-1de9-45d2-bfb7-1f3c95b02e66',
'dd3c0d66-4edc-4d42-96ac-2d0258117619',
'28c7d615-ab27-4838-9135-89befa75fc87',
'8c463806-4e43-42cc-9500-02d30ae539bd',
'b028c68c-d24b-4764-9453-58997f16d520',
'758c4db7-ba54-43cc-846f-b86e5c1a7c2d',
'6d0f3601-e8c1-4cbe-be93-191634dd13e2',
'aa1bef6a-61ba-43a5-a04c-ad6734a39c99',
'cf875e15-a1ac-4fcd-a1b3-e4f14f2f1188',
'68cc4f81-c96a-4d2a-8d7d-4672fea9b303',
'1efc8051-d016-41a3-a611-eb13e2821892',
'aa3c7ba6-2d78-4602-b72b-d27918cf585d',
'050657f3-94b7-46f9-98a3-8e646d2ec224',
'9bb371cf-349f-435c-a38a-fdde10065af8',
'589efc23-6e78-444d-a914-3d4b32f0486e',
'087e2051-2921-490a-bf4f-340ce282b98c',
'1ff37715-0cde-4a8f-92e1-a272d78e7c83',
'0d02b883-d742-45da-b00f-b24a0a97d49d',
'f9c80c8c-b5a8-4565-9c53-f2e117f733a9',
'40e4774a-70c3-4341-b77d-650582375ef1',
'280e07dc-9685-4b46-909a-f71d0614a023',
'702c0c99-de9f-42a2-9d95-c1e490ca7a1f',
'a95eea1a-e605-4e03-8603-a069726cfda9',
'b77e5735-64e8-47a6-8ed5-72793d8edc82',
'373a2c69-9efe-43ba-91c9-644fad9367fc',
'3ad29d9d-83a5-443a-9967-a9b926bfb182',
'eef723e6-54d4-4f95-8f4e-fb6836a105d4',
'118d4c6a-9dfb-4c6e-86ce-39b138c46c25',
'92bf743a-48da-4631-a8f8-3f5c94d78293',
'a2bbee35-de9c-4fad-8941-dda1ce5b400f',
'6f746f5d-caf6-46e5-a1fa-1068cd2bac89',
'5ccbf331-1a48-4dec-be83-8a36409ab331',
'c358868a-b888-40c3-b574-3f8361d05f26',
'd6484e99-2ccd-444a-81bc-c605af64ad0e',
'567416f5-9dd0-4a55-a708-5f7a1e84f371',
'b0daa245-004d-42fe-9946-9986ad14b2cc',
'0b065dac-7cbf-466f-9f57-ae4587999383',
'6daad661-5e7a-4a0d-87b8-99a199e5c604',
'4c1c5082-0bbe-4eea-b3d8-20cb88e7f431',
'12795314-1d02-450b-9bb2-8bab387f2e9e')
    `);
    console.log(`[ASSESSMENT TRACKER] Found ${assessmentsRes.rows.length} assessment rows.`);

    for (const row of assessmentsRes.rows) {
      await upsertOne(sourceClient, destClient, row);
      console.log(upsertOne);
    //   For one-record testing, uncomment next two lines:
    //   console.log('[ASSESSMENT TRACKER] 🛑 Stopping after one record for testing');
    // //   break;
    }

    console.log('[ASSESSMENT TRACKER] Migration completed successfully');
  } catch (err) {
    console.error('[ASSESSMENT TRACKER] Critical error:', err);
  } finally {
    await sourceClient.end();
    await destClient.end();
    console.log('[ASSESSMENT TRACKER] Disconnected from databases');
  }
}

async function upsertOne(sourceClient, destClient, a) {

  console.log("[ASSESSMENT TRACKER] Processing record:", a);
  const assesTrackingId = a.assessmentTrackingId;
  const userId = a.userId;
  const courseIdRaw = a.courseId || '';
  const contentIdRaw = a.contentId || '';
  const timeSpent = toInt(a.timeSpent);
  const totalScore = Number(a.totalScore || 0);
  const totalMaxScore = Number(a.totalMaxScore || 0);
  const assessmentSummaryText =
    a.assessmentSummary != null ? JSON.stringify(a.assessmentSummary) : null;
  const attemptId = a.attemptId || null;

  // // Resolve TenantID from usertenantmapping
  const tenantId = a.tenantId;
  
  // if (!tenantId) {
  //   console.warn(`[ASSESSMENT TRACKER] No tenantId found for user ${userId}, using fallback`);
  //   tenantId = '10a9f829-3652-47d0-b17b-68c4428f9f89'; // Fallback only if no tenantId exists
  // } else {
  //   console.log(`[ASSESSMENT TRACKER] Using tenantId from userTenantMapping: ${tenantId} for user: ${userId}`);
  // }
  
  // CourseID can be stored as-is (do_ identifier or UUID)
  const courseId = courseIdRaw;
  
  // Fetch assessment data (name and type) from API using contentId
  const assessmentData = await getAssessmentData(contentIdRaw);
  const assessmentName = assessmentData.name;
  const assessmentType = assessmentData.type;
  
  console.log(`[ASSESSMENT TRACKER] Using assessmentType from API: ${assessmentType} (not evaluatedBy: ${a.evaluatedBy})`);
console
  // Upsert into destination
  const upsertSql = `
    INSERT INTO public."AssessmentTracker" (
      "AssesTrackingID", "AssessmentID", "CourseID", "UserID", "TenantID",
      "TotalMaxScore", "TotalScore", "TimeSpent", "AssessmentSummary",
      "AttemptID", "AssessmentType", "AssessmentName"
    )
    VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT ("AssesTrackingID")
    DO UPDATE SET
      "CourseID" = EXCLUDED."CourseID",
      "UserID" = EXCLUDED."UserID",
      "TenantID" = EXCLUDED."TenantID",
      "TotalMaxScore" = EXCLUDED."TotalMaxScore",
      "TotalScore" = EXCLUDED."TotalScore",
      "TimeSpent" = EXCLUDED."TimeSpent",
      "AssessmentSummary" = EXCLUDED."AssessmentSummary",
      "AttemptID" = EXCLUDED."AttemptID",
      "AssessmentType" = EXCLUDED."AssessmentType",
      "AssessmentName" = EXCLUDED."AssessmentName"
  `;

  const params = [
    assesTrackingId,
    courseId,
    userId,
    tenantId,
    totalMaxScore,
    totalScore,
    timeSpent,
    assessmentSummaryText,
    attemptId,
    assessmentType,
    assessmentName
  ];

  try {
    await destClient.query(upsertSql, params);
    console.log('[ASSESSMENT TRACKER] Upserted', assesTrackingId);
  } catch (e) {
    console.error('[ASSESSMENT TRACKER] Upsert error for', assesTrackingId, e.message);
  }
}

if (require.main === module) {
  console.log('Running assessment-tracker-migration.js directly');
  migrateAssessmentTracker().catch((err) => {
    console.error('AssessmentTracker migration failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { migrateAssessmentTracker };