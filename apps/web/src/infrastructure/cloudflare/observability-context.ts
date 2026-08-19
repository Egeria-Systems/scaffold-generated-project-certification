import { getCloudflareContext } from "@opennextjs/cloudflare";

type ObservabilityEnvironment = Readonly<{
  BETTER_STACK_INGESTING_HOST?: unknown;
  BETTER_STACK_SOURCE_TOKEN?: unknown;
  CF_VERSION_METADATA?: Readonly<{ id?: unknown }>;
}>;

export type ObservabilityRuntimeContext = Readonly<{
  ingestingHost: string;
  sourceToken: string;
  releaseId?: string;
  schedule: (task: Promise<unknown>) => void;
}>;

export async function readObservabilityRuntimeContext(): Promise<ObservabilityRuntimeContext> {
  const cloudflareContext = await getCloudflareContext({ async: true });
  const environment = cloudflareContext.env as CloudflareEnv &
    ObservabilityEnvironment;
  const ingestingHost = environment.BETTER_STACK_INGESTING_HOST;
  const sourceToken = environment.BETTER_STACK_SOURCE_TOKEN;
  const releaseId = environment.CF_VERSION_METADATA?.id;

  return Object.freeze({
    ingestingHost: typeof ingestingHost === "string" ? ingestingHost : "",
    sourceToken: typeof sourceToken === "string" ? sourceToken : "",
    ...(typeof releaseId === "string" ? { releaseId } : {}),
    schedule: (task) => cloudflareContext.ctx.waitUntil(task),
  });
}
