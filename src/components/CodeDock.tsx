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

const CODE_BLOCK_RE = /```([\w+-]*)\s*(?:\[(.+?)\])?\n([\s\S]*?)```/g;

export default function CodeDock({ messages }: CodeDockProps) {
  const snippets = useMemo<ExtractedSnippet[]>(() => {
    const items: ExtractedSnippet[] = [];
    messages.forEach((msg, index) => {
      const regex = new RegExp(CODE_BLOCK_RE.source, "g");
      let count = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(msg.content)) !== null) {
        items.push({
          id: `${msg.id ?? index}-${count}`,
          language: match[1]?.trim() || "plain",
          filename: match[2]?.trim(),
          code: match[3] ?? "",
        });
        count += 1;
      }
    });
    return items;
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
        <span>💻 코드 도크</span>
        <span>{open ? "숨기기" : "보기"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {snippets.map((snippet) => (
            <article
              key={snippet.id}
              className="space-y-2 rounded-xl border border-slate-200 bg-gray-100 p-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-700">
                    {snippet.filename ?? "Unnamed snippet"}
                  </div>
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
          ))}
        </div>
      ) : null}
    </section>
  );
}
