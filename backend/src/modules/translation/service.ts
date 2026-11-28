import { createHash } from "node:crypto";
import type { Cache } from "../../lib/cache.js";
import type { Llm } from "./llm.js";
import type { LessonPack, LessonPackStore, PackManifest } from "./packs.js";
import { LANGUAGES, PROMPT_VERSION, systemPrompt, userMessage, type LangCode } from "./prompt.js";
import { protect, restore } from "./protect.js";
import { sanitize, type Kind } from "./sanitize.js";

export class IntegrityError extends Error {}
export class LiveInferenceDisabledError extends Error {}

const LESSON_TTL = 60 * 60 * 24 * 30; // static curriculum text: 30 days

export interface TranslateResult {
  translation: string;
  cached: boolean;
  language: string;
  source: "pack" | "cache" | "build-llm";
  packVersion?: string;
}

export interface TranslationServiceOptions {
  llm?: Llm;
  cache?: Cache;
  model?: string;
}

/**
 * Serves pre-compiled, syntax-verified 11-language static lesson packs at runtime.
 * Live local CPU/GPU LLM inference is disabled in production; an optional `llm` may still be
 * injected for offline curriculum compilation scripts and automated tests.
 */
export class TranslationService {
  private inflight = new Map<string, Promise<string>>();
  private llm?: Llm;
  private cache?: Cache;
  private model: string;

  constructor(private packs: LessonPackStore, opts: TranslationServiceOptions = {}) {
    this.llm = opts.llm;
    this.cache = opts.cache;
    this.model = opts.model ?? "static-pack";
  }

  getManifest(): PackManifest | null {
    return this.packs.getManifest();
  }

  getPack(lang: LangCode): LessonPack | null {
    return this.packs.getPack(lang);
  }

  async translate(rawText: string, lang: LangCode, kind: Kind): Promise<TranslateResult> {
    const text = sanitize(rawText, kind);

    // 1. Pre-compiled static lesson packs (zero live LLM inference, instant, 11 SA languages)
    if (lang === "en") {
      return {
        translation: text,
        cached: true,
        language: LANGUAGES.en,
        source: "pack",
        packVersion: this.packs.getPack("en")?.version,
      };
    }

    const packHit = this.packs.lookupText(text, lang);
    if (packHit) {
      return {
        translation: packHit.translation,
        cached: true,
        language: LANGUAGES[lang],
        source: "pack",
        packVersion: packHit.packVersion,
      };
    }

    // 2. Production runtime runs without a live LLM inference server.
    if (!this.llm) {
      throw new LiveInferenceDisabledError(
        "Live LLM inference is disabled at runtime; fetch pre-translated bundles from /v1/lesson-packs/:lang",
      );
    }

    const key = "tr:" + createHash("sha256").update(`${PROMPT_VERSION}|${this.model}|${lang}|${text}`).digest("hex");

    // Only static lesson text is cached. Free-form learner text is never stored (privacy).
    if (kind === "lesson" && this.cache) {
      const hit = await this.cache.get(key);
      if (hit) return { translation: hit, cached: true, language: LANGUAGES[lang], source: "cache" };

      // single-flight: concurrent identical requests share ONE llm call
      let p = this.inflight.get(key);
      if (!p) {
        p = this.callLlm(text, lang)
          .then(async (t) => { await this.cache!.set(key, t, LESSON_TTL); return t; })
          .finally(() => this.inflight.delete(key));
        this.inflight.set(key, p);
      }
      return { translation: await p, cached: false, language: LANGUAGES[lang], source: "build-llm" };
    }
    return { translation: await this.callLlm(text, lang), cached: false, language: LANGUAGES[lang], source: "build-llm" };
  }

  private async callLlm(text: string, lang: LangCode): Promise<string> {
    const { text: masked, slots } = protect(text);
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await this.llm!.complete(systemPrompt(lang), userMessage(masked));
      const r = restore(out, slots);
      if (r.intact && r.text.trim()) return r.text.trim();
    }
    throw new IntegrityError("translation did not preserve code/formula tokens");
  }
}
