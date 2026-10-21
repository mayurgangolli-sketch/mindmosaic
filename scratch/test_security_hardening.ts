/**
 * MindMosaic Security Hardening & Fix Verification Suite
 *
 * Verifies:
 * 1. IP extraction & Node.js node:net isIP() validation (IPv4 and compressed IPv6).
 * 2. Request body byte bounding via readBoundedJson (Content-Length pre-check + stream chunk reading).
 * 3. HTTP 413 for oversized bodies (both with and without Content-Length) and HTTP 400 for malformed JSON.
 * 4. In-memory rate limiting counters and route isolation (/api/chat vs /api/memory/extract).
 * 5. Route handlers integration with oversized body limits, rate limits, and MockAIProvider fallback when GROQ_API_KEY is absent.
 * 6. Conservative HSTS configuration in next.config.ts (max-age=31536000, no preload, no includeSubDomains, prod-only).
 */

import assert from "node:assert";
import { NextRequest } from "next/server";
import { getClientIp, checkRateLimit, resetRateLimitsForTesting } from "../lib/rate-limiter";
import { readBoundedJson, CHAT_MAX_BODY_BYTES, EXTRACT_MAX_BODY_BYTES } from "../lib/request-utils";
import { POST as chatHandler } from "../app/api/chat/route";
import { POST as extractHandler } from "../app/api/memory/extract/route";
import nextConfig from "../next.config";

// Ensure GROQ_API_KEY is not set for tests to verify offline mock safety and zero AI spend
delete process.env.GROQ_API_KEY;

function makeMockNextRequest(options: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  bodyText?: string;
  useStreamWithoutContentLength?: boolean;
}): NextRequest {
  const {
    url = "http://localhost:3000/api/chat",
    method = "POST",
    headers = {},
    bodyText = "",
    useStreamWithoutContentLength = false,
  } = options;

  const headerObj = new Headers(headers);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(bodyText);

  if (bodyText && !useStreamWithoutContentLength && !headerObj.has("content-length")) {
    headerObj.set("content-length", String(encoded.byteLength));
  }
  if (!headerObj.has("content-type")) {
    headerObj.set("content-type", "application/json");
  }

  if (useStreamWithoutContentLength) {
    headerObj.delete("content-length");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Enqueue in chunks to test streaming accumulation
        const chunkSize = 1024;
        for (let i = 0; i < encoded.length; i += chunkSize) {
          controller.enqueue(encoded.subarray(i, i + chunkSize));
        }
        controller.close();
      },
    });
    return new NextRequest(url, {
      method,
      headers: headerObj,
      body: stream,
      // duplex required in Node fetch for streams
      ...({ duplex: "half" } as any),
    });
  }

  return new NextRequest(url, {
    method,
    headers: headerObj,
    body: bodyText ? bodyText : undefined,
  });
}

async function runTests() {
  console.log("=== MindMosaic Security Hardening & Fix Verification Suite ===");
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  // --- Test 1: IP Validation with node:net isIP ---
  await test("1. getClientIp validates IPv4 and compressed IPv6 using node:net isIP()", () => {
    // IPv4 standard
    const reqV4 = makeMockNextRequest({ headers: { "cf-connecting-ip": "192.168.1.1" } });
    assert.strictEqual(getClientIp(reqV4), "192.168.1.1");

    // IPv6 full
    const reqV6Full = makeMockNextRequest({ headers: { "x-real-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334" } });
    assert.strictEqual(getClientIp(reqV6Full), "2001:0db8:85a3:0000:0000:8a2e:0370:7334");

    // IPv6 compressed
    const reqV6Comp = makeMockNextRequest({ headers: { "cf-connecting-ip": "2001:db8::1" } });
    assert.strictEqual(getClientIp(reqV6Comp), "2001:db8::1");

    // IPv6 localhost
    const reqV6Loopback = makeMockNextRequest({ headers: { "x-forwarded-for": "::1" } });
    assert.strictEqual(getClientIp(reqV6Loopback), "::1");

    // X-Forwarded-For chain with valid client IP first
    const reqChain = makeMockNextRequest({ headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" } });
    assert.strictEqual(getClientIp(reqChain), "203.0.113.195");

    // Malformed IP fallback (safely falls back to 127.0.0.1 without throwing)
    const reqMalformed = makeMockNextRequest({ headers: { "cf-connecting-ip": "not-an-ip", "x-real-ip": "999.999.999.999" } });
    assert.strictEqual(getClientIp(reqMalformed), "127.0.0.1");

    // Header precedence: cf-connecting-ip > x-real-ip > x-forwarded-for
    const reqPrecedence = makeMockNextRequest({
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      },
    });
    assert.strictEqual(getClientIp(reqPrecedence), "1.1.1.1");
  });

  // --- Test 2: readBoundedJson byte limit & JSON parsing ---
  await test("2. readBoundedJson enforces limits, rejects oversized bodies & malformed JSON", async () => {
    // 2a. Within limit
    const validJsonReq = makeMockNextRequest({ bodyText: JSON.stringify({ message: "hello" }) });
    const parsedValid = await readBoundedJson<{ message: string }>(validJsonReq, 1024);
    assert.strictEqual(parsedValid.status, 200);
    assert.ok(parsedValid.data);
    assert.strictEqual(parsedValid.data.message, "hello");

    // 2b. Content-Length exceeds limit immediately
    const oversizedBody = "x".repeat(2000);
    const oversizedReq = makeMockNextRequest({ bodyText: JSON.stringify({ data: oversizedBody }) });
    const parsedOversized = await readBoundedJson(oversizedReq, 1024);
    assert.strictEqual(parsedOversized.status, 413);
    assert.strictEqual(parsedOversized.data, null);
    assert.ok(parsedOversized.error?.includes("Payload too large"));

    // 2c. Stream accumulation exceeds limit when Content-Length is missing or chunked
    const parsedChunkedOversized = await readBoundedJson(
      makeMockNextRequest({
        bodyText: JSON.stringify({ data: "y".repeat(3000) }),
        useStreamWithoutContentLength: true,
      }),
      1024
    );
    assert.strictEqual(parsedChunkedOversized.status, 413);
    assert.strictEqual(parsedChunkedOversized.data, null);
    assert.ok(parsedChunkedOversized.error?.includes("Payload too large"));

    // 2d. Malformed JSON within byte limit
    const malformedReq = makeMockNextRequest({ bodyText: "{ invalid json" });
    const parsedMalformed = await readBoundedJson(malformedReq, 1024);
    assert.strictEqual(parsedMalformed.status, 400);
    assert.strictEqual(parsedMalformed.data, null);
    assert.strictEqual(parsedMalformed.error, "Invalid request body. JSON object expected.");
  });

  // --- Test 3: Rate Limiting & Counter Isolation ---
  await test("3. In-memory rate limiting isolates /api/chat and /api/memory/extract counters", () => {
    resetRateLimitsForTesting();
    const testIp = "198.51.100.5";

    // Chat route has limit of 15 / 60s
    for (let i = 0; i < 15; i++) {
      const res = checkRateLimit(`chat_${testIp}`, 15, 60000);
      assert.strictEqual(res.allowed, true, `Chat request ${i + 1} should be allowed`);
    }
    const chatBlocked = checkRateLimit(`chat_${testIp}`, 15, 60000);
    assert.strictEqual(chatBlocked.allowed, false, "Chat request 16 should be blocked");
    assert.strictEqual(chatBlocked.retryAfterSeconds, 60);

    // Memory extract route has its own limit of 10 / 60s, and should not be blocked by chat limit
    for (let i = 0; i < 10; i++) {
      const res = checkRateLimit(`extract_${testIp}`, 10, 60000);
      assert.strictEqual(res.allowed, true, `Extract request ${i + 1} should be allowed despite chat being blocked`);
    }
    const extractBlocked = checkRateLimit(`extract_${testIp}`, 10, 60000);
    assert.strictEqual(extractBlocked.allowed, false, "Extract request 11 should be blocked");
  });

  // --- Test 4: Route Handlers integration with 413 and 400 ---
  await test("4. API routes return HTTP 413 for oversized bodies and 400 for bad JSON", async () => {
    resetRateLimitsForTesting();

    // /api/chat oversized (> 64 KB)
    const bigChatPayload = JSON.stringify({ message: "A".repeat(CHAT_MAX_BODY_BYTES + 50) });
    const chatReq = makeMockNextRequest({
      url: "http://localhost:3000/api/chat",
      bodyText: bigChatPayload,
      headers: { "x-real-ip": "192.0.2.1" },
    });
    const chatRes = await chatHandler(chatReq);
    assert.strictEqual(chatRes.status, 413);
    const chatResJson = await chatRes.json();
    assert.ok(chatResJson.error.includes("Payload too large"));

    // /api/chat malformed JSON
    const badJsonChatReq = makeMockNextRequest({
      url: "http://localhost:3000/api/chat",
      bodyText: "{ not valid json",
      headers: { "x-real-ip": "192.0.2.2" },
    });
    const badJsonChatRes = await chatHandler(badJsonChatReq);
    assert.strictEqual(badJsonChatRes.status, 400);

    // /api/memory/extract oversized (> 16 KB)
    const bigExtractPayload = JSON.stringify({ messages: [{ role: "user", content: "B".repeat(EXTRACT_MAX_BODY_BYTES + 50) }] });
    const extractReq = makeMockNextRequest({
      url: "http://localhost:3000/api/memory/extract",
      bodyText: bigExtractPayload,
      headers: { "x-real-ip": "192.0.2.3" },
    });
    const extractRes = await extractHandler(extractReq);
    assert.strictEqual(extractRes.status, 413);
    const extractResJson = await extractRes.json();
    assert.ok(extractResJson.error.includes("Payload too large"));
  });

  // --- Test 5: Route Handlers safeguards & generic errors ---
  await test("5. Route handlers trigger rate limit 429 and fallback to MockAIProvider safely without GROQ_API_KEY", async () => {
    resetRateLimitsForTesting();
    const spamIp = "192.0.2.99";

    // Normal sized request to /api/chat
    const validBody = JSON.stringify({ message: "Hello, I am testing safely." });

    // Exhaust 15 requests (they should succeed with MockAIProvider since GROQ_API_KEY is not set)
    for (let i = 0; i < 15; i++) {
      const req = makeMockNextRequest({
        url: "http://localhost:3000/api/chat",
        bodyText: validBody,
        headers: { "x-real-ip": spamIp },
      });
      const res = await chatHandler(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.content);
    }

    // 16th request should be rejected with 429
    const blockedReq = makeMockNextRequest({
      url: "http://localhost:3000/api/chat",
      bodyText: validBody,
      headers: { "x-real-ip": spamIp },
    });
    const blockedRes = await chatHandler(blockedReq);
    assert.strictEqual(blockedRes.status, 429);
    assert.ok(blockedRes.headers.get("Retry-After"));
    const blockedData = await blockedRes.json();
    assert.strictEqual(blockedData.error, "Too many requests. Please wait a moment before sending another message.");
  });

  // --- Test 6: next.config.ts HSTS & Security Headers ---
  await test("6. next.config.ts configures conservative HSTS and security headers", async () => {
    assert.ok(nextConfig.headers, "nextConfig should define headers");
    const headersList = await nextConfig.headers();
    assert.ok(Array.isArray(headersList), "headers should return an array");

    const rootRule = headersList.find((h: { source: string }) => h.source === "/(.*)");
    assert.ok(rootRule, "Root headers rule should exist for /(.*)");

    const headerMap = new Map(rootRule.headers.map((h: { key: string; value: string }) => [h.key, h.value]));

    // Check essential security headers
    assert.strictEqual(headerMap.get("X-Frame-Options"), "DENY");
    assert.strictEqual(headerMap.get("X-Content-Type-Options"), "nosniff");
    assert.strictEqual(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.ok(headerMap.has("Content-Security-Policy"), "CSP must be present");

    // If NODE_ENV is production, HSTS should be strictly max-age=31536000 (no preload, no includeSubDomains)
    if (process.env.NODE_ENV === "production") {
      assert.strictEqual(
        headerMap.get("Strict-Transport-Security"),
        "max-age=31536000",
        "Production HSTS should be conservative max-age=31536000 without preload or includeSubDomains"
      );
    } else {
      // In non-production, HSTS must not be set
      assert.strictEqual(
        headerMap.get("Strict-Transport-Security"),
        undefined,
        "HSTS should not be set in non-production environments"
      );
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
