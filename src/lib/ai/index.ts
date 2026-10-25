export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatOptions = {
  temperature?: number;
  maxTokens?: number;
};

export interface AiProvider {
  chat(messages: AiMessage[], options?: AiChatOptions): Promise<string>;
}

class UnconfiguredAiProvider implements AiProvider {
  constructor(private readonly provider: string | undefined) {}

  async chat(): Promise<string> {
    const configuredProvider = this.provider || "nenhum";
    throw new Error(
      `IA indisponível: configure um adaptador para AI_PROVIDER="${configuredProvider}" e AI_API_KEY.`,
    );
  }
}

export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;
  if (!provider || !apiKey) return new UnconfiguredAiProvider(provider);
  return new UnconfiguredAiProvider(provider);
}
