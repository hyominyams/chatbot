"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github.css";

interface MarkdownProps {
  children: string;
}

const components: Components = {
  p: ({ children }) => (
    <p className="leading-relaxed text-slate-800">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 text-slate-800">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 text-slate-800">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-200 bg-blue-50/70 px-4 py-2 text-sm text-slate-700">
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    const language = className?.replace("language-", "") ?? "";

    if (inline) {
      return (
        <code
          className="rounded-md bg-slate-900/80 px-1.5 py-0.5 text-xs text-blue-100"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <pre className="max-h-96 overflow-auto rounded-xl border border-slate-200 bg-slate-900/95 p-4 shadow-xs">
        <code className={`text-xs text-slate-100 ${language ? `language-${language}` : ""}`} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="overflow-hidden overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-800">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top text-slate-700">{children}</td>,
};

export default function Markdown({ children }: MarkdownProps) {
  return (
    <div className="space-y-4 text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
