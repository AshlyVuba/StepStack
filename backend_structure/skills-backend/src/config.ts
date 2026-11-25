import { z } from "zod";

/**
 * All secrets come from the environment. There are deliberately NO default values for
 * secrets: a missing or weak key aborts startup instead of silently falling back.
 */
const schema = z.object({
  PORTFOLIO_SIGNING_KEY: z.string().min(32, "PORTFOLIO_SIGNING_KEY must be >= 32 chars"),
  PORTFOLIO_SIGNING_KEY_PREVIOUS: z.string().min(32).optional().or(z.literal("").transform(() => undefined)),
  INTERNAL_API_KEY: z.string().min(24, "INTERNAL_API_KEY must be >= 24 chars"),
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  TRANSLATION_MODEL: z.string().default("claude-sonnet-5-5"),
  PORT: z.coerce.number().default(3000),
  GRADER_TIMEOUT_MS: z.coerce.number().int().min(200).max(1900).default(1500),
  GRADER_POOL_SIZE: z.coerce.number().int().min(1).max(8).default(2),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${msg}`);
  }
  return parsed.data;
}
