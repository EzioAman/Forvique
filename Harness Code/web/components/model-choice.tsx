"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorSearch,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
} from "@/components/model-selector.aui";
import { ClaudeLogo, GeminiLogo, OpenAILogo } from "@/components/logos";
import type { ModelOption } from "@/utils/model-selection";
import { cn } from "@/lib/utils";
import { ReasoningEffort } from "@/components/reasoning-effort";

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

type GroupedModel = ModelOption & { provider: string };

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

const ALL_FILTER = "All";
// OpenRouter id prefixes shown as filter chips, in this order; every other provider is reached through search
const PINNED = ["openrouter", "anthropic", "openai", "google", "deepseek", "mistralai", "qwen"];

/* The agent needs tool calling, so only tool-capable models are listed. */
function useOpenRouterModels() {
  const [models, setModels] = useState<GroupedModel[]>([
    { ...FALLBACK[0], provider: "OpenRouter" },
  ]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("https://openrouter.ai/api/v1/models", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ data }: { data: OpenRouterModel[] }) => {
        const usable = data.filter((m) => m.supported_parameters?.includes("tools"));
        if (!usable.length) return;
        // one display name per id prefix, so "qwen/..." models without a "Qwen: " name still group under "Qwen"
        const display: Record<string, string> = { openrouter: "OpenRouter" };
        for (const m of usable) {
          const cut = m.name.indexOf(": ");
          if (cut > 0) display[m.id.split("/")[0]] ??= m.name.slice(0, cut);
        }
        setModels(
          usable.map((m) => {
            const slug = m.id.split("/")[0];
            const Logo = LOGOS[slug];
            // "Anthropic: Claude Sonnet 5.5" -> provider "Anthropic", name "Claude Sonnet 5.5"
            const cut = m.name.indexOf(": ");
            const provider = display[slug] ?? slug;
            return {
              id: `openrouter:${m.id}`,
              name: cut > 0 ? m.name.slice(cut + 2) : m.name,
              description: describe(m, provider),
              keywords: [m.id, m.name, provider],
              // every row gets the icon slot so names line up whether or not a logo exists
              icon: Logo ? (
                <Logo className="size-4" />
              ) : (
                <span className="inline-block size-4" aria-hidden />
              ),
              provider,
            };
          }),
        );
      })
      .catch(() => {}); // offline or blocked: keep the default model only
    return () => ctrl.abort();
  }, []);
  return models;
}

function useProviderGroups(models: GroupedModel[]) {
  return useMemo(() => {
    const providers = [...new Set(models.map((m) => m.provider))];
    const groups: Record<string, GroupedModel[]> = {};
    for (const provider of providers) {
      groups[provider] = models.filter((m) => m.provider === provider);
    }
    return { providers, groups };
  }, [models]);
}

/* The choice lives above the thread: the composer remounts when a new chat docks, which would reset an
   uncontrolled selector. MyAssistant provides it and reads it for each run. */
/* Reasoning effort, sent as the run's `effort` (OpenRouter `reasoning.effort`). OpenRouter turns effort into a share
   of max_tokens; the budgets assume the agent's default HARNESS_MAX_TOKENS of 4096. "" sends nothing (model default). */
export const EFFORT_LEVELS = [
  { key: "", label: "Auto", budget: 4096 },
  { key: "low", label: "Low", budget: 819 },
  { key: "medium", label: "Medium", budget: 2048 },
  { key: "high", label: "High", budget: 3277 },
];

export const ModelChoice = createContext<{
  model: string;
  setModel: (id: string) => void;
  effort: string;
  setEffort: (key: string) => void;
  /** Reasoning tokens the last reply used. */
  spent: number;
}>({ model: DEFAULT_MODEL, setModel: () => {}, effort: "", setEffort: () => {}, spent: 0 });

export const ComposerModel = () => {
  const { model, setModel, effort, setEffort, spent } = useContext(ModelChoice);
  const models = useOpenRouterModels();
  const { providers, groups } = useProviderGroups(models);
  const [filter, setFilter] = useState(ALL_FILTER);

  const visibleProviders = filter === ALL_FILTER ? providers : [filter];
  const chips = [
    ...new Set(
      PINNED.map((slug) => models.find((m) => m.id.startsWith(`openrouter:${slug}/`))?.provider),
    ),
  ].filter((p): p is string => !!p);

  return (
    <ModelSelectorRoot
      models={models}
      value={model}
      onValueChange={setModel}
    >
      <ModelSelectorTrigger variant="ghost" size="sm" />
      <ModelSelectorContent searchable className="w-80">
        <ModelSelectorSearch />
        <div
          data-slot="model-selector-filters"
          className="flex flex-wrap gap-1.5 border-b px-3 py-2"
        >
          {chips.map((provider) => (
            <button
              key={provider}
              type="button"
              aria-pressed={filter === provider}
              // clicking the active chip clears the filter
              onClick={() => setFilter(filter === provider ? ALL_FILTER : provider)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                filter === provider
                  ? "bg-accent text-accent-foreground border-transparent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {provider}
            </button>
          ))}
        </div>
        <ModelSelectorList>
          <ModelSelectorEmpty />
          {visibleProviders.map((provider) => (
            <ModelSelectorGroup key={provider} heading={provider}>
              {groups[provider].map((m) => (
                <ModelSelectorItem key={m.id} model={m} />
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
        <div className="border-t p-3">
          <ReasoningEffort levels={EFFORT_LEVELS} selectedKey={effort} spent={spent} onSelect={setEffort} />
        </div>
      </ModelSelectorContent>
    </ModelSelectorRoot>
  );
};
