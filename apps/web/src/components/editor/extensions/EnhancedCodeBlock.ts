import CodeBlock from "@tiptap/extension-code-block";

/**
 * EnhancedCodeBlock — extends @tiptap/extension-code-block.
 * Uses static renderHTML (no ReactNodeView) to avoid wrapper artifact issues.
 * Copy button added via inline onclick + data-attr for self-contained interactivity.
 * Exit hint shown via CSS :hover on the wrapper.
 */
export const EnhancedCodeBlock = CodeBlock.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      language: null,
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        class:
          "not-prose relative my-3 [&_.cb-exit]:hidden [&:hover_.cb-exit]:block",
        "data-cb-wrapper": "",
      },
      [
        "pre",
        {
          ...HTMLAttributes,
          class:
            "relative overflow-x-auto rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 font-mono text-sm leading-tight dark:border-gray-600 dark:bg-gray-900/60",
          "data-code-block": "",
        },
        // Editable code content
        ["code", { "data-code-block-content": "" }, 0],
        // Copy button — inside pre, bottom-right
        [
          "button",
          {
            type: "button",
            "aria-label": "复制代码",
            class:
              "cb-copy absolute bottom-0.5 right-1.5 rounded px-2 py-0.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
            onclick:
              "void((function(b){var c=b.closest('[data-code-block]').querySelector('code');navigator.clipboard.writeText(c.textContent).then(function(){b.textContent='\\u2713';setTimeout(function(){b.textContent='\\u590d\\u5236'},2000)}).catch(function(){var t=document.createElement('textarea');t.value=c.textContent;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);b.textContent='\\u2713';setTimeout(function(){b.textContent='\\u590d\\u5236'},2000)})})(this))",
          },
          "复制",
        ],
      ],
      // Exit hint — below pre, initially hidden, shown when pre is focused
      [
        "div",
        {
          class:
            "cb-exit pointer-events-none absolute -bottom-5 right-1 rounded px-2 py-0.5 text-xs text-gray-400 dark:text-gray-500",
        },
        "Ctrl+Enter 退出",
      ],
    ];
  },
});
