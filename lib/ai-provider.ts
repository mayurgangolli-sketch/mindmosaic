export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderResponse {
  content: string;
  isSimulated: boolean;
  modelUsed: string;
  safetyAlert?: 'crisis' | 'medical';
  error?: string;
}

export interface AIProvider {
  name: string;
  generateResponse(messages: ChatMessage[]): Promise<AIProviderResponse>;
}

