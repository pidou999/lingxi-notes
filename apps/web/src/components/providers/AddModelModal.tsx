"use client";

import { useState, useCallback } from "react";
import { Plus, Eye, EyeOff, Loader2, RefreshCw, Cpu } from "@ai-notes/icons";
import {
  saveProviders,
  getProviders,
  setSelectedModel,
  PRESET_PROVIDERS,
  type ProviderConfig,
  type PresetProvider,
  fetchModels,
  testConnection,
} from "@/lib/providers";

interface AddModelModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export function AddModelModal({ open, onClose, onAdded }: AddModelModalProps) {
  const [step, setStep] = useState<"provider" | "detail">("provider");
  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [modelInput, setModelInput] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setStep("provider");
    setSelectedPreset(null);
    setName("");
    setBaseUrl("");
    setApiKey("");
    setShowKey(false);
    setModelInput("");
    setEmbeddingModel("");
    setTesting(false);
    setTestResult(null);
    setFetchingModels(false);
    setFetchedModels([]);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectPreset = (preset: PresetProvider) => {
    setSelectedPreset(preset);
    if (preset.id !== "custom") {
      setName(preset.name);
      setBaseUrl(preset.baseUrl);
      // 自动填充推荐的 Embedding 模型
      if (preset.embeddingModel) {
        setEmbeddingModel(preset.embeddingModel);
      } else {
        setEmbeddingModel("");
      }
    } else {
      setName("");
      setBaseUrl("");
      setEmbeddingModel("");
    }
    setStep("detail");
  };

  const handleTest = async () => {
    if (!baseUrl || !apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await testConnection(
        baseUrl,
        apiKey,
        modelInput.split(",").map((s) => s.trim()).filter(Boolean)[0] || "test",
        selectedPreset?.protocol || "OpenAI"
      );
      setTestResult({ ok, msg: ok ? "连接成功" : "连接失败，请检查配置" });
    } catch {
      setTestResult({ ok: false, msg: "连接失败" });
    }
    setTesting(false);
  };

  const handleFetchModels = async () => {
    if (!baseUrl || !apiKey) return;
    setFetchingModels(true);
    try {
      const models = await fetchModels(baseUrl, apiKey, selectedPreset?.protocol || "OpenAI");
      setFetchedModels(models);
    } catch {
      setFetchedModels([]);
    }
    setFetchingModels(false);
  };

  const handleToggleFetchedModel = (m: string) => {
    setModelInput((prev) => {
      const current = prev.split(",").map((s) => s.trim()).filter(Boolean);
      if (current.includes(m)) {
        return current.filter((x) => x !== m).join(", ");
      }
      return prev ? `${prev}, ${m}` : m;
    });
  };

  const handleSave = () => {
    const models = modelInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!baseUrl || !apiKey || models.length === 0) return;

    const providers = getProviders();
    const newProvider: ProviderConfig = {
      id: crypto.randomUUID(),
      type: selectedPreset?.id || "custom",
      name: name || selectedPreset?.name || "自定义",
      baseUrl,
      apiKey,
      protocol: selectedPreset?.protocol || "OpenAI",
      models,
      embeddingModel: embeddingModel || undefined,
    };
    providers.push(newProvider);
    saveProviders(providers);
    setSelectedModel(`${newProvider.id}:${models[0]}`);
    window.dispatchEvent(new Event("providers-changed"));
    onAdded?.();
    handleClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">添加模型</h3>

        {step === "provider" ? (
          <>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">选择服务商</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p)}
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-600 dark:hover:bg-brand-900/20"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">服务商</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedPreset?.name || "自定义"}
                </span>
                <button
                  onClick={() => setStep("provider")}
                  className="text-xs text-brand-500 hover:text-brand-600"
                >
                  更换
                </button>
              </div>
            </div>

            {selectedPreset?.id === "custom" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="自定义服务商名称"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">API 地址</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">API Key</label>
              <div className="relative">
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-9 text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTest}
                disabled={testing || !baseUrl || !apiKey}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                测试连接
              </button>
              {testResult && (
                <span className={`text-xs ${testResult.ok ? "text-green-500" : "text-red-500"}`}>
                  {testResult.msg}
                </span>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">模型（逗号分隔多个）</label>
                <button
                  onClick={handleFetchModels}
                  disabled={fetchingModels || !baseUrl || !apiKey}
                  className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 disabled:opacity-40"
                >
                  {fetchingModels ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  自动获取
                </button>
              </div>
              <input
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="gpt-4o, gpt-3.5-turbo"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {fetchedModels.length > 0 && (
                <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                  {fetchedModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleToggleFetchedModel(m)}
                      className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 px-1.5 py-0.5 text-xs text-gray-600 hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-brand-600"
                    >
                      <Cpu size={10} />{m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Embedding 模型（可选，用于语义搜索）
              </label>
              <input
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                placeholder={selectedPreset?.embeddingModel || "留空自动推荐"}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {selectedPreset?.embeddingModel && !embeddingModel && (
                <p className="mt-1 text-xs text-gray-400">
                  推荐：{selectedPreset.embeddingModel}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!baseUrl || !apiKey || !modelInput.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
