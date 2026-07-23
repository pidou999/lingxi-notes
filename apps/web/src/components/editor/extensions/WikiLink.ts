/**
 * TipTap WikiLink 扩展（简化版）
 *
 * 不使用 Node.create（避免 @tiptap/core 版本冲突），
 * 仅注册 ProseMirror 插件来处理 [[wikilink]] 输入。
 *
 * 实际的 wikilink 渲染和解析在 wikilinks.ts 中完成：
 * - 保存时：wikilinks.ts 的 parseWikiLinksFromHtml 从 HTML 中提取链接关系
 * - 显示时：wikilinks.ts 的 wikiLinksToHtml 将 [[title]] 转为 <a data-wikilink> 链接
 * - 图谱数据：wikilinks.ts 的 buildGraphData 构建节点和边
 */
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { searchNotesForWiki } from "@/lib/wikilinks";

export const wikiLinkPluginKey = new PluginKey("wikiLinkInput");

/**
 * 创建 wikilink 输入插件
 * 监听 ]] 输入，将 [[title]] 替换为 wikilink 节点
 */
export function createWikiLinkPlugin() {
  return new Plugin({
    key: wikiLinkPluginKey,
    props: {
      handleTextInput(view, from, to, text) {
        if (text !== "]") return false;

        const state = view.state;
        const textBefore = state.doc.textBetween(
          Math.max(0, from - 100),
          from,
          "\n"
        );

        // 匹配 [[xxx 模式（用户正在输入第二个 ]）
        const wikiMatch = textBefore.match(/\[\[([^\[\]]+)$/);
        if (!wikiMatch) return false;

        const title = wikiMatch[1].trim();
        if (!title) return false;

        // 查找笔记
        const results = searchNotesForWiki(title);
        if (results.length === 0) return false;

        const note = results[0];

        // 计算要替换的范围
        const start = from - title.length - 2; // -2 for [[
        
        // 创建 wikilink 节点
        const schema = view.state.schema;
        const linkNode = schema.text(note.title, [
          schema.marks.link?.create({
            href: `/edit?id=${note.id}`,
            "data-wikilink": note.id,
            class: "wikilink",
          }) || schema.marks.bold?.create() || [],
        ].filter(Boolean));

        const tr = state.tr.replaceWith(start, to, linkNode);
        view.dispatch(tr);
        return true;
      },
    },
  });
}
