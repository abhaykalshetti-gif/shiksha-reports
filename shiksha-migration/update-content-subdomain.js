const { Client } = require('pg');
const axios = require('axios');
const dbConfig = require('./db');

const CONTENT_READ_BASE_URL =
    process.env.CONTENT_READ_BASE_URL ||
    'https://lap.prathamdigital.org/action/content/v3/read';

const DELAY_BETWEEN_RECORDS_MS = parseInt(process.env.DELAY_BETWEEN_RECORDS_MS || '200', 10);

const COOKIE = process.env.CONTENT_READ_COOKIE || '';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Read Content API ────────────────────────────────────────────────────────

async function readContentSubdomain(identifier) {
    const url =
        `${CONTENT_READ_BASE_URL}/${identifier}` +
        `?mode=edit` +
        `&fields=subDomain,domain,subject,program,contentLanguage,targetAgeGroup,primaryUser,contentType,mimeType,primaryCategory,status`;

    const headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    };

    if (COOKIE) {
        headers['Cookie'] = COOKIE;
    }

    try {
        const res = await axios.get(url, { headers, timeout: 10000 });
        const content = res?.data?.result?.content;

        if (!content) {
            console.warn(`[UPDATE-CONTENT-SUBDOMAIN] ⚠️  No content in API response for: ${identifier}`);
            return null;
        }

        // The API returns subDomain as an array e.g. ["Career Exploration"]
        const rawSubDomain = content.subDomain ?? null;
        const rawDomain = content.domain ?? null;
        const rawSubject = content.subject ?? null;

        if (rawSubDomain === null || rawSubDomain === undefined) {
            return null;
        }

        // Normalize to JSON string for DB storage (text column)
        let apiSubdomain;
        if (Array.isArray(rawSubDomain)) {
            apiSubdomain = rawSubDomain.length > 0 ? JSON.stringify(rawSubDomain) : null;
        } else if (typeof rawSubDomain === 'string') {
            apiSubdomain = rawSubDomain.trim() ? JSON.stringify([rawSubDomain.trim()]) : null;
        } else {
            apiSubdomain = JSON.stringify(rawSubDomain);
        }

        const apiDomain = Array.isArray(rawDomain) ? JSON.stringify(rawDomain) : (rawDomain ? JSON.stringify([rawDomain]) : null);
        const apiSubject = Array.isArray(rawSubject) ? JSON.stringify(rawSubject) : (rawSubject ? JSON.stringify([rawSubject]) : null);

        return { apiSubdomain, apiDomain, apiSubject };
    } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
            console.warn(`[UPDATE-CONTENT-SUBDOMAIN] ⚠️  Content not found (404) for: ${identifier}`);
        } else {
            console.error(`[UPDATE-CONTENT-SUBDOMAIN] ❌ API error for ${identifier}: ${err.message}`);
        }
        return null;
    }
}

// ─── Update Query ─────────────────────────────────────────────────────────────

async function updateContentSubdomain(client, identifier, newSubdomain, newDomain, newSubject) {
    console.log(newDomain);
    console.log(newSubject);
    console.log(newSubject)
    // return;
    const updateQuery = `
      UPDATE public."Content"
      SET    "subdomains" = $1,
             "domains"    = $2,
             "subjects"   = $3
      WHERE  "identifier" = $4
    `;
    const result = await client.query(updateQuery, [newSubdomain, newDomain, newSubject, identifier]);
    return result.rowCount;
}

// ─── Main Migration ───────────────────────────────────────────────────────────

async function migrateContentSubdomain() {
    console.log('=== STARTING update-content-subdomain MIGRATION ===');

    const destClient = new Client(dbConfig.destination);

    try {
        await destClient.connect();
        console.log('[UPDATE-CONTENT-SUBDOMAIN] Connected to destination database');

        // Step 1: Fetch all content rows from DB
        const fetchQuery = `
            SELECT c.identifier, c."subdomains", c."domains", c."subjects"
            FROM public."Content" AS c
            WHERE identifier = 'do_214678952690532352126'
            ORDER BY c.identifier ASC
        `;

        const { rows } = await destClient.query(fetchQuery);

        console.log(`[UPDATE-CONTENT-SUBDOMAIN] Found ${rows.length} content records to process`);

        if (rows.length === 0) {
            console.log('[UPDATE-CONTENT-SUBDOMAIN] Nothing to process. Exiting.');
            return;
        }

        let updated = 0;
        let skipped = 0;
        let apiError = 0;
        let noChange = 0;

        // Step 2 & 3: Process one by one
        for (let i = 0; i < rows.length; i++) {
            const { identifier, subdomains: dbSubdomain } = rows[i];

            console.log(
                `[UPDATE-CONTENT-SUBDOMAIN] [${i + 1}/${rows.length}] Processing: ${identifier} (current subdomains: ${dbSubdomain})`
            );

            // Call Read Content API
            const apiData = await readContentSubdomain(identifier);

            if (apiData === null) {
                console.warn(`[UPDATE-CONTENT-SUBDOMAIN]   ↳ Skipping — no subDomain returned from API`);
                apiError++;
                await delay(DELAY_BETWEEN_RECORDS_MS);
                continue;
            }

            const { apiSubdomain, apiDomain, apiSubject } = apiData;

            // Step 4: Update only if value differs
            console.log(`[UPDATE-CONTENT-SUBDOMAIN]   ↳ Updating subdomains: "${dbSubdomain}" → "${apiSubdomain}", domain: "${apiDomain}", subject: "${apiSubject}"`);
            try {
                const rowCount = await updateContentSubdomain(destClient, identifier, apiSubdomain, apiDomain, apiSubject);
                if (rowCount > 0) {
                    console.log(`[UPDATE-CONTENT-SUBDOMAIN]   ✅ Updated successfully`);
                    updated++;
                } else {
                    console.warn(`[UPDATE-CONTENT-SUBDOMAIN]   ⚠️  Update matched 0 rows`);
                    skipped++;
                }
            } catch (err) {
                console.error(`[UPDATE-CONTENT-SUBDOMAIN]   ❌ DB update error for ${identifier}: ${err.message}`);
                skipped++;
            }

            // return;

            await delay(DELAY_BETWEEN_RECORDS_MS);
        }

        // Summary
        console.log('\n=== SUMMARY ===');
        console.log(`  Total records   : ${rows.length}`);
        console.log(`  Updated         : ${updated}`);
        console.log(`  No change       : ${noChange}`);
        console.log(`  No subDomain    : ${apiError}`);
        console.log(`  DB skipped/err  : ${skipped}`);
    } catch (err) {
        console.error('[UPDATE-CONTENT-SUBDOMAIN] ❌ Fatal error:', err.message);
        throw err;
    } finally {
        await destClient.end();
        console.log('[UPDATE-CONTENT-SUBDOMAIN] Disconnected from destination database');
    }

    console.log('=== COMPLETED update-content-subdomain MIGRATION ===');
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

if (require.main === module) {
    migrateContentSubdomain().catch((err) => {
        console.error('Script failed:', err);
        process.exit(1);
    });
}

module.exports = { migrateContentSubdomain };