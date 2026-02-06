/**
 * AI Helper - Anthropic Claude API integration
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call the Claude API with a system prompt and messages
 */
export async function callClaude({
  systemPrompt,
  messages,
  maxTokens = 1024,
}: {
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<{ text: string; error?: string }> {
  if (!ANTHROPIC_API_KEY) {
    return { text: '', error: 'Anthropic API key not configured' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return { text: '', error: `API error: ${response.status}` };
    }

    const data: ClaudeResponse = await response.json();

    if (data.content && data.content.length > 0 && data.content[0].type === 'text') {
      return { text: data.content[0].text };
    }

    return { text: '', error: 'No response content' };
  } catch (error) {
    console.error('Error calling Claude:', error);
    return { text: '', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
