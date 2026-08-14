"use client";

import React, { useState, useMemo, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLink, Copy, Download, Check } from "lucide-react";

/**
 * Streaming-safe markdown pre-processor
 * Handles incomplete markdown patterns during streaming
 */
// Helper to identify table rows
function isTableRow(line: string) {
    // Matches lines that start/end with pipe, or look like a table row with internal pipes
    return /^\s*\|.*\|\s*$/.test(line) || /^\|?[\s-:]+\|/.test(line.trim());
}

// Helper to identify separator rows (|---|)
function isSeparatorRow(line: string) {
    return /^\s*\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(line);
}

/**
 * Streaming-safe markdown pre-processor
 * Handles incomplete markdown patterns during streaming
 */
function prepareStreamingContent(content: string): string {
    if (!content) return "";

    const lines = content.split('\n');
    let output: string[] = [];
    let tableBuffer: string[] = [];
    let tableState: "idle" | "header" | "ready" = "idle";

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Apply basic line cleanups (bold/italic) unless it looks like a table part
        if (!isTableRow(line)) {
            // Fix incomplete bold at start
            if (/^(\s*[-*]?\s*)\*\*\s*[^*]+$/.test(line) && !line.includes(":**")) {
                if (line.includes(':')) {
                    line = line.replace(/^(\s*[-*]?\s*)\*\*\s*([^:]+):(.*)$/, "$1**$2:**$3");
                } else {
                    line = line + "**";
                }
            }
            // Fix incomplete italic
            else if (/^(\s*)\*([A-Z][a-z])/.test(line)) {
                if (line.includes(':')) {
                    line = line.replace(/^(\s*)\*([^:]+):(.*)$/, "$1*$2:*$3");
                } else if (!line.endsWith('*')) {
                    line = line + "*";
                }
            }
        }

        // Table Buffering Logic
        // If we're currently buffering a table OR this line starts a table
        if (isTableRow(line) || tableState !== "idle") {
            // Ignore empty lines inside a table buffer - this is critical!
            if (line.trim() === "") {
                continue;
            }

            // If this is actually a table row, add to buffer
            if (isTableRow(line)) {
                tableBuffer.push(line);

                if (tableState === "idle") {
                    tableState = "header";
                } else if (tableState === "header" && isSeparatorRow(line)) {
                    tableState = "ready";
                }
                continue;
            }

            // Non-empty, non-table line while buffering means table ended
            // Fall through to flush logic below
        }

        // We hit a non-table line. Flush buffer if any.
        if (tableBuffer.length > 0) {
            if (tableState === "ready") {
                // Valid table structure - release as table
                output.push(...tableBuffer);
            } else {
                // Incomplete table - render as plain text (joined, not spread)
                output.push(tableBuffer.join("\n"));
            }
            tableBuffer = [];
            tableState = "idle";
        }

        output.push(line);
    }

    // Flush remaining buffer at end
    if (tableBuffer.length > 0) {
        if (tableState === "ready") {
            output.push(...tableBuffer);
        } else {
            output.push(tableBuffer.join("\n"));
        }
    }

    let cleaned = output.join('\n');

    // Standard Cleanups
    cleaned = cleaned.replace(/\s+\*+\s*$/gm, ""); // Orphan asterisks
    cleaned = cleaned.replace(/^(\s*[-*]?\s*)\*+\s*$/gm, "");

    // Incomplete links
    cleaned = cleaned.replace(/\[\s*[^\]]{0,150}$/g, "");
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*$/g, "");
    cleaned = cleaned.replace(/\][^)]*$/g, "");

    // Auto-close code blocks
    const codeBlockMatches = cleaned.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
        cleaned += "\n```";
    }

    // === ROBUST MARKDOWN FIXES ===

    // 1. Fix headers missing a leading space: "#####Title" -> "##### Title"
    cleaned = cleaned.replace(/^(#{1,6})([^#\s])/gm, "$1 $2");

    // 2. Fix headers jammed against text: "text#### Title" -> "text\n\n#### Title"
    // We skip if preceded by | to avoid breaking tables
    cleaned = cleaned.replace(/([^\n|])(#{1,6}\s)/g, "$1\n\n$2");

    // 3. Fix bullets jammed against text: "text- Item" -> "text\n\n- Item"
    // Look for punctuation followed by a bullet marker
    cleaned = cleaned.replace(/([.!?])\s*([-*]\s+)(?!\|)/g, "$1\n\n$2");

    // 4. Fix numbered lists jammed against text: "text1. Item" -> "text\n\n1. Item"
    cleaned = cleaned.replace(/([.!?])\s*(\d+[).]\s+)(?!\|)/g, "$1\n\n$2");

    // 5. Clean up bold/italic stuck to colons: ":** " -> ": **"
    cleaned = cleaned.replace(/(:\*?\*?)\s+-\s+(\*?\*?)(?!\|)/g, "$1\n- $2");

    // Paragraph spacing
    cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

    return cleaned.trim();
}

/**
 * Main MarkdownRenderer component  
 */
function MarkdownRenderer({ content, className }: { content: string, className?: string }) {
    // Process content on every render to ensure streaming updates are properly handled
    const cleanContent = prepareStreamingContent(content);

    return (
        <TooltipProvider delayDuration={200}>
            <div className={`markdown-content prose prose-invert max-w-none 
                text-[#e8e8ea]
                prose-p:text-[14px] prose-p:leading-[28px] prose-p:mb-5 prose-p:last:mb-0
                prose-strong:font-semibold prose-strong:text-white
                prose-headings:text-white prose-headings:font-semibold prose-headings:mb-4 prose-headings:mt-8
                prose-ul:my-5 prose-ol:my-5 prose-li:my-2 prose-li:text-[14.5px]
                [&:last-child]:mb-0 selection:bg-[#75A5ED]/30 ${className || ""}`}>

                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        // Render all links as styled source buttons INLINE
                        a: ({ node, children, href, ...props }) => {
                            let domain = "";
                            try {
                                domain = href ? new URL(href).hostname.replace(/^www\./, "") : "";
                            } catch { }

                            const displayDomain = domain.length > 25 ? domain.slice(0, 22) + "..." : domain;

                            return (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-1 py-0 rounded-md 
                                                bg-[#12141a] border border-[#2a2d35] 
                                                text-[#75A5ED] text-[10px] font-medium mx-1 my-0
                                                hover:bg-[#1a1d25] hover:border-[#3a3f4a]
                                                transition-all duration-200 cursor-pointer 
                                                no-underline align-middle"
                                            {...props}
                                        >
                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                            <span className="max-w-[50px] sm:max-w-[100px] truncate">Source: {displayDomain || children}</span>
                                        </a>
                                    </TooltipTrigger>
                                    <TooltipContent
                                        side="top"
                                        className="max-w-[400px] break-all bg-[#0B0B0D] border-[#2A2A2E] text-[#e8e8ea] text-[11px] px-3 py-2 z-50"
                                    >
                                        <p className="font-medium mb-1 text-white">{String(children)}</p>
                                        <p className="text-[#888]">{href}</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        },
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeString = String(children).replace(/\n$/, "");
                            const [copied, setCopied] = useState(false);

                            const handleCopy = () => {
                                navigator.clipboard.writeText(codeString);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            };

                            const handleDownload = () => {
                                const ext = match ? match[1] : 'txt';
                                const blob = new Blob([codeString], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `code.${ext}`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            };

                            return !inline && match ? (
                                <div className="my-6 rounded-lg overflow-hidden border border-[#2a2d35] shadow-lg bg-[#0d0d0f]">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#1a1d25] border-b border-[#2a2d35]">
                                        <span className="text-xs text-[#888] font-medium">{match[1]}</span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleCopy}
                                                className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
                                            >
                                                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                {copied ? 'Copied!' : 'Copy'}
                                            </button>
                                            <button
                                                onClick={handleDownload}
                                                className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                    {/* Code */}
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent' }}
                                        {...props}
                                    >
                                        {codeString}
                                    </SyntaxHighlighter>
                                </div>
                            ) : (
                                <code className="bg-[#2a2a2e] text-[#AE98FF] px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                    {children}
                                </code>
                            );
                        },
                        h1: ({ node, ...props }) => <h1 {...props} className="text-xl font-semibold mb-6 mt-8" />,
                        h2: ({ node, ...props }) => <h2 {...props} className="text-lg font-semibold mb-4 mt-8" />,
                        h3: ({ node, ...props }) => <h3 {...props} className="text-base font-semibold mb-3 mt-6" />,
                        h4: ({ node, ...props }) => <h4 {...props} className="text-sm font-semibold mb-2 mt-4" />,
                        p: ({ node, ...props }) => <p {...props} className="mb-5 last:mb-0 text-[14px] leading-[28px] font-light" />,
                        ul: ({ node, ...props }) => <ul {...props} className="my-5 pl-5 list-disc space-y-2" />,
                        ol: ({ node, ...props }) => <ol {...props} className="my-5 pl-5 list-decimal space-y-2" />,
                        li: ({ node, ...props }) => <li {...props} className="text-[14.5px] leading-[26px]" />,
                        // Table support with copy
                        table: ({ node, children, ...props }) => {
                            const [copied, setCopied] = useState(false);

                            const getTableContent = (e: React.MouseEvent) => {
                                const tableEl = e.currentTarget.closest('.table-wrapper')?.querySelector('table');
                                if (!tableEl) return null;

                                const rows = tableEl.querySelectorAll('tr');
                                return Array.from(rows).map(row => {
                                    const cells = row.querySelectorAll('th, td');
                                    return Array.from(cells).map(cell => {
                                        let text = cell.textContent?.trim() || '';
                                        // Escape quotes for CSV
                                        return `"${text.replace(/"/g, '""')}"`;
                                    });
                                });
                            };

                            const handleCopyTable = (e: React.MouseEvent) => {
                                const rows = getTableContent(e);
                                if (rows) {
                                    const text = rows.map(row => row.join('\t')).join('\n');
                                    navigator.clipboard.writeText(text);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }
                            };

                            const handleDownloadTable = (e: React.MouseEvent) => {
                                const rows = getTableContent(e);
                                if (rows) {
                                    const csvContent = rows.map(row => row.join(',')).join('\n');
                                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'table_data.csv';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                }
                            };

                            return (
                                <div className="my-6 rounded-lg border border-[#2a2d35] overflow-hidden table-wrapper">
                                    {/* Table Header with Copy */}
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#1a1d25] border-b border-[#2a2d35]">
                                        <span className="text-xs text-[#888] font-medium">Table</span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleCopyTable}
                                                className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
                                            >
                                                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                {copied ? 'Copied!' : 'Copy'}
                                            </button>
                                            <button
                                                onClick={handleDownloadTable}
                                                className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table {...props} className="min-w-full divide-y divide-[#2a2d35] text-sm">
                                            {children}
                                        </table>
                                    </div>
                                </div>
                            );
                        },
                        thead: ({ node, ...props }) => <thead {...props} className="bg-[#12141a]" />,
                        tbody: ({ node, ...props }) => <tbody {...props} className="divide-y divide-[#2a2d35] bg-[#0d0d0f]" />,
                        tr: ({ node, ...props }) => <tr {...props} className="hover:bg-[#1a1d25]/50 transition-colors" />,
                        th: ({ node, ...props }) => (
                            <th {...props} className="px-4 py-3 text-left text-xs font-semibold text-[#e8e8ea] uppercase tracking-wider" />
                        ),
                        td: ({ node, ...props }) => (
                            <td {...props} className="px-4 py-3 text-[13px] text-[#c8c8ca]" />
                        ),
                        // Blockquote support
                        blockquote: ({ node, ...props }) => (
                            <blockquote
                                {...props}
                                className="my-6 pl-4 border-l-4 border-[#75A5ED] bg-[#12141a] py-3 pr-4 rounded-r-lg text-[#c8c8ca] italic"
                            />
                        ),
                        // Horizontal rule
                        hr: ({ node, ...props }) => (
                            <hr {...props} className="my-8 border-t border-[#2a2d35]" />
                        ),
                        // Pre tag for code blocks without language
                        pre: ({ node, children, ...props }) => (
                            <pre {...props}>
                                {children}
                            </pre>
                        ),
                    }}
                >
                    {cleanContent}
                </ReactMarkdown>
            </div>
        </TooltipProvider>
    );
}

export default memo(MarkdownRenderer);
