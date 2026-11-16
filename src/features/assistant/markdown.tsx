"use client";

import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";

import { cn } from "~/lib/utils";

/**
 * Markdown for assistant answers. Tables, lists and code are styled from the
 * app's tokens; raw HTML is not rendered.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("chat-md", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {label}
            </a>
          ),
          table: ({ children: body }) => (
            <div className="chat-table">
              <table>{body}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
