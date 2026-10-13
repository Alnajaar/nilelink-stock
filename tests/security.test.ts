import assert from 'node:assert/strict';
import test from 'node:test';
import {
  constantTimeEqual,
  hashPassword,
  hmacSha256,
  HttpError,
  readJson,
  requireSameOrigin,
  verifyTotp
} from '../functions/api/_lib/security.ts';

test('password hashes are salted and verify deterministically', async () => {
  const first = await hashPassword('a sufficiently long password');
  const sameSalt = await hashPassword('a sufficiently long password', first.salt);
  const different = await hashPassword('a sufficiently long password');

  assert.equal(first.hash, sameSalt.hash);
  assert.notEqual(first.salt, different.salt);
  assert.notEqual(first.hash, different.hash);
});

test('PIN lookup uses a keyed HMAC digest', async () => {
  const digest = await hmacSha256('server-only-pepper', 'tenant:123456');

  assert.equal(digest, await hmacSha256('server-only-pepper', 'tenant:123456'));
  assert.notEqual(digest, await hmacSha256('different-pepper', 'tenant:123456'));
  assert.notEqual(digest, await hmacSha256('server-only-pepper', 'other-tenant:123456'));
});

test('TOTP verifier accepts the RFC 6238 SHA-1 test vector', async () => {
  assert.equal(await verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000), true);
  assert.equal(await verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '000000', 59_000), false);
});

test('same-origin protection rejects cross-origin mutations', () => {
  assert.doesNotThrow(() => requireSameOrigin(new Request('https://app.example/api/x', {
    method: 'POST',
    headers: { origin: 'https://app.example' }
  })));
  assert.throws(
    () => requireSameOrigin(new Request('https://app.example/api/x', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' }
    })),
    (error: unknown) => error instanceof HttpError && error.status === 403
  );
});

test('bounded JSON reader rejects bodies over the configured limit', async () => {
  await assert.rejects(
    readJson(new Request('https://app.example/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'too long' })
    }), 4),
    (error: unknown) => error instanceof HttpError && error.status === 413
  );
});

test('constant-time comparison returns false for unequal credentials', () => {
  assert.equal(constantTimeEqual('token', 'token'), true);
  assert.equal(constantTimeEqual('token', 'tokens'), false);
});
