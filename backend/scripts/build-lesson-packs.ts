import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AnthropicLlm, MockBuildLlm, type Llm } from "../src/modules/translation/llm.js";
import { LANGUAGES, PROMPT_VERSION, SUPPORTED_LANG_CODES, systemPrompt, userMessage, type LangCode } from "../src/modules/translation/prompt.js";
import { protect, restore, verifySyntaxLock } from "../src/modules/translation/protect.js";
import { sanitize } from "../src/modules/translation/sanitize.js";
import type { LessonPack, LocalizedLesson, PackManifest } from "../src/modules/translation/packs.js";

interface MasterTextBlock {
  title: string;
  body: string;
  hint: string;
}

interface MasterExercise {
  id: string;
  translationStatus?: Record<string, string>;
  text: Record<string, MasterTextBlock>;
}

type MasterExercisesFile = Record<string, MasterExercise[]>;

export interface BuildPacksOptions {
  inputPath: string;
  outputDirs: string[];
  version?: string;
  live?: boolean;
  apiKey?: string;
  model?: string;
}

export interface BuildPacksSummary {
  version: string;
  languages: number;
  lessonsPerPack: number;
  mode: "live-anthropic" | "deterministic-fallback";
  manifest: PackManifest;
}

async function translateWithSyntaxLock(
  source: string,
  lang: LangCode,
  llm: Llm,
): Promise<string> {
  const clean = sanitize(source, "lesson");
  if (lang === "en") return clean;

  const { text: masked, slots } = protect(clean);
  for (let attempt = 0; attempt < 2; attempt++) {
    const rawOut = await llm.complete(systemPrompt(lang), userMessage(masked));
    const restored = restore(rawOut, slots);
    if (restored.intact && restored.text.trim()) {
      const check = verifySyntaxLock(clean, restored.text.trim());
      if (check.ok) return restored.text.trim();
    }
  }
  throw new Error(`Syntax-lock integrity check failed while building [${lang}] for: ${clean.slice(0, 60)}`);
}

export async function buildLessonPacks(opts: BuildPacksOptions): Promise<BuildPacksSummary> {
  const raw = JSON.parse(readFileSync(opts.inputPath, "utf8")) as MasterExercisesFile;
  const useLive = Boolean(opts.live && opts.apiKey);
  const model = opts.model ?? "claude-sonnet-5-5";
  const version = opts.version ?? `${PROMPT_VERSION}.1.0`;
  const generatedAt = "2026-11-28T00:00:00.000Z";

  const packs = new Map<LangCode, LessonPack>();
  const manifestLanguages = {} as PackManifest["languages"];

  for (const lang of SUPPORTED_LANG_CODES) {
    const llm: Llm = useLive ? new AnthropicLlm(opts.apiKey!, model) : new MockBuildLlm(lang);
    const lessons: Record<string, LocalizedLesson> = {};

    for (const [pathway, items] of Object.entries(raw)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const en = item.text?.en;
        if (!en) throw new Error(`Exercise "${item.id}" is missing English master text`);

        const curated = item.text?.[lang];
        let title: string;
        let body: string;
        let hint: string;
        let status: string;

        if (curated) {
          title = sanitize(curated.title, "lesson");
          body = sanitize(curated.body, "lesson");
          hint = sanitize(curated.hint, "lesson");
          status = item.translationStatus?.[lang] ?? (lang === "en" ? "master" : "curated");

          for (const [field, src, dst] of [
            ["title", en.title, title],
            ["body", en.body, body],
            ["hint", en.hint, hint],
          ] as const) {
            const check = verifySyntaxLock(src, dst);
            if (!check.ok) {
              throw new Error(
                `Curated translation syntax-lock failed for ${item.id}.${field} [${lang}]: missing ${check.missing.join(", ")}`,
              );
            }
          }
        } else {
          title = await translateWithSyntaxLock(en.title, lang, llm);
          body = await translateWithSyntaxLock(en.body, lang, llm);
          hint = await translateWithSyntaxLock(en.hint, lang, llm);
          status = useLive ? "ai-compiled-needs-review" : "fallback-compiled";
        }

        lessons[item.id] = {
          id: item.id,
          pathway,
          title,
          body,
          hint,
          syntaxLocked: true,
          translationStatus: status,
        };
      }
    }

    const contentHash = createHash("sha256")
      .update(JSON.stringify({ version, language: lang, lessons }))
      .digest("hex")
      .slice(0, 16);

    const pack: LessonPack = {
      version,
      language: lang,
      languageName: LANGUAGES[lang],
      generatedAt,
      contentHash,
      lessons,
    };

    packs.set(lang, pack);
    manifestLanguages[lang] = {
      name: LANGUAGES[lang],
      file: `${lang}.json`,
      lessonCount: Object.keys(lessons).length,
      contentHash,
    };
  }

  const manifest: PackManifest = {
    version,
    generatedAt,
    languages: manifestLanguages,
  };

  for (const dir of opts.outputDirs) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    for (const [lang, pack] of packs.entries()) {
      writeFileSync(resolve(dir, `${lang}.json`), JSON.stringify(pack, null, 2) + "\n", "utf8");
    }
  }

  return {
    version,
    languages: packs.size,
    lessonsPerPack: manifestLanguages.en.lessonCount,
    mode: useLive ? "live-anthropic" : "deterministic-fallback",
    manifest,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..");
  const args = new Set(process.argv.slice(2));
  const live = args.has("--live");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (live && !apiKey) {
    console.warn("Warning: --live specified without ANTHROPIC_API_KEY; falling back to deterministic mode.");
  }

  const summary = await buildLessonPacks({
    inputPath: resolve(repoRoot, "data", "exercises.json"),
    outputDirs: [
      resolve(repoRoot, "backend", "lesson-packs"),
      resolve(repoRoot, "frontend", "packs"),
    ],
    live,
    apiKey,
    model: process.env.TRANSLATION_MODEL ?? "claude-sonnet-5-5",
  });

  console.log(
    `Built ${summary.languages} syntax-verified offline lesson packs (${summary.lessonsPerPack} lessons each, ${summary.version}, mode=${summary.mode}).`,
  );
}
