/**
 * MindMosaic — Bounded Request Body Utility
 *
 * Enforces strict byte-size boundaries on incoming HTTP requests before JSON parsing.
 *
 * Threat Model & Security Guarantees:
 * - Content-Length Pre-Check: Immediately rejects requests if declared Content-Length exceeds maxBytes (HTTP 413).
 * - Stream-Level Enforcement: Reads request stream chunk-by-chunk and aborts immediately if cumulative
 *   received bytes exceed maxBytes, neutralizing attacks that omit or spoof Content-Length (HTTP 413).
 * - Safe JSON Parsing: Validates that parsed output is a non-null, non-array JSON object (HTTP 400).
 * - Generic Errors: Returns clean client-facing messages without leaking internal parser details.
 */

export interface BoundedJsonResult<T = any> {
  status: number;
  data: T | null;
  error?: string;
}

// 64 KB limit for /api/chat:
// Comfortably accommodates 4,000-char message, 10-20 history messages, and memory context,
// while terminating oversized payload floods before memory exhaustion.
export const CHAT_MAX_BODY_BYTES = 64 * 1024; // 65,536 bytes

// 16 KB limit for /api/memory/extract:
// Accommodates single reflection (up to 2,000 chars) and session metadata.
export const EXTRACT_MAX_BODY_BYTES = 16 * 1024; // 16,384 bytes

/**
 * Reads and parses JSON from a Request stream with strict byte bounds.
 */
export async function readBoundedJson<T = any>(
  req: Request,
  maxBytes: number
): Promise<BoundedJsonResult<T>> {
  // 1. Fast pre-check: inspect Content-Length header if present
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      return {
        status: 413,
        error: `Payload too large. Maximum allowed size is ${maxBytes} bytes.`,
        data: null,
      };
    }
  }

  // 2. Stream-level read with byte accumulation
  if (!req.body) {
    return {
      status: 400,
      error: 'Invalid request body. JSON object expected.',
      data: null,
    };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          // Immediately stop reading without buffering remaining bytes
          await reader.cancel().catch(() => {});
          return {
            status: 413,
            error: `Payload too large. Maximum allowed size is ${maxBytes} bytes.`,
            data: null,
          };
        }
        chunks.push(value);
      }
    }
  } catch (streamError) {
    return {
      status: 400,
      error: 'Error reading request body stream.',
      data: null,
    };
  }

  if (chunks.length === 0) {
    return {
      status: 400,
      error: 'Invalid request body. JSON object expected.',
      data: null,
    };
  }

  // Concatenate chunks and decode UTF-8 text
  const totalLength = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const concatenated = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const rawText = new TextDecoder('utf-8').decode(concatenated);

  // 3. Safe JSON parsing & object schema validation
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      status: 400,
      error: 'Invalid request body. JSON object expected.',
      data: null,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      status: 400,
      error: 'Invalid request body. JSON object expected.',
      data: null,
    };
  }

  return {
    status: 200,
    data: parsed as T,
  };
}

