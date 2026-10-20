import { AIProvider, AIProviderResponse, ChatMessage } from '../ai-provider';

export class MockAIProvider implements AIProvider {
  name = 'mock';

  async generateResponse(messages: ChatMessage[]): Promise<AIProviderResponse> {
    // Extract the latest user message
    const userMessages = messages.filter((m) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

    // Simulate natural response latency (400ms)
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Transparent, honest simulated companion response
    const content = `Thank you for taking the time to write this down. Your reflection has been safely recorded in your browser's local memory.

[Offline Demo Mode - Simulated Response]
The live AI companion is currently running in offline test mode because no external API key is active. In live mode, MindMosaic will listen to your thoughts, validate your feelings without judgment, and offer gentle suggestions only when you ask for them.`;

    return {
      content,
      isSimulated: true,
      modelUsed: 'mock-offline-fallback',
    };
  }
}

