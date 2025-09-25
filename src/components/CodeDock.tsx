"use client";

import { useMemo } from "react";
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
    messages
      .filter((msg) => msg.role === "assistant")
      .forEach((msg, index) => {
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

  if (snippets.length === 0) {
    return null;
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      alert("코드가 복사되었습니다.");
    } catch (err) {
      console.error(err);
      alert("복사에 실패했습니다.");
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <header className="text-sm font-semibold text-gray-700">코드 도크</header>
      <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
        {snippets.map((snippet) => (
          <article
            key={snippet.id}
            className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">
                  {snippet.filename ?? "Unnamed snippet"}
                </div>
                <div className="text-xs text-gray-500">언어: {snippet.language}</div>
              </div>
              <button
                onClick={() => handleCopy(snippet.code)}
                className="rounded-md border border-gray-300 bg-gray-100 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200"
              >
                복사
              </button>
            </div>
            <pre className="max-h-40 overflow-y-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
              <code>{snippet.code}</code>
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}
