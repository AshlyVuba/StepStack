import { createHash } from "node:crypto";
import type { Cache } from "../../lib/cache.js";
import type { Llm } from "./llm.js";
import { LANGUAGES, PROMPT_VERSION, systemPrompt, userMessage, type LangCode } from "./prompt.js";
import { protect, restore } from "./protect.js";
import { sanitize, type Kind } from "./sanitize.js";

export class IntegrityError extends Error {}

const LESSON_TTL = 60 * 60 * 24 * 30; // static curriculum text: 30 days

export interface TranslateResult { translation: string; cached: boolean; language: string }

export class TranslationService {
  private inflight = new Map<string, Promise<string>>();
  constructor(private llm: Llm, private cache: Cache, private model: string) {}

  async translate(rawText: string, lang: LangCode, kind: Kind): Promise<TranslateResult> {
    const text = sanitize(rawText, kind);
    const key = "tr:" + createHash("sha256").update(`${PROMPT_VERSION}|${this.model}|${lang}|${text}`).digest("hex");

    // Only static lesson text is cached. Free-form learner text is never stored (privacy).
    if (kind === "lesson") {
      const hit = await this.cache.get(key);
      if (hit) return { translation: hit, cached: true, language: LANGUAGES[lang] };

      // single-flight: concurrent identical requests share ONE llm call
      let p = this.inflight.get(key);
      if (!p) {
        p = this.callLlm(text, lang)
          .then(async (t) => { await this.cache.set(key, t, LESSON_TTL); return t; })
          .finally(() => this.inflight.delete(key));
        this.inflight.set(key, p);
      }
      return { translation: await p, cached: false, language: LANGUAGES[lang] };
    }
    return { translation: await this.callLlm(text, lang), cached: false, language: LANGUAGES[lang] };
  }

  private async callLlm(text: string, lang: LangCode): Promise<string> {
    const { text: masked, slots } = protect(text);
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await this.llm.complete(systemPrompt(lang), userMessage(masked));
      const r = restore(out, slots);
      if (r.intact && r.text.trim()) return r.text.trim();
    }
    throw new IntegrityError("translation did not preserve code/formula tokens");
  }
}
