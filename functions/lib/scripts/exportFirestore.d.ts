/**
 * Export all Firestore data to local JSON backup.
 * Run: npm run export-firestore (from functions) or npm run export-firestore (from repo root).
 *
 * Output: firestore-backup/<ISO-timestamp>/ with one JSON file per collection (+ users/uid/sub.json, tripPoints/tripId/batches.json).
 *
 * Credentials (one of):
 * - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json (Firebase Console → Project settings → Service accounts)
 * - gcloud auth application-default login (then GCLOUD_PROJECT=driiva); if you see invalid_rapt, re-run gcloud login.
 */
export {};
//# sourceMappingURL=exportFirestore.d.ts.map