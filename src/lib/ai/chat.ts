
type MensagemChat = { role: "system" | "user" | "assistant"; content: string };

export function iaConfigurada() {
  return Boolean(process.env.AI_API_KEY);
}

/**
 * Chama um endpoint de chat compatível com a API da OpenAI.
 * Configurável por env: AI_BASE_URL (padrão OpenRouter), AI_API_KEY, AI_MODEL.
 * Retorna null quando a IA não está configurada ou a chamada falha.
 */
export async function chatCompletion(
  systemPrompt: string,
  messages: MensagemChat[],
  maxTokens = 900,
): Promise<string | null> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        // OpenRouter: modelos de raciocínio devolvem só a resposta final
        reasoning: { exclude: true },
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const payload = await response.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
