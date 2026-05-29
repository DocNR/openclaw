import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { getCurrentPluginMetadataSnapshot } from "./current-plugin-metadata-snapshot.js";
import {
  collectManifestModelIdNormalizationPolicies,
  type ManifestModelIdNormalizationProvider,
  normalizeProviderModelIdWithManifestPolicy,
} from "./manifest-model-id-normalization-policy.js";
import type { PluginManifestRecord } from "./manifest-registry.js";
import { resolvePluginMetadataSnapshot } from "./plugin-metadata-snapshot.js";
import { getActivePluginRegistryWorkspaceDirFromState } from "./runtime-workspace-state.js";

type ManifestModelIdNormalizationLookupParams = {
  config?: OpenClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  plugins?: readonly Pick<PluginManifestRecord, "modelIdNormalization">[];
};

type ManifestModelIdNormalizationPolicyCache = {
  configFingerprint: string;
  policies: Map<string, ManifestModelIdNormalizationProvider>;
};

let cachedPolicies: ManifestModelIdNormalizationPolicyCache | undefined;

function resolveMetadataSnapshotForPolicies(
  params: ManifestModelIdNormalizationLookupParams = {},
): {
  plugins: readonly Pick<PluginManifestRecord, "modelIdNormalization">[];
  configFingerprint?: string;
  cacheable: boolean;
} {
  const env = params.env ?? process.env;
  const workspaceDir = params.workspaceDir ?? getActivePluginRegistryWorkspaceDirFromState();
  if (params.config === undefined) {
    const currentSnapshot = getCurrentPluginMetadataSnapshot({
      env,
      workspaceDir,
      allowWorkspaceScopedSnapshot: true,
      requireDefaultDiscoveryContext: true,
    });
    if (currentSnapshot) {
      return {
        plugins: currentSnapshot.plugins,
        configFingerprint: currentSnapshot.configFingerprint,
        cacheable: true,
      };
    }
  }
  const snapshot = resolvePluginMetadataSnapshot({
    config: params.config ?? {},
    env,
    workspaceDir,
    allowWorkspaceScopedCurrent: true,
  });
  return {
    plugins: snapshot.plugins,
    configFingerprint: snapshot.configFingerprint,
    cacheable: false,
  };
}

function loadManifestModelIdNormalizationPolicies(
  params: ManifestModelIdNormalizationLookupParams = {},
): Map<string, ManifestModelIdNormalizationProvider> {
  if (params.plugins) {
    return collectManifestModelIdNormalizationPolicies(params.plugins);
  }
  const { plugins, configFingerprint, cacheable } = resolveMetadataSnapshotForPolicies(params);
  if (cacheable && configFingerprint && cachedPolicies?.configFingerprint === configFingerprint) {
    return cachedPolicies.policies;
  }
  const policies = collectManifestModelIdNormalizationPolicies(plugins);
  if (cacheable && configFingerprint) {
    cachedPolicies = { configFingerprint, policies };
  }
  return policies;
}

function resolveManifestModelIdNormalizationPolicy(
  provider: string,
  params: ManifestModelIdNormalizationLookupParams = {},
): ManifestModelIdNormalizationProvider | undefined {
  const providerId = normalizeLowercaseStringOrEmpty(provider);
  return loadManifestModelIdNormalizationPolicies(params).get(providerId);
}

export function normalizeProviderModelIdWithManifest(params: {
  provider: string;
  config?: OpenClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  plugins?: readonly Pick<PluginManifestRecord, "modelIdNormalization">[];
  context: {
    provider: string;
    modelId: string;
  };
}): string | undefined {
  const policy = resolveManifestModelIdNormalizationPolicy(params.provider, params);
  if (!policy) {
    return undefined;
  }
  return normalizeProviderModelIdWithManifestPolicy({
    policy,
    modelId: params.context.modelId,
  });
}
