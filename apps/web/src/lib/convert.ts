import { marked } from "marked";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

/** File System Access API 类型 */
type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
};

/** 导入格式 */
export type ImportFormat = "md" | "txt" | "html" | "docx" | "json";

/** 导出格式 */
export type ExportFormat = "md" | "txt" | "json" | "docx";

export interface ExportPayload {
  title: string;
  html: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 格式检测 ──────────────────────────────────

const FORMAT_MAP: Record<string, ImportFormat> = {
  ".md": "md",
  ".mdx": "md",
  ".markdown": "md",
  ".txt": "txt",
  ".html": "html",
  ".htm": "html",
  ".docx": "docx",
  ".json": "json",
};

export function detectImportFormat(filename: string): ImportFormat | null {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return FORMAT_MAP[ext] ?? null;
}

export function detectExportFormat(filename: string): ExportFormat | null {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".txt") return "txt";
  if (ext === ".json") return "json";
  if (ext === ".docx") return "docx";
  return null;
}

// ── 导入转换 ──────────────────────────────────

/** Markdown → HTML */
export function markdownToHtml(md: string): string {
  try {
    const result = marked.parse(md, { async: false });
    return typeof result === "string" ? result : "";
  } catch {
    return "<pre>" + md.replace(/</g, "&lt;") + "</pre>";
  }
}

/** 纯文本 → HTML */
export function plainTextToHtml(text: string): string {
  return "<p>" + text.replace(/</g, "&lt;").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
}

/** 读取文件内容（文本） */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file);
  });
}

/** 读取文件为 ArrayBuffer（docx 等） */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsArrayBuffer(file);
  });
}

/** 读取 JSON 文件并返回 Note 数据列表 */
export function parseJsonImport(json: string): { title: string; html: string; tags?: string[] }[] {
  try {
    const data = JSON.parse(json);
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((item: Record<string, unknown>) => ({
      title: String(item.title || item.name || "未命名笔记"),
      html: String(item.html || item.content || ""),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
    }));
  } catch {
    return [];
  }
}

/** docx → HTML（mammoth） */
export async function docxToHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await readFileAsArrayBuffer(file);
  const result = await mammoth.convertToHtml({ arrayBuffer: buf });
  return result.value;
}

/** 通用导入接口：自动检测格式并返回 { title, html } */
export async function importFile(
  file: File
): Promise<{ title: string; html: string; tags?: string[] }[]> {
  const format = detectImportFormat(file.name);
  if (!format) throw new Error("不支持的文件格式: " + file.name);

  switch (format) {
    case "json": {
      const text = await readFileAsText(file);
      return parseJsonImport(text);
    }
    case "docx": {
      const html = await docxToHtml(file);
      const name = file.name.replace(/\.docx$/i, "");
      return [{ title: name, html }];
    }
    case "md": {
      const text = await readFileAsText(file);
      const html = markdownToHtml(text);
      const name = file.name.replace(/\.md$/i, "").replace(/\.mdx$/i, "");
      return [{ title: name, html }];
    }
    case "txt": {
      const text = await readFileAsText(file);
      const html = plainTextToHtml(text);
      const name = file.name.replace(/\.txt$/i, "");
      return [{ title: name, html }];
    }
    case "html": {
      const text = await readFileAsText(file);
      const name = file.name.replace(/\.html$/i, "").replace(/\.htm$/i, "");
      return [{ title: name, html: text }];
    }
    default:
      throw new Error("未处理的格式: " + format);
  }
}

// ── 导出转换 ──────────────────────────────────

/** HTML → Markdown（turndown） */
export function htmlToMarkdown(html: string): string {
  try {
    return turndown.turndown(html);
  } catch {
    return html.replace(/<[^>]*>/g, "").trim();
  }
}

/** HTML → 纯文本 */
export function htmlToPlainText(html: string): string {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

/** 将 note 列表序列化为 JSON 导出字符串 */
export function notesToJson(notes: ExportPayload[]): string {
  return JSON.stringify(notes, null, 2);
}

/** HTML → docx Blob（docx 库） */
export async function htmlToDocx(
  html: string,
  title: string
): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

  const paragraphs: any[] = [];

  // 标题
  paragraphs.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
    })
  );
  paragraphs.push(new Paragraph({ spacing: { after: 200 } }));

  // 解析 HTML 为段落
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  function parseNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text })],
            spacing: { after: 100 },
          })
        );
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      const levelMap: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
      const lvl = levelMap[tag] as 1 | 2 | 3 | 4 | 5 | 6;
      const headingKey = `HEADING_${lvl}` as keyof typeof HeadingLevel;
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: el.textContent || "", bold: true })],
          heading: HeadingLevel[headingKey],
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (tag === "p") {
      paragraphs.push(
        new Paragraph({
          children: Array.from(el.childNodes).map((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
              return new TextRun({ text: child.textContent || "" });
            }
            const c = child as HTMLElement;
            if (c.tagName.toLowerCase() === "strong" || c.tagName.toLowerCase() === "b") {
              return new TextRun({ text: c.textContent || "", bold: true });
            }
            if (c.tagName.toLowerCase() === "em" || c.tagName.toLowerCase() === "i") {
              return new TextRun({ text: c.textContent || "", italics: true });
            }
            if (c.tagName.toLowerCase() === "a") {
              return new TextRun({
                text: c.textContent || "",
                style: "Hyperlink",
              });
            }
            if (c.tagName.toLowerCase() === "br") {
              return new TextRun({ break: 1 });
            }
            return new TextRun({ text: c.textContent || "" });
          }),
          spacing: { after: 100 },
        })
      );
    } else if (tag === "blockquote") {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: el.textContent || "", italics: true })],
          indent: { left: 400 },
          spacing: { before: 100, after: 100 },
        })
      );
    } else if (tag === "ul" || tag === "ol") {
      Array.from(el.children).forEach((li, i) => {
        const prefix = tag === "ol" ? `${i + 1}. ` : "• ";
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: prefix + (li.textContent || "") })],
            indent: { left: 400 },
            spacing: { after: 50 },
          })
        );
      });
    } else if (tag === "pre" || tag === "code") {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: el.textContent || "", font: "Courier New" })],
          spacing: { before: 100, after: 100 },
          indent: { left: 200 },
        })
      );
    } else if (tag === "hr") {
      paragraphs.push(new Paragraph({ thematicBreak: true, spacing: { before: 200, after: 200 } }));
    } else {
      el.childNodes.forEach(parseNode);
    }
  }

  tempDiv.childNodes.forEach(parseNode);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * 下载文件：优先 File System Access API（弹原生另存为对话框），
 * 不支持时自动降级到普通 <a> 下载。
 */
export async function downloadFile(blob: Blob, suggestedName: string): Promise<void> {
  // 优先使用 File System Access API（Chromium 支持）
  if ("showSaveFilePicker" in window) {
    try {
      const opts: SaveFilePickerOptions = {
        suggestedName,
        types: [
          {
            description: "文件",
            accept: {
              "application/octet-stream": [suggestedName.split(".").pop() || ""].map(
                (ext) => "." + ext
              ),
            },
          },
        ],
        excludeAcceptAllOption: false,
      };
      const handle = await (window as any).showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch {
      // 用户取消 或 API 错误 → 降级
    }
  }

  // 降级方案：<a> 下载
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 获取导出文件名 */
export function getExportFilename(title: string, format: ExportFormat): string {
  const safe = title.replace(/[<>:"/\\|?*]+/g, "_").trim() || "未命名笔记";
  const extMap: Record<ExportFormat, string> = {
    md: ".md",
    txt: ".txt",
    json: ".json",
    docx: ".docx",
  };
  return safe + extMap[format];
}
