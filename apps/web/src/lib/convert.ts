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

/** HTML → Markdown（turndown，自动解析图片相对路径为绝对路径） */
export function htmlToMarkdown(html: string): string {
  try {
    const resolved = resolveHtmlImageUrls(html);
    return turndown.turndown(resolved);
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

// ── 图片导出辅助 ──────────────────────────────

/** 解析 HTML 中所有图片的相对路径为绝对路径（浏览器端） */
export function resolveHtmlImageUrls(html: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return html;
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const imgs = temp.querySelectorAll("img");
  imgs.forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src && !/^https?:\/\//.test(src) && !src.startsWith("data:") && !src.startsWith("blob:")) {
      img.setAttribute(
        "src",
        window.location.origin + (src.startsWith("/") ? "" : "/") + src
      );
    }
  });
  return temp.innerHTML;
}

/** data URI → Uint8Array（浏览器端同步转换） */
function dataUriToUint8Array(dataUri: string): Uint8Array {
  const base64 = dataUri.split(",")[1];
  if (!base64) return new Uint8Array(0);
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}

/** 获取网络图片的原始尺寸 */
function getImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

/** 下载 HTML 中所有外部图片，嵌入为 base64 data URI（用于 DOCX 导出） */
export async function embedHtmlImages(html: string): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") return html;

  // 先解析相对路径
  const resolved = resolveHtmlImageUrls(html);
  const temp = document.createElement("div");
  temp.innerHTML = resolved;
  const imgs = temp.querySelectorAll("img");

  await Promise.all(
    Array.from(imgs).map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (src.startsWith("data:")) return;

      try {
        // 获取图片尺寸（用于 docx ImageRun）
        const dims = await getImageDimensions(src);
        img.setAttribute("data-img-width", String(dims.width));
        img.setAttribute("data-img-height", String(dims.height));

        // 下载并 base64 编码
        const resp = await fetch(src, { mode: "cors", credentials: "omit" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUrl);
      } catch {
        // 加载失败 → 移除该图片
        img.remove();
      }
    })
  );

  return temp.innerHTML;
}

/** HTML → docx Blob（docx 库，自动嵌入图片） */
export async function htmlToDocx(
  html: string,
  title: string
): Promise<Blob> {
  // 嵌入图片为 base64 data URI
  const embeddedHtml = await embedHtmlImages(html);

  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } = docx;

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
  tempDiv.innerHTML = embeddedHtml;

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
    } else if (tag === "img") {
      const src = el.getAttribute("src") || "";
      if (src.startsWith("data:")) {
        try {
          const uint8 = dataUriToUint8Array(src);

          // 获取图片尺寸（优先使用 embedHtmlImages 预存的数据）
          let width = parseInt(el.getAttribute("data-img-width") || "0", 10);
          let height = parseInt(el.getAttribute("data-img-height") || "0", 10);

          // 缩放以适应页面宽度
          const maxWidth = 500;
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
          // 默认尺寸
          if (width <= 0 || height <= 0) {
            width = 400;
            height = 300;
          }

          // 确定图片类型
          const mimeMatch = src.match(/^data:(image\/(\w+));/);
          const imgType = mimeMatch?.[2] === "jpeg" ? "jpg" : "png";

          paragraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: uint8,
                  transformation: { width, height },
                  type: imgType,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
            })
          );
        } catch {
          // 图片处理失败 → 用文本替代
          const alt = el.getAttribute("alt") || "[图片]";
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: alt, italics: true })],
              spacing: { before: 100, after: 100 },
            })
          );
        }
      }
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
