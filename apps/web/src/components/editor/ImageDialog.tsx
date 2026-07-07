"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@ai-notes/ui-kit";

interface ImageDialogProps {
  editor: Editor;
  open: boolean;
  onClose: () => void;
}

type ImgTab = "upload" | "url";

export function ImageDialog({ editor, open, onClose }: ImageDialogProps) {
  const [tab, setTab] = useState<ImgTab>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTab("upload");
      setSelectedFile(null);
      setFilePreviewUrl("");
      setFileName("");
      setImgUrl("");
      setUploading(false);
    }
  }, [open]);

  // Drag-and-drop handlers for upload zone
  useEffect(() => {
    const dz = dropZoneRef.current;
    if (!dz || !open) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && files[0].type.startsWith("image/")) {
        handleFileSelect(files[0]);
      }
    };

    dz.addEventListener("dragover", handleDragOver);
    dz.addEventListener("dragleave", handleDragLeave);
    dz.addEventListener("drop", handleDrop);
    return () => {
      dz.removeEventListener("dragover", handleDragOver);
      dz.removeEventListener("dragleave", handleDragLeave);
      dz.removeEventListener("drop", handleDrop);
    };
  }, [open]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreviewUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFilePreviewUrl("");
    setImgUrl("");
    onClose();
  };

  const handleInsert = async () => {
    if (tab === "upload") {
      if (!selectedFile) return;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const resp = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "上传失败");
        }
        const data = await resp.json();
        editor.chain().focus().setImage({ src: data.url }).run();
        handleClose();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "上传失败";
        alert(`❌ 上传失败：${message}`);
      } finally {
        setUploading(false);
      }
    } else {
      // URL mode
      let url = imgUrl.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      editor.chain().focus().setImage({ src: url }).run();
      handleClose();
    }
  };

  if (!open) return null;

  const showUrlPreview =
    tab === "url" && imgUrl.trim() && /^https?:\/\//i.test(imgUrl.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            🖼️ 插入图片
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex border-b border-gray-200 dark:border-gray-600">
          <button
            onClick={() => setTab("upload")}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === "upload"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            本地上传
          </button>
          <button
            onClick={() => {
              setTab("url");
              setTimeout(
                () =>
                  document
                    .querySelector<HTMLInputElement>("#imgUrlInput")
                    ?.focus(),
                100
              );
            }}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === "url"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            网络地址
          </button>
        </div>

        {/* Upload panel */}
        {tab === "upload" && (
          <div>
            <div
              ref={dropZoneRef}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                dragOver
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/10"
                  : "border-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-500 dark:hover:bg-blue-900/10"
              )}
            >
              <svg
                className="mx-auto mb-2 h-10 w-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                点击选择图片或拖拽到此处
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                支持 JPG / PNG / GIF / WebP，最大 5MB
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {filePreviewUrl && (
              <div className="mt-3">
                <img
                  src={filePreviewUrl}
                  alt="预览"
                  className="max-h-32 rounded-lg border border-gray-200 object-contain dark:border-gray-600"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {fileName}
                </p>
              </div>
            )}
          </div>
        )}

        {/* URL panel */}
        {tab === "url" && (
          <div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                图片地址
              </label>
              <input
                id="imgUrlInput"
                type="url"
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInsert();
                  if (e.key === "Escape") handleClose();
                }}
                placeholder="https://example.com/image.png"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {showUrlPreview && (
              <div className="mt-3">
                <img
                  src={imgUrl.trim()}
                  alt="URL 预览"
                  className="max-h-32 rounded-lg border border-gray-200 object-contain dark:border-gray-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            取消
          </button>
          <button
            onClick={handleInsert}
            disabled={
              (tab === "upload" && (!selectedFile || uploading)) ||
              (tab === "url" && !imgUrl.trim())
            }
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white",
              (tab === "upload" && selectedFile && !uploading) ||
                (tab === "url" && imgUrl.trim())
                ? "bg-blue-500 hover:bg-blue-600"
                : "cursor-not-allowed bg-gray-300 dark:bg-gray-600"
            )}
          >
            {uploading ? "上传中..." : "插入"}
          </button>
        </div>
      </div>
    </div>
  );
}
