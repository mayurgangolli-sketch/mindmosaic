// Mock browser environment for localStorage & sessionStorage
class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

(globalThis as any).window = globalThis;
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;

import assert from 'node:assert';
import {
  saveMemorySettings,
  getMemorySettings,
  saveMemory,
  deleteMemory,
  getMemories,
  clearAllMemories,
  MemoryRecord,
} from '../lib/storage';
import { checkSafetyPatterns } from '../lib/safety';
import { selectRelevantMemories, RelevantMemoryContext } from '../lib/memory-retrieval';

function runSlice5CIntegrationTests() {
  console.log('--- Starting Slice 5C Integration & Dynamic Retry Tests ---');

  // Test 1: Client Safety Pre-Gating for Crisis & Acute Medical Reflections
  console.log('Test 1: Client safety pre-gating for crisis and medical emergencies...');
  mockLocalStorage.clear();
  mockSessionStorage.clear();

  // Set permissions ON
  mockSessionStorage.setItem('mindmosaic_consent_given', 'true');
  saveMemorySettings({ enabled: true });

  const testWalkMemory: MemoryRecord = {
    id: 'mem_walk_101',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: 'coping_strategy',
    summary: 'Taking a 15-minute walk before exams really helps me unwind.',
    tags: ['walk', 'exams'],
    provenance: 'user_stated',
  };
  saveMemory(testWalkMemory);
  assert.strictEqual(getMemories().length, 1);

  // Simulating JournalEntry.tsx dispatch logic:
  const prepareTurnPayload = (userText: string) => {
    const consent = mockSessionStorage.getItem('mindmosaic_consent_given');
    if (consent !== 'true') {
      return { blockedByConsent: true, payload: null };
    }

    let relevantMemories: RelevantMemoryContext[] = [];
    const memSettings = getMemorySettings();
    const safetyCheck = checkSafetyPatterns(userText);

    if (memSettings.enabled && !safetyCheck.isCrisis && !safetyCheck.isMedicalEmergency) {
      const savedMemories = getMemories();
      relevantMemories = selectRelevantMemories(userText, savedMemories);
    }

    return {
      blockedByConsent: false,
      payload: {
        message: userText,
        relevantMemories,
      },
    };
  };

  // 1a: Acute Medical reflection -> memories must be []
  const medTurn = prepareTurnPayload('I am experiencing sudden slurred speech and severe chest tightness.');
  assert.strictEqual(medTurn.blockedByConsent, false);
  assert.deepStrictEqual(medTurn.payload?.relevantMemories, [], 'Acute medical reflection must send empty relevantMemories');

  // 1b: Crisis reflection -> memories must be []
  const crisisTurn = prepareTurnPayload('I am thinking of suicide and want to end it all.');
  assert.strictEqual(crisisTurn.blockedByConsent, false);
  assert.deepStrictEqual(crisisTurn.payload?.relevantMemories, [], 'Crisis reflection must send empty relevantMemories');

  // Test 2: Memory OFF Gate
  console.log('Test 2: Memory OFF suppresses memory selection...');
  saveMemorySettings({ enabled: false });
  const memOffTurn = prepareTurnPayload('My final exams are tomorrow and I feel tense.');
  assert.strictEqual(memOffTurn.blockedByConsent, false);
  assert.deepStrictEqual(memOffTurn.payload?.relevantMemories, [], 'When Persistent Memory is OFF, relevantMemories must be empty');

  // Test 3: Consent Inactive Gate
  console.log('Test 3: Consent inactive blocks dispatch...');
  saveMemorySettings({ enabled: true });
  mockSessionStorage.removeItem('mindmosaic_consent_given');
  const noConsentTurn = prepareTurnPayload('Hello companion');
  assert.strictEqual(noConsentTurn.blockedByConsent, true, 'Without affirmative consent, dispatch must be blocked');

  // Test 4: Relevant Memory Selection when ON & Safe
  console.log('Test 4: Safe reflection with Memory ON includes matching memory...');
  mockSessionStorage.setItem('mindmosaic_consent_given', 'true');
  const safeExamTurn = prepareTurnPayload('My final exams are approaching and I am trying to stay calm.');
  assert.strictEqual(safeExamTurn.blockedByConsent, false);
  assert.strictEqual(safeExamTurn.payload?.relevantMemories.length, 1);
  assert.strictEqual(safeExamTurn.payload?.relevantMemories[0].id, 'mem_walk_101');

  // Test 5: Dynamic Retry After Memory Deletion
  console.log('Test 5: Dynamic retry after memory deletion in storage...');
  // Simulating user opening settings modal and deleting 'mem_walk_101' before clicking Retry:
  deleteMemory('mem_walk_101');
  assert.strictEqual(getMemories().length, 0);

  // Retry executed on the same message
  const retryAfterDeleteTurn = prepareTurnPayload('My final exams are approaching and I am trying to stay calm.');
  assert.strictEqual(retryAfterDeleteTurn.blockedByConsent, false);
  assert.deepStrictEqual(
    retryAfterDeleteTurn.payload?.relevantMemories,
    [],
    'Retry must dynamically read fresh storage and omit deleted memory'
  );

  // Test 6: Dynamic Retry After Switching Memory OFF
  console.log('Test 6: Dynamic retry after switching memory OFF...');
  // Re-save a memory
  saveMemory(testWalkMemory);
  assert.strictEqual(getMemories().length, 1);

  // First dispatch would include memory
  const initialTurn = prepareTurnPayload('Exams are stressful.');
  assert.strictEqual(initialTurn.payload?.relevantMemories.length, 1);

  // User toggles memory OFF before retrying
  saveMemorySettings({ enabled: false });

  // Retry executed
  const retryAfterMemoryOff = prepareTurnPayload('Exams are stressful.');
  assert.deepStrictEqual(
    retryAfterMemoryOff.payload?.relevantMemories,
    [],
    'Retry must immediately reflect Memory OFF state'
  );

  console.log('--- All Slice 5C Integration Tests Passed Successfully! ---');
}

runSlice5CIntegrationTests();

