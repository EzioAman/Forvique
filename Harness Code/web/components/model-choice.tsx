"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ModelSelector } from "@/components/model-selector.aui";
import { ClaudeLogo, GeminiLogo, OpenAILogo } from "@/components/logos";
import type { ModelOption } from "@/utils/model-selection";

/* assistant-ui's runtime ModelSelector, in the composer, listing OpenRouter's live catalog (public, no key).
   Ids use the agent's "provider:model" form (agent/src/agent/graph.py, make_model).
   Anthropic, OpenAI and Gemini list their models only with a key, which lives in the agent: they need an
   agent "list models" endpoint before they can appear here (see CLAUDE.md). */
export const DEFAULT_MODEL = "openrouter:openrouter/auto";
const FALLBACK: ModelOption[] = [{ id: DEFAULT_MODEL, name: "Auto Router" }];

type OpenRouterModel = {
  id: string;
  name: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
};

const LOGOS: Record<string, typeof ClaudeLogo> = {
  anthropic: ClaudeLogo,
  openai: OpenAILogo,
  google: GeminiLogo,
};
const perMillion = (perToken?: string) => Number(perToken) * 1_000_000;
const money = (n: number) => `$${n < 1 ? +n.toFixed(2) : +n.toFixed(1)}`;

/* "Anthropic · 1M · $2 / $10 per M": provider, context window, input / output price per million tokens.
   Prices come live from OpenRouter on every load; "price varies" is OpenRouter's -1 (routers). */
function describe(m: OpenRouterModel, provider: string) {
  const n = m.context_length;
  const size = n
    ? n >= 1_000_000
      ? `${+(n / 1_000_000).toFixed(1)}M`
      : `${Math.round(n / 1000)}K`
    : undefined;
  const input = perMillion(m.pricing?.prompt);
  const output = perMillion(m.pricing?.completion);
  const price =
    !Number.isFinite(input) || input < 0
      ? "price varies"
      : input === 0 && output === 0
        ? "free"
        : `${money(input)} / ${money(output)} per M`;
  return [provider, size, price].filter(Boolean).join(" · ");
}

/* The agent needs tool calling, so only tool-capable models are listed. */
function useOpenRouterModels() {
  const [models, setModels] = useState<ModelOption[]>(FALLBACK);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("https://openrouter.ai/api/v1/models", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ data }: { data: OpenRouterModel[] }) => {
        const usable = data.filter((m) => m.supported_parameters?.includes("tools"));
        if (!usable.length) return;
        setModels(
          usable.map((m) => {
            const Logo = LOGOS[m.id.split("/")[0]];
            // "Anthropic: Claude Sonnet 5.5" -> provider "Anthropic", name "Claude Sonnet 5.5"
            const cut = m.name.indexOf(": ");
            const provider = cut > 0 ? m.name.slice(0, cut) : m.id.split("/")[0];
            return {
              id: `openrouter:${m.id}`,
              name: cut > 0 ? m.name.slice(cut + 2) : m.name,
              description: describe(m, provider),
              keywords: [m.id, m.name],
              // every row gets the icon slot so names line up whether or not a logo exists
              icon: Logo ? (
                <Logo className="size-4" />
              ) : (
                <span className="inline-block size-4" aria-hidden />
              ),
            };
          }),
        );
      })
      .catch(() => {}); // offline or blocked: keep the default model only
    return () => ctrl.abort();
  }, []);
  return models;
}

/* The choice lives above the thread: the composer remounts when a new chat docks, which would reset an
   uncontrolled selector. MyAssistant provides it and reads it for each run. */
export const ModelChoice = createContext<{ model: string; setModel: (id: string) => void }>({
  model: DEFAULT_MODEL,
  setModel: () => {},
});

export const ComposerModel = () => {
  const { model, setModel } = useContext(ModelChoice);
  const models = useOpenRouterModels();
  return (
    <ModelSelector models={models} value={model} onValueChange={setModel} size="sm" searchable />
  );
};
