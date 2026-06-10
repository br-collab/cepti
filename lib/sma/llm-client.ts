import Anthropic from "@anthropic-ai/sdk";

const SMA_MODEL = "claude-opus-4-8";

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
