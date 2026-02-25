import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { provider } from "../db/index.js";

export type ResolvedProvider = {
  model: LanguageModel;
  providerId: string;
  modelId: string;
};

export type ResolveError = {
  error: string;
};

/**
 * Resolves a provider+model by looking up the API key from DB
 * and constructing the correct @ai-sdk/* provider instance.
 */
export async function resolveProvider(
  providerId: string,
  modelId: string,
): Promise<ResolvedProvider | ResolveError> {
  const providerRow = await provider.get(providerId);

  if (!providerRow) {
    return { error: `Provider '${providerId}' not configured. Go to Settings.` };
  }

  if (!providerRow.apiKey) {
    return { error: `API key not configured for ${providerId}. Go to Settings.` };
  }

  const { apiKey } = providerRow;

  let model: LanguageModel;

  switch (providerId) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      model = anthropic(modelId);
      break;
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      model = openai(modelId);
      break;
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      model = google(modelId);
      break;
    }
    default:
      return { error: `Unsupported provider: ${providerId}` };
  }

  return { model, providerId, modelId };
}

export function isResolveError(result: ResolvedProvider | ResolveError): result is ResolveError {
  return "error" in result;
}
