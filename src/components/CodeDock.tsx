"use client";

import { useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/api";

type CodeDockProps = {
  messages: ChatMessage[];
};

type ExtractedSnippet = {
  id: string;
  language: string;
  filename?: string;
  code: string;
};

const CODE_BLOCK_RE = /```([\w+-]*)\s*(?:filename:\s*([^\s\n]+)|\[(.+?)\])?\s*\n([\s\S]*?)```/g;
const FILE_PRIORITY: Record<string, number> = {
  "setup.gs": 0,
  "code.gs": 1,
  "index.html": 2,
};
const ACCEPTED_LANGUAGES = new Set([
  "",
  "gs",
  "javascript",
  "js",
  "ts",
  "typescript",
  "html",
  "css",
  "json",
]);

export default function CodeDock({ messages }: CodeDockProps) {
  const snippets = useMemo<ExtractedSnippet[]>(() => {
    const items: ExtractedSnippet[] = [];

    messages.forEach((msg, index) => {
      const regex = new RegExp(CODE_BLOCK_RE.source, "g");
      let count = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(msg.content)) !== null) {
        const rawLanguage = match[1]?.trim() ?? "";
        const rawFilename = (match[2] ?? match[3])?.trim();
        const code = match[4] ?? "";

        const normalizedLanguage = rawLanguage.toLowerCase();
        const normalizedFilename = rawFilename?.toLowerCase();
        const isKnownFile = normalizedFilename
          ? normalizedFilename in FILE_PRIORITY
          : false;
        const isAcceptableLanguage = ACCEPTED_LANGUAGES.has(normalizedLanguage);

        if ((!isKnownFile && !isAcceptableLanguage) || !code.trim()) {
          continue;
        }

        items.push({
          id: `${msg.id ?? index}-${count}`,
          language: rawLanguage || "plain",
          filename: rawFilename,
          code,
        });
        count += 1;
      }
    });

    return items.sort((a, b) => {
      const normalize = (value?: string) => value?.toLowerCase() ?? "";
      const aPriority = FILE_PRIORITY[normalize(a.filename)] ?? Number.MAX_SAFE_INTEGER;
      const bPriority = FILE_PRIORITY[normalize(b.filename)] ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.id.localeCompare(b.id);
    });
  }, [messages]);

  const [open, setOpen] = useState(false);

  if (snippets.length === 0) return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white/90 p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100"
      >
        <span>🤖 코드 도크</span>
        <span>{open ? "숨기기" : "열기"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {snippets.map((snippet) => {
            const displayFilename = snippet.filename ?? "Unnamed snippet";
            const normalizedFilename = snippet.filename?.toLowerCase();
            const headline = normalizedFilename && normalizedFilename in FILE_PRIORITY
              ? displayFilename
              : `${displayFilename} (임시)`;

            return (
              <article
                key={snippet.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-gray-100 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{headline}</div>
                    <div className="text-xs text-slate-500">언어: {snippet.language}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(snippet.code)}
                    className="rounded-md bg-blue-400 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
                  >
                    복사
                  </button>
                </div>
                <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                  <code>{snippet.code}</code>
                </pre>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
