/**
 * RootAdapter interface seam (M4 Task 4).
 *
 * Proves the typed RootAdapter interface is actually satisfied by
 * RootHttpAdapter (compile-time check) and that each method calls the
 * expected Root Platform path/verb against a mocked transport - a smoke test,
 * not a live-Root integration test. No Root sandbox creds exist (see
 * m4-grounding.md section 4), so this deliberately never touches the network;
 * it proves the seam is wired correctly, not that the real Root API works.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RootHttpAdapter,
  resolveCurrency,
  type RootAdapter,
} from '../../http/rootAdapter';

// Compile-time check: RootHttpAdapter must satisfy the RootAdapter interface.
// If this line fails to type-check, the concrete class has drifted from the
// interface it's supposed to implement.
const _typeCheck: RootAdapter = new RootHttpAdapter();
void _typeCheck;

function mockTransport(jsonBody: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(jsonBody),
    text: () => Promise.resolve(JSON.stringify(jsonBody)),
  });
}

describe('RootAdapter (M4 Task 4 structural seam)', () => {
  beforeEach(() => {
    process.env.ROOT_API_KEY = 'test-key';
    process.env.ROOT_PRODUCT_MODULE_KEY = 'test-module';
    process.env.ROOT_API_URL = 'https://api.rootplatform.test/v1/insurance';
  });

  it('quote() POSTs to /quotes with the request body', async () => {
    const transport = mockTransport({ quote_package_id: 'q1', suggested_premium: 1000 });
    const adapter = new RootHttpAdapter(transport as unknown as typeof fetch);

    const result = await adapter.quote({ type: 'test-module', module: { foo: 'bar' } });

    expect(result.quote_package_id).toBe('q1');
    expect(transport).toHaveBeenCalledWith(
      'https://api.rootplatform.test/v1/insurance/quotes',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('ensurePolicyholder() POSTs to /policyholders', async () => {
    const transport = mockTransport({ policyholder_id: 'ph1' });
    const adapter = new RootHttpAdapter(transport as unknown as typeof fetch);

    const result = await adapter.ensurePolicyholder({
      userId: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });

    expect(result.policyholder_id).toBe('ph1');
    expect(transport).toHaveBeenCalledWith(
      'https://api.rootplatform.test/v1/insurance/policyholders',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('bind() POSTs to /applications', async () => {
    const transport = mockTransport({ application_id: 'a1', policy_id: 'p1', status: 'active' });
    const adapter = new RootHttpAdapter(transport as unknown as typeof fetch);

    const result = await adapter.bind({ quote_package_id: 'q1', policyholder_id: 'ph1' });

    expect(result.policy_id).toBe('p1');
    expect(transport).toHaveBeenCalledWith(
      'https://api.rootplatform.test/v1/insurance/applications',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sync() GETs /policies/:id (same path getPolicy uses)', async () => {
    const transport = mockTransport({ policy_id: 'p1', status: 'active' });
    const adapter = new RootHttpAdapter(transport as unknown as typeof fetch);

    const result = await adapter.sync('p1');

    expect(result.policy_id).toBe('p1');
    expect(transport).toHaveBeenCalledWith(
      'https://api.rootplatform.test/v1/insurance/policies/p1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('cancel() PATCHes /policies/:id with status cancelled', async () => {
    const transport = mockTransport({ policy_id: 'p1', status: 'cancelled', cancelled_at: '2026-01-01' });
    const adapter = new RootHttpAdapter(transport as unknown as typeof fetch);

    const result = await adapter.cancel('p1');

    expect(result.status).toBe('cancelled');
    expect(transport).toHaveBeenCalledWith(
      'https://api.rootplatform.test/v1/insurance/policies/p1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    );
  });

  it('resolveCurrency() is an identity pass-through today (pinned ZAR-vs-GBP decision, not a guessed rate)', () => {
    expect(resolveCurrency(1000)).toBe(1000);
    expect(resolveCurrency(0)).toBe(0);
  });
});
