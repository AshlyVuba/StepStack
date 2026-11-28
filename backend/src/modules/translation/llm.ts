import Anthropic from "@anthropic-ai/sdk";
import { LANGUAGES, type LangCode } from "./prompt.js";

/**
 * Build-time translation provider interface.
 * StepStack does NOT run live local CPU/GPU LLM inference at runtime in production;
 * this interface is used by `scripts/build-lesson-packs.ts` (and unit tests) to compile
 * syntax-verified static 11-language lesson packs ahead of time.
 */
export interface Llm {
  complete(system: string, user: string): Promise<string>;
}

/** Optional build-time Anthropic client used only when regenerating lesson packs with `--live`. */
export class AnthropicLlm implements Llm {
  private client: Anthropic;
  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  }
  async complete(system: string, user: string): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    });
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  }
}

/** Curated localized lead-ins used by the deterministic offline/CI build fallback. */
const PACK_LABELS: Record<LangCode, { lesson: string; hint: string }> = {
  en: { lesson: "", hint: "" },
  zu: { lesson: "[isiZulu] ", hint: "Icebiso: " },
  xh: { lesson: "[isiXhosa] ", hint: "Ingcebiso: " },
  af: { lesson: "[Afrikaans] ", hint: "Wenk: " },
  nso: { lesson: "[Sepedi] ", hint: "Keletšo: " },
  tn: { lesson: "[Setswana] ", hint: "Kgakololo: " },
  st: { lesson: "[Sesotho] ", hint: "Keletso: " },
  ts: { lesson: "[Xitsonga] ", hint: "Xitsundzuxo: " },
  ss: { lesson: "[siSwati] ", hint: "Sicebiso: " },
  ve: { lesson: "[Tshivenda] ", hint: "Tsivhudzo: " },
  nr: { lesson: "[isiNdebele] ", hint: "Isiyeleliso: " },
};

/**
 * Deterministic offline/CI translator used by `build-lesson-packs.ts` when no external API key is
 * configured. Preserves every `⟦n⟧` syntax-lock placeholder byte-for-byte.
 */
export class MockBuildLlm implements Llm {
  constructor(private lang: LangCode) {}
  async complete(_system: string, user: string): Promise<string> {
    const inner = user.replace(/^<learner_text>\n?/, "").replace(/\n?<\/learner_text>$/, "").trim();
    if (this.lang === "en") return inner;
    const prefix = PACK_LABELS[this.lang]?.lesson ?? `[${LANGUAGES[this.lang]}] `;
    return `${prefix}${inner}`;
  }
}
