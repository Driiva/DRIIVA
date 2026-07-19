import { z } from 'zod';

/**
 * VEHICLE INFO
 * ============
 * Shared by UserDocument (`vehicle`) and PolicyDocument (`vehicle`) - kept in
 * its own module so both can import it without a circular dependency between
 * `user.ts` and `policy.ts`.
 * Source: shared/firestore-types.ts `VehicleInfo` (~L377-383).
 */
export const VehicleInfoSchema = z.object({
  vin: z.string().nullable(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  color: z.string().nullable(),
});
export type VehicleInfo = z.infer<typeof VehicleInfoSchema>;
