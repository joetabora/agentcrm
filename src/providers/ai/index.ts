export type AIMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type AICompletionRequest = {
  messages: AIMessage[]
  task?: "fast" | "advanced"
}

export type AICompletionResult = {
  content: string
  provider: string
  model: string
}

export interface AIProvider {
  readonly name: string
  complete(request: AICompletionRequest): Promise<AICompletionResult>
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock"

  async complete(_request: AICompletionRequest): Promise<AICompletionResult> {
    return {
      content: JSON.stringify({
        answerMarkdown:
          "No live AI model is configured. Set OPENAI_API_KEY to enable grounded answers, or rely on CRM fields directly.",
        claims: [
          {
            text: "AI provider is mock — no model inference was run.",
            kind: "FACT",
          },
        ],
        refused: true,
        refuseReason: "Mock AI provider (OPENAI_API_KEY not set)",
      }),
      provider: this.name,
      model: "mock-none",
    }
  }
}

/** OpenAI Chat Completions — https://platform.openai.com/docs/api-reference/chat/create */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai"

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI error ${res.status}: ${text}`)
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      model?: string
    }
    const content = data.choices?.[0]?.message?.content ?? ""
    return {
      content,
      provider: this.name,
      model: data.model ?? this.model,
    }
  }
}

export function getAIProvider(): AIProvider {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (key) {
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"
    return new OpenAIProvider(key, model)
  }
  return new MockAIProvider()
}
