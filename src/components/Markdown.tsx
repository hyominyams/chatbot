"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-gray-800 prose-pre:bg-gray-900 prose-pre:text-gray-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: ({ inline, children: codeChildren, className, ...props }: any) => {
            const baseClass = inline
              ? "bg-slate-800/80 px-1.5 py-0.5 rounded-md text-xs text-gray-100"
              : className;
            return (
              <code className={baseClass} {...props}>
                {codeChildren}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
