import Anthropic from "@anthropic-ai/sdk";
import { logCaptionUsage } from "./ai-usage";

const SMA_MODEL = "claude-opus-4-8";

export interface GenerateDetailedResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export const createLLMClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  return new Anthropic({
    apiKey,
  });
};

export const getSMAModel = () => SMA_MODEL;

export const generateDetailed = async (opts: {
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<GenerateDetailedResult> => {
  const client = createLLMClient();
  const response = await client.messages.create({
    model: SMA_MODEL,
    max_tokens: opts.maxTokens || 1024,
    system: opts.system,
    messages: [
      {
        role: "user",
        content: opts.userMessage,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }
      return "";
    })
    .join("");

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Best-effort FinOps logging. Fire-and-forget: never blocks or breaks
  // generation if the insert fails (logCaptionUsage never throws).
  void logCaptionUsage({ model: SMA_MODEL, inputTokens, outputTokens });

  return {
    text,
    inputTokens,
    outputTokens,
    model: SMA_MODEL,
  };
};
