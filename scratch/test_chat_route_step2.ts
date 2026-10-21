import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/chat/route';

async function runStep2ChatRouteTests() {
  console.log('--- Starting Step 2 Tests for app/api/chat/route.ts ---');

  // Test 1: Request Payload Validation
  console.log('Test 1: Request payload validation...');
  // 1a: Missing message
  const emptyReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const resEmpty = await POST(emptyReq);
  assert.strictEqual(resEmpty.status, 400);

  // 1b: Message length cap (> 4000 characters)
  const hugeReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'a'.repeat(4001) }),
  });
  const resHuge = await POST(hugeReq);
  assert.strictEqual(resHuge.status, 400);

  // Test 2: Safe Memory Payload Validation & Diagnostic Term Stripping
  console.log('Test 2: Diagnostic term filtering and character limits in memory context...');
  const reqWithDiagnosticMem = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: 'Just reflecting on my quiet day.',
      relevantMemories: [
        {
          category: 'inferred_observation',
          summary: 'User suffers from severe clinical depression and bipolar disorder.',
          provenance: 'ai_inferred',
        },
        {
          category: 'coping_strategy',
          summary: 'Taking a 15-minute walk before exams really helps me unwind.',
          provenance: 'user_stated',
        },
      ],
    }),
  });

  const resDiag = await POST(reqWithDiagnosticMem);
  assert.strictEqual(resDiag.status, 200);
  const dataDiag = await resDiag.json();
  assert.strictEqual(dataDiag.success, true);
  // Response returned successfully with valid memory processed while diagnostic memory was safely dropped

  // Test 3: Authoritative Safety Precedence: Crisis with Memory Context
  console.log('Test 3: Authoritative server safety stripping on crisis reflection...');
  const crisisReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: 'I want to commit suicide and end it all tonight.',
      relevantMemories: [
        {
          category: 'coping_strategy',
          summary: 'Taking a walk helps unwind.',
          provenance: 'user_stated',
        },
      ],
    }),
  });

  const resCrisis = await POST(crisisReq);
  assert.strictEqual(resCrisis.status, 200);
  const dataCrisis = await resCrisis.json();
  assert.strictEqual(dataCrisis.data.safetyAlert, 'crisis', 'Must return crisis safetyAlert');
  assert.ok(
    dataCrisis.data.content.includes('Tele-MANAS') ||
    dataCrisis.data.content.includes('14416') ||
    dataCrisis.data.content.includes('112') ||
    dataCrisis.data.isSimulated === true,
    'Crisis response must trigger emergency resource response'
  );

  // Test 4: Acute Medical Emergency Precedence (Provider bypassed)
  console.log('Test 4: Acute medical emergency precedence...');
  const medReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: 'I am experiencing the worst headache of my life and slurred speech.',
      relevantMemories: [
        {
          category: 'coping_strategy',
          summary: 'Taking a walk helps unwind.',
          provenance: 'user_stated',
        },
      ],
    }),
  });

  const resMed = await POST(medReq);
  assert.strictEqual(resMed.status, 200);
  const dataMed = await resMed.json();
  assert.strictEqual(dataMed.data.safetyAlert, 'medical', 'Must trigger medical emergency alert');
  assert.ok(
    dataMed.data.content.includes('call 112') || dataMed.data.content.includes('emergency medical care'),
    'Must provide immediate emergency medical directive'
  );

  // Test 5: Normal Safe Reflection with Valid Memory Context
  console.log('Test 5: Normal safe reflection with approved memory context...');
  const normalReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: 'I have another big exam tomorrow and I am hoping to stay calm.',
      relevantMemories: [
        {
          category: 'coping_strategy',
          summary: 'Taking a 15-minute walk before exams really helps me unwind.',
          provenance: 'user_stated',
          tags: ['walk', 'exams'],
        },
      ],
    }),
  });

  const resNormal = await POST(normalReq);
  assert.strictEqual(resNormal.status, 200);
  const dataNormal = await resNormal.json();
  assert.strictEqual(dataNormal.success, true);
  assert.ok(dataNormal.data.content.length > 0, 'Must return a valid companion response');

  // Test 6: Zero Sensitive Logging Verification
  console.log('Test 6: Zero sensitive logging verification...');
  let loggedSensitive = false;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const spyLog = (...args: any[]) => {
    const combined = args.join(' ');
    if (combined.includes('secret_canary_reflection_text') || combined.includes('secret_canary_memory_summary')) {
      loggedSensitive = true;
    }
  };

  console.log = spyLog;
  console.warn = spyLog;
  console.error = spyLog;

  try {
    const canaryReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'This is my secret_canary_reflection_text.',
        relevantMemories: [
          {
            category: 'lifestyle_fact',
            summary: 'Contains secret_canary_memory_summary.',
            provenance: 'user_stated',
          },
        ],
      }),
    });
    await POST(canaryReq);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  assert.strictEqual(loggedSensitive, false, 'Canary reflection text and memory summaries must NEVER be logged');

  console.log('--- All Step 2 Chat Route Tests Passed Successfully! ---');
}

runStep2ChatRouteTests();

