/**
 * WEATHER ENRICHMENT
 * ==================
 * Fetches weather conditions for a trip using the Open-Meteo free API.
 * No API key required. Maps WMO weather codes to simple condition strings.
 *
 * Open-Meteo archive API: https://open-meteo.com/en/docs/historical-weather-api
 */
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
/**
 * Get the weather condition at a given location and time.
 * Uses Open-Meteo's historical archive API (free, no key).
 *
 * Falls back to null on any error (network, parsing, timeout).
 */
export declare function getWeatherForTrip(lat: number, lng: number, timestamp: Date): Promise<WeatherCondition | null>;
//# sourceMappingURL=weather.d.ts.map