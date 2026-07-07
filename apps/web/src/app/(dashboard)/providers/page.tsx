"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Settings, Server, Cpu, CheckCircle, XCircle, ChevronDown, Eye, EyeOff, Loader2, RefreshCw } from "@ai-notes/icons";
import { Button, Modal } from "@ai-notes/ui-kit";
import {
  type ProviderConfig,
  type PresetProvider,
  PRESET_PROVIDERS,
  getProviders,
  saveProviders,
  getPresetProvider,
  fetchModels,
  testConnection,
} from "@/lib/providers";

/* =========================== Provider Card =========================== */

function ProviderCard({
  provider,
  onEdit,
}: {
  provider: ProviderConfig;
  onEdit: () => void;
}) {
  const preset = getPresetProvider(provider.type);
  const displayName =
    provider.type === "custom" ? provider.name : preset?.name || provider.name;
  const hasModels = provider.models.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
            <Server size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {displayName}
            </h3>
            <p className="max-w-[200px] truncate text-xs text-gray-500 dark:text-gray-400">
              {provider.baseUrl || "未配置 API 地址"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${
              hasModels ? "bg-green-500" : "bg-gray-300"
            }`}
            title={hasModels ? "已配置" : "未配置模型"}
          />
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="编辑"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Models */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          已添加的模型
        </p>
        {hasModels ? (
          <div className="flex flex-wrap gap-1.5">
            {provider.models.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <Cpu size={12} />
                {m}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            暂未添加模型
          </p>
        )}
      </div>
    </div>
  );
}

/* ==================== 服务商选择下拉 ==================== */

function ProviderSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? (getPresetProvider(value)?.name || "自定义") : "选择服务商";
  const isPlaceholder = !value;

  const items = PRESET_PROVIDERS.map((p) => ({
    key: p.id,
    label: p.name,
    value: p.id,
  }));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${
          isPlaceholder ? "text-gray-400 dark:text-gray-500" : ""
        }`}
      >
        <span>{label}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                value === item.value
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ====================== Add Provider Dialog ====================== */

function AddProviderDialog({
  open,
  onClose,
  onSave,
  editProvider,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (p: ProviderConfig) => void;
  editProvider?: ProviderConfig | null;
}) {
  const [selectedPreset, setSelectedPreset] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelInput, setModelInput] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editProvider;
  const isCustom = selectedPreset === "custom";

  // Open/Edit init
  useEffect(() => {
    if (!open) return;
    if (editProvider) {
      const preset = getPresetProvider(editProvider.type);
      setSelectedPreset(editProvider.type);
      setName(editProvider.name);
      setBaseUrl(editProvider.baseUrl);
      setApiKey(editProvider.apiKey);
      setModels(editProvider.models);
    } else {
      setSelectedPreset("");
      setName("");
      setBaseUrl("");
      setApiKey("");
      setModels([]);
      setModelInput("");
      setFetchedModels([]);
      setTestResult(null);
      setShowApiKey(false);
      setShowModelDropdown(false);
    }
  }, [open, editProvider]);

  // 模型下拉点击外部关闭
  useEffect(() => {
    if (!showModelDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };
    // Use setTimeout to avoid the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showModelDropdown]);

  const handlePresetSelect = (value: string) => {
    setSelectedPreset(value);
    setTestResult(null);
    setFetchedModels([]);
    if (value !== "custom") {
      const preset = getPresetProvider(value);
      if (preset) setBaseUrl(preset.baseUrl);
      setName("");
    } else {
      setBaseUrl("");
    }
  };

  // 根据 selectedPreset 计算当前协议
  const currentProtocol = useMemo(() => {
    const preset = getPresetProvider(selectedPreset);
    return preset?.protocol || "OpenAI";
  }, [selectedPreset]);

  // 自动获取模型
  const handleFetchModels = async () => {
    if (!baseUrl || !apiKey) return;
    setFetching(true);
    try {
      const list = await fetchModels(baseUrl, apiKey, currentProtocol);
      setFetchedModels(list);
      setShowModelDropdown(true);
    } catch (err: any) {
      alert("获取模型失败: " + (err.message || "未知错误"));
    } finally {
      setFetching(false);
    }
  };

  const toggleModel = (m: string) => {
    setModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const addCustomModel = () => {
    const trimmed = modelInput.trim();
    if (trimmed && !models.includes(trimmed)) {
      setModels((prev) => [...prev, trimmed]);
      setModelInput("");
    }
  };

  // 连通测试
  const handleTestConnection = async () => {
    if (!baseUrl || !apiKey || models.length === 0) return;
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection(baseUrl, apiKey, models[0], currentProtocol);
    setTestResult(ok);
    setTesting(false);
  };

  const handleConfirm = () => {
    // 校验
    if (isCustom && !name.trim()) {
      alert("请输入服务商名称");
      return;
    }
    if (!baseUrl.trim()) {
      alert("请输入 API 地址");
      return;
    }
    if (!apiKey.trim()) {
      alert("请输入 API Key");
      return;
    }
    if (models.length === 0) {
      alert("请至少添加一个模型");
      return;
    }

    const provider: ProviderConfig = {
      id: editProvider?.id || crypto.randomUUID(),
      type: selectedPreset,
      name: isCustom
        ? name.trim()
        : getPresetProvider(selectedPreset)?.name || name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      protocol: currentProtocol,
      models,
    };
    onSave(provider);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "编辑服务商" : "添加服务商"}
    >
      <div className="space-y-4">
        {/* 服务商选择 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            服务商
          </label>
          <ProviderSelect value={selectedPreset} onChange={handlePresetSelect} />
        </div>

        {/* 自定义名称 */}
        {isCustom && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              服务商名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入服务商名称"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
        )}

        {/* Base URL */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={isCustom ? "https://your-api.com/v1" : "自动填充"}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              tabIndex={-1}
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* 模型选择 */}
        <div ref={modelDropdownRef}>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            模型
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                onFocus={() => {
                  if (fetchedModels.length > 0) setShowModelDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomModel();
                  }
                }}
                placeholder="输入模型名称，回车添加"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
              />
              {fetchedModels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400"
                  tabIndex={-1}
                >
                  <ChevronDown size={16} className={`transition-transform ${showModelDropdown ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={!baseUrl || !apiKey || fetching}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {fetching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              自动获取
            </button>
          </div>

          {/* 模型下拉列表（多选） */}
          {showModelDropdown && fetchedModels.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              {fetchedModels.map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    models.includes(m)
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={models.includes(m)}
                    onChange={() => toggleModel(m)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600"
                  />
                  {m}
                </label>
              ))}
            </div>
          )}
          {fetchedModels.length === 0 && !fetching && baseUrl && apiKey && modelInput === "" && (
            <p className="mt-1 text-xs text-gray-400">
              点击"自动获取"从 API 拉取模型列表
            </p>
          )}
        </div>

        {/* 连通测试结果 */}
        {testResult !== null && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              testResult
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {testResult ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span>{testResult ? "连通成功 ✓" : "连通失败 ✗"}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!baseUrl || !apiKey || models.length === 0 || testing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {testing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            连通测试
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* =========================== 页面主体 =========================== */

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderConfig | null>(null);

  useEffect(() => {
    setProviders(getProviders());
  }, []);

  const handleSave = (p: ProviderConfig) => {
    const updated = editing
      ? providers.map((x) => (x.id === p.id ? p : x))
      : [...providers, p];
    setProviders(updated);
    saveProviders(updated);
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (p: ProviderConfig) => {
    setEditing(p);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            模型配置
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            管理 AI 服务商和模型
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          <Plus size={16} />
          添加服务商
        </button>
      </div>

      {/* Cards */}
      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 dark:border-gray-700">
          <Server size={48} className="text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            暂无服务商配置
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            点击上方"添加服务商"开始配置
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onEdit={() => handleEdit(p)}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <AddProviderDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        editProvider={editing}
      />
    </div>
  );
}
