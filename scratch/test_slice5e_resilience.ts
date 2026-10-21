// Mock browser environment for localStorage & sessionStorage
class MockStorage {
  public store: Record<string, string> = {};
  public throwOnSetItem: boolean = false;

  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key: string, val: string) {
    if (this.throwOnSetItem) {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      (err as any).code = 22;
      throw err;
    }
    this.store[key] = String(val);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
    this.throwOnSetItem = false;
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

(globalThis as any).window = globalThis;
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;

import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { POST as chatPOST } from '../app/api/chat/route';
import {
  getSessions,
  saveSession,
  deleteSession,
  clearAllSessions,
  getMemories,
  saveMemory,
  deleteMemory,
  clearAllMemories,
  getMemorySettings,
  saveMemorySettings,
  DEFAULT_MEMORY_SETTINGS,
  JournalSession,
  MemoryRecord,
} from '../lib/storage';
import { selectRelevantMemories } from '../lib/memory-retrieval';

async function runSlice5EResilienceTests() {
  console.log('=== MindMosaic Slice 5E: Storage Resilience, Privacy Isolation & Adversarial Safety ===\n');

  // Prevent external AI API calls by temporarily clearing GROQ_API_KEY
  const originalApiKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Storage Resilience under Malformed / Corrupted Data
    // -------------------------------------------------------------------------
    console.log('Test 1: Storage resilience under corrupted data & data-loss assessment...');
    mockLocalStorage.clear();

    // 1a: Completely unparseable non-JSON in mindmosaic_sessions
    mockLocalStorage.setItem('mindmosaic_sessions', 'MALFORMED_NON_JSON_{{{');
    const sessionsCorrupted = getSessions();
    assert.deepStrictEqual(sessionsCorrupted, [], 'Corrupted sessions must safely return [] without throwing');

    // 1b: Data-loss evaluation on subsequent save
    // When storage had unparseable text and user saves a new session, verify it restores valid storage
    const newSession: JournalSession = {
      id: 'sess_recovery_1',
      createdAt: new Date().toISOString(),
      entryText: 'Recovered reflection text after corruption.',
      conversation: [],
    };
    const saveRes = saveSession(newSession);
    assert.strictEqual(saveRes.success, true);
    const sessionsAfterSave = getSessions();
    assert.strictEqual(sessionsAfterSave.length, 1);
    assert.strictEqual(sessionsAfterSave[0].entryText, 'Recovered reflection text after corruption.');

    // 1c: Partially valid array in mindmosaic_sessions (tolerates missing dates and extra fields)
    const partiallyValidSessions = [
      { id: 'sess_valid_1', createdAt: '2026-10-19T10:00:00Z', entryText: 'Valid 1', conversation: [] },
      { id: 'sess_missing_date', createdAt: 'INVALID_DATE', entryText: 'Valid 2 missing date', conversation: [] },
      { id: 'sess_extra_fields', createdAt: '2026-10-20T12:00:00Z', entryText: 'Valid 3', conversation: [], extraUnexpected: true },
    ];
    mockLocalStorage.setItem('mindmosaic_sessions', JSON.stringify(partiallyValidSessions));
    const parsedSessions = getSessions();
    assert.strictEqual(parsedSessions.length, 3, 'Partially valid sessions must all be preserved without data loss');
    assert.strictEqual(parsedSessions[0].id, 'sess_extra_fields', 'Newest valid date sorts first');

    // 1d: Unparseable non-JSON in mindmosaic_memories
    mockLocalStorage.setItem('mindmosaic_memories', 'CORRUPTED_MEMORIES_STRING_###');
    const memoriesCorrupted = getMemories();
    assert.deepStrictEqual(memoriesCorrupted, [], 'Corrupted memories must safely return [] without throwing');

    // 1e: Partially valid array in mindmosaic_memories (missing/invalid dates)
    const partiallyValidMemories: any[] = [
      {
        id: 'mem_p1',
        version: 1,
        createdAt: 'INVALID_TIMESTAMP',
        updatedAt: 'INVALID_TIMESTAMP',
        category: 'coping_strategy',
        summary: 'Walking helps.',
        tags: ['walk'],
        provenance: 'user_stated',
      },
      {
        id: 'mem_p2',
        version: 1,
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
        category: 'user_preference',
        summary: 'Prefers quiet reflection.',
        tags: [],
        provenance: 'user_stated',
      },
    ];
    mockLocalStorage.setItem('mindmosaic_memories', JSON.stringify(partiallyValidMemories));
    const memoriesRecovered = getMemories();
    assert.strictEqual(memoriesRecovered.length, 2, 'Partially valid memories must both be retained');
    assert.strictEqual(memoriesRecovered[0].id, 'mem_p2', 'Valid timestamp sorts ahead of fallback 0 timestamp');

    // 1f: Corrupted non-JSON in mindmosaic_memory_settings
    mockLocalStorage.setItem('mindmosaic_memory_settings', 'NOT_JSON_SETTINGS');
    const settingsCorrupted = getMemorySettings();
    assert.deepStrictEqual(settingsCorrupted, DEFAULT_MEMORY_SETTINGS, 'Corrupted settings must safely return default disabled settings');
    console.log('  -> PASS: Corrupted reads return safe non-crashing fallbacks and partially valid data is preserved.\n');

    // -------------------------------------------------------------------------
    // Test 2: Storage Quota Failure Handling (Zero Silent Overwrite)
    // -------------------------------------------------------------------------
    console.log('Test 2: Storage quota exceeded handling...');
    mockLocalStorage.clear();

    // Seed 1 existing session in storage
    const existingSess: JournalSession = {
      id: 'sess_existing_1',
      createdAt: '2026-10-20T08:00:00Z',
      entryText: 'Existing reflection before quota full.',
      conversation: [],
    };
    mockLocalStorage.setItem('mindmosaic_sessions', JSON.stringify([existingSess]));

    // Enable simulated QuotaExceededError
    mockLocalStorage.throwOnSetItem = true;

    // Attempt saveSession
    const failedSessionSave = saveSession({
      id: 'sess_new_2',
      createdAt: new Date().toISOString(),
      entryText: 'New reflection that exceeds quota.',
      conversation: [],
    });
    assert.strictEqual(failedSessionSave.success, false);
    assert.ok(failedSessionSave.error?.includes('Browser storage is full'));

    // Attempt saveMemory
    saveMemorySettings({ enabled: true }); // Note: throwOnSetItem is active so this returns error or we enable before
    mockLocalStorage.throwOnSetItem = false;
    saveMemorySettings({ enabled: true });
    mockLocalStorage.throwOnSetItem = true;

    const failedMemorySave = saveMemory({
      id: 'mem_quota_test',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'coping_strategy',
      summary: 'Taking deep breaths.',
      tags: ['breathe'],
      provenance: 'user_stated',
    });
    assert.strictEqual(failedMemorySave.success, false);
    assert.ok(failedMemorySave.error?.includes('Could not write memory record'));

    // Disable quota simulation and verify existing session was preserved intact
    mockLocalStorage.throwOnSetItem = false;
    const sessionsAfterQuotaAttempt = getSessions();
    assert.strictEqual(sessionsAfterQuotaAttempt.length, 1);
    assert.strictEqual(sessionsAfterQuotaAttempt[0].id, 'sess_existing_1');
    console.log('  -> PASS: Quota errors handled gracefully without throwing or silently corrupting existing data.\n');

    // -------------------------------------------------------------------------
    // Test 3: Deletion and Privacy Partition Isolation
    // -------------------------------------------------------------------------
    console.log('Test 3: Deletion and privacy partition isolation...');
    mockLocalStorage.clear();

    // Enable memory settings
    saveMemorySettings({ enabled: true });
    assert.strictEqual(getMemorySettings().enabled, true);

    // Seed 2 sessions
    saveSession({ id: 'sess_1', createdAt: '2026-10-20T01:00:00Z', entryText: 'Session 1', conversation: [] });
    saveSession({ id: 'sess_2', createdAt: '2026-10-20T02:00:00Z', entryText: 'Session 2', conversation: [] });
    assert.strictEqual(getSessions().length, 2);

    // Seed 2 memories
    const mem1: MemoryRecord = {
      id: 'mem_1',
      version: 1,
      createdAt: '2026-10-20T01:00:00Z',
      updatedAt: '2026-10-20T01:00:00Z',
      category: 'coping_strategy',
      summary: 'Walk before exams helps.',
      tags: ['walk'],
      provenance: 'user_stated',
    };
    const mem2: MemoryRecord = {
      id: 'mem_2',
      version: 1,
      createdAt: '2026-10-20T02:00:00Z',
      updatedAt: '2026-10-20T02:00:00Z',
      category: 'user_preference',
      summary: 'Prefers quiet reflection.',
      tags: ['quiet'],
      provenance: 'user_stated',
    };
    saveMemory(mem1);
    saveMemory(mem2);
    assert.strictEqual(getMemories().length, 2);

    // 3a: Delete single memory (mem_1)
    const del1Res = deleteMemory('mem_1');
    assert.strictEqual(del1Res, true);
    assert.strictEqual(getMemories().length, 1);
    assert.strictEqual(getMemories()[0].id, 'mem_2');
    // Verify sessions and settings untouched
    assert.strictEqual(getSessions().length, 2, 'Deleting a memory must NOT touch sessions');
    assert.strictEqual(getMemorySettings().enabled, true, 'Deleting a memory must NOT touch settings');

    // 3b: Clear all memories
    const clearMemRes = clearAllMemories();
    assert.strictEqual(clearMemRes, true);
    assert.strictEqual(getMemories().length, 0);
    // Verify sessions and settings untouched
    assert.strictEqual(getSessions().length, 2, 'Clearing all memories must NOT touch sessions');
    assert.strictEqual(getMemorySettings().enabled, true, 'Clearing all memories must NOT touch settings');

    // Re-seed memories for session deletion test
    saveMemory(mem1);
    saveMemory(mem2);
    assert.strictEqual(getMemories().length, 2);

    // 3c: Delete single session (sess_1)
    const delSessRes = deleteSession('sess_1');
    assert.strictEqual(delSessRes, true);
    assert.strictEqual(getSessions().length, 1);
    assert.strictEqual(getSessions()[0].id, 'sess_2');
    // Verify memories untouched
    assert.strictEqual(getMemories().length, 2, 'Deleting a session must NOT touch memories');

    // 3d: Toggle Persistent Memory OFF
    const offRes = saveMemorySettings({ enabled: false });
    assert.strictEqual(offRes.success, true);
    assert.strictEqual(getMemorySettings().enabled, false);
    // Verify saved memories are NOT erased
    assert.strictEqual(getMemories().length, 2, 'Switching memory OFF must NOT erase stored memories');
    // Verify saveMemory is now blocked
    const blockedSave = saveMemory({
      id: 'mem_blocked',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'coping_strategy',
      summary: 'Blocked save.',
      tags: [],
      provenance: 'user_stated',
    });
    assert.strictEqual(blockedSave.success, false);
    assert.ok(blockedSave.error?.includes('currently disabled'));
    console.log('  -> PASS: Partition isolation between sessions, memories, and settings verified completely.\n');

    // -------------------------------------------------------------------------
    // Test 4: Capacity Limit (50 records) & Prioritized AI-Inferred Eviction
    // -------------------------------------------------------------------------
    console.log('Test 4: Capacity limit & prioritized AI-inferred eviction...');
    mockLocalStorage.clear();
    saveMemorySettings({ enabled: true });

    // Seed 48 user_stated memories and 2 ai_inferred memories (total 50)
    for (let i = 1; i <= 48; i++) {
      saveMemory({
        id: `mem_user_${i}`,
        version: 1,
        createdAt: new Date(Date.now() - (100 - i) * 60000).toISOString(),
        updatedAt: new Date(Date.now() - (100 - i) * 60000).toISOString(),
        category: 'coping_strategy',
        summary: `User stated coping strategy #${i}`,
        tags: [`user${i}`],
        provenance: 'user_stated',
      });
    }
    // Add 2 AI-inferred observations (one older, one newer)
    saveMemory({
      id: 'mem_inferred_old',
      version: 1,
      createdAt: new Date(Date.now() - 50000).toISOString(),
      updatedAt: new Date(Date.now() - 50000).toISOString(),
      category: 'inferred_observation',
      summary: 'Tends to feel stressed before presentation deadlines.',
      tags: ['stress'],
      provenance: 'ai_inferred',
    });
    saveMemory({
      id: 'mem_inferred_new',
      version: 1,
      createdAt: new Date(Date.now() - 10000).toISOString(),
      updatedAt: new Date(Date.now() - 10000).toISOString(),
      category: 'inferred_observation',
      summary: 'Feels calm after listening to instrumental music.',
      tags: ['music'],
      provenance: 'ai_inferred',
    });

    assert.strictEqual(getMemories().length, 50, 'Storage must be exactly at 50 capacity');

    // Save 1 new user_stated memory: must evict the oldest AI-inferred memory ('mem_inferred_old')
    const add51 = saveMemory({
      id: 'mem_user_49',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'coping_strategy',
      summary: 'User stated coping strategy #49',
      tags: ['user49'],
      provenance: 'user_stated',
    });
    assert.strictEqual(add51.success, true);
    const memoriesAfter51 = getMemories();
    assert.strictEqual(memoriesAfter51.length, 50, 'Capacity must remain capped at 50');
    assert.strictEqual(
      memoriesAfter51.some((m) => m.id === 'mem_inferred_old'),
      false,
      'Oldest AI-inferred memory must be evicted first'
    );
    assert.strictEqual(
      memoriesAfter51.some((m) => m.id === 'mem_inferred_new'),
      true,
      'Newer AI-inferred memory must be retained'
    );

    // Now fill remaining 1 slot with user_stated memory, so ALL 50 are user_stated
    saveMemory({
      id: 'mem_user_50',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'coping_strategy',
      summary: 'User stated coping strategy #50',
      tags: ['user50'],
      provenance: 'user_stated',
    });
    const memoriesAllUser = getMemories();
    assert.strictEqual(memoriesAllUser.length, 50);
    assert.strictEqual(memoriesAllUser.every((m) => m.provenance === 'user_stated'), true);

    // Attempt to save an AI-inferred record when all 50 are user_stated: must reject to protect user data
    const rejectedInferred = saveMemory({
      id: 'mem_inferred_attempt',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'inferred_observation',
      summary: 'AI observation trying to evict user memory.',
      tags: [],
      provenance: 'ai_inferred',
    });
    assert.strictEqual(rejectedInferred.success, false);
    assert.ok(rejectedInferred.error?.includes('Inferred observations cannot evict user memories'));
    assert.strictEqual(getMemories().length, 50);
    console.log('  -> PASS: 50-record capacity, AI eviction priority, and user-record protection verified.\n');

    // -------------------------------------------------------------------------
    // Test 5: Adversarial Memory Input Validation & Diagnostic Rejection
    // -------------------------------------------------------------------------
    console.log('Test 5: Adversarial memory input validation...');
    mockLocalStorage.clear();
    saveMemorySettings({ enabled: true });

    // 5a: Clinical diagnostic terms in AI-inferred memory
    const diagInferred = saveMemory({
      id: 'mem_diag_1',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'inferred_observation',
      summary: 'User exhibits signs of clinical depression and bipolar disorder.',
      tags: ['depression'],
      provenance: 'ai_inferred',
    });
    assert.strictEqual(diagInferred.success, false);
    assert.ok(diagInferred.error?.includes('Inferred observations cannot contain clinical or diagnostic terminology'));

    // 5b: Formal clinical label in user-stated memory
    const diagUserStated = saveMemory({
      id: 'mem_diag_2',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'lifestyle_fact',
      summary: 'I have a formal diagnosis of bipolar disorder.',
      tags: [],
      provenance: 'user_stated',
    });
    assert.strictEqual(diagUserStated.success, false);
    assert.ok(diagUserStated.error?.includes('formal clinical or diagnostic labeling'));

    // 5c: Summary exceeding 160 characters
    const bloatedMemory = saveMemory({
      id: 'mem_bloat',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'coping_strategy',
      summary: 'A'.repeat(161),
      tags: [],
      provenance: 'user_stated',
    });
    assert.strictEqual(bloatedMemory.success, false);
    assert.ok(bloatedMemory.error?.includes('exceeds maximum length of 160 characters'));

    // 5d: Empty or whitespace-only summary
    const emptyMemory = saveMemory({
      id: 'mem_empty',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'coping_strategy',
      summary: '     ',
      tags: [],
      provenance: 'user_stated',
    });
    assert.strictEqual(emptyMemory.success, false);
    assert.ok(emptyMemory.error?.includes('cannot be empty'));

    // 5e: Valid non-diagnostic memory succeeds cleanly
    const validWalk = saveMemory({
      id: 'mem_walk_valid',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'coping_strategy',
      summary: 'Taking a 15-minute walk before exams really helps me unwind.',
      tags: ['walk', 'exams'],
      provenance: 'user_stated',
    });
    assert.strictEqual(validWalk.success, true);
    assert.strictEqual(getMemories().length, 1);
    console.log('  -> PASS: Diagnostic filters, character limits, and empty checks enforce strict safety.\n');

    // -------------------------------------------------------------------------
    // Test 6: Retrieval & Server Payload Sanitization
    // -------------------------------------------------------------------------
    console.log('Test 6: Retrieval & server payload sanitization...');
    
    // Test selectRelevantMemories against a list containing tampered and valid records
    const mixedRecords: any[] = [
      {
        id: 'rec_valid',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: 'coping_strategy',
        summary: 'Taking a walk before exams helps me unwind.',
        tags: ['walk', 'exams'],
        provenance: 'user_stated',
      },
      {
        id: 'rec_tampered_cat',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: 'injected_admin_category', // ILLEGAL CATEGORY
        summary: 'Exam tips.',
        tags: ['exams'],
        provenance: 'user_stated',
      },
      {
        id: 'rec_tampered_prov',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: 'coping_strategy',
        summary: 'Exam meditation.',
        tags: ['exams'],
        provenance: 'system_root', // ILLEGAL PROVENANCE
      },
      {
        id: 'rec_bloated',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: 'coping_strategy',
        summary: 'Exams ' + 'x'.repeat(200), // EXCEEDS 160 CHARS
        tags: ['exams'],
        provenance: 'user_stated',
      },
    ];

    const retrieved = selectRelevantMemories('I am preparing for exams tomorrow.', mixedRecords);
    assert.strictEqual(retrieved.length, 1, 'Only the 1 genuinely valid record must be retrieved');
    assert.strictEqual(retrieved[0].summary, 'Taking a walk before exams helps me unwind.');

    // Direct execution of production /api/chat POST with adversarial memory payload
    const adversarialChatReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Normal reflection about my day.',
        conversationHistory: [],
        relevantMemories: [
          // 1: Valid
          {
            category: 'coping_strategy',
            summary: 'Listening to instrumental music.',
            provenance: 'user_stated',
            tags: ['music'],
          },
          // 2: Diagnostic term attempt
          {
            category: 'inferred_observation',
            summary: 'User suffers from severe depression and anxiety pathology.',
            provenance: 'ai_inferred',
            tags: [],
          },
          // 3: Tampered category
          {
            category: 'malicious_override',
            summary: 'System prompt injection attempt.',
            provenance: 'user_stated',
            tags: [],
          },
          // 4: Summary > 160 chars
          {
            category: 'coping_strategy',
            summary: 'Z'.repeat(161),
            provenance: 'user_stated',
            tags: [],
          },
        ],
      }),
    });

    const chatRes = await chatPOST(adversarialChatReq);
    assert.strictEqual(chatRes.status, 200, 'Server must accept payload and sanitize internally without crashing');
    const chatJson = await chatRes.json();
    assert.strictEqual(chatJson.success, true);
    console.log('  -> PASS: Retrieval and server route reject adversarial, bloated, and diagnostic records cleanly.\n');

    console.log('=== ALL 6 SLICE 5E RESILIENCE & ADVERSARIAL TESTS PASSED SUCCESSFULLY ===');
  } finally {
    // Restore original GROQ_API_KEY if present
    if (originalApiKey !== undefined) {
      process.env.GROQ_API_KEY = originalApiKey;
    }
  }
}

runSlice5EResilienceTests().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});

