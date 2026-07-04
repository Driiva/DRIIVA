"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'driiva';
const OUT_DIR = process.env.FIRESTORE_BACKUP_DIR || path.join(__dirname, '../../../firestore-backup');
function serializeValue(value) {
    if (value === null || value === undefined)
        return value;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value._seconds === 'number') {
        const t = value;
        return new Date(t._seconds * 1000 + ((t._nanoseconds || 0) / 1e6)).toISOString();
    }
    if (typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (typeof value.latitude === 'number') {
        const g = value;
        return { latitude: g.latitude, longitude: g.longitude };
    }
    if (typeof value.path === 'string') {
        return value.path;
    }
    if (Array.isArray(value))
        return value.map(serializeValue);
    if (typeof value === 'object' && value !== null) {
        const out = {};
        for (const [k, v] of Object.entries(value))
            out[k] = serializeValue(v);
        return out;
    }
    return value;
}
async function exportCollection(db, name, outPath) {
    const col = db.collection(name);
    const docs = [];
    const snapshot = await col.get();
    snapshot.docs.forEach((doc) => {
        docs.push({ id: doc.id, data: serializeValue(doc.data()) });
    });
    const filePath = path.join(outPath, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    return docs.length;
}
async function exportSubcollection(db, parentCollection, parentId, subName, outPath) {
    const col = db.collection(parentCollection).doc(parentId).collection(subName);
    const docs = [];
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
async function main() {
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
        }
        catch (e) {
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
                if (n > 0)
                    totalDocs += n;
            }
            catch (e) {
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
                if (n > 0)
                    totalDocs += n;
            }
            catch (e) {
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
//# sourceMappingURL=exportFirestore.js.map