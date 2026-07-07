"use client";

import { useCallback, useState } from "react";
import { type Editor } from "@tiptap/react";
import { cn } from "@ai-notes/ui-kit";
import { LinkDialog } from "./LinkDialog";
import { ImageDialog } from "./ImageDialog";

interface EditorToolbarProps {
  editor: Editor | null;
}

type ToolbarAction = {
  label: string;
  action: () => void;
  isActive: () => boolean;
  shortcut?: string;
};

function ToolbarButton({
  action,
  active,
  disabled,
}: {
  action: ToolbarAction;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        action.action();
      }}
      disabled={disabled}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
        disabled && "cursor-not-allowed opacity-50"
      )}
      title={
        action.shortcut
          ? `${action.label} (${action.shortcut})`
          : action.label
      }
      aria-label={action.label}
      aria-pressed={active}
    >
      {action.label}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const handleLinkToggle = useCallback(() => {
    if (!editor) return;
    if (editor.isActive("link")) {
      // If already a link, open dialog to show/edit/remove
      setLinkDialogOpen(true);
      return;
    }
    // Check if there's selected text
    const { empty } = editor.state.selection;
    if (empty) {
      // No selection, just open dialog
      setLinkDialogOpen(true);
    } else {
      // Has selection, open dialog with selected text
      setLinkDialogOpen(true);
    }
  }, [editor]);

  const handleImageClick = useCallback(() => {
    if (!editor) return;
    setImageDialogOpen(true);
  }, [editor]);

  if (!editor) return null;

  const groups: ToolbarAction[][] = [
    // Heading group
    [
      {
        label: "H1",
        action: () =>
          editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive("heading", { level: 1 }),
        shortcut: "Ctrl+Alt+1",
      },
      {
        label: "H2",
        action: () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive("heading", { level: 2 }),
        shortcut: "Ctrl+Alt+2",
      },
      {
        label: "H3",
        action: () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive("heading", { level: 3 }),
        shortcut: "Ctrl+Alt+3",
      },
    ],
    // Inline formatting group
    [
      {
        label: "B",
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive("bold"),
        shortcut: "Ctrl+B",
      },
      {
        label: "I",
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive("italic"),
        shortcut: "Ctrl+I",
      },
      {
        label: "S",
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive("strike"),
        shortcut: "Ctrl+Shift+S",
      },
      {
        label: "Code",
        action: () => editor.chain().focus().toggleCode().run(),
        isActive: () => editor.isActive("code"),
        shortcut: "Ctrl+E",
      },
    ],
    // Link & Image
    [
      {
        label: "🔗",
        action: handleLinkToggle,
        isActive: () => editor.isActive("link"),
      },
      {
        label: "🖼",
        action: handleImageClick,
        isActive: () => false,
      },
    ],
    // Block formatting group
    [
      {
        label: "列表",
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive("bulletList"),
      },
      {
        label: "编号",
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive("orderedList"),
      },
      {
        label: "引用",
        action: () => editor.chain().focus().toggleBlockquote().run(),
        isActive: () => editor.isActive("blockquote"),
        shortcut: "Ctrl+Shift+B",
      },
      {
        label: "代码块",
        action: () => editor.chain().focus().toggleCodeBlock().run(),
        isActive: () => editor.isActive("codeBlock"),
      },
    ],
    // Undo / Redo
    [
      {
        label: "↩",
        action: () => editor.chain().focus().undo().run(),
        isActive: () => false,
        shortcut: "Ctrl+Z",
      },
      {
        label: "↪",
        action: () => editor.chain().focus().redo().run(),
        isActive: () => false,
        shortcut: "Ctrl+Shift+Z",
      },
    ],
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-3 py-2 dark:border-gray-700"
      role="toolbar"
      aria-label="文本编辑工具栏"
    >
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <Divider />}
          {group.map((action) => (
            <ToolbarButton
              key={action.label}
              action={action}
              active={action.isActive()}
            />
          ))}
        </div>
      ))}

      {/* Dialogs (rendered outside the toolbar flow) */}
      <LinkDialog
        editor={editor}
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
      />
      <ImageDialog
        editor={editor}
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
      />
    </div>
  );
}
