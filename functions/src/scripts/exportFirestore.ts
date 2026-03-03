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

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'driiva';
const OUT_DIR = process.env.FIRESTORE_BACKUP_DIR || path.join(__dirname, '../../../firestore-backup');

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { _seconds?: number })._seconds === 'number') {
    const t = value as { _seconds: number; _nanoseconds?: number };
    return new Date(t._seconds * 1000 + ((t._nanoseconds || 0) / 1e6)).toISOString();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  if (typeof (value as { latitude?: number }).latitude === 'number') {
    const g = value as { latitude: number; longitude: number };
    return { latitude: g.latitude, longitude: g.longitude };
  }
  if (typeof (value as { path?: string }).path === 'string') {
    return (value as { path: string }).path;
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

async function exportCollection(
  db: admin.firestore.Firestore,
  name: string,
  outPath: string
): Promise<number> {
  const col = db.collection(name);
  const docs: { id: string; data: unknown }[] = [];
  const snapshot = await col.get();
  snapshot.docs.forEach((doc) => {
    docs.push({ id: doc.id, data: serializeValue(doc.data()) });
  });
  const filePath = path.join(outPath, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
  return docs.length;
}

async function exportSubcollection(
  db: admin.firestore.Firestore,
  parentCollection: string,
  parentId: string,
  subName: string,
  outPath: string
): Promise<number> {
  const col = db.collection(parentCollection).doc(parentId).collection(subName);
  const docs: { id: string; data: unknown }[] = [];
  const snapshot = await col.get();
  snapshot.docs.forEach((doc) => {
    docs.push({ id: doc.id, data: serializeValue(doc.data()) });
  });
  const subDir = path.join(outPath, parentCollection, parentId);
  fs.mkdirSync(subDir, { recursive: true });
  const filePath = path.join(subDir, `${subName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
  return docs.length;
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(OUT_DIR, stamp);
  fs.mkdirSync(outPath, { recursive: true });

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const collections = await db.listCollections();
  const names = collections.map((c) => c.id);
  console.log('Root collections:', names.join(', '));

  let totalDocs = 0;
  for (const name of names) {
    try {
      const count = await exportCollection(db, name, outPath);
      totalDocs += count;
      console.log(`  ${name}: ${count} docs`);
    } catch (e) {
      console.error(`  ${name}: error`, e);
    }
  }

  // Known subcollections: users/{uid}/achievements, users/{uid}/policies, tripPoints/{tripId}/batches
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const subcols = await db.collection('users').doc(uid).listCollections();
    for (const sub of subcols) {
      try {
        const n = await exportSubcollection(db, 'users', uid, sub.id, outPath);
        if (n > 0) totalDocs += n;
      } catch (e) {
        console.error(`  users/${uid}/${sub.id}:`, e);
      }
    }
  }
  const tripPointsSnap = await db.collection('tripPoints').limit(500).get();
  for (const tpDoc of tripPointsSnap.docs) {
    const subcols = await db.collection('tripPoints').doc(tpDoc.id).listCollections();
    for (const sub of subcols) {
      try {
        const n = await exportSubcollection(db, 'tripPoints', tpDoc.id, sub.id, outPath);
        if (n > 0) totalDocs += n;
      } catch (e) {
        console.error(`  tripPoints/${tpDoc.id}/${sub.id}:`, e);
      }
    }
  }

  const meta = {
    exportedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    rootCollections: names,
    totalDocs,
  };
  fs.writeFileSync(path.join(outPath, '_meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('Total docs:', totalDocs);
  console.log('Backup written to:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
