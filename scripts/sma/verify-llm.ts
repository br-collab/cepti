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
  console.log("Verifying LLM client setup...\n");

  try {
    const apiKey = loadEnvLocal();
    console.log("✓ ANTHROPIC_API_KEY loaded from .env.local");
    console.log(`  Key starts with: ${apiKey.substring(0, 7)}...`);

    if (!apiKey || apiKey === "") {
      throw new Error("ANTHROPIC_API_KEY is empty");
    }

    createLLMClient();
    console.log("✓ LLM client created successfully");

    const model = getSMAModel();
    console.log(`✓ SMA model configured: ${model}`);

    console.log("\n✓ All verifications passed!");
  } catch (error) {
    console.error("✗ Verification failed:", error);
    process.exit(1);
  }
};

main();
