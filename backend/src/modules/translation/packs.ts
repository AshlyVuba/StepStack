import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANGUAGES, SUPPORTED_LANG_CODES, isLangCode, type LangCode } from "./prompt.js";
import { verifySyntaxLock } from "./protect.js";

export interface LocalizedLesson {
  id: string;
  pathway: string;
  title: string;
  body: string;
  hint: string;
  syntaxLocked: boolean;
  translationStatus: string;
}

export interface LessonPack {
  version: string;
  language: LangCode;
  languageName: string;
  generatedAt: string;
  contentHash: string;
  lessons: Record<string, LocalizedLesson>;
}

export interface PackManifestEntry {
  name: string;
  file: string;
  lessonCount: number;
  contentHash: string;
}

export interface PackManifest {
  version: string;
  generatedAt: string;
  languages: Record<LangCode, PackManifestEntry>;
}

export interface PackLookupHit {
  translation: string;
  packVersion: string;
  lessonId: string;
}

function normKey(s: string): string {
  return s.replace(/\r\n?/g, "\n").trim();
}

/**
 * Loads pre-compiled, versioned 11-language static JSON lesson packs from disk.
 * No live local CPU/GPU LLM inference runs at request time.
 */
export class LessonPackStore {
  private manifest: PackManifest | null = null;
  private packs = new Map<LangCode, LessonPack>();
  /** Map from normalised English source text -> { lessonId, field } for fast static lookup */
  private englishIndex = new Map<string, { lessonId: string; field: "title" | "body" | "hint" }>();

  constructor(private dir: string = resolve(process.cwd(), "lesson-packs")) {
    this.reload();
  }

  reload(): void {
    this.manifest = null;
    this.packs.clear();
    this.englishIndex.clear();

    const manifestPath = join(this.dir, "manifest.json");
    if (!existsSync(manifestPath)) return;
    this.manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackManifest;

    for (const lang of SUPPORTED_LANG_CODES) {
      const packPath = join(this.dir, `${lang}.json`);
      if (!existsSync(packPath)) continue;
      const pack = JSON.parse(readFileSync(packPath, "utf8")) as LessonPack;
      this.packs.set(lang, pack);
    }

    const enPack = this.packs.get("en");
    if (enPack) {
      for (const [lessonId, lesson] of Object.entries(enPack.lessons)) {
        for (const field of ["title", "body", "hint"] as const) {
          const val = normKey(lesson[field]);
          if (val) this.englishIndex.set(val, { lessonId, field });
        }
      }
    }
  }

  getManifest(): PackManifest | null {
    return this.manifest;
  }

  getPack(lang: string): LessonPack | null {
    if (!isLangCode(lang)) return null;
    return this.packs.get(lang) ?? null;
  }

  availableLanguages(): LangCode[] {
    return [...this.packs.keys()];
  }

  lookupText(sourceText: string, lang: LangCode): PackLookupHit | null {
    const pack = this.packs.get(lang);
    if (!pack) return null;
    const hit = this.englishIndex.get(normKey(sourceText));
    if (!hit) return null;
    const localized = pack.lessons[hit.lessonId];
    if (!localized) return null;
    const translation = localized[hit.field];
    if (!translation) return null;
    return { translation, packVersion: pack.version, lessonId: hit.lessonId };
  }

  /** Verifies every loaded pack covers all English master lessons and passes syntax-lock checks. */
  verifyAllPacks(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    const enPack = this.packs.get("en");
    if (!enPack) return { ok: false, errors: ["Missing English master pack (en.json)"] };

    for (const lang of SUPPORTED_LANG_CODES) {
      const pack = this.packs.get(lang);
      if (!pack) {
        errors.push(`Missing lesson pack for language: ${lang} (${LANGUAGES[lang]})`);
        continue;
      }
      for (const [id, master] of Object.entries(enPack.lessons)) {
        const entry = pack.lessons[id];
        if (!entry) {
          errors.push(`[${lang}] Missing lesson "${id}"`);
          continue;
        }
        for (const field of ["title", "body", "hint"] as const) {
          const check = verifySyntaxLock(master[field], entry[field]);
          if (!check.ok) {
            errors.push(`[${lang}] Syntax-lock failure in ${id}.${field}: missing ${check.missing.join(", ")}`);
          }
        }
      }
    }
    return { ok: errors.length === 0, errors };
  }
}
