const { Client } = require('pg');
const axios = require('axios');
const dbConfig = require('./db');

const API_URL = 'https://lap.prathamdigital.org/action/composite/v3/search';
const API_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ5TGlWakRTOGFrd1JkOTI4aTJnbXluNG9Na1ZkdERpcXk0V3NaNHZLeHF3In0.eyJleHAiOjE3OTM4NzI5OTAsImlhdCI6MTc5Mzc4NjU5MCwianRpIjoiNWIzYTdiZDUtOWE4NS00NDdmLWFmNjQtMWY4ZTgyNjFkZWI5IiwiaXNzIjoiaHR0cHM6Ly9rZXljbG9hay1wcm9kLnByYXRoYW1kaWdpdGFsLm9yZy9hdXRoL3JlYWxtcy9wcmF0aGFtIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjM4ZDNjMDIxLTU0MzktNGRhMS1hZDNkLTJlNTUyODdlNTA1NiIsInR5cCI6IkJlYXJlciIsImF6cCI6InByYXRoYW0iLCJzZXNzaW9uX3N0YXRlIjoiOTA5ZDY2YmUtYmMwMi00NjZlLTlkNDctYzgzYzI4ZjIyMmI5IiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIvKiJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtcHJhdGhhbSJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoicHJvZmlsZSBlbWFpbCBwcmF0aGFtLXJvbGUiLCJzaWQiOiI5MDlkNjZiZS1iYzAyLTQ2NmUtOWQ0Ny1jODNjMjhmMjIyYjkiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsIm5hbWUiOiJIYXJzaHZhcmRoYW4gQmFuYXBoZXIiLCJ1c2VyX3JvbGVzIjoiTGVhcm5lciIsInByZWZlcnJlZF91c2VybmFtZSI6ImhhcnNodmFyZGhhbi5iYW5hcGhlckBwcmF0aGFtLm9yZyIsImdpdmVuX25hbWUiOiJIYXJzaHZhcmRoYW4iLCJmYW1pbHlfbmFtZSI6IkJhbmFwaGVyIiwiZW1haWwiOiJoYXJzaHZhcmRoYW4uYmFuYXBoZXJAcHJhdGhhbS5vcmcifQ.JGot-8cSFpCD_XtcuVc_Zgyu0IQC0niK5pQEILgqmAyiS1NS_TPmfOnIPKkYvr05kFon5i_Rmw-U4yJYuTVUjY3v6uCS0ssRdPx6TYj_7QPZIdQU6tVlcTr9BkY-tRUyj8ahZeHD_aZpn8c5-IRWjCoxqpSWkkm6KZY_gKvoWFO3CqWgI222-CAD1Kbh3j5ayLIOxoQ-KFqQeiawhMeucCKX4nJpcp0tXkn9V9I4ADOsjmY23kZ9AaxAiD4xZl4RimLF-ZmllMTXL6pKLNitNvRvpyg5ccOWCDlr0m5FbFKDrKknKMs_gh1tk4LsqtfKZebgPj_g1OY9p83Al4Zsdg';
const TENANT_ID = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';

async function main() {
  
  if (API_TOKEN === 'REPLACE_WITH_A_FRESH_BEARER_TOKEN') {
    throw new Error('Set API_TOKEN to a fresh bearer token before running.');
  }

  // Change to dbConfig.source if public."Course" is in the source database.
  const client = new Client(dbConfig.destination);
  await client.connect();

  try {
    const { rows } = await client.query(`
      SELECT identifier as "CourseId", status
      FROM public."Course"
      WHERE status in ('unlisted','Unlisted')
    `);

    console.log(`Checking ${rows.length} Live courses`);
 let sum=0;
    for (const course of rows) {
      const response = await axios.post(
        API_URL,
        {
          request: {
            filters: {
              status: ['Live'],
              primaryCategory: ['Course'],
            },
            sort_by: { lastUpdatedOn: 'desc' },
            query: course.CourseId,
            limit: 10,
            offset: 0,
          },
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_TOKEN}`,
            tenantid: TENANT_ID,
          },
          timeout: 30000,
        },
      );

      const count = response.data?.result?.count;
      console.log("valid course ID:", course.CourseId, "count:", count);
      if (count==0) {
      sum++;
      console.log("Invalid course ID:", course.CourseId);
      }

    }
    console.log("Invalid course IDs:", sum);
  } finally {
    await client.end( );
  }
}

main().catch((error) => {
  console.error('Course status check failed:', error.message);
  process.exitCode = 1;
});