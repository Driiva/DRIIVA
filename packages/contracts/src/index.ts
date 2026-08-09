/**
 * @driiva/contracts
 * =================
 * The single typed zod contract package for Driiva's persistent data shapes.
 * Every surface (web client, Express server, Cloud Functions) imports these
 * exact schemas/types rather than hand-mirroring its own copy - the disease
 * this package exists to cure (see shared/firestore-types.ts vs
 * functions/src/types.ts vs shared/types.ts, three drifting copies today).
 *
 * M0: schemas only. No existing app/functions code is repointed to import
 * from here yet - that happens in later modules.
 */
export * from './timestamp';
export * from './money';
export * from './score-breakdown';
export * from './vehicle';
export * from './policy';
export * from './pool-share';
export * from './trip';
export * from './trip-points';
export * from './user';
export * from './quote';
export * from './pending-payment';
export * from './friendship';
