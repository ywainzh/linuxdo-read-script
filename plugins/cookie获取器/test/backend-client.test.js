import test from 'node:test';
import assert from 'node:assert/strict';

import { requestWithRetry, TransferError } from '../backend-client.js';

function response(status, body = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}

const baseRequest = {
  url: 'https://example.com/hook',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
  retryDelayMs: 0,
  sleep: async () => {}
};

test('Successful requests are returned without retry', async () => {
  let calls = 0;
  const result = await requestWithRetry({
    ...baseRequest,
    fetchImpl: async () => {
      calls += 1;
      return response(200, '<ok>');
    }
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { responseText: '<ok>', status: 200, attempts: 1 });
});

test('Network failures and 5xx responses retry once', async () => {
  let networkCalls = 0;
  await assert.rejects(
    requestWithRetry({
      ...baseRequest,
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('offline');
      }
    }),
    error => error instanceof TransferError && error.attempts === 2 && error.code === 'network'
  );
  assert.equal(networkCalls, 2);

  let serverCalls = 0;
  const recovered = await requestWithRetry({
    ...baseRequest,
    fetchImpl: async () => {
      serverCalls += 1;
      return serverCalls === 1 ? response(503) : response(204);
    }
  });
  assert.equal(serverCalls, 2);
  assert.equal(recovered.attempts, 2);
});

test('4xx responses do not retry', async () => {
  let calls = 0;
  await assert.rejects(
    requestWithRetry({
      ...baseRequest,
      fetchImpl: async () => {
        calls += 1;
        return response(400);
      }
    }),
    error => error.status === 400 && error.attempts === 1
  );
  assert.equal(calls, 1);
});

test('Timeouts abort and retry once', async () => {
  let calls = 0;
  await assert.rejects(
    requestWithRetry({
      ...baseRequest,
      timeoutMs: 5,
      fetchImpl: async () => {
        calls += 1;
        return new Promise(() => {});
      }
    }),
    error => error.code === 'timeout' && error.attempts === 2
  );
  assert.equal(calls, 2);
});

test('Timeout covers reading the response body', async () => {
  let calls = 0;
  await assert.rejects(
    requestWithRetry({
      ...baseRequest,
      timeoutMs: 5,
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          text: async () => new Promise(() => {})
        };
      }
    }),
    error => error.code === 'timeout' && error.attempts === 2
  );
  assert.equal(calls, 2);
});
