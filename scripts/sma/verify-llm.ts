import fs from "fs";
import path from "path";
import { createLLMClient, getSMAModel } from "../../lib/sma/llm-client";

const loadEnvLocal = () => {
  const envPath = path.join(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`);
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");

  for (const line of lines) {
    if (line.startsWith("ANTHROPIC_API_KEY=")) {
      const key = line.substring("ANTHROPIC_API_KEY=".length).trim();
      process.env.ANTHROPIC_API_KEY = key;
      return key;
    }
  }

  throw new Error("ANTHROPIC_API_KEY not found in .env.local");
};

const main = async () => {
  console.log("=== LLM Connectivity Verification ===\n");

  try {
    const apiKey = loadEnvLocal();
    console.log("✓ ANTHROPIC_API_KEY loaded from .env.local");

    if (!apiKey || apiKey === "") {
      throw new Error("ANTHROPIC_API_KEY is empty");
    }

    console.log("✓ Environment configured\n");

    // Create client and make live API call
    console.log("Making live API call...");
    const client = createLLMClient();
    const model = getSMAModel();

    const response = await client.messages.create({
      model,
      max_tokens: 100,
      system: "You are a connectivity test.",
      messages: [
        {
          role: "user",
          content: "Reply with the single word OK",
        },
      ],
    });

    console.log("✓ API call successful\n");

    // Extract and report results
    const responseText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    console.log(`Model: ${model}`);
    console.log(`Response: ${responseText}`);
    console.log(`Input tokens: ${inputTokens}`);
    console.log(`Output tokens: ${outputTokens}`);
    console.log("\n✓ Verification passed!");
  } catch (error) {
    console.error("\n✗ Verification failed:", error);
    process.exit(1);
  }
};

main();
