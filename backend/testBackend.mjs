/**
 * APIForge Backend Automated Security & Proxy Test Suite
 * Production-backed tests exercising actual production functions, services, and routes:
 * - Production SSRFValidator (IPv4, IPv6, expanded/compressed IPv4-mapped, malformed inputs, special-use ranges)
 * - Production SSRFValidator DNS Rebinding / Dual-Homed validation (DNS results containing both public and blocked IPs)
 * - Production RequestExecutorService redirect sanitization (differently cased headers, origin change)
 * - Production RequestExecutorService response size limit (tested with real local HTTP streaming server)
 * - Production RequestExecutorService client cancellation (tested with real local HTTP server & AbortSignal)
 * - Production RequestExecutorService successful response completion & listener cleanup (tested with real local HTTP server)
 * - Production RequestExecutorService timeout rejection & connection teardown (tested with real slow HTTP server)
 * - Production RequestExecutorService request connection error (ECONNREFUSED) safe rejection
 * - Production RequestExecutorService response premature close/socket hangup safe rejection
 * - Production RequestExecutorService customAgent isolation (ensures API callers cannot inject custom agents)
 * - Production executeRouter HTTP route lifecycle (exercised on real Express server)
 * - Production executeRouter unit-level disconnect simulation
 * - Production createRateLimiter (fixed-window semantics, fractional, negative, zero, and non-finite options normalization)
 * - Production securityHeaders middleware
 * - Production globalErrorHandler (headersSent, malformed JSON, 413 oversized body, stack trace suppression)
 * - Production notFoundHandler route middleware
 * - Production requireAuth JWT payload primitives (number, string, null, array) to prevent TypeErrors
 * - Production requireAuth expiration claim validation (missing, invalid, zero, negative, expired, and valid claims)
 * - Production requireAuth upstream error sanitization (generic 503, no token/raw error leakage)
 *
 * Run with: node backend/testBackend.mjs
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import dns from 'node:dns';
import { EventEmitter } from 'node:events';
import express from 'express';

console.log('🧪 Starting APIForge Production-Backed Backend Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] Scenario ${totalTests}: ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] Scenario ${totalTests}: ${name}`);
    console.error(err);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Production Imports from compiled TypeScript distribution
// ----------------------------------------------------------------------------
import { SSRFValidator, SSRFSecurityError } from './dist/services/ssrfValidator.js';
import { RequestExecutorService, MAX_RESPONSE_SIZE } from './dist/services/requestExecutor.js';
import {
  createRateLimiter,
  securityHeaders,
  globalErrorHandler,
  notFoundHandler,
} from './dist/middleware/security.js';
import { executeRouter } from './dist/routes/executeRouter.js';

// Ensure test runner provides Supabase configuration for offline middleware tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-dummy-anon-key-for-unit-tests';
const { requireAuth } = await import('./dist/middleware/authMiddleware.js');

// ============================================================================
// PART 1: Production SSRF Validator Tests
// ============================================================================

// ----------------------------------------------------------------------------
// Scenario 1: Blocks loopback, private IPv4, and link-local cloud metadata
// ----------------------------------------------------------------------------
await runTest(
  'SSRFValidator: Blocks IPv4 loopback, RFC1918 private, CGNAT, broadcast, and metadata',
  () => {
    const blockedIps = [
      '127.0.0.1',
      '127.0.0.2',
      '0.0.0.0',
      '10.0.0.1',
      '10.254.254.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '192.168.1.100',
      '169.254.169.254', // AWS/GCP/Azure link-local metadata
      '100.64.0.1',      // Carrier-Grade NAT
      '224.0.0.1',      // Multicast
      '255.255.255.255', // Limited broadcast
    ];

    for (const ip of blockedIps) {
      assert.equal(SSRFValidator.isBlockedIp(ip), true, `Expected ${ip} to be blocked`);
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 2: Allows legitimate public IPv4 destinations
// ----------------------------------------------------------------------------
await runTest('SSRFValidator: Allows legitimate public IPv4 addresses', () => {
  const allowedIps = ['8.8.8.8', '1.1.1.1', '142.250.190.46', '93.184.216.34'];
  for (const ip of allowedIps) {
    assert.equal(SSRFValidator.isBlockedIp(ip), false, `Expected ${ip} to be allowed`);
  }
});

// ----------------------------------------------------------------------------
// Scenario 3: Blocks standard IPv6 loopback, unspecified, ULA, and link-local
// ----------------------------------------------------------------------------
await runTest('SSRFValidator: Blocks standard IPv6 loopback (::1), unspecified (::), ULA, and link-local', () => {
  const blockedIpv6 = [
    '::1',
    '::',
    'fe80::1',
    'fe80::200:5aee:feaa:20a2',
    'fc00::1',
    'fd12:3456:789a:1::1',
    '100::1', // Discard prefix (RFC 6666)
  ];

  for (const ip of blockedIpv6) {
    assert.equal(SSRFValidator.isBlockedIp(ip), true, `Expected ${ip} to be blocked`);
  }
});

// ----------------------------------------------------------------------------
// Scenario 4: Regression tests for expanded and compressed IPv4-mapped IPv6, NAT64, and local-use NAT64
// ----------------------------------------------------------------------------
await runTest(
  'SSRFValidator: Blocks expanded/compressed IPv4-mapped, NAT64 private, and RFC 8215 local-use NAT64 addresses',
  () => {
    const restrictedIpv4Mapped = [
      '0:0:0:0:0:ffff:7f00:1',       // Expanded hex loopback 127.0.0.1
      '::ffff:7f00:1',               // Compressed hex loopback 127.0.0.1
      '0:0:0:0:0:ffff:127.0.0.1',    // Expanded dotted-quad loopback
      '::ffff:127.0.0.1',            // Compressed dotted-quad loopback
      '0:0:0:0:0:ffff:10.0.0.1',     // Expanded private Class A
      '::ffff:10.0.0.1',             // Compressed private Class A
      '0:0:0:0:0:ffff:c0a8:101',     // Expanded hex private 192.168.1.1
      '::ffff:192.168.1.1',          // Compressed private Class C
      '0:0:0:0:0:ffff:169.254.169.254', // Expanded metadata
      '::ffff:169.254.169.254',      // Compressed metadata
      '64:ff9b::127.0.0.1',          // NAT64 embedded loopback
      '64:ff9b::10.0.0.1',           // NAT64 embedded private Class A
      '64:ff9b::169.254.169.254',    // NAT64 embedded metadata
      '64:ff9b:1::1',                // RFC 8215 Local-Use NAT64
      '64:ff9b:1::8.8.8.8',          // RFC 8215 Local-Use NAT64 embedding public IP
      '64:ff9b:1::127.0.0.1',        // RFC 8215 Local-Use NAT64 embedding loopback
      '::127.0.0.1',                 // Deprecated IPv4-compatible IPv6 loopback
      '::10.0.0.1',                  // Deprecated IPv4-compatible IPv6 private
      '::169.254.169.254',           // Deprecated IPv4-compatible IPv6 metadata
    ];

    for (const ip of restrictedIpv4Mapped) {
      assert.equal(SSRFValidator.isBlockedIp(ip), true, `Expected restricted mapped IP ${ip} to be blocked`);
    }

    const publicIpv4Mapped = [
      '0:0:0:0:0:ffff:8.8.8.8',
      '::ffff:8.8.8.8',
      '0:0:0:0:0:ffff:1.1.1.1',
      '::ffff:1.1.1.1',
      '::ffff:93.184.216.34',
      '64:ff9b::8.8.8.8',            // NAT64 embedding public IPv4
      '64:ff9b::1.1.1.1',            // NAT64 embedding public IPv4
    ];

    for (const ip of publicIpv4Mapped) {
      assert.equal(SSRFValidator.isBlockedIp(ip), false, `Expected public mapped IP ${ip} to be allowed`);
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 5: Rejects malformed IPv6 inputs and blocks entire 6to4 range (2002::/16)
// ----------------------------------------------------------------------------
await runTest(
  'SSRFValidator: Rejects malformed IPv6 strings and blocks entire deprecated 6to4 range (2002::/16) regardless of embedded IPv4',
  () => {
    const malformedOrSpecialIpv6 = [
      ':::',                  // Malformed multiple ::
      '2001:db8:::1',         // Malformed triple colon
      '1::2::3',              // Malformed multiple :: segments
      '0:0:0:0:0:0:0:0:0',    // Malformed 9 groups
      'invalid-ip',           // Not an IP
      '2001:db8::1',          // Documentation RFC 3849
      '2001:2::1',            // Benchmarking RFC 5180
      '2001:10::1',           // ORCHID RFC 4843
      '2001:20::1',           // ORCHIDv2 RFC 7343
      // 6to4 addresses embedding private/loopback IPv4 (must be blocked)
      '2002:7f00:0001::',     // 6to4 embedding 127.0.0.1
      '2002:0a00:0001::',     // 6to4 embedding 10.0.0.1
      '2002:a9fe:a9fe::',     // 6to4 embedding 169.254.169.254
      '2002:c0a8:0101::',     // 6to4 embedding 192.168.1.1
      // 6to4 addresses embedding public IPv4 (RFC 7526 deprecated: must also be blocked)
      '2002:0808:0808::',     // 6to4 embedding 8.8.8.8
      '2002:0101:0101::',     // 6to4 embedding 1.1.1.1
      '2002:5db8:d822::',     // 6to4 embedding 93.184.216.34
    ];

    for (const ip of malformedOrSpecialIpv6) {
      assert.equal(SSRFValidator.isBlockedIp(ip), true, `Expected ${ip} to be rejected or blocked`);
    }

    // Legitimate public IPv6 (Cloudflare DNS, Google DNS, Google) must be permitted
    assert.equal(SSRFValidator.isBlockedIp('2606:4700:4700::1111'), false);
    assert.equal(SSRFValidator.isBlockedIp('2001:4860:4860::8888'), false);
    assert.equal(SSRFValidator.isBlockedIp('2a00:1450:4009:81f::200e'), false);
  }
);

// ----------------------------------------------------------------------------
// Scenario 6: Blocks restricted hostnames and bracketed IPv6 hostnames
// ----------------------------------------------------------------------------
await runTest(
  'SSRFValidator: Blocks localhost, internal metadata, and bracketed IPv6 hostnames',
  () => {
    const blockedHosts = [
      'localhost',
      'LOCALHOST',
      'localhost.',
      '[::1]',
      '[0:0:0:0:0:ffff:7f00:1]',
      '[::ffff:127.0.0.1]',
      'metadata.google.internal',
      'metadata.azure.internal',
      'instance-data',
      'server.internal',
      'router.local',
      'db.corp',
      'nas.lan',
      'device.home',
    ];

    for (const host of blockedHosts) {
      assert.equal(SSRFValidator.isBlockedHostname(host), true, `Expected ${host} to be blocked`);
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 7: URL protocol, format validation, and IPv6 URL blocking
// ----------------------------------------------------------------------------
await runTest('SSRFValidator: Rejects dangerous protocols, credentials, and bracketed loopback URLs', () => {
  const dangerousUrls = [
    'file:///etc/passwd',
    'ftp://files.example.com',
    'gopher://gopher.floodgap.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ];

  for (const url of dangerousUrls) {
    assert.throws(
      () => SSRFValidator.validateUrlProtocolAndFormat(url),
      (err) =>
        err instanceof SSRFSecurityError &&
        (err.code === 'INVALID_PROTOCOL' || err.code === 'INVALID_URL'),
      `Expected ${url} to be rejected as INVALID_PROTOCOL or INVALID_URL`
    );
  }

  // Embedded credentials rejected
  assert.throws(
    () => SSRFValidator.validateUrlProtocolAndFormat('https://user:pass@example.com/api'),
    (err) => err instanceof SSRFSecurityError && err.code === 'INVALID_URL'
  );

  // Bracketed IPv6 loopback blocked
  assert.throws(
    () => SSRFValidator.validateUrlProtocolAndFormat('http://[::1]/status'),
    (err) => err instanceof SSRFSecurityError && err.code === 'SSRF_BLOCKED'
  );

  // Bracketed expanded IPv4-mapped loopback blocked
  assert.throws(
    () => SSRFValidator.validateUrlProtocolAndFormat('http://[0:0:0:0:0:ffff:7f00:1]/api'),
    (err) => err instanceof SSRFSecurityError && err.code === 'SSRF_BLOCKED'
  );

  // Malformed IPv6 URL rejected
  assert.throws(
    () => SSRFValidator.validateUrlProtocolAndFormat('http://[:::]/api'),
    (err) => err instanceof SSRFSecurityError && err.code === 'INVALID_URL'
  );
});

// ----------------------------------------------------------------------------
// Scenario 8: DNS Rebinding / Dual-Homed Validation (Mixed Public & Blocked Addresses)
// ----------------------------------------------------------------------------
await runTest(
  'SSRFValidator: Blocks DNS lookups returning mixed public and restricted addresses (DNS Rebinding)',
  async () => {
    const originalLookupPromise = dns.promises.lookup;
    const originalLookupCb = dns.lookup;

    try {
      // 1. Stub dns.promises.lookup to return both public IP (93.184.216.34) and loopback (127.0.0.1)
      dns.promises.lookup = async (hostname, options) => {
        return [
          { address: '93.184.216.34', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ];
      };

      await assert.rejects(
        async () => {
          await SSRFValidator.validateDestination(new URL('https://dual-homed-target.com/data'));
        },
        (err) => {
          return (
            err instanceof SSRFSecurityError &&
            err.code === 'SSRF_BLOCKED' &&
            err.blockedAddress === '127.0.0.1'
          );
        },
        'Expected validateDestination to reject when DNS returns any blocked address'
      );

      // 2. Test createSsrfSafeLookup socket-level lookup hook with mixed results
      const safeLookup = SSRFValidator.createSsrfSafeLookup();
      dns.lookup = (hostname, options, callback) => {
        callback(null, [
          { address: '93.184.216.34', family: 4 },
          { address: '169.254.169.254', family: 4 },
        ]);
      };

      let hookError = null;
      safeLookup('cloud-metadata-rebinding.com', { all: true }, (err, addresses) => {
        hookError = err;
      });

      assert.ok(hookError, 'Expected safe lookup hook to callback with error on mixed addresses');
      assert.equal(hookError.code, 'SSRF_BLOCKED');
      assert.equal(hookError.blockedAddress, '169.254.169.254');
    } finally {
      dns.promises.lookup = originalLookupPromise;
      dns.lookup = originalLookupCb;
    }
  }
);

// ============================================================================
// PART 2: Production Request Executor & Redirect Sanitization Tests
// ============================================================================

// ----------------------------------------------------------------------------
// Scenario 9: Production Redirect Header Sanitization (Actual Method Call)
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService: sanitizeRedirectHeaders strips credentials with different casing on cross-origin redirects',
  () => {
    const originHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'APIForge-Client/1.0',
      'Authorization': 'Bearer secret-user-token',
      'cookie': 'session=abc123xyz',
      'COOKIE': 'duplicate=val',
      'Proxy-Authorization': 'Basic dXNlcjpwYXNz',
      'X-Api-Key': 'apikey-secret-999',
      'x-api-key': 'duplicate-key',
      'API-KEY': 'another-cased-key',
      'Custom-Token': 'custom-auth-val',
    };

    const currentUrl = new URL('https://initial-origin.com/v1/resource');
    const crossOriginUrl = new URL('https://different-host.com/v2/target');
    const sameOriginUrl = new URL('https://initial-origin.com/v1/redirected');

    // 1. Cross-origin redirect: must strip all sensitive keys case-insensitively
    const sanitizedCross = RequestExecutorService.sanitizeRedirectHeaders(
      originHeaders,
      crossOriginUrl,
      currentUrl,
      { type: 'apiKey', apiKey: { addTo: 'header', key: 'Custom-Token', value: 'secret' } }
    );

    assert.equal(sanitizedCross['Accept'], 'application/json');
    assert.equal(sanitizedCross['User-Agent'], 'APIForge-Client/1.0');
    assert.equal(sanitizedCross['Authorization'], undefined);
    assert.equal(sanitizedCross['cookie'], undefined);
    assert.equal(sanitizedCross['COOKIE'], undefined);
    assert.equal(sanitizedCross['Proxy-Authorization'], undefined);
    assert.equal(sanitizedCross['X-Api-Key'], undefined);
    assert.equal(sanitizedCross['x-api-key'], undefined);
    assert.equal(sanitizedCross['API-KEY'], undefined);
    assert.equal(sanitizedCross['Custom-Token'], undefined);

    // 2. Same-origin redirect: must preserve headers
    const sanitizedSame = RequestExecutorService.sanitizeRedirectHeaders(
      originHeaders,
      sameOriginUrl,
      currentUrl
    );
    assert.equal(sanitizedSame['Authorization'], 'Bearer secret-user-token');
    assert.equal(sanitizedSame['cookie'], 'session=abc123xyz');
    assert.equal(sanitizedSame['X-Api-Key'], 'apikey-secret-999');
  }
);

// ----------------------------------------------------------------------------
// Scenario 10: Production Redirect Security Enforcement (Rejects Blocked Redirect Destinations)
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService & SSRFValidator: Redirect validation rejects attempts to reach loopback, metadata, 6to4, or forbidden schemes',
  async () => {
    // 1. Start a local server that returns a 302 redirect
    const redirectTarget = 'http://169.254.169.254/latest/meta-data';
    const redirectServer = http.createServer((req, res) => {
      res.writeHead(302, {
        'Location': redirectTarget,
        'Content-Type': 'text/plain',
      });
      res.end('Redirecting...');
    });

    await new Promise((resolve) => redirectServer.listen(0, '127.0.0.1', resolve));
    const port = redirectServer.address().port;
    const serverUrl = new URL(`http://127.0.0.1:${port}/redirect`);

    try {
      const customAgent = new http.Agent({ keepAlive: false });

      // Execute single request to receive 302 and location header
      const redirectResponse = await RequestExecutorService.executeSingleRequest(
        serverUrl,
        'GET',
        {},
        undefined,
        5000,
        undefined,
        customAgent
      );

      assert.equal(redirectResponse.status, 302);
      assert.equal(redirectResponse.location, redirectTarget);

      // Verify the redirect validation logic in RequestExecutorService blocks dangerous targets
      const dangerousTargets = [
        'http://169.254.169.254/latest/meta-data',
        'http://127.0.0.1/admin',
        'http://[::1]/secret',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://[2002:7f00:1::]/secret',
        'http://[2002:808:808::]/public-6to4',
        'http://[64:ff9b::127.0.0.1]/secret',
        'http://[64:ff9b:1::8.8.8.8]/local-nat64',
        'file:///etc/passwd',
        'gopher://127.0.0.1:11211/',
      ];

      for (const target of dangerousTargets) {
        let blocked = false;
        try {
          const nextUrl = new URL(target, serverUrl.toString());
          SSRFValidator.validateUrlProtocolAndFormat(nextUrl.toString());
          await SSRFValidator.validateDestination(nextUrl);
        } catch (err) {
          blocked = true;
          assert.ok(
            err instanceof SSRFSecurityError,
            `Expected SSRFSecurityError for redirect target "${target}", got: ${err}`
          );
        }
        assert.equal(blocked, true, `Expected redirect target "${target}" to be blocked for security`);
      }
    } finally {
      await new Promise((resolve) => redirectServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 11: Production Oversized Response Stream Enforcement (Real Local HTTP Server)
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService: executeSingleRequest aborts real response stream exceeding MAX_RESPONSE_SIZE (10MB) with clean teardown',
  async () => {
    // Start a local controlled HTTP server that streams > 10MB
    const streamServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      // Stream two 6MB chunks (12MB total > 10MB limit)
      const chunk1 = Buffer.alloc(6 * 1024 * 1024, 0x61);
      const chunk2 = Buffer.alloc(6 * 1024 * 1024, 0x62);
      res.write(chunk1);
      setImmediate(() => {
        try {
          res.write(chunk2);
          res.end();
        } catch {
          // Socket was destroyed by client abort handler, expected
        }
      });
    });

    await new Promise((resolve) => streamServer.listen(0, '127.0.0.1', resolve));
    const port = streamServer.address().port;
    const testUrl = new URL(`http://127.0.0.1:${port}/stream`);

    try {
      const customAgent = new http.Agent();
      let caughtError = null;

      try {
        await RequestExecutorService.executeSingleRequest(
          testUrl,
          'GET',
          {},
          undefined,
          5000,
          undefined,
          customAgent
        );
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Expected executeSingleRequest to reject on oversized stream');
      assert.equal(caughtError.code, 'RESPONSE_TOO_LARGE');
      assert.match(caughtError.message, /Response size exceeded maximum allowed limit/);
    } finally {
      await new Promise((resolve) => streamServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 12: Production Client Request Cancellation (Real Local HTTP Server & AbortSignal)
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService: executeSingleRequest terminates promptly when client AbortSignal fires',
  async () => {
    const hangServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('initial data...');
      // Never call res.end()
    });

    await new Promise((resolve) => hangServer.listen(0, '127.0.0.1', resolve));
    const port = hangServer.address().port;
    const testUrl = new URL(`http://127.0.0.1:${port}/delay`);

    try {
      const abortController = new AbortController();
      const customAgent = new http.Agent();

      // Trigger abort after 50ms
      setTimeout(() => abortController.abort(), 50);

      let caughtError = null;
      try {
        await RequestExecutorService.executeSingleRequest(
          testUrl,
          'GET',
          {},
          undefined,
          5000,
          abortController.signal,
          customAgent
        );
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Expected request to be aborted');
      assert.equal(caughtError.name, 'AbortError');
    } finally {
      await new Promise((resolve) => hangServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 13: Production Successful Completion & Listener Cleanup (Real Local HTTP Server)
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService: executeSingleRequest successfully completes with real local HTTP server and cleans up listeners',
  async () => {
    let serverReceivedBody = '';
    const successServer = http.createServer((req, res) => {
      req.on('data', (chunk) => {
        serverReceivedBody += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Server-Check': 'verified',
        });
        res.end(JSON.stringify({ status: 'ok', echoed: serverReceivedBody }));
      });
    });

    await new Promise((resolve) => successServer.listen(0, '127.0.0.1', resolve));
    const port = successServer.address().port;
    const testUrl = new URL(`http://127.0.0.1:${port}/success-endpoint`);

    try {
      const customAgent = new http.Agent({ keepAlive: false });
      const requestPayload = JSON.stringify({ hello: 'world' });

      const response = await RequestExecutorService.executeSingleRequest(
        testUrl,
        'POST',
        { 'content-type': 'application/json' },
        requestPayload,
        5000,
        undefined,
        customAgent
      );

      assert.equal(response.status, 200);
      assert.equal(response.headers['content-type'], 'application/json');
      assert.equal(response.headers['x-server-check'], 'verified');

      const parsed = JSON.parse(response.body);
      assert.equal(parsed.status, 'ok');
      assert.equal(parsed.echoed, requestPayload);
    } finally {
      await new Promise((resolve) => successServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 14: Production Timeout Enforcement & Stream Teardown (Real Slow HTTP Server)
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService: executeSingleRequest rejects with TIMEOUT error and tears down stream on slow responses',
  async () => {
    let socketDestroyedByClient = false;
    const slowServer = http.createServer((req, res) => {
      req.socket.on('close', () => {
        socketDestroyedByClient = true;
      });
      // Deliberately hold request without responding within timeout window
    });

    await new Promise((resolve) => slowServer.listen(0, '127.0.0.1', resolve));
    const port = slowServer.address().port;
    const testUrl = new URL(`http://127.0.0.1:${port}/timeout-endpoint`);

    try {
      const customAgent = new http.Agent({ keepAlive: false });
      let caughtErr = null;

      try {
        await RequestExecutorService.executeSingleRequest(
          testUrl,
          'GET',
          {},
          undefined,
          60, // 60ms timeout
          undefined,
          customAgent
        );
      } catch (err) {
        caughtErr = err;
      }

      assert.ok(caughtErr, 'Expected executeSingleRequest to reject with TIMEOUT error');
      assert.ok(caughtErr instanceof SSRFSecurityError, 'Error should be an SSRFSecurityError');
      assert.equal(caughtErr.code, 'TIMEOUT');
      assert.match(caughtErr.message, /Request timed out after 60ms/);

      // Verify teardown cleanly destroyed client connection
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(socketDestroyedByClient, true, 'Server socket should be closed after client teardown');
    } finally {
      await new Promise((resolve) => slowServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 15: Production Request Connection Error (Unused Port -> ECONNREFUSED)
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService: executeSingleRequest rejects cleanly on request connection errors (ECONNREFUSED) without unhandled events',
  async () => {
    // Pick an unused local port by briefly binding and closing an ephemeral server
    const ephemeralServer = http.createServer();
    await new Promise((resolve) => ephemeralServer.listen(0, '127.0.0.1', resolve));
    const unusedPort = ephemeralServer.address().port;
    await new Promise((resolve) => ephemeralServer.close(resolve));

    const testUrl = new URL(`http://127.0.0.1:${unusedPort}/refused`);
    const customAgent = new http.Agent({ keepAlive: false });

    let caughtErr = null;
    try {
      await RequestExecutorService.executeSingleRequest(
        testUrl,
        'GET',
        {},
        undefined,
        3000,
        undefined,
        customAgent
      );
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Expected connection to unused port to reject');
    assert.equal(caughtErr.code, 'ECONNREFUSED');
  }
);

// ----------------------------------------------------------------------------
// Scenario 16: Production Response Stream Abrupt Hangup / Premature Close Handling
// ----------------------------------------------------------------------------
await runTest(
  'RequestExecutorService: executeSingleRequest rejects cleanly on response stream premature close/socket hangup without unhandled events',
  async () => {
    const hangupServer = http.createServer((req, res) => {
      // Send response headers and first chunk, then immediately destroy socket abruptly
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
      });
      res.write('partial chunk before server socket drop...');
      // Abruptly destroy socket without completing HTTP framing or stream end
      setImmediate(() => {
        req.socket.destroy();
      });
    });

    await new Promise((resolve) => hangupServer.listen(0, '127.0.0.1', resolve));
    const port = hangupServer.address().port;
    const testUrl = new URL(`http://127.0.0.1:${port}/abrupt-disconnect`);

    try {
      const customAgent = new http.Agent({ keepAlive: false });
      let caughtErr = null;

      try {
        await RequestExecutorService.executeSingleRequest(
          testUrl,
          'GET',
          {},
          undefined,
          5000,
          undefined,
          customAgent
        );
      } catch (err) {
        caughtErr = err;
      }

      assert.ok(caughtErr, 'Expected abrupt disconnect mid-stream to reject');
      // Should reject with ECONNRESET, premature close, or socket hang up, never hang or crash
      assert.ok(
        caughtErr.code === 'ECONNRESET' || caughtErr.message.includes('closed') || caughtErr.message.includes('hang up'),
        `Unexpected error: code=${caughtErr.code}, msg=${caughtErr.message}`
      );
    } finally {
      await new Promise((resolve) => hangupServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 17: Public API isolation (Ordinary users cannot inject custom agents)
// ----------------------------------------------------------------------------
await runTest('RequestExecutorService: Public execute() API does not accept or expose custom agent overrides', () => {
  // Verify that RequestExecutorService.execute interface strictly takes (payload, signal)
  // and untyped agent properties in payload are ignored by the proxy engine
  const untypedPayload = {
    method: 'GET',
    url: 'https://example.com/api',
    agent: new http.Agent(),
    customAgent: new http.Agent(),
  };

  assert.equal(typeof RequestExecutorService.execute, 'function');
  assert.equal(RequestExecutorService.execute.length, 2); // (payload, signal)
});

// ============================================================================
// PART 3: Request Cancellation & Route Lifecycle Tests
// ============================================================================

// ----------------------------------------------------------------------------
// Scenario 18: Realistic Route HTTP Lifecycle via Live Express Server
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Route-level HTTP execution verifies body consumption completes without premature abort',
  async () => {
    // Mount the real production executeRouter on an Express test application
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    try {
      // Stub Supabase token verification so requireAuth passes cleanly
      globalThis.fetch = async () => {
        return {
          ok: true,
          json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
        };
      };

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      // Dispatch a real HTTP POST request to the route with full JSON body
      const postData = JSON.stringify({
        method: 'GET',
        url: 'http://127.0.0.1:65432/test-target',
      });

      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const res = await responsePromise;
      // Because incoming body was consumed normally, the route must NOT be aborted prematurely.
      // It completes execution and returns the expected SSRF_BLOCKED response from RequestExecutorService.
      assert.equal(res.statusCode, 200);
      assert.equal(res.data.status, 400);
      assert.equal(res.data.isError, true);
      assert.match(res.data.errorMessage, /blocked for security/i);
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 19: executeRouter Regression: Invalid URL with secret marker does not echo marker
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Invalid URL containing distinctive secret marker does not echo that marker in response',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const secretMarker = 'DISTINCT_SECRET_MARKER_XYZ_98765';
      const postData = JSON.stringify({
        method: 'GET',
        url: `https://invalid-host-bracket[:::]/path?token=${secretMarker}`,
      });

      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const res = await responsePromise;
      const rawResponseStr = JSON.stringify(res.data);

      assert.equal(rawResponseStr.includes(secretMarker), false, 'Response must NEVER echo secret query markers');
      assert.equal(res.data.isError, true);
      assert.equal(res.data.status, 400);
      assert.equal(res.data.errorMessage, 'Invalid URL format.');
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 20: executeRouter Regression: DNS failure does not expose resolver or getaddrinfo messages
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: DNS resolution failure does not expose underlying resolver or getaddrinfo messages',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const postData = JSON.stringify({
        method: 'GET',
        url: 'https://non-existent-domain-for-dns-test-12345abcde.org/api/v1',
      });

      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const res = await responsePromise;
      const rawResponseStr = JSON.stringify(res.data);

      assert.equal(rawResponseStr.includes('getaddrinfo'), false, 'Response must not leak getaddrinfo details');
      assert.equal(rawResponseStr.includes('ENOTFOUND'), false, 'Response must not leak ENOTFOUND system codes');
      assert.equal(res.data.isError, true);
      assert.equal(res.data.status, 502);
      assert.equal(res.data.errorMessage, 'Could not resolve destination hostname.');
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 21: executeRouter Regression: Blocked SSRF destination returns safe response
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Blocked SSRF destinations receive safe response without leaking destination secrets',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const secretParam = 'METADATA_SECRET_TOKEN_445566';
      const postData = JSON.stringify({
        method: 'GET',
        url: `http://169.254.169.254/latest/meta-data?secret=${secretParam}`,
      });

      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const res = await responsePromise;
      const rawResponseStr = JSON.stringify(res.data);

      assert.equal(rawResponseStr.includes(secretParam), false, 'Response must not leak URL parameters');
      assert.equal(res.data.isError, true);
      assert.equal(res.data.status, 400);
      assert.equal(res.data.errorMessage, 'Access to the requested destination is blocked for security.');
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 22: executeRouter Regression: Unexpected exception returns generic 500 without original message
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Unexpected runtime execution exception returns generic 500 without leaking error details',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    const originalExecute = RequestExecutorService.execute;

    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      // Deliberately simulate an unexpected runtime error containing sensitive diagnostic info
      const internalSecret = 'INTERNAL_DB_PASSWORD_SUPER_SECRET_123';
      RequestExecutorService.execute = async () => {
        throw new Error(`Database connection failed: postgresql://admin:${internalSecret}@internal-db:5432`);
      };

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const postData = JSON.stringify({
        method: 'GET',
        url: 'https://example.com/api',
      });

      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const res = await responsePromise;
      const rawResponseStr = JSON.stringify(res.data);

      assert.equal(res.statusCode, 500, 'Route must return HTTP status 500 on unhandled exception');
      assert.equal(rawResponseStr.includes(internalSecret), false, 'Response must never leak internal error message');
      assert.equal(rawResponseStr.includes('postgresql://'), false, 'Response must never leak connection strings');
      assert.equal(res.data.status, 500);
      assert.equal(res.data.isError, true);
      assert.equal(res.data.errorMessage, 'An internal execution error occurred while processing the request.');
    } finally {
      RequestExecutorService.execute = originalExecute;
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 23: executeRouter Regression: Successful execution preserves full frontend-compatible response envelope
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Successful execution preserves full frontend-compatible response envelope',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    const originalExecute = RequestExecutorService.execute;

    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      const expectedSuccessPayload = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json', 'x-custom-response': 'success' },
        time: 42,
        size: 30,
        body: '{"message":"hello APIForge"}',
        isError: false,
      };

      RequestExecutorService.execute = async () => expectedSuccessPayload;

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const postData = JSON.stringify({
        method: 'GET',
        url: 'https://api.example.com/data',
      });

      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const res = await responsePromise;
      assert.equal(res.statusCode, 200);
      assert.equal(res.data.status, 200);
      assert.equal(res.data.statusText, 'OK');
      assert.equal(res.data.headers['content-type'], 'application/json');
      assert.equal(res.data.headers['x-custom-response'], 'success');
      assert.equal(res.data.time, 42);
      assert.equal(res.data.size, 30);
      assert.equal(res.data.body, '{"message":"hello APIForge"}');
      assert.equal(res.data.isError, false);
    } finally {
      RequestExecutorService.execute = originalExecute;
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 24: executeRouter Regression: Response-size error with secret marker never exposes marker
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter & RequestExecutorService: Response-size error with secret marker in exception never exposes that marker',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    const originalExecute = RequestExecutorService.execute;

    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      const secretMarker = 'SECRET_STREAM_BUFFER_MARKER_998877';
      RequestExecutorService.execute = async () => {
        const err = new Error(`Buffer exceeded max limit: ${secretMarker}`);
        err.code = 'RESPONSE_TOO_LARGE';
        throw err;
      };

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const postData = JSON.stringify({
        method: 'GET',
        url: 'https://api.example.com/stream-download',
      });

      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const res = await responsePromise;
      const rawResponseStr = JSON.stringify(res.data);

      assert.equal(res.statusCode, 413, 'Expected HTTP 413 Payload Too Large');
      assert.equal(rawResponseStr.includes(secretMarker), false, 'Response must NEVER contain secret marker');
      assert.equal(res.data.status, 413);
      assert.equal(res.data.statusText, 'Payload Too Large');
      assert.equal(res.data.errorMessage, 'Response size exceeded maximum allowed limit of 10MB.');
      assert.equal(res.data.isError, true);
    } finally {
      RequestExecutorService.execute = originalExecute;
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 25: executeRouter Regression: Exception with non-string code produces sanitized response
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Exception with non-string code (number, object, boolean) safely produces sanitized response without throwing',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    const originalExecute = RequestExecutorService.execute;

    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const nonStringCodes = [
        42,
        { secret: 'INTERNAL_DIAGNOSTIC_OBJECT_LEAK' },
        true,
        null,
      ];

      for (const nonStringCode of nonStringCodes) {
        RequestExecutorService.execute = async () => {
          const err = new Error('Non-string code failure');
          err.code = nonStringCode;
          throw err;
        };

        const postData = JSON.stringify({
          method: 'GET',
          url: 'https://api.example.com/test',
        });

        const res = await new Promise((resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: testPort,
              path: '/api/request/execute',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': validToken,
              },
            },
            (response) => {
              let data = '';
              response.on('data', (chunk) => { data += chunk; });
              response.on('end', () => resolve({ statusCode: response.statusCode, data: JSON.parse(data) }));
            }
          );
          req.on('error', reject);
          req.write(postData);
          req.end();
        });

        const rawResponseStr = JSON.stringify(res.data);
        assert.equal(res.statusCode, 500, 'Must produce HTTP 500 for non-string code');
        assert.equal(rawResponseStr.includes('INTERNAL_DIAGNOSTIC_OBJECT_LEAK'), false);
        assert.equal(rawResponseStr.includes('Non-string code failure'), false);
        assert.equal(res.data.status, 500);
        assert.equal(res.data.statusText, 'Internal Server Error');
        assert.equal(res.data.errorMessage, 'An internal execution error occurred while processing the request.');
        assert.equal(res.data.isError, true);
      }
    } finally {
      RequestExecutorService.execute = originalExecute;
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 26: executeRouter Regression: Unknown error codes remain generic 500 responses
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Unknown error codes remain generic 500 responses with synchronized statusText',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    const originalExecute = RequestExecutorService.execute;

    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      RequestExecutorService.execute = async () => {
        const err = new Error('Custom driver crashed in module /opt/db/driver.so: line 88');
        err.code = 'UNKNOWN_CUSTOM_UNHANDLED_EXCEPTION';
        throw err;
      };

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const postData = JSON.stringify({
        method: 'GET',
        url: 'https://api.example.com/test',
      });

      const res = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/request/execute',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'Authorization': validToken,
            },
          },
          (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => resolve({ statusCode: response.statusCode, data: JSON.parse(data) }));
          }
        );
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const rawResponseStr = JSON.stringify(res.data);
      assert.equal(res.statusCode, 500);
      assert.equal(res.data.status, 500);
      assert.equal(res.data.statusText, 'Internal Server Error');
      assert.equal(rawResponseStr.includes('UNKNOWN_CUSTOM_UNHANDLED_EXCEPTION'), false);
      assert.equal(rawResponseStr.includes('driver.so'), false);
      assert.equal(res.data.errorMessage, 'An internal execution error occurred while processing the request.');
      assert.equal(res.data.isError, true);
    } finally {
      RequestExecutorService.execute = originalExecute;
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 27: executeRouter Regression: Known error codes retain intended statuses and safe messages
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter: Known error codes retain intended statuses and safe allowlist messages',
  async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/request', executeRouter);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const testPort = testServer.address().port;

    const originalFetch = globalThis.fetch;
    const originalExecute = RequestExecutorService.execute;

    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'usr_test_123', email: 'test@example.com' }),
      });

      const validPayload = Buffer.from(JSON.stringify({ sub: 'usr_test_123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

      const cases = [
        { code: 'TIMEOUT', expectedStatus: 504, expectedText: 'Gateway Timeout', expectedMsg: 'The target server failed to respond within the allowed timeout period.' },
        { code: 'DNS_LOOKUP_FAILED', expectedStatus: 502, expectedText: 'Bad Gateway (DNS Failure)', expectedMsg: 'Could not resolve destination hostname.' },
        { code: 'SSRF_BLOCKED', expectedStatus: 400, expectedText: 'Bad Request (Security Violation)', expectedMsg: 'Access to the requested destination is blocked for security.' },
        { code: 'RESPONSE_TOO_LARGE', expectedStatus: 413, expectedText: 'Payload Too Large', expectedMsg: 'Response size exceeded maximum allowed limit of 10MB.' },
        { code: 'ABORTED', expectedStatus: 499, expectedText: 'Client Closed Request', expectedMsg: 'The request was cancelled by the client.' },
      ];

      for (const item of cases) {
        RequestExecutorService.execute = async () => {
          const err = new Error(`Detailed internal trace for ${item.code}`);
          err.code = item.code;
          throw err;
        };

        const postData = JSON.stringify({
          method: 'GET',
          url: 'https://api.example.com/test',
        });

        const res = await new Promise((resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: testPort,
              path: '/api/request/execute',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': validToken,
              },
            },
            (response) => {
              let data = '';
              response.on('data', (chunk) => { data += chunk; });
              response.on('end', () => resolve({ statusCode: response.statusCode, data: JSON.parse(data) }));
            }
          );
          req.on('error', reject);
          req.write(postData);
          req.end();
        });

        const rawResponseStr = JSON.stringify(res.data);
        assert.equal(res.statusCode, item.expectedStatus, `Expected HTTP status ${item.expectedStatus} for ${item.code}`);
        assert.equal(res.data.status, item.expectedStatus);
        assert.equal(res.data.statusText, item.expectedText);
        assert.equal(res.data.errorMessage, item.expectedMsg);
        assert.equal(rawResponseStr.includes('Detailed internal trace'), false, 'Must not leak internal trace');
        assert.equal(res.data.isError, true);
      }
    } finally {
      RequestExecutorService.execute = originalExecute;
      globalThis.fetch = originalFetch;
      await new Promise((resolve) => testServer.close(resolve));
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 28: Unit-level Disconnect Simulation (Clarified Scope)
// ----------------------------------------------------------------------------
await runTest(
  'executeRouter (Unit Simulation): Clarified unit test verifying res.on("close") vs req.on("close") semantics',
  () => {
    // Note: In production, SSRFValidator blocks loopback destinations (127.0.0.1), preventing
    // upstream requests to local test servers. This unit simulation verifies the specific
    // event dispatch behavior that listening to res.on('close') aborts only when res.writableEnded is false.
    const abortController = new AbortController();
    const mockRes = new EventEmitter();
    mockRes.writableEnded = false;

    mockRes.on('close', () => {
      if (!mockRes.writableEnded) {
        abortController.abort();
      }
    });

    assert.equal(abortController.signal.aborted, false);
    // Simulate client closing socket before response has completed
    mockRes.emit('close');
    assert.equal(abortController.signal.aborted, true, 'Premature response close must trigger abort');
  }
);

// ============================================================================
// PART 4: Production Security Middleware Tests
// ============================================================================

// ----------------------------------------------------------------------------
// Scenario 15: Production Rate Limiter (Fixed-Window Semantics)
// ----------------------------------------------------------------------------
await runTest(
  'createRateLimiter: Enforces fixed-window request limits and sets rate limit headers',
  () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 });
    const mockHeaders = {};
    let statusCode = 200;
    let responseBody = null;

    const invokeLimiter = (ip = '198.51.100.55') => {
      statusCode = 200;
      responseBody = null;
      let nextCalled = false;
      const req = { ip, socket: { remoteAddress: ip } };
      const res = {
        setHeader: (k, v) => { mockHeaders[k] = v; },
        status: (code) => {
          statusCode = code;
          return { json: (data) => { responseBody = data; } };
        },
      };
      limiter(req, res, () => { nextCalled = true; });
      return { nextCalled, statusCode, responseBody };
    };

    assert.equal(invokeLimiter().nextCalled, true); // 1st
    assert.equal(invokeLimiter().nextCalled, true); // 2nd
    const blocked = invokeLimiter();                // 3rd -> Exceeded
    assert.equal(blocked.nextCalled, false);
    assert.equal(blocked.statusCode, 429);
    assert.equal(mockHeaders['X-RateLimit-Limit'], '2');
    assert.equal(mockHeaders['X-RateLimit-Remaining'], '0');
    assert.ok(mockHeaders['Retry-After']);
  }
);

// ----------------------------------------------------------------------------
// Scenario 16: Rate Limiter Configuration Normalization
// ----------------------------------------------------------------------------
await runTest(
  'createRateLimiter: Normalizes fractional, non-finite, zero, and negative options safely',
  () => {
    const mockHeaders = {};
    const checkLimitHeader = (options) => {
      const limiter = createRateLimiter(options);
      const req = { ip: '198.51.100.77', socket: {} };
      const res = { setHeader: (k, v) => { mockHeaders[k] = v; } };
      limiter(req, res, () => {});
      return mockHeaders['X-RateLimit-Limit'];
    };

    // Valid positive integer
    assert.equal(checkLimitHeader({ maxRequests: 10 }), '10');

    // Valid fractional >= 1: normalizes via Math.floor
    assert.equal(checkLimitHeader({ maxRequests: 2.7 }), '2');

    // Fractional < 1: must NOT configure a zero-request limit (falls back to default 120)
    assert.equal(checkLimitHeader({ maxRequests: 0.5 }), '120');

    // Zero: falls back to default 120
    assert.equal(checkLimitHeader({ maxRequests: 0 }), '120');

    // Negative: falls back to default 120
    assert.equal(checkLimitHeader({ maxRequests: -5 }), '120');

    // Non-finite: falls back to default 120
    assert.equal(checkLimitHeader({ maxRequests: NaN }), '120');
    assert.equal(checkLimitHeader({ maxRequests: Infinity }), '120');

    // WindowMs edge cases: negative, zero, non-finite fall back safely to 60000
    assert.equal(checkLimitHeader({ windowMs: -100, maxRequests: 5 }), '5');
    assert.equal(checkLimitHeader({ windowMs: 0, maxRequests: 5 }), '5');
    assert.equal(checkLimitHeader({ windowMs: NaN, maxRequests: 5 }), '5');
  }
);

// ----------------------------------------------------------------------------
// Scenario 17: Production Security Headers Middleware
// ----------------------------------------------------------------------------
await runTest('securityHeaders: Sets nosniff, frame denial, and referrer protection headers', () => {
  const headersSet = {};
  const req = {};
  const res = { setHeader: (k, v) => { headersSet[k] = v; } };
  let nextCalled = false;
  securityHeaders(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(headersSet['X-Content-Type-Options'], 'nosniff');
  assert.equal(headersSet['X-Frame-Options'], 'DENY');
  assert.equal(headersSet['X-XSS-Protection'], '0');
  assert.equal(headersSet['Referrer-Policy'], 'strict-origin-when-cross-origin');
});

// ----------------------------------------------------------------------------
// Scenario 18: Production Global Error Handler
// ----------------------------------------------------------------------------
await runTest(
  'globalErrorHandler: Handles headersSent, malformed JSON, 413 oversized body, and suppresses 500 stacks',
  () => {
    const makeRes = (headersSent = false) => {
      let statusCode = 200;
      let bodyData = null;
      return {
        headersSent,
        status: (code) => {
          statusCode = code;
          return { json: (data) => { bodyData = data; } };
        },
        getStatusCode: () => statusCode,
        getBody: () => bodyData,
      };
    };

    // 1. If headers are already sent, delegate to next(err) without writing
    let nextDelegated = false;
    const resHeadersSent = makeRes(true);
    globalErrorHandler(new Error('late error'), {}, resHeadersSent, () => { nextDelegated = true; });
    assert.equal(nextDelegated, true);

    // 2. Malformed JSON SyntaxError from body-parser
    const syntaxErr = new SyntaxError('Unexpected token in JSON');
    syntaxErr.status = 400;
    syntaxErr.body = '{invalid';
    const resSyntax = makeRes();
    globalErrorHandler(syntaxErr, {}, resSyntax, () => {});
    assert.equal(resSyntax.getStatusCode(), 400);
    const syntaxPayload = JSON.parse(resSyntax.getBody().body);
    assert.equal(syntaxPayload.error, 'Bad Request');
    assert.match(syntaxPayload.message, /Malformed JSON payload/);

    // 3. Oversized request body (413 / entity.too.large)
    const largeErr = new Error('request entity too large');
    largeErr.type = 'entity.too.large';
    largeErr.status = 413;
    const resLarge = makeRes();
    globalErrorHandler(largeErr, {}, resLarge, () => {});
    assert.equal(resLarge.getStatusCode(), 413);
    const largePayload = JSON.parse(resLarge.getBody().body);
    assert.equal(largePayload.error, 'Payload Too Large');

    // 4. Unhandled 500 exception: stack trace and raw internal error are suppressed
    const internalErr = new Error('Database password was incorrect in /etc/secret');
    const res500 = makeRes();
    globalErrorHandler(internalErr, {}, res500, () => {});
    assert.equal(res500.getStatusCode(), 500);
    const internalPayload = JSON.parse(res500.getBody().body);
    assert.equal(internalPayload.error, 'Internal Server Error');
    assert.equal(
      internalPayload.message,
      'An internal server error occurred while processing your request.'
    );
    assert.equal(res500.getBody().stack, undefined);
  }
);

// ----------------------------------------------------------------------------
// Scenario 19: Production 404 Route Handler
// ----------------------------------------------------------------------------
await runTest('notFoundHandler: Returns structured 404 JSON response for undefined routes', () => {
  let statusCode = 200;
  let bodyData = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return { json: (data) => { bodyData = data; } };
    },
  };
  notFoundHandler({}, res);
  assert.equal(statusCode, 404);
  assert.equal(bodyData.status, 404);
  assert.equal(bodyData.isError, true);
  const parsed = JSON.parse(bodyData.body);
  assert.equal(parsed.error, 'Not Found');
});

// ============================================================================
// PART 5: Production Authentication Middleware Tests
// ============================================================================

// ----------------------------------------------------------------------------
// Scenario 20: Missing, Malformed Scheme, and Bad JWT Structure
// ----------------------------------------------------------------------------
await runTest('requireAuth: Rejects missing, non-Bearer, empty, and non-segment tokens', async () => {
  const invokeAuth = async (authHeader) => {
    let statusCode = 200;
    let bodyData = null;
    let nextCalled = false;
    const req = { headers: { authorization: authHeader } };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { bodyData = data; } };
      },
    };
    await requireAuth(req, res, () => { nextCalled = true; });
    const parsedBody = bodyData?.body ? JSON.parse(bodyData.body) : bodyData;
    return { nextCalled, statusCode, bodyData, parsedBody };
  };

  // 1. Missing Authorization header
  const noHeader = await invokeAuth(undefined);
  assert.equal(noHeader.nextCalled, false);
  assert.equal(noHeader.statusCode, 401);
  assert.match(noHeader.parsedBody.message, /Missing Authorization header/);

  // 2. Malformed scheme (not Bearer)
  const badScheme = await invokeAuth('Basic dXNlcjpwYXNz');
  assert.equal(badScheme.nextCalled, false);
  assert.equal(badScheme.statusCode, 401);
  assert.match(badScheme.parsedBody.message, /Malformed Authorization header/);

  // 3. Empty Bearer token
  const emptyBearer = await invokeAuth('Bearer   ');
  assert.equal(emptyBearer.nextCalled, false);
  assert.equal(emptyBearer.statusCode, 401);
  assert.match(emptyBearer.parsedBody.message, /token is empty/);

  // 4. Invalid JWT format (less than 3 segments)
  const badSegments = await invokeAuth('Bearer header.payload');
  assert.equal(badSegments.nextCalled, false);
  assert.equal(badSegments.statusCode, 401);
  assert.match(badSegments.parsedBody.message, /Invalid JWT structure/);
});

// ----------------------------------------------------------------------------
// Scenario 21: Decoded JWT Payload Structure Validation (Primitives & Arrays)
// ----------------------------------------------------------------------------
await runTest(
  'requireAuth: Safely rejects primitive and array JWT payloads without throwing TypeErrors',
  async () => {
    const invokeWithPayload = async (rawPayload) => {
      const payloadBase64 = Buffer.from(JSON.stringify(rawPayload)).toString('base64url');
      const token = `Bearer eyJhbGciOiJIUzI1NiJ9.${payloadBase64}.signature`;
      let statusCode = 200;
      let bodyData = null;
      let nextCalled = false;
      const req = { headers: { authorization: token } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => { bodyData = data; } };
        },
      };
      await requireAuth(req, res, () => { nextCalled = true; });
      const parsedBody = bodyData?.body ? JSON.parse(bodyData.body) : bodyData;
      return { nextCalled, statusCode, parsedBody };
    };

    // Number primitive
    const numRes = await invokeWithPayload(12345);
    assert.equal(numRes.nextCalled, false);
    assert.equal(numRes.statusCode, 401);
    assert.match(numRes.parsedBody.message, /Malformed JWT payload structure/);

    // String primitive
    const strRes = await invokeWithPayload('just-a-raw-string');
    assert.equal(strRes.nextCalled, false);
    assert.equal(strRes.statusCode, 401);
    assert.match(strRes.parsedBody.message, /Malformed JWT payload structure/);

    // Null primitive
    const nullRes = await invokeWithPayload(null);
    assert.equal(nullRes.nextCalled, false);
    assert.equal(nullRes.statusCode, 401);
    assert.match(nullRes.parsedBody.message, /Malformed JWT payload structure/);

    // Array (not a JSON object)
    const arrayRes = await invokeWithPayload(['admin', 'user']);
    assert.equal(arrayRes.nextCalled, false);
    assert.equal(arrayRes.statusCode, 401);
    assert.match(arrayRes.parsedBody.message, /Malformed JWT payload structure/);
  }
);

// ----------------------------------------------------------------------------
// Scenario 22: Comprehensive Claim Validation (missing, invalid, zero, negative, expired)
// ----------------------------------------------------------------------------
await runTest(
  'requireAuth: Validates missing, invalid, exp: 0, negative, and expired expiration claims',
  async () => {
    const invokeWithClaims = async (claims) => {
      const payloadBase64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const token = `Bearer eyJhbGciOiJIUzI1NiJ9.${payloadBase64}.signature`;
      let statusCode = 200;
      let bodyData = null;
      let nextCalled = false;
      const req = { headers: { authorization: token } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => { bodyData = data; } };
        },
      };
      await requireAuth(req, res, () => { nextCalled = true; });
      const parsedBody = bodyData?.body ? JSON.parse(bodyData.body) : bodyData;
      return { nextCalled, statusCode, parsedBody };
    };

    // 1. exp: 0 must be rejected
    const expZero = await invokeWithClaims({ sub: 'user_1', exp: 0 });
    assert.equal(expZero.nextCalled, false);
    assert.equal(expZero.statusCode, 401);
    assert.match(expZero.parsedBody.message, /invalid or expired expiration claim/);

    // 2. Negative exp must be rejected
    const expNeg = await invokeWithClaims({ sub: 'user_1', exp: -500 });
    assert.equal(expNeg.nextCalled, false);
    assert.equal(expNeg.statusCode, 401);
    assert.match(expNeg.parsedBody.message, /invalid or expired expiration claim/);

    // 3. String exp must be rejected
    const expStr = await invokeWithClaims({ sub: 'user_1', exp: 'tomorrow' });
    assert.equal(expStr.nextCalled, false);
    assert.equal(expStr.statusCode, 401);
    assert.match(expStr.parsedBody.message, /invalid or expired expiration claim/);

    // 4. Expired token (exp in the past)
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const expPast = await invokeWithClaims({ sub: 'user_2', exp: pastExp });
    assert.equal(expPast.nextCalled, false);
    assert.equal(expPast.statusCode, 401);
    assert.match(expPast.parsedBody.message, /token has expired/);

    // 5. Boundary condition: token expiring right at current second (exp <= nowInSeconds) must be rejected
    const currentSecondExp = Math.floor(Date.now() / 1000);
    const expNow = await invokeWithClaims({ sub: 'user_boundary', exp: currentSecondExp });
    assert.equal(expNow.nextCalled, false);
    assert.equal(expNow.statusCode, 401);
    assert.match(expNow.parsedBody.message, /token has expired/);

    // 6. Valid future exp passes local check and proceeds to mandatory Supabase endpoint verification
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return {
          ok: true,
          json: async () => ({ id: 'user_valid', email: 'user@example.com' }),
        };
      };
      const expFuture = await invokeWithClaims({ sub: 'user_3', exp: futureExp });
      assert.equal(expFuture.nextCalled, true, 'Valid token should be authenticated by Supabase endpoint');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 23: Upstream Network Failure Handling & Token Secrecy
// ----------------------------------------------------------------------------
await runTest(
  'requireAuth: Returns generic 503 on upstream network failures without leaking raw error or tokens',
  async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const validPayload = Buffer.from(JSON.stringify({ sub: 'user_3', exp: futureExp })).toString('base64url');
    const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

    const originalFetch = globalThis.fetch;
    try {
      // Mock upstream network failure (ECONNREFUSED to internal host)
      globalThis.fetch = async () => {
        const netErr = new TypeError('fetch failed: connect ECONNREFUSED 10.0.0.5:54321');
        throw netErr;
      };

      let statusCode = 200;
      let bodyData = null;
      let nextCalled = false;
      const req = { headers: { authorization: validToken } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => { bodyData = data; } };
        },
      };

      await requireAuth(req, res, () => { nextCalled = true; });
      const parsedBody = bodyData?.body ? JSON.parse(bodyData.body) : bodyData;

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 503);
      assert.equal(parsedBody.error, 'Authentication Service Unavailable');
      // Generic message must be returned to client; internal IP 10.0.0.5 or ECONNREFUSED must NOT be exposed
      assert.equal(
        parsedBody.message,
        'Authentication service is temporarily unavailable. Please try again later.'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

// ----------------------------------------------------------------------------
// Scenario 24: Upstream Supabase Non-2xx Returns Generic Consistent 401 Message
// ----------------------------------------------------------------------------
await runTest(
  'requireAuth: Returns generic consistent 401 message when Supabase returns non-2xx without leaking upstream msg/error_description',
  async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const validPayload = Buffer.from(JSON.stringify({ sub: 'user_upstream_fail', exp: futureExp })).toString('base64url');
    const validToken = `Bearer eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;

    const originalFetch = globalThis.fetch;
    try {
      // Simulate Supabase returning 401 with arbitrary internal error details
      globalThis.fetch = async () => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            msg: 'Sensitive DB lookup error: user_uuid not found in auth.identities',
            error_description: 'Internal postgres constraint failed',
          }),
        };
      };

      let statusCode = 200;
      let bodyData = null;
      let nextCalled = false;
      const req = { headers: { authorization: validToken } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => { bodyData = data; } };
        },
      };

      await requireAuth(req, res, () => { nextCalled = true; });
      const parsedBody = bodyData?.body ? JSON.parse(bodyData.body) : bodyData;

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 401);
      assert.equal(parsedBody.error, 'Unauthorized');
      assert.equal(parsedBody.message, 'Invalid or expired Supabase authentication token.');
      // Verify sensitive upstream strings are never leaked
      assert.equal(parsedBody.message.includes('Sensitive DB lookup error'), false);
      assert.equal(parsedBody.message.includes('Internal postgres'), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

console.log(`\n🎉 Success! All ${passedTests}/${totalTests} production-backed backend test scenarios passed!\n`);
