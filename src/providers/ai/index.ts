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

  async complete(): Promise<AICompletionResult> {
    return {
      content: "",
      provider: this.name,
      model: "mock-none",
    }
  }
}

export function getAIProvider(): AIProvider {
  return new MockAIProvider()
}
