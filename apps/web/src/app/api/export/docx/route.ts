import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join, resolve, sep } from "path";

// 图片只能从 public/uploads 读取，固化根目录用于路径穿越校验
const UPLOADS_DIR = resolve(process.cwd(), "public", "uploads");

/**
 * 服务端 DOCX 生成路由
 *
 * 使用 docx 库（Node.js 环境正常工作）生成真正的 .docx 文件，
 * 自动将 data URI 和 /uploads/ 路径的图片嵌入为 ImageRun。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const html = body.html || "";
    let title = body.title || "未命名笔记";

    const safeTitle = title
      .replace(/[<>:"/\\|?*]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "未命名笔记";

    // ── 动态导入 docx ──────────────────────────────
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } = await import("docx");

    // ── 解析 HTML，生成 docx 元素 ───────────────────
    const paragraphs: any[] = [];

    // 标题
    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    );
    paragraphs.push(new Paragraph({ spacing: { after: 200 } }));

    // 缓存已处理的图片以避免重复加载
    const imageCache = new Map<string, { buffer: Buffer; width: number; height: number; type: string }>();

    /** 从 data URI 或 /uploads/ 路径加载图片 buffer */
    function resolveImage(src: string): { buffer: Buffer; width: number; height: number; type: any } | null {
      if (imageCache.has(src)) return imageCache.get(src)!;

      try {
        let buffer: Buffer;
        let mime = "image/png";

        if (src.startsWith("data:")) {
          // data:image/png;base64,xxx
          const m = src.match(/^data:(image\/\w+);base64,(.+)$/);
          if (!m) return null;
          mime = m[1];
          buffer = Buffer.from(m[2], "base64");
        } else if (src.startsWith("/uploads/")) {
          // 本地上传文件：src 来自笔记 HTML（用户可控），必须防止路径穿越
          const remainder = src.slice("/uploads/".length);
          const filePath = resolve(UPLOADS_DIR, remainder);
          // 归一化后必须仍落在 public/uploads 内，否则拒绝（拦截 /uploads/../../.env 等）
          if (!filePath.startsWith(UPLOADS_DIR + sep)) return null;
          if (!existsSync(filePath)) return null;
          buffer = readFileSync(filePath);
          // 推测 mime
          const ext = filePath.split(".").pop()?.toLowerCase();
          const extMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
          mime = extMap[ext || ""] || "image/png";
        } else if (src.startsWith("http://") || src.startsWith("https://")) {
          // 外部 URL（简单跳过，可后续优化）
          return null;
        } else {
          return null;
        }

        // 获取图片尺寸（手动解析 PNG/JPEG header）
        let width = 400;
        let height = 300;
        try {
          const dims = getImageDimensions(buffer, mime);
          if (dims) {
            width = dims.width;
            height = dims.height;
          }
        } catch {
          width = 400;
          height = 300;
        }

        // 映射 mime 到 ImageRun 接受的 type 值
        const mimeToType: Record<string, string> = {
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/jpg": "jpg",
          "image/gif": "gif",
          "image/webp": "png", // WebP 降级
        };
        const imageType = mimeToType[mime] || "png";

        const result = { buffer, width, height, type: imageType };
        imageCache.set(src, result);
        return result;
      } catch {
        return null;
      }
    }

    /** 手动解析图片尺寸（PNG/JPEG/GIF/WebP），不依赖 image-size 包 */
    function getImageDimensions(buf: Buffer, mime: string): { width: number; height: number } | null {
      try {
        const type = mime.split("/")[1]?.toLowerCase() || "";
        if (type === "png" && buf.length >= 24) {
          // PNG: 前 8 字节签名 + IHDR chunk (4 len + 4 type + 4w + 4h)
          const width = buf.readUInt32BE(16);
          const height = buf.readUInt32BE(20);
          if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
        }
        if ((type === "jpeg" || type === "jpg") && buf.length >= 4) {
          // JPEG: 扫描 SOF marker (0xFF 0xC0/0xC1/0xC2)
          let offset = 2;
          while (offset < buf.length - 1) {
            if (buf[offset] !== 0xFF) { offset++; continue; }
            const marker = buf[offset + 1];
            if (marker === 0xD8) { offset += 2; continue; } // SOI
            if (marker === 0xD9) break; // EOI
            if (marker >= 0xC0 && marker <= 0xC3) {
              // SOF0-SOF3: 3 bytes precision+height+width
              const height = buf.readUInt16BE(offset + 5);
              const width = buf.readUInt16BE(offset + 7);
              if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
              break;
            }
            const len = buf.readUInt16BE(offset + 2);
            offset += 2 + len;
          }
        }
        if (type === "gif" && buf.length >= 10) {
          const width = buf.readUInt16LE(6);
          const height = buf.readUInt16LE(8);
          if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
        }
        if (type === "webp" && buf.length >= 30) {
          // WebP: 'VP8 ' or 'VP8L' or 'VP8X'
          const riffSize = buf.readUInt32LE(4);
          if (buf.slice(8, 12).toString() === "WEBP") {
            const chunkType = buf.slice(12, 16).toString();
            if (chunkType === "VP8 " && buf.length >= 30) {
              // VP8: 19 bytes header, then width/height in odd format
              const raw = buf.readUInt16LE(26);
              const width = raw & 0x3FFF;
              const height = (buf.readUInt16LE(28) & 0x3FFF);
              if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
            }
            if (chunkType === "VP8L" && buf.length >= 25) {
              const bits = buf.readUInt32LE(21);
              const width = (bits & 0x3FFF) + 1;
              const height = ((bits >> 14) & 0x3FFF) + 1;
              if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
            }
            if (chunkType === "VP8X" && buf.length >= 30) {
              const width = buf.readUIntLE(24, 3) + 1;
              const height = buf.readUIntLE(27, 3) + 1;
              if (width > 0 && height > 0 && width < 10000 && height < 10000) return { width, height };
            }
          }
        }
      } catch {}
      return null;
    }
    function htmlToDocxElements(htmlStr: string): any[] {
      const result: any[] = [];

      // 用正则分段：按块级标签分割
      const blockRegex = /<(\/?)(h[1-6]|p|blockquote|pre|hr|ul|ol|li|table|tr|td|th|div|br|hr)(\s[^>]*)?>/gi;
      const parts: { tag: string; isClosing: boolean; content: string }[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      // 手动分段解析
      // 先把 HTML 按标签拆成 token 流
      const tokens: { type: "tag" | "text" | "selfclose"; tag?: string; isClosing?: boolean; attrs?: string; content?: string }[] = [];
      const tokenRegex = /<(\/?)(\w+)([^>]*?)(\/?)>/g;
      let tm: RegExpExecArray | null;
      let ti = 0;
      while ((tm = tokenRegex.exec(htmlStr)) !== null) {
        if (tm.index > ti) {
          tokens.push({ type: "text", content: htmlStr.slice(ti, tm.index) });
        }
        const isClosing = tm[1] === "/";
        const tag = tm[2].toLowerCase();
        const attrs = tm[3];
        const isSelfClose = tm[4] === "/" || tag === "br" || tag === "hr" || tag === "img";
        if (isSelfClose) {
          tokens.push({ type: "selfclose", tag, attrs });
        } else if (isClosing) {
          tokens.push({ type: "tag", tag, isClosing: true });
        } else {
          tokens.push({ type: "tag", tag, isClosing: false, attrs });
        }
        ti = tm.index + tm[0].length;
      }
      if (ti < htmlStr.length) {
        tokens.push({ type: "text", content: htmlStr.slice(ti) });
      }

      // 构建 DOM 树（简化版）
      interface VNode {
        tag: string;
        attrs?: string;
        children: (VNode | string)[];
      }
      const root: VNode[] = [];
      const stack: (VNode | null)[] = [null];

      const blockTags = new Set(["h1","h2","h3","h4","h5","h6","p","blockquote","pre","ul","ol","li","table","tr","td","th","div","hr"]);
      const inlineTags = new Set(["strong","b","em","i","u","s","a","span","code","br","img","sub","sup"]);

      for (const tok of tokens) {
        if (tok.type === "text") {
          const parent = stack[stack.length - 1];
          if (parent && "children" in parent) {
            parent.children.push(tok.content || "");
          }
        } else if (tok.type === "selfclose") {
          const parent = stack[stack.length - 1];
          if (parent && "children" in parent) {
            parent.children.push({ tag: tok.tag!, attrs: tok.attrs, children: [] });
          } else {
            root.push({ tag: tok.tag!, attrs: tok.attrs, children: [] });
          }
        } else if (tok.type === "tag" && !tok.isClosing) {
          const node: VNode = { tag: tok.tag!, attrs: tok.attrs, children: [] };
          const parent = stack[stack.length - 1];
          if (parent && "children" in parent) {
            parent.children.push(node);
          } else {
            root.push(node);
          }
          if (!inlineTags.has(tok.tag!)) {
            stack.push(node);
          }
        } else if (tok.type === "tag" && tok.isClosing) {
          if (!inlineTags.has(tok.tag!)) {
            if (stack.length > 1) stack.pop();
          }
        }
      }

      // 渲染 VNode → docx paragraph
      function renderInline(node: VNode | string, runOptions?: any): (any | null)[] {
        if (typeof node === "string") {
          const text = node.replace(/\s+/g, " ").trim();
          if (!text) return [];
          return [new TextRun({ text, ...runOptions })];
        }
        if (node.tag === "br") return [new TextRun({ break: 1 })];
        if (node.tag === "img") {
          const srcMatch = node.attrs?.match(/src=["']([^"']+)["']/);
          const src = srcMatch ? srcMatch[1] : "";
          if (!src) return [];
          
          const img = resolveImage(src);
          if (!img) return [];

          const maxWidth = 500; // 最大显示宽度
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round(h * (maxWidth / w));
            w = maxWidth;
          }

          return [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [
                new ImageRun({
                  data: new Uint8Array(img.buffer),
                  transformation: { width: w, height: h },
                  type: img.type,
                }),
              ],
            }),
          ];
        }
        if (node.tag === "a") {
          const hrefMatch = node.attrs?.match(/href=["']([^"']+)["']/);
          const href = hrefMatch ? hrefMatch[1] : "";
          return node.children.flatMap(c => renderInline(c, { ...runOptions, link: href }));
        }
        if (["strong", "b"].includes(node.tag)) {
          return node.children.flatMap(c => renderInline(c, { ...runOptions, bold: true }));
        }
        if (["em", "i"].includes(node.tag)) {
          return node.children.flatMap(c => renderInline(c, { ...runOptions, italics: true }));
        }
        if (["u"].includes(node.tag)) {
          return node.children.flatMap(c => renderInline(c, { ...runOptions, underline: { type: "single" } }));
        }
        if (["s", "del"].includes(node.tag)) {
          return node.children.flatMap(c => renderInline(c, { ...runOptions, strike: true }));
        }
        if (node.tag === "code") {
          return node.children.flatMap(c => renderInline(c, { ...runOptions, font: "Consolas", size: 18 }));
        }
        if (node.tag === "span") {
          return node.children.flatMap(c => renderInline(c, runOptions));
        }
        // 内联标签 fallback
        return node.children.flatMap(c => renderInline(c, runOptions));
      }

      function inlineChildren(children: (VNode | string)[]): any[] {
        return children.flatMap(c => renderInline(c));
      }

      function renderBlock(node: VNode): any[] {
        const items: any[] = [];

        switch (node.tag) {
          case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
            const levelMap: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
            const level = levelMap[node.tag] || 1;
            const headingLevels = [undefined, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
            items.push(new Paragraph({
              heading: headingLevels[level],
              spacing: { before: level === 1 ? 300 : 200, after: 100 },
              children: inlineChildren(node.children),
            }));
            break;
          }
          case "p": {
            const children = inlineChildren(node.children);
            if (children.length > 0) {
              items.push(new Paragraph({ spacing: { after: 100 }, children }));
            }
            break;
          }
          case "blockquote": {
            items.push(new Paragraph({
              spacing: { before: 100, after: 100 },
              indent: { left: 800 },
              children: inlineChildren(node.children),
            }));
            break;
          }
          case "pre": {
            // 将 pre 内的文本作为一个代码段落
            let codeText = "";
            for (const c of node.children) {
              if (typeof c === "string") codeText += c;
              else if (c.tag === "code") {
                for (const cc of c.children) {
                  if (typeof cc === "string") codeText += cc;
                }
              }
            }
            const lines = codeText.split("\n");
            for (const line of lines) {
              items.push(new Paragraph({
                spacing: { before: 0, after: 0 },
                indent: { left: 400 },
                children: [new TextRun({ text: line, font: "Consolas", size: 18 })],
              }));
            }
            items.push(new Paragraph({ spacing: { after: 100 } }));
            break;
          }
          case "ul": {
            for (const child of node.children) {
              if (typeof child === "object" && child.tag === "li") {
                const text = child.children.flatMap(c => {
                  if (typeof c === "string") return [new TextRun({ text: c.replace(/\s+/g, " ").trim() })];
                  return renderInline(c);
                });
                items.push(new Paragraph({
                  spacing: { before: 20, after: 20 },
                  indent: { left: 600, hanging: 300 },
                  bullet: { level: 0 },
                  children: text,
                }));
              }
            }
            break;
          }
          case "ol": {
            let index = 1;
            for (const child of node.children) {
              if (typeof child === "object" && child.tag === "li") {
                const text = child.children.flatMap(c => {
                  if (typeof c === "string") return [new TextRun({ text: c.replace(/\s+/g, " ").trim() })];
                  return renderInline(c);
                });
                items.push(new Paragraph({
                  spacing: { before: 20, after: 20 },
                  indent: { left: 600, hanging: 300 },
                  numbering: { reference: "1", level: 0 },
                  children: [
                    new TextRun({ text: `${index}. ` }),
                    ...text,
                  ],
                }));
                index++;
              }
            }
            break;
          }
          case "hr": {
            items.push(new Paragraph({
              spacing: { before: 200, after: 200 },
              thematicBreak: true,
            }));
            break;
          }
          case "img": {
            const srcMatch = node.attrs?.match(/src=["']([^"']+)["']/);
            const src = srcMatch ? srcMatch[1] : "";
            if (src) {
              const img = resolveImage(src);
              if (img) {
                const maxWidth = 500;
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                  h = Math.round(h * (maxWidth / w));
                  w = maxWidth;
                }
                items.push(new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100, after: 100 },
                  children: [new ImageRun({
                    data: new Uint8Array(img.buffer),
                    transformation: { width: w, height: h },
                    type: img.type,
                  })],
                }));
              }
            }
            break;
          }
          default: {
            // div 或其他容器标签：递归子节点
            for (const child of node.children) {
              if (typeof child === "string") {
                const text = child.trim();
                if (text) {
                  items.push(new Paragraph({ children: [new TextRun({ text })] }));
                }
              } else {
                items.push(...renderBlock(child));
              }
            }
          }
        }
        return items;
      }

      for (const node of root) {
        result.push(...renderBlock(node));
      }

      return result;
    }

    const elements = htmlToDocxElements(html);
    paragraphs.push(...elements);

    // ── 构建 Document ───────────────────────────────
    const doc = new Document({
      title,
      styles: {
        default: {
          document: {
            run: {
              font: "Microsoft YaHei",
              size: 22, // 半磅值: 22 = 11pt
            },
            paragraph: {
              spacing: { after: 120 },
            },
          },
        },
      },
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buf = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.docx`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "导出失败";
    console.error("DOCX export error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
