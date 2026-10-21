import assert from 'node:assert';
import {
  extractSearchTokens,
  isCommunicationPreference,
  calculateMemoryRelevance,
  selectRelevantMemories,
  RelevantMemoryContext,
} from '../lib/memory-retrieval';
import type { MemoryRecord } from '../lib/storage';

function runStep1RetrievalTests() {
  console.log('--- Starting Step 1 Tests for lib/memory-retrieval.ts ---');

  // Test 1: Tokenization and Stop-word filtering
  console.log('Test 1: Tokenization and stop-word filtering...');
  const textWithFillers = 'I am really feeling very tired today and just want to think about good things!';
  const tokens = extractSearchTokens(textWithFillers);
  // 'really', 'feeling', 'tired', 'today', 'think', 'things'
  // 'tired' should remain; 'really', 'feeling', 'today', 'think', 'things' should be stripped as fillers
  assert.ok(tokens.includes('tired'), 'Meaningful word "tired" must be retained');
  assert.strictEqual(tokens.includes('really'), false, '"really" must be stripped as stop/filler word');
  assert.strictEqual(tokens.includes('feeling'), false, '"feeling" must be stripped as stop/filler word');
  assert.strictEqual(tokens.includes('today'), false, '"today" must be stripped as stop/filler word');
  assert.strictEqual(tokens.includes('just'), false, '"just" must be stripped');
  assert.strictEqual(tokens.includes('and'), false, '"and" must be stripped');

  // Test 2: Communication Preference vs Lifestyle Preference Detection
  console.log('Test 2: Communication preference vs lifestyle preference...');
  const commPref: MemoryRecord = {
    id: 'mem_comm_1',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: 'user_preference',
    summary: 'Prefers quiet listening without unsolicited advice.',
    tags: ['listening', 'boundaries'],
    provenance: 'user_stated',
  };

  const lifestylePref: MemoryRecord = {
    id: 'mem_life_1',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: 'user_preference',
    summary: 'Prefers drinking chamomile tea before bed.',
    tags: ['tea', 'night'],
    provenance: 'user_stated',
  };

  assert.strictEqual(isCommunicationPreference(commPref), true, 'Quiet listening without advice must be recognized as communication preference');
  assert.strictEqual(isCommunicationPreference(lifestylePref), false, 'Drinking chamomile tea must NOT be categorized as communication preference');

  // Test 3: False-Positive Minimization with Ambiguous Incidental Words
  console.log('Test 3: False-positive minimization for ambiguous context...');
  const examWalkMemory: MemoryRecord = {
    id: 'mem_walk_1',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: 'coping_strategy',
    summary: 'Taking a 15-minute walk before exams really helps me unwind.',
    tags: ['walk', 'exams', 'unwind'],
    provenance: 'user_stated',
  };

  // User wrote about walking into the office with zero exam context
  const officeReflection = 'I walked into the office this morning and noticed the lights were flickering.';
  const officeSelected = selectRelevantMemories(officeReflection, [examWalkMemory]);
  assert.strictEqual(officeSelected.length, 0, 'Incidental "walked into office" must NOT trigger exam walk memory');

  // Test 4: Relevant Keyword & Tag Overlap Matching
  console.log('Test 4: Relevant keyword and tag matching...');
  const examPanicReflection = 'My final exams are approaching fast and I am feeling overwhelmed by the study material.';
  const examSelected = selectRelevantMemories(examPanicReflection, [examWalkMemory, lifestylePref]);
  assert.strictEqual(examSelected.length, 1, 'Exam reflection must select the exam walk memory');
  assert.strictEqual(examSelected[0].id, 'mem_walk_1');
  assert.strictEqual(examSelected.some((m: RelevantMemoryContext) => m.id === 'mem_life_1'), false, 'Unrelated tea preference must NOT be selected');

  // Test 5: Communication Preference Priority in Unrelated Conversations
  console.log('Test 5: Communication preference priority across reflections...');
  const dinnerReflection = 'My partner and I are cooking dinner and trying out a new pasta recipe.';
  const dinnerSelected = selectRelevantMemories(dinnerReflection, [commPref, lifestylePref, examWalkMemory]);
  // Communication preference applies to govern how companion responds, while lifestyle & exam memories are omitted
  assert.strictEqual(dinnerSelected.length, 1, 'Only communication preference should be included for cooking topic');
  assert.strictEqual(dinnerSelected[0].id, 'mem_comm_1');

  // Test 6: Count and Character Length Capping (Max 3 items, Max 400 chars)
  console.log('Test 6: Count and character length capping...');
  const longMemories: MemoryRecord[] = [
    {
      id: 'm1',
      version: 1,
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-20T10:00:00Z',
      category: 'coping_strategy',
      summary: 'Strategy A: Deep breathing exercises help calm nerves during presentations.',
      tags: ['presentation', 'breathing'],
      provenance: 'user_stated',
    },
    {
      id: 'm2',
      version: 1,
      createdAt: '2026-10-20T11:00:00Z',
      updatedAt: '2026-10-20T11:00:00Z',
      category: 'coping_strategy',
      summary: 'Strategy B: Rehearsing the opening minute of a presentation out loud builds confidence.',
      tags: ['presentation', 'rehearsal'],
      provenance: 'user_stated',
    },
    {
      id: 'm3',
      version: 1,
      createdAt: '2026-10-20T12:00:00Z',
      updatedAt: '2026-10-20T12:00:00Z',
      category: 'coping_strategy',
      summary: 'Strategy C: Writing three key cue words on an index card anchors thoughts during a presentation.',
      tags: ['presentation', 'cue'],
      provenance: 'user_stated',
    },
    {
      id: 'm4',
      version: 1,
      createdAt: '2026-10-20T13:00:00Z',
      updatedAt: '2026-10-20T13:00:00Z',
      category: 'coping_strategy',
      summary: 'Strategy D: Drinking a glass of cool water before stepping on stage reduces tension in presentations.',
      tags: ['presentation', 'water'],
      provenance: 'user_stated',
    },
  ];

  const presentationReflection = 'I have a huge presentation coming up and I need to prepare my speaking plan.';
  const cappedSelected = selectRelevantMemories(presentationReflection, longMemories, { maxCount: 3, maxChars: 250 });
  assert.ok(cappedSelected.length <= 3, 'Must not exceed maxCount of 3');
  const totalChars = cappedSelected.reduce((sum: number, m: RelevantMemoryContext) => sum + m.summary.length, 0);
  assert.ok(totalChars <= 250, 'Must not exceed maxChars cap');

  // Test 7: Empty or Malformed Inputs
  console.log('Test 7: Empty or malformed inputs...');
  assert.deepStrictEqual(selectRelevantMemories('', [examWalkMemory]), []);
  assert.deepStrictEqual(selectRelevantMemories('valid text', []), []);
  assert.deepStrictEqual(selectRelevantMemories('valid text', null as any), []);
  assert.deepStrictEqual(selectRelevantMemories(null as any, [examWalkMemory]), []);

  console.log('--- All Step 1 Retrieval Engine Tests Passed Successfully! ---');
}

runStep1RetrievalTests();
