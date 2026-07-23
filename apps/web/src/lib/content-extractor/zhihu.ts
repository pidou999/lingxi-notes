/**
 * 知乎专用清理模块
 *
 * 包括：
 * - removeZhihuEmbeddedNoise：在正文容器内按文本模式移除热搜/推荐/广告节点
 * - postProcessZhihuText：纯文本后处理（广告块、UI文案、发布元信息等）
 * - postProcessZhihuHtml：HTML后处理（保留标签结构，移除广告噪音）
 */

// ====== 广告/品牌关键词库 ======

const AD_KEYWORDS = [
  '志凌海纳',
  'SmartX',
  '超融合',
  'Hyper-converged',
  'Hyper converged',
  'HCI',
  'Gartner',
  'IDC',
  '市场季度跟踪报告',
  '全栈超融合软件',
  '分析机构都在强调',
  '字节自研大模型',
  '豆包大模型',
  '豆包-',
  '豆包',
  '火山引擎',
  '特惠来袭',
  '特惠',
  'tokens使用量',
  '日均tokens',
  '新用户仅需',
  '即享约',
  '万tokens',
  '多模态理解能力',
  'GUI操作能力',
  '一站式大模型',
  '大模型平台',
  '穿透内网',
  '麻辣麻辣',
  '100+热议',
  '100+种草',
  '100+热',
  '100+赞',
  '云一哥',
  '爱说实话的云一哥',
  '智能体 AI 指南',
  '智能体 AI',
  'AI 指南',
  'AI 助手',
  '扣子',
  'Coze',
  'Kimi',
  '通义',
  '文心',
  '智谱',
  '月之暗面',
  'MiniMax',
  '百川',
  '阶跃',
  '零一万物',
];

const AD_BRAND_IMG_KEYWORDS = [
  '志凌海纳',
  'smartx',
  'hci',
  'hyper-converged',
  'hyperconverged',
  'gartner',
  'idc',
  '火山引擎',
  '豆包',
  '字节跳动',
  'bytedance',
  'volcano',
  'sensenova',
  'doubao',
  'toutiao',
  '扣子',
  'coze',
  'kimi',
  '通义',
  '文心',
  '智谱',
  'minimax',
  '百川',
  '阶跃',
  '零一万物',
];

const adKeywordRe = new RegExp(
  AD_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);
const adImgKeywordRe = new RegExp(
  AD_BRAND_IMG_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);

// ====== 后处理函数 ======

/**
 * 知乎纯文本后处理：清理广告块、发布元信息、操作按钮文案等。
 */
export function postProcessZhihuText(text: string): string {
  return (
    text
      .replace(/^本文由 .* 多平台发布.*$/gm, '')
      .replace(/^发布于 \d{4}[-\/]\d{1,2}[-\/]\d{1,2}\s*\d{0,2}[:\d]*\s*·.*$/gm, '')
      .replace(/^编辑于 .*$/gm, '')
      .replace(/^著作权归作者所有.*$/gm, '')
      .replace(/^\s*(?:广告|推广|品牌推广|赞助内容|商业合作|包含广告|以上内容包含广告|该内容包含商业合作信息)\s*$/gim, '')
      .replace(/^豆包.*$/gm, '')
      .replace(/^(?:字节自研大模型|豆包|特惠来袭|火山引擎|100\+热议|云一哥|麻辣麻辣|100\+种草|穿透内网|志凌海纳|SmartX|超融合|Hyper-converged|Gartner|IDC|全栈超融合软件|分析机构都在强调)[\s\S]*?(?=\n\n|(?![\s\S]))/gm, '')
      .replace(/^.*(?:字节自研大模型|豆包大模型|火山引擎|特惠来袭|tokens使用量|日均tokens|新用户仅需|即享约|万tokens|多模态理解能力|GUI操作能力|一站式大模型|大模型平台|志凌海纳|SmartX|超融合|Hyper-converged|Gartner|IDC|市场季度跟踪报告|全栈超融合软件|分析机构都在强调).*$/gim, '')
      .replace(/^\s*(?:大家都在搜|大家都在看|大家都在读|大家都在问|的都在搜|的都在看|换一换|发现更多|探索更多|继续阅读|展开更多|相关推荐|推荐阅读|为你推荐|精选推荐|猜你想搜|猜你喜欢|更多内容|热门内容|热门回答|相似问题|相关问题|更多回答|延伸阅读|相关文章|相关阅读|了解更多|查看详情|打开App|App 内打开|在 App 中打开|本文收录于|赞助内容|品牌推广|商业合作|以上内容包含广告|该内容包含商业合作信息|创作声明|包含 AI 辅助创作|穿透内网)\s*$/gim, '')
      .replace(/^\s*\S.{0,80}?\s+\d+(?:\.\d+)?(?:亿\d+)?\s*万(?:热|赞|关注|评论|热度)?\s*$/gim, '')
      .replace(/^\s*\S.{0,60}?\d+\s*万(?:热|赞|关注|评论|热度)?\s*$/gim, '')
      .replace(/^\s*\S.{0,80}?(?:热|赞|关注|评论|热度)\s*$/gim, '')
      .replace(/^.*赞赏.*支持.*$/gm, '')
      .replace(/^.*打赏.*$/gm, '')
      .replace(/^\s*(?:\d+(?:\.\d+)?\s*[万亿kK]?\s*)?(?:赞同|喜欢|收藏|分享|添加评论)\s*$/gim, '')
      .replace(/^\s*(?:赞同|喜欢|收藏|分享|添加评论)\s*(?:\d+(?:\.\d+)?\s*[万亿kK]?)?\s*$/gim, '')
      .replace(/^\s*\[[^\]]+\]\(https?:\/\/zhuanlan\.zhihu\.com\/p\/\S+\)\s*$/gm, '')
      .replace(/^\s*(?:展开阅读全文|阅读全文|继续浏览内容|发现更多|下载知乎客户端|与世界分享知识、经验和见解)\s*$/gm, '')
      .replace(/^\s*查看全部\s*\d+\s*条?回?答?\s*$/gm, '')
      .replace(/^\s*(?:编辑于|发布于)\s*.*$/gm, '')
      .replace(/^\s*\d+\s*人?赞同了(?:该回答|该文章)\s*$/gm, '')
      .replace(/^\s*(?:关注问题|写回答|邀请回答|好问题|添加评论|分享|举报)\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * 知乎 HTML 后处理：在保留标签结构的前提下，移除广告块与常见噪音节点。
 */
export function postProcessZhihuHtml(html: string): string {
  let cleaned = html
    .replace(/^(?:字节自研大模型|豆包|特惠来袭|火山引擎|100\+热议|云一哥|麻辣麻辣|100\+种草|穿透内网|志凌海纳|SmartX|超融合|Hyper-converged|Gartner|IDC|全栈超融合软件|分析机构都在强调)[\s\S]*?(?=\n\n|(?![\s\S]))/gm, '')
    .replace(/豆包-.*?智能模型/g, '')
    .replace(/的广告/g, '')
    .replace(/<[^>]+>\s*[^<]*(?:字节自研大模型|豆包大模型|火山引擎|特惠来袭|tokens使用量|日均tokens|新用户仅需|即享约|万tokens|多模态理解能力|GUI操作能力|一站式大模型|大模型平台|志凌海纳|SmartX|超融合|Hyper-converged|Gartner|IDC|市场季度跟踪报告|全栈超融合软件|分析机构都在强调)[^<]*<\/[^>]+>/gi, '')
    .replace(/(<[^>]*>\s*)(?:大家都在搜|大家都在看|大家都在读|大家都在问|的都在搜|的都在看|换一换|发现更多|探索更多|继续阅读|展开更多|相关推荐|推荐阅读|为你推荐|精选推荐|猜你想搜|猜你喜欢|更多内容|热门内容|热门回答|相似问题|相关问题|更多回答|延伸阅读|相关文章|相关阅读|了解更多|查看详情|打开App|App 内打开|在 App 中打开|本文收录于|赞助内容|品牌推广|商业合作|以上内容包含广告|该内容包含商业合作信息|创作声明|包含 AI 辅助创作|穿透内网)(\s*<\/[^>]*>)/gi, '$1$2')
    .replace(/<[^>]+>\s*\S.{0,80}?\s+\d+(?:\.\d+)?(?:亿\d+)?\s*万(?:热|赞|关注|评论|热度)?\s*<\/[^>]+>/gi, '')
    .replace(/<[^>]+>\s*\S.{0,60}?\d+\s*万(?:热|赞|关注|评论|热度)?\s*<\/[^>]+>/gi, '')
    .replace(/<[^>]+>\s*\S.{0,80}?(?:热|赞|关注|评论|热度)\s*<\/[^>]+>/gi, '')
    .trim();

  const uiTexts = ['赞同', '喜欢', '收藏', '分享', '添加评论'];
  for (const t of uiTexts) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numberPart = '(?:\\d+(?:\\.\\d+)?\\s*[万亿kK]?)';
    const re = new RegExp(
      `((?:^|>)[\\s]*)(?:${numberPart}\\s*)?(${escaped})(?:\\s*${numberPart})?([\\s]*(?:<|$))`,
      'g'
    );
    cleaned = cleaned.replace(re, '$1$3');
  }

  return cleaned;
}

/**
 * 知乎嵌入正文内的噪音节点清理（基于文本模式，而非 class 选择器）。
 *
 * 在正文容器内按文本模式二次过滤，移除热搜/推荐/广告节点。
 * 只处理叶子/近叶子节点，避免误伤正文段落。
 */
export function removeZhihuEmbeddedNoise($: any, $content: any): void {
  // 1. 清理叶子/近叶子节点的文本模式（热搜条目、模块标题、广告标记、品牌广告）
  $content.find('a, p, div, span, li, section, h3, h4, h5, h6, figure, figcaption').each((_: number, el: any) => {
    const $el = $(el);
    const text = $el.text().trim();

    const children = $el.children();
    const isLeaf = children.length === 0;
    const isSingleInline =
      children.length === 1 &&
      ['span', 'a', 'b', 'strong', 'i', 'em', 'img'].includes(
        children.first().prop('tagName')?.toLowerCase()
      );
    if (!isLeaf && !isSingleInline) return;
    if (!text) return;

    // 热搜条目：数字 + 万热/万赞/万关注等
    if (
      /^\s*\S.{0,80}?\s+\d+(?:\.\d+)?(?:亿\d+)?\s*万(?:热|赞|关注|评论|热度)?\s*$/i.test(text)
    ) {
      $el.remove();
      return;
    }
    if (/^\s*\S.{0,60}?\d+\s*万(?:热|赞|关注|评论|热度)?\s*$/i.test(text)) {
      $el.remove();
      return;
    }

    // 热搜条目：短文本以"热/赞/关注/评论/热度"结尾
    const tagName = (el.tagName || '').toLowerCase();
    if (
      ['a', 'li'].includes(tagName) &&
      /^\s*\S.{0,80}?(?:热|赞|关注|评论|热度)\s*$/i.test(text)
    ) {
      $el.remove();
      return;
    }

    // 模块标题
    if (
      /^\s*(?:大家都在搜|大家都在看|大家都在读|大家都在问|的都在搜|的都在看|换一换|发现更多|探索更多|继续阅读|展开更多|相关推荐|推荐阅读|为你推荐|精选推荐|猜你想搜|猜你喜欢|更多内容|热门内容|热门回答|相似问题|相关问题|更多回答|推荐阅读卡片|延伸阅读|相关文章|相关阅读|了解更多|查看详情|打开App|App 内打开|在 App 中打开|本文收录于|赞助内容|品牌推广|商业合作|以上内容包含广告|该内容包含商业合作信息|创作声明|包含 AI 辅助创作|穿透内网)\s*$/i.test(text)
    ) {
      $el.remove();
      return;
    }

    // 热搜条目：长度 5~40，无句号/感叹号等正文章节特征
    if (
      text.length >= 5 &&
      text.length <= 40 &&
      !/[。！？.!?；;…]/.test(text) &&
      !/发布于/.test(text)
    ) {
      const sentenceCount = (text.match(/[。！？.!?]/g) || []).length;
      if (sentenceCount === 0) {
        $el.remove();
        return;
      }
    }

    // 100+热议 / 100+种草 等短噪声标记
    if (/^\s*100\s*\+\s*(?:热议|种草|热|赞)\s*$/i.test(text)) {
      $el.remove();
      return;
    }

    // 知乎 UI 操作按钮文案
    if (
      /^\s*(?:\d+(?:\.\d+)?\s*[万亿kK]?)\s*(?:赞同|喜欢|收藏|分享|添加评论)\s*$/i.test(text) ||
      /^\s*(?:赞同|喜欢|收藏|分享|添加评论)\s*(?:\d+(?:\.\d+)?\s*[万亿kK]?)?\s*$/i.test(text)
    ) {
      $el.remove();
      return;
    }

    // 广告/推广标记
    if (
      /^\s*(?:广告|推广|sponsored|ad|品牌推广|赞助内容|商业合作|包含广告|以上内容包含广告|该内容包含商业合作信息)\s*$/i.test(text)
    ) {
      $el.remove();
      return;
    }

    // 命中广告/品牌关键词
    if (adKeywordRe.test(text)) {
      $el.remove();
      return;
    }

    // 纯短推荐链接
    const href = $el.attr('href') || '';
    if (isLeaf && text.length < 20 && href.includes('zhihu.com') && /^[^\n]+$/.test(text)) {
      $el.remove();
      return;
    }
  });

  // 2. 清理广告品牌图片
  $content.find('img').each((_: number, el: any) => {
    const $el = $(el);
    const alt = ($el.attr('alt') || '').toLowerCase();
    const title = ($el.attr('title') || '').toLowerCase();
    const src = ($el.attr('src') || '').toLowerCase();
    if (adImgKeywordRe.test(alt) || adImgKeywordRe.test(title) || adImgKeywordRe.test(src)) {
      $el.remove();
    }
  });

  // 3. 清理包含广告/热搜短噪声标记的父块
  const noiseBlockRe = /(?:100\s*\+\s*(?:热议|种草|热|赞)|\d+\s*万(?:热|赞|关注|评论|热度)?)/;
  $content.find('div, section, p, li, figure, h3, h4, h5, h6').each((_: number, el: any) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (text.length < 120 && noiseBlockRe.test(text)) {
      $el.remove();
    }
  });

  // 4. 移除广告关键词父块
  $content.find('div, section, p, figure, li').each((_: number, el: any) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (text.length < 160 && adKeywordRe.test(text)) {
      $el.remove();
    }
  });

  // 5. 清理因移除子节点而变空的容器
  function isEffectivelyEmpty($node: any): boolean {
    const text = $node.text().trim();
    if (text) return false;
    const children = $node.children();
    if (children.length === 0) return true;
    let onlyBr = true;
    children.each((__: number, c: any) => {
      const tag = ($(c).prop('tagName') || '').toLowerCase();
      if (tag !== 'br') onlyBr = false;
    });
    return onlyBr;
  }
  $content.find('div, section, figure, li, h3, h4, h5, h6').each((_: number, el: any) => {
    const $el = $(el);
    if (isEffectivelyEmpty($el)) {
      $el.remove();
    }
  });
}
