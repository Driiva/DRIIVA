/**
 * SYNC TRIP ON COMPLETE
 * =====================
 * Firestore trigger: when a trip's status becomes 'completed', write a summary row
 * to PostgreSQL trips_summary for API access.
 */
import * as functions from 'firebase-functions';
export declare const syncTripOnComplete: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
//# sourceMappingURL=syncTripOnComplete.d.ts.map