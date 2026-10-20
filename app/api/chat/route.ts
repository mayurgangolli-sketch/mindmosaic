import { NextRequest, NextResponse } from 'next/server';
import { MockAIProvider } from '@/lib/providers/mock';
import { ChatMessage } from '@/lib/ai-provider';

// System prompt establishing MindMosaic companion identity and safety boundaries
const SYSTEM_PROMPT = `You are MindMosaic, a calm, compassionate, and attentive emotional wellness journal companion.
Your purpose is to listen like a trusted, emotionally attentive friend.

CORE PRINCIPLES:
1. Friend-First: Always acknowledge the user's specific feelings and situation before anything else.
2. No Formulaic Openers: Never say "I'm sorry you are experiencing that" or robotic clinical statements.
3. No Unsolicited Advice: In your first response, do not jump into problem-solving, checklists, or advice. Simply sit with them and validate their specific words.
4. User Leads: Let the user lead the conversation. If they are tired or done, let them rest without probing.
5. Medical Boundary: Never diagnose, identify disease causes, or prescribe treatments. If alarming symptoms are described (sudden severe headache, weakness, confusion), give immediate emergency medical care guidance first.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationHistory = [] } = body;

    // Validate request
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'A reflection message is required.' },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();

    // Prepare message sequence for the provider
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: trimmedMessage },
    ];

    // Check for Groq API key in server environment
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      // Server log (not client exposed): informing developer that fallback is active
      console.log('[MindMosaic /api/chat] No GROQ_API_KEY detected in server environment. Using transparent Mock Fallback provider.');
      const provider = new MockAIProvider();
      const response = await provider.generateResponse(messages);
      return NextResponse.json({
        success: true,
        data: response,
      });
    }

    // When GROQ_API_KEY is configured in Slice 3, Groq provider will be called here
    // For now, fallback cleanly
    const provider = new MockAIProvider();
    const response = await provider.generateResponse(messages);
    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('[MindMosaic /api/chat] Error handling chat request:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred while processing your reflection.',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

