import { describe, it, expect } from 'vitest';

import { TripPointSchema, TripPointsDocumentSchema, TripPointsBatchSchema } from '../trip-points';
import { fakeTimestamp } from './fixtures';

describe('TripPointSchema', () => {
  const validPoint = {
    t: 1_500,
    lat: 51.5074,
    lng: -0.1278,
    spd: 1_340, // 13.40 m/s, encoded as m/s * 100
    hdg: 270,
    acc: 5,
  };

  it('parses a representative compressed GPS point (t offset ms, spd = m/s*100)', () => {
    expect(TripPointSchema.parse(validPoint)).toEqual(validPoint);
  });

  it('parses with optional accelerometer/gyroscope fields present', () => {
    const withSensors = { ...validPoint, ax: 0.1, ay: -0.2, az: 9.8, gx: 0, gy: 0, gz: 0.01 };
    expect(TripPointSchema.parse(withSensors)).toEqual(withSensors);
  });

  it('rejects a non-integer spd (must stay an encoded integer, not real m/s)', () => {
    expect(() => TripPointSchema.parse({ ...validPoint, spd: 13.4 })).toThrow();
  });

  it('rejects a heading outside 0-360', () => {
    expect(() => TripPointSchema.parse({ ...validPoint, hdg: 400 })).toThrow();
  });
});

describe('TripPointsDocumentSchema', () => {
  const validFixture = {
    tripId: 'trip_abc123',
    userId: 'user_abc123',
    points: [
      { t: 0, lat: 51.5074, lng: -0.1278, spd: 0, hdg: 0, acc: 4 },
      { t: 1_000, lat: 51.5075, lng: -0.1279, spd: 850, hdg: 45, acc: 4 },
    ],
    samplingRateHz: 1,
    totalPoints: 2,
    compressedSize: 128,
    createdAt: fakeTimestamp(),
  };

  it('parses a representative tripPoints/{tripId} document', () => {
    expect(TripPointsDocumentSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(TripPointsDocumentSchema.shape)).toMatchSnapshot();
  });

  it('rejects a negative totalPoints', () => {
    expect(() => TripPointsDocumentSchema.parse({ ...validFixture, totalPoints: -1 })).toThrow();
  });
});

describe('TripPointsBatchSchema', () => {
  const validFixture = {
    tripId: 'trip_abc123',
    batchIndex: 0,
    startOffset: 0,
    endOffset: 60_000,
    points: [{ t: 0, lat: 51.5074, lng: -0.1278, spd: 0, hdg: 0, acc: 4 }],
  };

  it('parses a representative tripPoints/{tripId}/batches/{n} document', () => {
    expect(TripPointsBatchSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('rejects a missing batchIndex', () => {
    const { batchIndex: _batchIndex, ...missingField } = validFixture;
    expect(() => TripPointsBatchSchema.parse(missingField)).toThrow();
  });
});
