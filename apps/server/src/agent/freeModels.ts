/**
 * Free models from OpenCode Zen.
 * Config fetched at runtime from GitHub via modelsConfig.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getModelsConfig } from "./modelsConfig.js";

export type { FreeModelEntry as FreeModel } from "./modelsConfig.js";

/** Returns the list of available free models. */
export async function getFreeModels() {
  const config = await getModelsConfig();
  return config.free.models;
}

/** Create the OpenCode Zen provider (OpenAI-compatible with public key). */
export async function createZenProvider() {
  const config = await getModelsConfig();
  return createOpenAICompatible({
    name: config.free.provider,
    baseURL: config.free.baseURL,
    apiKey: "public",
  });
}
