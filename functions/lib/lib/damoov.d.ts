/**
 * DAMOOV API CLIENT
 * =================
 * Server-side client for Damoov DataHub / User APIs.
 * Damoov is the telematics data collection layer - it feeds Driiva's XGBoost
 * risk model. Credentials come from Firebase Secret Manager, never hardcoded.
 *
 * API docs: https://docs.damoov.com/
 */
export interface DamoovUserResponse {
    DeviceToken: string;
    Result: {
        IsSuccess: boolean;
        ErrorCode?: number;
        ErrorMessage?: string;
    };
}
export interface DamoovTripData {
    Id: string;
    StartDate: string;
    EndDate: string;
    DistanceKm: number;
    DurationMin: number;
    Rating100: number;
    RatingBraking100: number;
    RatingAcceleration100: number;
    RatingSpeeding100: number;
    RatingPhoneUsage100: number;
    RatingCornering100: number;
    HardBrakingCount: number;
    HardAccelerationCount: number;
    CorneringCount: number;
    Points?: Array<{
        Latitude: number;
        Longitude: number;
    }>;
}
export interface DamoovTripsResponse {
    Result: {
        IsSuccess: boolean;
        ErrorCode?: number;
        ErrorMessage?: string;
    };
    Trips?: DamoovTripData[];
}
/**
 * Register a new user with Damoov. Returns deviceToken on success, null on failure.
 * Called silently during Firebase Auth registration - must never throw.
 */
export declare function createDamoovUser(uid: string, email: string): Promise<string | null>;
/**
 * Fetch trips from Damoov DataHub for a given device token and date range.
 * Returns array of trip data or empty array on failure.
 */
export declare function fetchDamoovTrips(deviceToken: string, startDate: string, endDate: string): Promise<DamoovTripData[]>;
/**
 * Fetch daily driving statistics from Damoov for sparkline/trend data.
 * Returns array of daily score objects.
 */
export declare function fetchDamoovDailyStats(deviceToken: string, startDate: string, endDate: string): Promise<Array<{
    Date: string;
    Score: number;
}>>;
//# sourceMappingURL=damoov.d.ts.map