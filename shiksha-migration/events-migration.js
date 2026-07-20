/*
  Events Migration Script
  - Reads from legacy event tables in source DB: "Events", "EventDetails", "EventRepetition"
  - Flattens and writes to reporting DB table: "Events" (new schema)
  - One row per repetition in destination
*/

const { Client } = require('pg');
const dbConfig = require('./db');

console.log('=== Loading events-migration.js ===');

function coerceString(v) {
  return v === undefined || v === null ? null : String(v);
}
function coerceDecimal(v) {
  return v === undefined || v === null || v === '' ? null : String(v);
}
function coerceDate(v) {
  return v ? new Date(v) : null;
}
// Always return a JSON TEXT representation (or null) for binding with ::jsonb
function coerceJson(v) {
  if (v === undefined || v === null) return null;
  // Buffer -> try parse, else stringify text
  if (Buffer.isBuffer(v)) {
    const s = v.toString('utf8').trim();
    if (!s || s.toLowerCase() === 'null') return null;
    try {
      JSON.parse(s);
      return s; // already JSON text
    } catch {
      return JSON.stringify(s);
    }
  }
  // Numbers/booleans
  if (typeof v === 'number' || typeof v === 'boolean') {
    return JSON.stringify(v);
  }
  // Objects/arrays
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return JSON.stringify(String(v));
    }
  }
  // Strings
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s.toLowerCase() === 'null') return null;
    try {
      JSON.parse(s);
      return s; // valid JSON text
    } catch {
      // not JSON => store as JSON string value
      return JSON.stringify(s);
    }
  }
  // Fallback
  return JSON.stringify(String(v));
}

async function migrateEvents() {
  console.log('=== STARTING EVENTS MIGRATION ===');

  const sourceClient = new Client(dbConfig.event_source);
  const destClient = new Client(dbConfig.event_destination);

  try {
    await sourceClient.connect();
    console.log('[EVENTS] Connected to source database');
    await destClient.connect();
    console.log('[EVENTS] Connected to destination database');

    // Join legacy tables; one row per repetition via LEFT JOIN
    const sql = `
      SELECT 
        e."eventId"               AS event_id,
        e."isRecurring"           AS is_recurring,
        e."recurrenceEndDate"     AS recurrence_end_date,
        e."recurrencePattern"     AS recurrence_pattern,
        e."autoEnroll"            AS auto_enroll,
        e."registrationStartDate" AS reg_start,
        e."registrationEndDate"   AS reg_end,
        e."createdBy"             AS created_by,
        e."updatedBy"             AS updated_by,
        er."eventRepetitionId"    AS event_repetition_id,
        ed."title"                AS title,
        ed."shortDescription"     AS short_description,
        ed."eventType"            AS event_type,
        ed."isRestricted"         AS is_restricted,
        ed."location"             AS location,
        ed."longitude"            AS longitude,
        ed."latitude"             AS latitude,
        ed."onlineProvider"       AS online_provider,
        ed."maxAttendees"         AS max_attendees,
        ed."recordings"           AS recordings,
        ed."status"               AS status,
        ed."description"          AS description,
        ed."meetingDetails"       AS meeting_details,
        ed."idealTime"            AS ideal_time,
        ed."metadata"             AS metadata,
        ed."attendees"            AS attendees,
        er."startDateTime"        AS start_dt,
        er."endDateTime"          AS end_dt,
        er."onlineDetails"        AS online_details
      FROM public."Events" e
      JOIN public."EventDetails" ed ON ed."eventDetailId" = e."eventDetailId"
      JOIN public."EventRepetition" er ON er."eventId" = e."eventId"
      ORDER BY e."eventId"
    `;

    const res = await sourceClient.query(sql);
    console.log(`[EVENTS] Fetched ${res.rows.length} rows to migrate`);


    const insertSql = `
      INSERT INTO public."Events" (
        title, "shortDescription", "eventType", "isRestricted",
        location, longitude, latitude, "onlineProvider", "maxAttendees",
        recordings, status, description, "meetingDetails", "createdBy", "updatedBy",
        "idealTime", metadata, attendees, "eventId",
        "startDateTime", "endDateTime", "onlineDetails",
        "autoEnroll", "registrationStartDate", "registrationEndDate", extra, "eventRepetitionId"
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,
        $10::jsonb,$11,$12,$13::jsonb,$14,$15,
        $16,$17::jsonb,$18::jsonb,$19,
        $20,$21,$22::jsonb,
        $23,$24,$25,$26::jsonb,$27
      )
      ON CONFLICT ("eventRepetitionId") DO NOTHING
    `;

    let rowCount = 0;
    const total = res.rows.length;

    for (const r of res.rows) {
      rowCount++;
      const params = [
        coerceString(r.title),
        coerceString(r.short_description),
        coerceString(r.event_type),
        !!r.is_restricted,
        coerceString(r.location),
        coerceDecimal(r.longitude),
        coerceDecimal(r.latitude),
        coerceString(r.online_provider),
        r.max_attendees ?? null,
        coerceJson(r.recordings),
        coerceString(r.status),
        coerceString(r.description),
        coerceJson(r.meeting_details),
        coerceString(r.created_by),
        coerceString(r.updated_by),
        coerceString(r.ideal_time),
        coerceJson(r.metadata),
        coerceJson(r.attendees),
        coerceString(r.event_id),
        coerceDate(r.start_dt),
        coerceDate(r.end_dt),
        coerceJson(r.online_details),
        !!r.auto_enroll,
        coerceDate(r.reg_start),
        coerceDate(r.reg_end),
        coerceJson(null),
        coerceString(r.event_repetition_id),
      ];

      try {
        await destClient.query(insertSql, params);
      } catch (e) {
        console.error('[EVENTS] Insert error for eventId:', r.event_id, e.message);
      }

      if (rowCount % 1000 === 0) {
        console.log(`[EVENTS] Progress: ${rowCount}/${total} rows processed`);
      }
    }

    console.log('[EVENTS] Migration batch completed');
  } catch (err) {
    console.error('[EVENTS] Critical error:', err);
  } finally {
    await sourceClient.end();
    await destClient.end();
    console.log('[EVENTS] Disconnected from databases');
  }
}

if (require.main === module) {
  console.log('Running events-migration.js directly');
  migrateEvents().catch((err) => {
    console.error('Events migration failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { migrateEvents };

