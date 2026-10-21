import { AIProvider, AIProviderResponse, ChatMessage } from '../ai-provider';

export class GroqAIProvider implements AIProvider {
  name = 'groq';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  }

  async generateResponse(messages: ChatMessage[]): Promise<AIProviderResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout for mobile connections

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: 0.7,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage =
          errorBody?.error?.message || `Groq API returned HTTP status ${response.status}`;
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content.trim()) {
        throw new Error('Groq returned an empty response.');
      }

      return {
        content: content.trim(),
        isSimulated: false,
        modelUsed: data.model || this.model,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

