import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";

export type ManifestModelIdNormalizationProvider = {
  stripPrefixes?: readonly string[];
  aliases?: Record<string, string>;
  prefixWhenBare?: string;
  prefixWhenBareAfterAliasStartsWith?: readonly {
    modelPrefix: string;
    prefix: string;
  }[];
};

export type ManifestModelIdNormalizationPlugin = {
  modelIdNormalization?: {
    providers?: Record<string, ManifestModelIdNormalizationProvider>;
  };
};

// Keep aligned with bundled manifest modelIdNormalization blocks. Model ref
// normalization uses this leaf copy without importing plugin runtime state.
export const DEFAULT_MANIFEST_MODEL_ID_NORMALIZATION_PLUGINS: readonly ManifestModelIdNormalizationPlugin[] =
  [
    {
      modelIdNormalization: {
        providers: {
          anthropic: {
            aliases: {
              "opus-4.8": "claude-opus-4-8",
              opus: "claude-opus-4-8",
              "opus-4.6": "claude-opus-4-6",
              "sonnet-4.6": "claude-sonnet-4-6",
            },
          },
        },
      },
    },
    {
      modelIdNormalization: {
        providers: {
          google: {
            aliases: {
              "gemini-3-pro": "gemini-3.1-pro-preview",
              "gemini-3-pro-preview": "gemini-3.1-pro-preview",
              "gemini-3-flash": "gemini-3-flash-preview",
              "gemini-3.1-pro": "gemini-3.1-pro-preview",
              "gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite",
              "gemini-3.1-flash": "gemini-3-flash-preview",
              "gemini-3.1-flash-preview": "gemini-3-flash-preview",
            },
          },
          "google-gemini-cli": {
            aliases: {
              "gemini-3-pro": "gemini-3.1-pro-preview",
              "gemini-3-pro-preview": "gemini-3.1-pro-preview",
              "gemini-3-flash": "gemini-3-flash-preview",
              "gemini-3.1-pro": "gemini-3.1-pro-preview",
              "gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite",
              "gemini-3.1-flash": "gemini-3-flash-preview",
              "gemini-3.1-flash-preview": "gemini-3-flash-preview",
            },
          },
          "google-vertex": {
            aliases: {
              "gemini-3-pro": "gemini-3.1-pro-preview",
              "gemini-3-pro-preview": "gemini-3.1-pro-preview",
              "gemini-3-flash": "gemini-3-flash-preview",
              "gemini-3.1-pro": "gemini-3.1-pro-preview",
              "gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite",
              "gemini-3.1-flash": "gemini-3-flash-preview",
              "gemini-3.1-flash-preview": "gemini-3-flash-preview",
            },
          },
        },
      },
    },
    {
      modelIdNormalization: {
        providers: {
          huggingface: {
            stripPrefixes: ["huggingface/"],
          },
        },
      },
    },
    {
      modelIdNormalization: {
        providers: {
          nvidia: {
            prefixWhenBare: "nvidia",
          },
        },
      },
    },
    {
      modelIdNormalization: {
        providers: {
          openrouter: {
            prefixWhenBare: "openrouter",
          },
        },
      },
    },
    {
      modelIdNormalization: {
        providers: {
          "vercel-ai-gateway": {
            aliases: {
              "opus-4.6": "claude-opus-4-6",
              "sonnet-4.6": "claude-sonnet-4-6",
            },
            prefixWhenBareAfterAliasStartsWith: [
              {
                modelPrefix: "claude-",
                prefix: "anthropic",
              },
            ],
          },
        },
      },
    },
    {
      modelIdNormalization: {
        providers: {
          xai: {
            aliases: {
              "grok-4.20-experimental-beta-0304-reasoning": "grok-4.20-beta-latest-reasoning",
              "grok-4.20-experimental-beta-0304-non-reasoning":
                "grok-4.20-beta-latest-non-reasoning",
              "grok-4.20-reasoning": "grok-4.20-beta-latest-reasoning",
              "grok-4.20-non-reasoning": "grok-4.20-beta-latest-non-reasoning",
            },
          },
        },
      },
    },
  ] satisfies readonly ManifestModelIdNormalizationPlugin[];

export function collectManifestModelIdNormalizationPolicies(
  plugins: readonly ManifestModelIdNormalizationPlugin[],
): Map<string, ManifestModelIdNormalizationProvider> {
  const policies = new Map<string, ManifestModelIdNormalizationProvider>();
  for (const plugin of plugins) {
    for (const [provider, policy] of Object.entries(plugin.modelIdNormalization?.providers ?? {})) {
      policies.set(normalizeLowercaseStringOrEmpty(provider), policy);
    }
  }
  return policies;
}

function hasProviderPrefix(modelId: string): boolean {
  return modelId.includes("/");
}

function formatPrefixedModelId(prefix: string, modelId: string): string {
  return `${prefix.replace(/\/+$/u, "")}/${modelId.replace(/^\/+/u, "")}`;
}

export function normalizeProviderModelIdWithManifestPolicy(params: {
  policy: ManifestModelIdNormalizationProvider;
  modelId: string;
}): string {
  const policy = params.policy;
  let modelId = params.modelId.trim();
  if (!modelId) {
    return modelId;
  }

  for (const prefix of policy.stripPrefixes ?? []) {
    const normalizedPrefix = normalizeLowercaseStringOrEmpty(prefix);
    if (normalizedPrefix && normalizeLowercaseStringOrEmpty(modelId).startsWith(normalizedPrefix)) {
      modelId = modelId.slice(prefix.length);
      break;
    }
  }

  modelId = policy.aliases?.[normalizeLowercaseStringOrEmpty(modelId)] ?? modelId;

  if (!hasProviderPrefix(modelId)) {
    for (const rule of policy.prefixWhenBareAfterAliasStartsWith ?? []) {
      if (normalizeLowercaseStringOrEmpty(modelId).startsWith(rule.modelPrefix.toLowerCase())) {
        return formatPrefixedModelId(rule.prefix, modelId);
      }
    }
    if (policy.prefixWhenBare) {
      return formatPrefixedModelId(policy.prefixWhenBare, modelId);
    }
  }

  return modelId;
}

export function normalizeProviderModelIdWithManifestPlugins(params: {
  provider: string;
  plugins: readonly ManifestModelIdNormalizationPlugin[];
  modelId: string;
}): string | undefined {
  const providerId = normalizeLowercaseStringOrEmpty(params.provider);
  const policy = collectManifestModelIdNormalizationPolicies(params.plugins).get(providerId);
  return policy
    ? normalizeProviderModelIdWithManifestPolicy({
        policy,
        modelId: params.modelId,
      })
    : undefined;
}
