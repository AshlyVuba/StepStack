import { z } from "zod";

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }
  catch { return false; }
};

const isHttpOrigin = (value: string) => {
  try { return isHttpUrl(value) && new URL(value).origin === value; }
  catch { return false; }
};

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
  PUBLIC_BASE_URL: z.string().url().refine(isHttpOrigin, "PUBLIC_BASE_URL must be an HTTP(S) origin without credentials or a path").default("http://localhost:3000"),
  TRANSLATION_MODEL: z.string().default("claude-sonnet-5-5"),
  PORT: z.coerce.number().default(3000),
  GRADER_TIMEOUT_MS: z.coerce.number().int().min(200).max(1900).default(1500),
  /** number of reverse proxies in front of the API (0 = none: never trust X-Forwarded-For) */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  CORS_ORIGIN: z.string()
    .default("http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080")
    .refine((value) => value.split(",").every((origin) => {
      try {
        const url = new URL(origin.trim());
        return isHttpOrigin(origin.trim()) && url.origin === origin.trim();
      } catch { return false; }
    }), "CORS_ORIGIN must list explicit credential-free HTTP(S) origins without paths or wildcards"),
  FRONTEND_BASE_URL: z.string().url().refine(isHttpUrl, "FRONTEND_BASE_URL must use HTTP or HTTPS").default("http://localhost:5173"),
  /** public portfolio links stop verifying this many days after they were issued */
  PORTFOLIO_TTL_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  /** kill switch for the Python grader: set to "false" to return 503 without touching the sandbox */
  GRADING_PYTHON_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
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