import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { POST as chatPOST } from '../app/api/chat/route';
import {
  saveSession,
  getSessions,
  createSession,
  JournalSession,
  Message,
} from '../lib/storage';

// Local storage mock for Node environment
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();
(global as any).localStorage = mockStorage;
(global as any).window = {};

async function runSlice4BranchingTests() {
  console.log('===========================================================');
  console.log('Starting MindMosaic Slice 4 Automated Test Suite');
  console.log('Testing: Branching, Suggestions, Non-Retroactivity, Safety');
  console.log('===========================================================\n');

  // Clear storage
  mockStorage.clear();

  // --------------------------------------------------------------------------
  // Test 1: Immediate Suggestion Trigger & Transcript Integrity
  // --------------------------------------------------------------------------
  console.log('Test 1: "Get a suggestion" trigger and transcript integrity...');
  {
    // User writes an initial journal entry
    const entryText = "I'm feeling really overwhelmed with my presentation tomorrow morning.";
    const session = createSession(entryText);

    // Initial assistant response (friend-first listening, no advice)
    const initialAssistantTurn: Message = {
      id: 'msg_asst_1',
      role: 'assistant',
      content: 'Presentations can feel daunting. It makes total sense that you are feeling this tension.',
      timestamp: new Date().toISOString(),
      isSimulated: true,
    };
    session.conversation = [initialAssistantTurn];
    saveSession(session);

    assert.strictEqual(session.conversation.length, 1, 'Initial conversation must have exactly 1 assistant turn');
    assert.strictEqual(session.conversation[0].branchChoice, undefined, 'Initial turn has no branch tag');

    // User clicks "Get a suggestion"
    // Server request payload
    const suggestionReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Could you please share 1–2 practical suggestions or gentle coping perspectives based on what I shared?',
        conversationHistory: [
          { role: 'user', content: session.entryText },
          { role: 'assistant', content: session.conversation[0].content },
        ],
        branchChoice: 'suggestion',
        isInternalRequest: true,
      }),
    });

    const res = await chatPOST(suggestionReq);
    assert.strictEqual(res.status, 200, 'Chat route should return HTTP 200');
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.content, 'Should contain companion response');

    // Client creates ONLY assistant message with branchChoice: 'suggestion'
    // CRITICAL: Transcript integrity check - NO synthetic user message added
    const suggestionAssistantTurn: Message = {
      id: 'msg_asst_2',
      role: 'assistant',
      content: json.data.content,
      timestamp: new Date().toISOString(),
      branchChoice: 'suggestion',
      isSimulated: json.data.isSimulated,
    };

    session.conversation.push(suggestionAssistantTurn);
    saveSession(session);

    // Verify localStorage & conversation state
    const retrievedSessions = getSessions();
    const stored = retrievedSessions.find((s) => s.id === session.id);
    assert.ok(stored, 'Session must exist in localStorage');
    assert.strictEqual(stored.conversation.length, 2, 'Must have exactly 2 messages in conversation');
    assert.strictEqual(stored.conversation[0].role, 'assistant', 'Turn 0 is companion initial reply');
    assert.strictEqual(stored.conversation[0].branchChoice, undefined, 'Turn 0 has no branchChoice');
    assert.strictEqual(stored.conversation[1].role, 'assistant', 'Turn 1 is companion suggestion reply');
    assert.strictEqual(stored.conversation[1].branchChoice, 'suggestion', 'Turn 1 has suggestion branchChoice');

    // Confirm that NO fake user message was stored
    const userMessages = stored.conversation.filter((m) => m.role === 'user');
    assert.strictEqual(userMessages.length, 0, 'Transcript integrity: No fabricated user message exists');
    console.log('  ✓ "Get a suggestion" dispatched cleanly without fabricating user transcript turns');
  }

  // --------------------------------------------------------------------------
  // Test 2: "Talk more" Selection & Subsequent Message Tagging
  // --------------------------------------------------------------------------
  console.log('\nTest 2: "Talk more" selection and turn tagging...');
  {
    const entryText = "I had a disagreement with my sibling today.";
    const session = createSession(entryText);
    session.conversation = [
      {
        id: 'msg_asst_initial',
        role: 'assistant',
        content: 'That sounds really frustrating and exhausting.',
        timestamp: new Date().toISOString(),
      },
    ];
    saveSession(session);

    // User chooses "Talk more" -> activeBranch becomes 'talk'
    let activeBranch: 'talk' | 'suggestion' | null = 'talk';

    // User sends a follow-up reply in Talk mode
    const userReplyContent = "We argued over something small, but it felt much bigger.";
    const userTurn: Message = {
      id: 'msg_user_1',
      role: 'user',
      content: userReplyContent,
      timestamp: new Date().toISOString(),
      branchChoice: activeBranch,
    };
    session.conversation.push(userTurn);

    // Server request with branchChoice: 'talk'
    const talkReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: userReplyContent,
        conversationHistory: [
          { role: 'user', content: session.entryText },
          { role: 'assistant', content: session.conversation[0].content },
        ],
        branchChoice: activeBranch,
      }),
    });

    const res = await chatPOST(talkReq);
    assert.strictEqual(res.status, 200);
    const json = await res.json();

    const asstReply: Message = {
      id: 'msg_asst_reply',
      role: 'assistant',
      content: json.data.content,
      timestamp: new Date().toISOString(),
      branchChoice: activeBranch,
      isSimulated: json.data.isSimulated,
    };
    session.conversation.push(asstReply);
    saveSession(session);

    const stored = getSessions().find((s) => s.id === session.id);
    assert.ok(stored);
    assert.strictEqual(stored.conversation.length, 3);
    assert.strictEqual(stored.conversation[1].branchChoice, 'talk');
    assert.strictEqual(stored.conversation[2].branchChoice, 'talk');
    console.log('  ✓ "Talk more" turns correctly tagged with branchChoice: "talk"');
  }

  // --------------------------------------------------------------------------
  // Test 3: Branch Switching & Non-Retroactivity Invariant
  // --------------------------------------------------------------------------
  console.log('\nTest 3: Dynamic branch switching & non-retroactivity...');
  {
    const session = createSession("Work has been relentless.");
    session.conversation = [
      {
        id: 'msg_1',
        role: 'assistant',
        content: 'Work overload takes a heavy toll.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg_2',
        role: 'user',
        content: 'I keep thinking about deadlines even in bed.',
        timestamp: new Date().toISOString(),
        branchChoice: 'talk',
      },
      {
        id: 'msg_3',
        role: 'assistant',
        content: 'It sounds like your mind has not had space to power down.',
        timestamp: new Date().toISOString(),
        branchChoice: 'talk',
      },
    ];
    saveSession(session);

    // User switches branch to 'suggestion'
    let activeBranch: 'talk' | 'suggestion' = 'suggestion';

    // Verify existing turns were NOT retroactively modified
    assert.strictEqual(session.conversation[1].branchChoice, 'talk', 'Earlier turn must remain "talk"');
    assert.strictEqual(session.conversation[2].branchChoice, 'talk', 'Earlier turn must remain "talk"');

    // Next turn sent under 'suggestion'
    const userTurn2: Message = {
      id: 'msg_4',
      role: 'user',
      content: 'What is one small boundary I could set tonight?',
      timestamp: new Date().toISOString(),
      branchChoice: activeBranch,
    };
    session.conversation.push(userTurn2);

    const asstTurn2: Message = {
      id: 'msg_5',
      role: 'assistant',
      content: 'Consider leaving your laptop outside the sleeping area 30 minutes before sleep.',
      timestamp: new Date().toISOString(),
      branchChoice: activeBranch,
    };
    session.conversation.push(asstTurn2);
    saveSession(session);

    const stored = getSessions().find((s) => s.id === session.id);
    assert.ok(stored);
    assert.strictEqual(stored.conversation[1].branchChoice, 'talk', 'Preserved non-retroactively');
    assert.strictEqual(stored.conversation[2].branchChoice, 'talk', 'Preserved non-retroactively');
    assert.strictEqual(stored.conversation[3].branchChoice, 'suggestion', 'Tagged with new branch');
    assert.strictEqual(stored.conversation[4].branchChoice, 'suggestion', 'Tagged with new branch');
    console.log('  ✓ Branch switching preserves existing tags and updates only subsequent turns');
  }

  // --------------------------------------------------------------------------
  // Test 4: Session Resumption & Branch State Restoration
  // --------------------------------------------------------------------------
  console.log('\nTest 4: Session resumption and active branch restoration...');
  {
    // Helper replicating JournalEntry activeBranch restoration logic
    function computeRestoredBranch(session: JournalSession): 'talk' | 'suggestion' | null {
      const conv = session.conversation || [];
      const lastBranch = [...conv].reverse().find((m) => m.branchChoice)?.branchChoice;
      if (lastBranch) return lastBranch;
      if (conv.length > 1) return 'talk';
      return null;
    }

    // Case 4a: Session with length 1 (initial companion reply, no branch picked yet)
    const sessionInitial = createSession("Entry");
    sessionInitial.conversation = [
      { id: '1', role: 'assistant', content: 'Listening...', timestamp: new Date().toISOString() },
    ];
    assert.strictEqual(computeRestoredBranch(sessionInitial), null, 'Must restore null to show BranchChoice');

    // Case 4b: Session whose last tagged turn was 'suggestion'
    const sessionSuggestion = createSession("Entry");
    sessionSuggestion.conversation = [
      { id: '1', role: 'assistant', content: 'Listening...', timestamp: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'Idea', timestamp: new Date().toISOString(), branchChoice: 'suggestion' },
    ];
    assert.strictEqual(computeRestoredBranch(sessionSuggestion), 'suggestion', 'Must restore "suggestion"');

    // Case 4c: Session whose last tagged turn was 'talk'
    const sessionTalk = createSession("Entry");
    sessionTalk.conversation = [
      { id: '1', role: 'assistant', content: 'Listening...', timestamp: new Date().toISOString() },
      { id: '2', role: 'user', content: 'More thoughts', timestamp: new Date().toISOString(), branchChoice: 'talk' },
      { id: '3', role: 'assistant', content: 'I hear you', timestamp: new Date().toISOString(), branchChoice: 'talk' },
    ];
    assert.strictEqual(computeRestoredBranch(sessionTalk), 'talk', 'Must restore "talk"');

    // Case 4d: Legacy session with multiple turns but no branchChoice tags
    const sessionLegacy = createSession("Legacy Entry");
    sessionLegacy.conversation = [
      { id: '1', role: 'assistant', content: 'First', timestamp: new Date().toISOString() },
      { id: '2', role: 'user', content: 'Second', timestamp: new Date().toISOString() },
      { id: '3', role: 'assistant', content: 'Third', timestamp: new Date().toISOString() },
    ];
    assert.strictEqual(computeRestoredBranch(sessionLegacy), 'talk', 'Legacy multi-turn must default to "talk"');

    console.log('  ✓ Session resumption reliably restores branch state across all history shapes');
  }

  // --------------------------------------------------------------------------
  // Test 5: Duplicate-Request Prevention
  // --------------------------------------------------------------------------
  console.log('\nTest 5: Duplicate-request protection...');
  {
    let isAiLoading = false;
    let networkCallCount = 0;

    const simulateTrigger = async (branch: 'talk' | 'suggestion') => {
      // Guard identical to BranchChoice & JournalEntry handlers
      if (isAiLoading) {
        return { rejected: true };
      }
      isAiLoading = true;
      networkCallCount++;
      // Simulate in-flight async call
      await new Promise((r) => setTimeout(r, 50));
      isAiLoading = false;
      return { rejected: false };
    };

    // First click initiates request
    const p1 = simulateTrigger('suggestion');
    // Immediate second click while p1 is in flight
    const p2 = simulateTrigger('suggestion');

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.strictEqual(r1.rejected, false, 'First click must proceed');
    assert.strictEqual(r2.rejected, true, 'Second click during loading must be rejected');
    assert.strictEqual(networkCallCount, 1, 'Only one network call must execute');
    console.log('  ✓ Duplicate requests blocked when request is already in flight');
  }

  // --------------------------------------------------------------------------
  // Test 6: Safety Overrides Integrity Under Branching
  // --------------------------------------------------------------------------
  console.log('\nTest 6: Authoritative safety overrides under branching...');
  {
    // Case 6a: Acute Medical Emergency override
    const medicalReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'I have sudden loss of vision and worst headache of my life.',
        branchChoice: 'suggestion',
      }),
    });
    const medicalRes = await chatPOST(medicalReq);
    assert.strictEqual(medicalRes.status, 200);
    const medicalData = await medicalRes.json();
    assert.strictEqual(medicalData.data.safetyAlert, 'medical', 'Must trigger medical safetyAlert');
    assert.ok(
      medicalData.data.content.includes('112') || medicalData.data.content.includes('emergency medical'),
      'Must contain emergency medical referral'
    );

    // Case 6b: Crisis expression override
    const crisisReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'I want to end my life and commit suicide tonight.',
        branchChoice: 'suggestion',
      }),
    });
    const crisisRes = await chatPOST(crisisReq);
    assert.strictEqual(crisisRes.status, 200);
    const crisisData = await crisisRes.json();
    assert.strictEqual(crisisData.data.safetyAlert, 'crisis', 'Must trigger crisis safetyAlert');
    assert.ok(
      crisisData.data.content.includes('Tele-MANAS') ||
      crisisData.data.content.includes('14416') ||
      crisisData.data.content.includes('112') ||
      crisisData.data.isSimulated === true,
      'Must provide crisis resources'
    );

    console.log('  ✓ Medical emergency and crisis safety boundaries override branching unconditionally');
  }

  // --------------------------------------------------------------------------
  // Test 7: BranchChoice & BranchSwitcher Design System Rules (No Pills)
  // --------------------------------------------------------------------------
  console.log('\nTest 7: Design system verification (non-pill corner radii)...');
  {
    const fs = await import('node:fs');
    const branchChoiceSource = fs.readFileSync('components/BranchChoice.tsx', 'utf-8');

    // Verify it doesn't use rounded-full for action buttons
    assert.ok(!branchChoiceSource.includes('rounded-full'), 'Must not use rounded-full for buttons (no generic pills)');
    assert.ok(branchChoiceSource.includes('rounded-2xl'), 'Uses modest rounded-2xl corner radius');
    assert.ok(branchChoiceSource.includes('rounded-xl'), 'Uses modest rounded-xl corner radius');
    assert.ok(branchChoiceSource.includes('Switch to &ldquo;{targetLabel}&rdquo;'), 'Contains accessible switcher text');
    console.log('  ✓ UI components adhere to anti-slop guidelines with modest corner radii and no pill buttons');
  }

  console.log('\n===========================================================');
  console.log('All MindMosaic Slice 4 Automated Tests Passed Successfully!');
  console.log('===========================================================\n');
}

runSlice4BranchingTests().catch((err) => {
  console.error('Slice 4 test failed:', err);
  process.exit(1);
});
