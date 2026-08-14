"use client"

import type React from "react"

import { useState, useEffect, memo, useRef } from "react"
import { ChevronDown, Archive, CloudCog } from "lucide-react"
import { GetInsights, ArchiveInsights } from "@/controllers/ask-rover-controller"
import { useProjectStore } from "@/app/store/project/project.store"
import { useAskRoverStore } from "@/app/store/ask-rover/ask-rover.store"
import { UniversalPopup } from "./universal-popup"
import { InsightType } from "@/types/ask-rover-types"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx"
import Image from "next/image"
import MarkdownRenderer from "./markdownrenderer"
import { useRouter } from "next/navigation";


const MemoizedMarkdownRenderer = memo(MarkdownRenderer);

function ReadMore({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false)
    const limit = 700
    const isLong = text.length > limit
    const visibleText = expanded ? text : text.slice(0, limit)

    return (
        <p className="text-foreground text-sm leading-[30px] break-words">
            <MemoizedMarkdownRenderer content={
                new DOMParser()
                    .parseFromString(visibleText, "text/html")
                    .body.textContent
            } />
            {!expanded && isLong && "... "}
            {isLong && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-primary hover:underline inline ml-1 cursor-pointer"
                >
                    {expanded ? "Read less" : "Read more"}
                </button>
            )}
        </p>
    )
}

/**
 * Parse markdown text and convert to docx Paragraph elements
 * Supports: headings, bold, italic, lists, and regular text
 */
function parseMarkdownToDocxParagraphs(markdown: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const lines = markdown.split('\n');
    let inList = false;
    let listType: 'bullet' | 'number' | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip empty lines
        if (trimmedLine === '') {
            inList = false;
            listType = null;
            continue;
        }

        // Check for headings (## Heading)
        const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingText = headingMatch[2];
            const headingLevel = level === 1 ? HeadingLevel.HEADING_1 :
                level === 2 ? HeadingLevel.HEADING_2 :
                    level === 3 ? HeadingLevel.HEADING_3 :
                        level === 4 ? HeadingLevel.HEADING_4 :
                            level === 5 ? HeadingLevel.HEADING_5 : HeadingLevel.HEADING_6;

            paragraphs.push(new Paragraph({
                children: parseInlineMarkdown(headingText),
                heading: headingLevel,
                spacing: { before: 240, after: 120 },
            }));
            continue;
        }

        // Check for bullet list items (- item or * item)
        const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
        if (bulletMatch) {
            paragraphs.push(new Paragraph({
                children: parseInlineMarkdown(bulletMatch[1]),
                bullet: { level: 0 },
                spacing: { before: 60, after: 60 },
            }));
            inList = true;
            listType = 'bullet';
            continue;
        }

        // Check for numbered list items (1. item or 1) item)
        const numberMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)$/);
        if (numberMatch) {
            paragraphs.push(new Paragraph({
                children: parseInlineMarkdown(numberMatch[2]),
                numbering: { reference: "default-numbering", level: 0 },
                spacing: { before: 60, after: 60 },
            }));
            inList = true;
            listType = 'number';
            continue;
        }

        // Regular paragraph
        paragraphs.push(new Paragraph({
            children: parseInlineMarkdown(trimmedLine),
            spacing: { before: 120, after: 120 },
        }));
    }

    return paragraphs;
}

/**
 * Parse inline markdown formatting (bold, italic, code) and return TextRun array
 */
function parseInlineMarkdown(text: string): TextRun[] {
    const runs: TextRun[] = [];

    // Pattern to match **bold**, *italic*, `code`, and regular text
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|[^*`]+)/g;
    const matches = text.match(pattern) || [text];

    for (const match of matches) {
        if (match.startsWith('**') && match.endsWith('**')) {
            // Bold text
            runs.push(new TextRun({
                text: match.slice(2, -2),
                bold: true,
            }));
        } else if (match.startsWith('*') && match.endsWith('*')) {
            // Italic text
            runs.push(new TextRun({
                text: match.slice(1, -1),
                italics: true,
            }));
        } else if (match.startsWith('`') && match.endsWith('`')) {
            // Code text
            runs.push(new TextRun({
                text: match.slice(1, -1),
                font: "Consolas",
            }));
        } else {
            // Regular text
            runs.push(new TextRun({ text: match }));
        }
    }

    return runs;
}

/**
 * Strip HTML and decode any HTML entities
 */
function stripHtmlAndDecode(html: string): string {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
}

export default function SavedInsightsContent() {
    const { selectedProject, hydrated } = useProjectStore()
    const { insightsList } = useAskRoverStore()
    const [sourceFilter, setSourceFilter] = useState("All")
    const [userFilter, setUserFilter] = useState("All")
    const [userFilterValue, setUserFilterValue] = useState("All")
    const [tagFilter, setTagFilter] = useState("All")
    const [dateFilter, setDateFilter] = useState("All")
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const exportContainerRef = useRef<HTMLDivElement>(null)

    const router = useRouter()

    const safeInsightsList = Array.isArray(insightsList) ? insightsList : []

    // Use Sets to prevent duplicates
    const sourcesSet = new Set<string>();
    const createdBySet = new Set<string>();

    safeInsightsList.forEach((item) => {
        if (item?.Source) {
            sourcesSet.add(item.Source);
        }
        if (item?.UpdatedBy) {
            let splitUser = item.UpdatedBy.split("@")[0]
            splitUser = splitUser.charAt(0).toUpperCase() + splitUser.slice(1)
            createdBySet.add(splitUser);
        }
    })

    const sources = ["All", ...Array.from(sourcesSet)];
    const createdBy = ["All", ...Array.from(createdBySet)];

    const filteredInsights = safeInsightsList.filter((insight) => {
        if (!insight || !insight.Question) return false

        const matchesSource = sourceFilter === "All" || insight.Source === sourceFilter
        const matchesUser = userFilterValue === "All" || insight.UpdatedBy === userFilterValue
        const matchesTag = tagFilter === "All" || insight.Tags?.includes(tagFilter)

        let matchesDate = true
        if (dateFilter !== "All") {
            const insightDate = new Date(insight.UpdatedOn)
            const now = new Date()

            if (dateFilter === "Today") {
                matchesDate = insightDate.toDateString() === now.toDateString()
            } else if (dateFilter === "Last 7 days") {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                matchesDate = insightDate >= sevenDaysAgo
            } else if (dateFilter === "Last 30 days") {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                matchesDate = insightDate >= thirtyDaysAgo
            } else if (dateFilter === "Last 6 months") {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                matchesDate = insightDate >= sixMonthsAgo;
            }
        }

        return matchesSource && matchesUser && matchesTag && matchesDate
    })

    const toggleDropdown = (dropdown: string) => {
        setOpenDropdown(openDropdown === dropdown ? null : dropdown)
    }

    useEffect(() => {
        if (!hydrated) return
        if (!selectedProject?.length) return

        const projectid = selectedProject[0].ProjectID

        const fetchInsights = async () => {
            await GetInsights(projectid)
        }

        fetchInsights()
    }, [hydrated, selectedProject])

    // Helper function to convert markdown to HTML for PDF rendering
    // Handles: tables, code blocks, headers, bold, italic, lists
    function formatMarkdownToHtml(text: string): string {
        if (!text) return '';

        const lines = text.split('\n');
        const result: string[] = [];
        let inCodeBlock = false;
        let codeBlockLang = '';
        let codeBlockContent: string[] = [];
        let inTable = false;
        let tableRows: string[][] = [];
        let hasTableHeader = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for code block start/end
            if (line.trim().startsWith('```')) {
                if (!inCodeBlock) {
                    // Start of code block
                    inCodeBlock = true;
                    codeBlockLang = line.trim().slice(3).trim();
                    codeBlockContent = [];
                } else {
                    // End of code block
                    inCodeBlock = false;
                    const codeHtml = codeBlockContent
                        .map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
                        .join('\n');
                    result.push(`
                        <div style="margin: 16px 0; background: #f5f5f5; border-radius: 6px; overflow: hidden;">
                            ${codeBlockLang ? `<div style="background: #e0e0e0; padding: 6px 12px; font-size: 12px; color: #666;">${codeBlockLang}</div>` : ''}
                            <pre style="margin: 0; padding: 16px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"><code>${codeHtml}</code></pre>
                        </div>
                    `);
                    codeBlockContent = [];
                    codeBlockLang = '';
                }
                continue;
            }

            if (inCodeBlock) {
                codeBlockContent.push(line);
                continue;
            }

            // Check for table rows (lines with |)
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                const cells = line.split('|').slice(1, -1).map(c => c.trim());

                // Check if this is a separator row (|---|---|)
                if (cells.every(c => /^[-:]+$/.test(c))) {
                    hasTableHeader = true;
                    continue;
                }

                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(cells);
                continue;
            } else if (inTable) {
                // End of table, render it
                result.push(renderTable(tableRows, hasTableHeader));
                inTable = false;
                tableRows = [];
                hasTableHeader = false;
            }

            // Process regular line
            let processedLine = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Headers - with page-break-inside: avoid to prevent splitting across pages
            if (/^######\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^######\s+(.+)$/, '<h6 style="font-size: 12px; font-weight: 600; margin: 16px 0 8px 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">$1</h6>');
            } else if (/^#####\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^#####\s+(.+)$/, '<h5 style="font-size: 13px; font-weight: 600; margin: 16px 0 8px 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">$1</h5>');
            } else if (/^####\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^####\s+(.+)$/, '<h4 style="font-size: 14px; font-weight: 600; margin: 16px 0 8px 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">$1</h4>');
            } else if (/^###\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^###\s+(.+)$/, '<h3 style="font-size: 15px; font-weight: 600; margin: 16px 0 10px 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">$1</h3>');
            } else if (/^##\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^##\s+(.+)$/, '<h2 style="font-size: 16px; font-weight: 600; margin: 18px 0 10px 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">$1</h2>');
            } else if (/^#\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^#\s+(.+)$/, '<h1 style="font-size: 18px; font-weight: 600; margin: 20px 0 12px 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">$1</h1>');
            }
            // Bullet lists - with page-break protection
            else if (/^[-*]\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^[-*]\s+(.+)$/, '<div style="margin: 4px 0; padding-left: 20px; page-break-inside: avoid; break-inside: avoid;">• $1</div>');
            }
            // Numbered lists - with page-break protection
            else if (/^(\d+)[.)]\s+(.+)$/.test(processedLine)) {
                processedLine = processedLine.replace(/^(\d+)[.)]\s+(.+)$/, '<div style="margin: 4px 0; padding-left: 20px; page-break-inside: avoid; break-inside: avoid;">$1. $2</div>');
            }
            // Regular paragraph - with page-break protection
            else if (processedLine.trim()) {
                processedLine = `<p style="margin: 8px 0; line-height: 1.6; page-break-inside: avoid; break-inside: avoid;">${processedLine}</p>`;
            }

            // Apply inline formatting
            processedLine = processedLine
                .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px;">$1</code>');

            result.push(processedLine);
        }

        // Close any unclosed code block
        if (inCodeBlock && codeBlockContent.length > 0) {
            const codeHtml = codeBlockContent
                .map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
                .join('\n');
            result.push(`
                <div style="margin: 16px 0; background: #f5f5f5; border-radius: 6px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
                    ${codeBlockLang ? `<div style="background: #e0e0e0; padding: 6px 12px; font-size: 12px; color: #666;">${codeBlockLang}</div>` : ''}
                    <pre style="margin: 0; padding: 16px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"><code>${codeHtml}</code></pre>
                </div>
            `);
        }

        // Close any unclosed table
        if (inTable && tableRows.length > 0) {
            result.push(renderTable(tableRows, hasTableHeader));
        }

        return result.join('');
    }

    // Helper function to render a markdown table as HTML
    function renderTable(rows: string[][], hasHeader: boolean): string {
        if (rows.length === 0) return '';

        let html = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; page-break-inside: avoid; break-inside: avoid;">';

        rows.forEach((row, index) => {
            const isHeader = hasHeader && index === 0;
            const tag = isHeader ? 'th' : 'td';
            const bgColor = isHeader ? '#f5f5f5' : (index % 2 === 0 ? '#ffffff' : '#fafafa');
            const fontWeight = isHeader ? '600' : 'normal';

            html += `<tr style="background: ${bgColor};">`;
            row.forEach(cell => {
                html += `<${tag} style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-weight: ${fontWeight};">${cell}</${tag}>`;
            });
            html += '</tr>';
        });

        html += '</table>';
        return html;
    }

    // Export to PDF using html2canvas - supports all Unicode text including Japanese/CJK
    const exportToPDF = async () => {
        setIsExporting(true);

        try {
            // Create a temporary container for rendering
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = `
                position: fixed;
                left: -9999px;
                top: 0;
                width: 800px;
                background: white;
                padding: 40px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Noto Sans JP", "Noto Sans CJK JP", Roboto, Arial, sans-serif;
                color: #1a1a1a;
            `;
            document.body.appendChild(tempContainer);

            // Build HTML content with rendered markdown
            // Use page-break-inside: avoid to prevent content from being cut mid-element
            let htmlContent = `
                <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 30px; color: #1a1a1a; page-break-inside: avoid; break-inside: avoid;">Saved Insights</h1>
            `;

            filteredInsights.forEach((insight, index) => {
                const answerText = stripHtmlAndDecode(insight.Answer);
                htmlContent += `
                    <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; page-break-inside: avoid; break-inside: avoid;">
                        <h2 style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">
                            Q${index + 1}: ${insight.Question}
                        </h2>
                        <div style="font-size: 14px; line-height: 1.8; color: #333;">
                            ${formatMarkdownToHtml(answerText)}
                        </div>
                    </div>
                `;
            });

            tempContainer.innerHTML = htmlContent;

            // Use html2canvas to capture the content
            const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            // Create PDF with proper multi-page handling using canvas slicing
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 15; // Proper margin in mm
            const contentWidth = pdfWidth - (margin * 2);
            const contentHeight = pdfHeight - (margin * 2);

            // Calculate the scale factor to fit content width
            const imgWidthPx = canvas.width;
            const imgHeightPx = canvas.height;
            const scaleFactor = contentWidth / (imgWidthPx / 2); // Divide by 2 because of scale: 2 in html2canvas

            // Calculate how much of the image (in pixels) fits on one page
            const pageHeightPx = (contentHeight / scaleFactor) * 2; // Multiply by 2 for scale

            // Calculate total pages needed
            const totalPages = Math.ceil(imgHeightPx / pageHeightPx);

            for (let page = 0; page < totalPages; page++) {
                if (page > 0) {
                    pdf.addPage();
                }

                // Calculate the source rectangle for this page
                const sourceY = page * pageHeightPx;
                const sourceHeight = Math.min(pageHeightPx, imgHeightPx - sourceY);

                // Create a temporary canvas for this page slice
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = imgWidthPx;
                pageCanvas.height = sourceHeight;

                const ctx = pageCanvas.getContext('2d');
                if (ctx) {
                    // Draw the slice of the main canvas
                    ctx.drawImage(
                        canvas,
                        0, sourceY, imgWidthPx, sourceHeight,  // Source rectangle
                        0, 0, imgWidthPx, sourceHeight         // Destination rectangle
                    );

                    // Convert to image and add to PDF
                    const pageImgData = pageCanvas.toDataURL('image/png');
                    const sliceHeight = (sourceHeight * contentWidth) / imgWidthPx;
                    pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, sliceHeight);
                }
            }

            // Clean up
            document.body.removeChild(tempContainer);

            // Save the PDF
            pdf.save('insights.pdf');
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            alert('Error exporting to PDF. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };


    // Export to DOCX with proper Unicode support and markdown parsing
    const exportToDOCX = async () => {
        setIsExporting(true);

        try {
            const children: Paragraph[] = [
                new Paragraph({
                    children: [new TextRun({ text: "Saved Insights", bold: true, size: 48 })],
                    heading: HeadingLevel.TITLE,
                    spacing: { after: 400 },
                }),
            ];

            filteredInsights.forEach((insight, index) => {
                // Add question as a subheading
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Q${index + 1}: ${insight.Question}`,
                                bold: true,
                                size: 28,
                            }),
                        ],
                        spacing: { before: 400, after: 200 },
                    })
                );

                // Parse and add answer with markdown formatting
                const answerText = stripHtmlAndDecode(insight.Answer);
                const answerParagraphs = parseMarkdownToDocxParagraphs(answerText);
                children.push(...answerParagraphs);

                // Add separator
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: "" })],
                        spacing: { before: 200, after: 200 },
                    })
                );
            });

            const doc = new Document({
                sections: [
                    {
                        children: children,
                    },
                ],
                numbering: {
                    config: [
                        {
                            reference: "default-numbering",
                            levels: [
                                {
                                    level: 0,
                                    format: "decimal",
                                    text: "%1.",
                                    alignment: AlignmentType.START,
                                },
                            ],
                        },
                    ],
                },
            });

            const blob = await Packer.toBlob(doc);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "insights.docx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting to DOCX:', error);
            alert('Error exporting to DOCX. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    // Handle export selection
    const handleExport = (format: string) => {
        if (filteredInsights.length === 0) {
            alert("No insights to export!")
            return
        }

        if (isExporting) {
            return; // Prevent multiple exports
        }

        switch (format) {
            case "Export PDF":
                exportToPDF()
                break
            case "Export DOC":
                exportToDOCX()
                break
        }
        setOpenDropdown(null)
    }

    function findByUpdatedByUsername(username: string): InsightType | undefined {
        return safeInsightsList.find(item => {
            const email = item?.UpdatedBy || "";
            const localPart = email.split("@")[0];
            localPart.toLowerCase() === username.toLowerCase() && setUserFilterValue(email);
        });
    }


    const Dropdown = ({
        label,
        icon,
        options,
        value,
        onChange,
        name,
        disabled = false,
    }: {
        label: string
        icon: React.ReactNode
        options: string[]
        value: string
        onChange: (value: string) => void
        name: string
        disabled?: boolean
    }) => {
        return (
            <div className="relative">
                <button
                    onClick={() => !disabled && toggleDropdown(name)}
                    disabled={disabled}
                    className={`flex items-center gap-2 px-4 py-2 bg-muted rounded-lg text-sm transition-colors border border-border h-[37px] text-sm font-normal ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/80 cursor-pointer"
                        }`}
                >
                    {icon}
                    <span>{value === "All" ? label : value}</span>
                    <ChevronDown className="w-4 h-4" />
                </button>
                {openDropdown === name && !disabled && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[160px]">
                        {options.map((option) => (
                            <button
                                key={option}
                                onClick={() => {
                                    name === "user" && findByUpdatedByUsername(option)
                                    onChange(option)
                                    setOpenDropdown(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg cursor-pointer"
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";

    return (
        <div className="flex-1 p-8 flex justify-center h-full overflow-hidden">
            <div className="w-[920px] space-y-12">
                <div className="h-full flex flex-col">
                    <div className="flex items-center gap-4 mb-2">
                        <h1 className="gradient-title">Saved Insights</h1>
                        <div className="h-px bg-[#2a2a2a] flex-1 mt-1" />
                    </div>
                    {filteredInsights.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-muted-foreground text-center">No insights found for the selected filters.</p>
                        </div>
                    ) :
                        (
                            <>

                                {/* Filter Toolbar */}
                                <div className="flex items-center text-white gap-3 mb-4">
                                    <Dropdown
                                        label="Source"
                                        name="source"
                                        icon={
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                                                />
                                            </svg>
                                        }
                                        options={sources}
                                        value={sourceFilter}
                                        onChange={setSourceFilter}
                                    />

                                    <Dropdown
                                        label="By User"
                                        name="user"
                                        icon={
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                />
                                            </svg>
                                        }
                                        options={createdBy}
                                        value={userFilter}
                                        onChange={setUserFilter}
                                    />

                                    {/* <Dropdown
                                label="By Tag"
                                name="tag"
                                icon={
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                        />
                                    </svg>
                                }
                                options={["All", "EV Battery", "Sustainability", "Economics"]}
                                value={tagFilter}
                                onChange={setTagFilter}
                            /> */}

                                    <Dropdown
                                        label="By Date"
                                        name="date"
                                        icon={
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                />
                                            </svg>
                                        }
                                        options={["All", "Today", "Last 7 days", "Last 30 days", "Last 6 months"]}
                                        value={dateFilter}
                                        onChange={setDateFilter}
                                    />

                                    <div className="flex-1" />
                                    {/* <button className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors">
                                <span>Archive</span>
                            </button> */}




                                    <Dropdown
                                        label={isExporting ? "Exporting..." : "Export Insights"}
                                        name="exportInsights"
                                        icon={
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                                />
                                            </svg>
                                        }
                                        options={["Export PDF", "Export DOC"]}
                                        value="All"
                                        onChange={handleExport}
                                        disabled={filteredInsights.length === 0 || isExporting}
                                    />
                                </div>

                                {/* Insights Cards */}
                                {console.log("Rendering Insights:", filteredInsights)}
                                <div className="flex-1 overflow-y-auto space-y-4 pb-6 scrollbar-hide">
                                    {(
                                        filteredInsights.map((insight) => (
                                            <div key={insight.QID}
                                                className="bg-card border border-border rounded-lg py-4 hover:shadow-lg transition-shadow">
                                                {/* Card Header */}
                                                <div className="border-b border-border pb-2 mb-4 px-6">
                                                    <div className="flex items-center gap-3 text-xs font-normal text-foreground">
                                                        {/* <input type="checkbox" className="w-4 h-4 rounded border-border" /> */}

                                                        <span className="flex items-center gap-1">
                                                            <Image
                                                                src={`${assetPrefix}/assets/images/source.png`}
                                                                alt="Source Image"
                                                                width={13}
                                                                height={13}
                                                                className="block"
                                                            />
                                                            {insight.Source}
                                                        </span>

                                                        <span>|</span>
                                                        <span>{insight.UpdatedOn}</span>
                                                        {insight.UpdatedBy.length > 0 && (
                                                            <>
                                                                <span>|</span>
                                                                <span className="flex items-center gap-1">
                                                                    <Image
                                                                        src={`${assetPrefix}/assets/icons/user-white.svg`}
                                                                        alt="Source Image"
                                                                        width={13}
                                                                        height={13}
                                                                        className="block"
                                                                    />
                                                                    {insight.UpdatedBy}
                                                                </span>
                                                            </>
                                                        )}

                                                        <div className="flex-1" />
                                                        <UniversalPopup
                                                            mode="delete"
                                                            title="Delete Saved Insights"
                                                            description="This action can't be undone."
                                                            trigger={
                                                                <button
                                                                    className="w-[31.29px] h-[31.29px] flex items-center justify-center rounded-full bg-[#201F1F] hover:bg-secondary text-icon-secondary hover:text-destructive cursor-pointer"
                                                                >
                                                                    <Image
                                                                        src={`${assetPrefix}/assets/icons/archive.svg`}
                                                                        alt="Archive Icon"
                                                                        width={14}
                                                                        height={14}
                                                                    />
                                                                </button>
                                                            }
                                                            onConfirm={async () => {
                                                                await ArchiveInsights(
                                                                    "Archive",
                                                                    insight.QID,
                                                                    "ProjectID",
                                                                    selectedProject[0]?.ProjectID,
                                                                    `ProjectID::${selectedProject[0]?.ProjectID}`,
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Card Content */}
                                                <div className="px-6">
                                                    <h3 className="text-foreground font-normal text-base mb-2">
                                                        {insight.Question}
                                                    </h3>

                                                    <ReadMore
                                                        text={
                                                            insight.Answer
                                                                ? new DOMParser().parseFromString(insight.Answer, "text/html").body.textContent || ""
                                                                : ""
                                                        }
                                                    />
                                                </div>


                                                {/* <div>
                                                        <h3 className="text-foreground font-semibold text-base mb-2">{insight.Question}</h3>
                                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                                            
                                                                {new DOMParser().parseFromString(insight.Answer, "text/html").body.textContent}
                                                                {" "}
                                                                    <button className="text-primary hover:underline">
                                                                        Readmore
                                                                    </button>
                                                            
                                                        </p>
                                                    </div> */}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                </div>

            </div>
        </div>
    )
}
