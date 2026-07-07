"use client";

import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent, type EditorOptions } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { EditorToolbar } from "./EditorToolbar";
import { EnhancedCodeBlock } from "./extensions/EnhancedCodeBlock";
import { cn } from "@ai-notes/ui-kit";

export interface TipTapEditorProps {
  content?: string;
  contentJson?: Record<string, unknown>;
  onChange?: (html: string, json: Record<string, unknown>) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  editorClassName?: string;
  autoSaveDelay?: number;
  onAutoSave?: (html: string, json: Record<string, unknown>) => void;
}

export interface TipTapEditorHandle {
  /** 在编辑器末尾追加 HTML 内容 */
  appendHtml: (html: string) => void;
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(function TipTapEditor(
  { content = "", contentJson, onChange, placeholder = "开始写作...", editable = true, className, editorClassName, autoSaveDelay = 2000, onAutoSave }: TipTapEditorProps,
  ref
) {
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalChange = useRef(false);

  const editorOptions: Partial<EditorOptions> = {
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
      }),
      EnhancedCodeBlock,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class:
            "text-brand-600 underline underline-offset-2 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg my-2",
        },
        allowBase64: true,
      }),
    ],
    content: contentJson || content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-gray dark:prose-invert max-w-none focus:outline-none min-h-full px-6 py-4",
          editorClassName
        ),
        "aria-label": "文本编辑器",
        "data-placeholder": placeholder,
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const hasFiles = event.dataTransfer?.files?.length;
          if (!hasFiles) return false;

          // Check if any dropped file is an image
          for (let i = 0; i < event.dataTransfer!.files.length; i++) {
            const file = event.dataTransfer!.files[i];
            if (file.type.startsWith("image/")) {
              event.preventDefault();

              // Upload the image
              const formData = new FormData();
              formData.append("file", file);

              fetch("/api/upload/image", {
                method: "POST",
                body: formData,
              })
                .then((r) => r.json())
                .then((data) => {
                  const { schema } = view.state;
                  const node = schema.nodes.image.create({
                    src: data.url,
                  });
                  const tr = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(tr);
                })
                .catch(() => {
                  // Silently fail
                });

              return true;
            }
          }
          return false;
        },
        paste: (view, event) => {
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
              event.preventDefault();

              const file = item.getAsFile();
              if (!file) return true;

              const formData = new FormData();
              formData.append("file", file);

              fetch("/api/upload/image", {
                method: "POST",
                body: formData,
              })
                .then((r) => r.json())
                .then((data) => {
                  const { schema } = view.state;
                  const node = schema.nodes.image.create({
                    src: data.url,
                  });
                  const tr = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(tr);
                })
                .catch(() => {});

              return true;
            }
          }
          return false;
        },
      },
      handleKeyDown: (view, event) => {
        // Handle Enter key for blockquote exit
        if (event.key === "Enter" && !event.shiftKey) {
          const { $anchor } = view.state.selection;
          const parent = $anchor.parent;

          if (parent.type.name === "paragraph") {
            // Walk up ancestors to find blockquote at any nesting depth
            for (let d = $anchor.depth; d >= 0; d--) {
              if ($anchor.node(d).type.name === "blockquote") {
                const isEmpty = parent.textContent === "";
                const isLastPara = $anchor.index(d) >= $anchor.node(d).childCount - 1;
                const isAtEnd = $anchor.parentOffset >= parent.content.size;

                // Exit blockquote when:
                // 1) paragraph is empty, OR
                // 2) cursor is at end of the last paragraph inside blockquote
                if (isEmpty || (isLastPara && isAtEnd)) {
                  event.preventDefault();
                  const after = $anchor.after(d);
                  const tr = view.state.tr;
                  tr.insert(after, view.state.schema.nodes.paragraph.create());
                  tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)));
                  tr.scrollIntoView();
                  view.dispatch(tr);
                  return true;
                }
              }
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON() as Record<string, unknown>;

      if (isInternalChange.current) return;

      onChange?.(html, json);

      if (onAutoSave) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
          onAutoSave(html, json);
        }, autoSaveDelay);
      }
    },
  };

  const editor = useEditor(editorOptions);

  useEffect(() => {
    if (editor && contentJson && !editor.isDestroyed) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(contentJson);
      if (currentJson !== newJson) {
        isInternalChange.current = true;
        editor.commands.setContent(contentJson);
        isInternalChange.current = false;
      }
    }
  }, [editor, contentJson]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Expose editor methods via ref
  useImperativeHandle(
    ref,
    () => ({
      appendHtml(html: string) {
        if (editor && !editor.isDestroyed) {
          editor.commands.focus();
          // Insert at end of document
          const pos = editor.state.doc.content.size;
          editor.commands.insertContentAt(pos, html);
          // Trigger auto-save
          if (onAutoSave) {
            onAutoSave(editor.getHTML(), editor.getJSON() as Record<string, unknown>);
          }
        }
      },
    }),
    [editor, onAutoSave]
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
        className
      )}
    >
      <EditorToolbar editor={editor} />
      <div className="overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
