import { useEffect, useState, Suspense } from "react";
import { Check, ExternalLink, Loader2, Sparkles, AlertCircle, Plus, X, Server, Trash2 } from "lucide-react";
import { useTranslations } from "@/i18n/compat/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DeepSeekLogo from "@/components/ai/icon/IconDeepseek";
import IconDoubao from "@/components/ai/icon/IconDoubao";
import IconZhipu from "@/components/ai/icon/IconZhipu";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import { cn } from "@/lib/utils";
import IconOpenAi from "@/components/ai/icon/IconOpenAi";
import { toast } from "sonner";
import { isTauri, directTestConnection } from "@/utils/aiDirectClient";
import { isCustomProvider, type CustomProvider } from "@/config/ai";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

// ─── Custom Provider Editor ────────────────────────────────────────

function CustomProviderEditor({
  provider,
  onUpdate,
  onDelete,
  connectionStatus,
  connectionError,
  onTestConnection,
}: {
  provider: CustomProvider;
  onUpdate: (id: string, updates: Partial<Omit<CustomProvider, "id">>) => void;
  onDelete: (id: string) => void;
  connectionStatus: ConnectionStatus;
  connectionError: string;
  onTestConnection: () => void;
}) {
  const [newModelInput, setNewModelInput] = useState("");
  const t = useTranslations();

  const addModel = () => {
    const model = newModelInput.trim();
    if (model && !provider.models.includes(model)) {
      const newModels = [...provider.models, model];
      onUpdate(provider.id, {
        models: newModels,
        selectedModel: provider.selectedModel || model,
      });
      setNewModelInput("");
    }
  };

  const removeModel = (model: string) => {
    const newModels = provider.models.filter((m) => m !== model);
    onUpdate(provider.id, {
      models: newModels,
      selectedModel:
        provider.selectedModel === model
          ? newModels[0] || ""
          : provider.selectedModel,
    });
  };

  const inputClass = cn(
    "h-11",
    "bg-white dark:bg-gray-900",
    "border-gray-200 dark:border-gray-800",
    "focus:ring-2 focus:ring-primary/20"
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Server className="h-6 w-6 text-orange-500" />
          {provider.name || "自定义服务"}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(provider.id)}
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          删除
        </Button>
      </div>

      <div className="space-y-6">
        {/* Service Name */}
        <div className="space-y-2">
          <Label className="text-base font-medium">服务名称</Label>
          <Input
            value={provider.name}
            onChange={(e) => onUpdate(provider.id, { name: e.target.value })}
            placeholder="例如：七牛云 (Qiniu)"
            className={inputClass}
          />
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label className="text-base font-medium">API Key</Label>
          <Input
            value={provider.apiKey}
            onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
            type="password"
            placeholder="输入 API Key"
            className={inputClass}
          />
        </div>

        {/* API Endpoint */}
        <div className="space-y-2">
          <Label className="text-base font-medium">API 地址</Label>
          <Input
            value={provider.apiEndpoint}
            onChange={(e) =>
              onUpdate(provider.id, { apiEndpoint: e.target.value })
            }
            placeholder="例如：https://api.qnaigc.com/v1"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">
            OpenAI 兼容接口地址，会自动拼接 /chat/completions
          </p>
        </div>

        {/* Models */}
        <div className="space-y-2">
          <Label className="text-base font-medium">模型</Label>
          <div className="flex flex-wrap gap-2">
            {provider.models.map((model) => (
              <span
                key={model}
                onClick={() =>
                  onUpdate(provider.id, { selectedModel: model })
                }
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all",
                  model === provider.selectedModel
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                {model}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeModel(model);
                  }}
                  className="ml-0.5 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addModel();
                  }
                }}
                placeholder="输入模型 ID"
                className="h-8 w-40 text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={addModel}
                disabled={!newModelInput.trim()}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {provider.selectedModel && (
            <p className="text-xs text-muted-foreground">
              当前使用：<span className="font-medium text-primary">{provider.selectedModel}</span>（点击模型标签切换）
            </p>
          )}
        </div>

        {/* Test Connection */}
        <div className="pt-4">
          <Button
            onClick={onTestConnection}
            disabled={
              connectionStatus === "testing" ||
              !(provider.apiKey && provider.selectedModel && provider.apiEndpoint)
            }
            variant="outline"
            className={cn(
              "w-full h-11",
              connectionStatus === "success" &&
                "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950",
              connectionStatus === "error" &&
                "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            )}
          >
            {connectionStatus === "testing" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("dashboard.settings.ai.testConnection.testing")}
              </>
            ) : connectionStatus === "success" ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t("dashboard.settings.ai.testConnection.success")}
              </>
            ) : connectionStatus === "error" ? (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("dashboard.settings.ai.testConnection.failed")}
              </>
            ) : (
              t("dashboard.settings.ai.testConnection.button")
            )}
          </Button>
          {connectionError && (
            <p className="text-xs text-red-500 mt-2">{connectionError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

const AISettingsContent = () => {
  const {
    requireGeminiConfig,
    setRequireGeminiConfig,
    doubaoApiKey,
    doubaoModelId,
    deepseekApiKey,
    openaiApiKey,
    openaiModelId,
    openaiApiEndpoint,
    geminiApiKey,
    geminiModelId,
    zhipuApiKey,
    zhipuModelId,
    setDoubaoApiKey,
    setDoubaoModelId,
    setDeepseekApiKey,
    setOpenaiApiKey,
    setOpenaiModelId,
    setOpenaiApiEndpoint,
    setGeminiApiKey,
    setGeminiModelId,
    setZhipuApiKey,
    setZhipuModelId,
    selectedModel,
    setSelectedModel,
    customProviders,
    addCustomProvider,
    updateCustomProvider,
    removeCustomProvider,
  } = useAIConfigStore();
  const [currentModel, setCurrentModel] = useState(selectedModel);
  const [connectionStatus, setConnectionStatus] = useState<
    Record<string, ConnectionStatus>
  >({});
  const [connectionError, setConnectionError] = useState<
    Record<string, string>
  >({});

  const t = useTranslations();

  useEffect(() => {
    setCurrentModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (requireGeminiConfig) {
      setCurrentModel("gemini");
      setRequireGeminiConfig(false);
    }
  }, [requireGeminiConfig, setRequireGeminiConfig]);

  const handleApiKeyChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "doubao" | "deepseek" | "openai" | "gemini" | "zhipu"
  ) => {
    const newApiKey = e.target.value;
    if (type === "doubao") setDoubaoApiKey(newApiKey);
    else if (type === "deepseek") setDeepseekApiKey(newApiKey);
    else if (type === "gemini") setGeminiApiKey(newApiKey);
    else if (type === "zhipu") setZhipuApiKey(newApiKey);
    else setOpenaiApiKey(newApiKey);
  };

  const handleModelIdChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "doubao" | "openai" | "gemini" | "zhipu"
  ) => {
    const newModelId = e.target.value;
    if (type === "doubao") setDoubaoModelId(newModelId);
    else if (type === "openai") setOpenaiModelId(newModelId);
    else if (type === "gemini") setGeminiModelId(newModelId);
    else if (type === "zhipu") setZhipuModelId(newModelId);
  };

  const handleTestConnection = async (modelType: string) => {
    setConnectionStatus((prev) => ({ ...prev, [modelType]: "testing" }));
    setConnectionError((prev) => ({ ...prev, [modelType]: "" }));

    let requestBody: Record<string, unknown>;

    if (isCustomProvider(modelType)) {
      const provider = customProviders.find((p) => p.id === modelType);
      if (!provider) return;
      requestBody = {
        modelType: "openai",
        apiKey: provider.apiKey,
        modelId: provider.selectedModel,
        apiEndpoint: provider.apiEndpoint,
      };
    } else {
      requestBody = {
        modelType,
        apiKey:
          modelType === "doubao"
            ? doubaoApiKey
            : modelType === "openai"
              ? openaiApiKey
              : modelType === "gemini"
                ? geminiApiKey
                : modelType === "zhipu"
                  ? zhipuApiKey
                  : deepseekApiKey,
      };
      if (modelType === "doubao") requestBody.modelId = doubaoModelId;
      else if (modelType === "openai") {
        requestBody.modelId = openaiModelId;
        requestBody.apiEndpoint = openaiApiEndpoint;
      } else if (modelType === "gemini") requestBody.modelId = geminiModelId;
      else if (modelType === "zhipu") requestBody.modelId = zhipuModelId;
    }

    try {
      let data: { success: boolean; error?: string };

      if (isTauri) {
        data = await directTestConnection({
          modelType: requestBody.modelType as any,
          apiKey: requestBody.apiKey as string,
          modelId: requestBody.modelId as string | undefined,
          apiEndpoint: requestBody.apiEndpoint as string | undefined,
        });
      } else {
        const response = await fetch("/api/ai/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        data = await response.json();
      }

      if (data.success) {
        setConnectionStatus((prev) => ({ ...prev, [modelType]: "success" }));
        toast.success(t("dashboard.settings.ai.testConnection.success"));
      } else {
        setConnectionStatus((prev) => ({ ...prev, [modelType]: "error" }));
        setConnectionError((prev) => ({
          ...prev,
          [modelType]: data.error || "Unknown error",
        }));
        toast.error(t("dashboard.settings.ai.testConnection.failed"), {
          description: data.error,
        });
      }
    } catch (error) {
      setConnectionStatus((prev) => ({ ...prev, [modelType]: "error" }));
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setConnectionError((prev) => ({ ...prev, [modelType]: errorMessage }));
      toast.error(t("dashboard.settings.ai.testConnection.failed"), {
        description: errorMessage,
      });
    }
  };

  const handleAddCustomProvider = () => {
    const id = addCustomProvider({
      name: "",
      apiEndpoint: "",
      apiKey: "",
      models: [],
      selectedModel: "",
    });
    setCurrentModel(id);
  };

  const handleDeleteCustomProvider = (id: string) => {
    removeCustomProvider(id);
    setCurrentModel("deepseek");
  };

  const builtinModels = [
    {
      id: "deepseek",
      name: t("dashboard.settings.ai.deepseek.title"),
      description: t("dashboard.settings.ai.deepseek.description"),
      icon: DeepSeekLogo,
      link: "https://platform.deepseek.com",
      color: "text-purple-500",
      isConfigured: !!deepseekApiKey,
    },
    {
      id: "doubao",
      name: t("dashboard.settings.ai.doubao.title"),
      description: t("dashboard.settings.ai.doubao.description"),
      icon: IconDoubao,
      link: "https://console.volcengine.com/ark",
      color: "text-blue-500",
      isConfigured: !!(doubaoApiKey && doubaoModelId),
    },
    {
      id: "openai",
      name: t("dashboard.settings.ai.openai.title"),
      description: t("dashboard.settings.ai.openai.description"),
      icon: IconOpenAi,
      link: "https://platform.openai.com/api-keys",
      color: "text-blue-500",
      isConfigured: !!(openaiApiKey && openaiModelId && openaiApiEndpoint),
    },
    {
      id: "gemini",
      name: t("dashboard.settings.ai.gemini.title"),
      description: t("dashboard.settings.ai.gemini.description"),
      icon: Sparkles,
      link: "https://aistudio.google.com/app/apikey",
      color: "text-amber-500",
      isConfigured: !!(geminiApiKey && geminiModelId),
    },
    {
      id: "zhipu",
      name: t("dashboard.settings.ai.zhipu.title"),
      description: t("dashboard.settings.ai.zhipu.description"),
      icon: IconZhipu,
      link: "https://open.bigmodel.cn/api-keys",
      color: "text-teal-500",
      isConfigured: !!(zhipuApiKey && zhipuModelId),
    },
  ];

  const inputClass = cn(
    "h-11",
    "bg-white dark:bg-gray-900",
    "border-gray-200 dark:border-gray-800",
    "focus:ring-2 focus:ring-primary/20"
  );

  return (
    <div className="mx-auto py-4 px-4">
      {requireGeminiConfig && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">
            {t("dashboard.settings.ai.gemini.requiredTitle")}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {t("dashboard.settings.ai.gemini.requiredDescription")}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-8">
        {/* ─── Left Sidebar ─────────────────────────────── */}
        <div className="w-64 space-y-6">
          {/* Built-in providers */}
          <div className="flex flex-col space-y-1">
            {builtinModels.map((model) => {
              const Icon = model.icon;
              const isChecked = selectedModel === model.id;
              const isViewing = currentModel === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => setCurrentModel(model.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left border",
                    "transition-all duration-200 cursor-pointer",
                    "hover:bg-primary/10 hover:border-primary/30",
                    isViewing
                      ? "bg-primary/10 border-primary/40"
                      : "border-transparent"
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0",
                      isViewing ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-start">
                    <span
                      className={cn(
                        "font-medium text-sm",
                        isViewing && "text-primary"
                      )}
                    >
                      {model.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {model.isConfigured
                        ? t("common.configured")
                        : t("common.notConfigured")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedModel(model.id);
                      setCurrentModel(model.id);
                    }}
                    className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center border transition-all shrink-0",
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-transparent border-muted-foreground/40 text-transparent hover:border-primary/40"
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom providers */}
          {customProviders.length > 0 && (
            <div className="flex flex-col space-y-1">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                自定义服务
              </div>
              {customProviders.map((provider) => {
                const isChecked = selectedModel === provider.id;
                const isViewing = currentModel === provider.id;
                const isConfigured = !!(
                  provider.apiKey &&
                  provider.selectedModel &&
                  provider.apiEndpoint
                );
                return (
                  <div
                    key={provider.id}
                    onClick={() => setCurrentModel(provider.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left border",
                      "transition-all duration-200 cursor-pointer",
                      "hover:bg-primary/10 hover:border-primary/30",
                      isViewing
                        ? "bg-primary/10 border-primary/40"
                        : "border-transparent"
                    )}
                  >
                    <div
                      className={cn(
                        "shrink-0",
                        isViewing ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <Server className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          isViewing && "text-primary"
                        )}
                      >
                        {provider.name || "未命名服务"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {isConfigured
                          ? t("common.configured")
                          : t("common.notConfigured")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedModel(provider.id);
                        setCurrentModel(provider.id);
                      }}
                      className={cn(
                        "h-6 w-6 rounded-md flex items-center justify-center border transition-all shrink-0",
                        isChecked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-transparent border-muted-foreground/40 text-transparent hover:border-primary/40"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add custom provider button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleAddCustomProvider}
          >
            <Plus className="h-4 w-4" />
            添加 AI 服务
          </Button>
        </div>

        {/* ─── Right Content ────────────────────────────── */}
        <div className="flex-1 max-w-2xl">
          {/* Custom provider editor */}
          {isCustomProvider(currentModel) &&
            customProviders.map(
              (provider) =>
                provider.id === currentModel && (
                  <CustomProviderEditor
                    key={provider.id}
                    provider={provider}
                    onUpdate={updateCustomProvider}
                    onDelete={handleDeleteCustomProvider}
                    connectionStatus={connectionStatus[provider.id] || "idle"}
                    connectionError={connectionError[provider.id] || ""}
                    onTestConnection={() => handleTestConnection(provider.id)}
                  />
                )
            )}

          {/* Built-in provider editor */}
          {!isCustomProvider(currentModel) &&
            builtinModels.map(
              (model) =>
                model.id === currentModel && (
                  <div key={model.id} className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-semibold flex items-center gap-2">
                        <div className={cn("shrink-0", model.color)}>
                          <model.icon className="h-6 w-6" />
                        </div>
                        {model.name}
                      </h2>
                      <p className="mt-2 text-muted-foreground">
                        {model.description}
                      </p>
                    </div>

                    <div className="space-y-6">
                      {/* API Key */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-medium">
                            {t(
                              `dashboard.settings.ai.${model.id}.apiKey`
                            )}
                          </Label>
                          <a
                            href={model.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            {t("dashboard.settings.ai.getApiKey")}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <Input
                          value={
                            model.id === "doubao"
                              ? doubaoApiKey
                              : model.id === "openai"
                                ? openaiApiKey
                                : model.id === "gemini"
                                  ? geminiApiKey
                                  : model.id === "zhipu"
                                    ? zhipuApiKey
                                    : deepseekApiKey
                          }
                          onChange={(e) =>
                            handleApiKeyChange(
                              e,
                              model.id as
                                | "doubao"
                                | "deepseek"
                                | "openai"
                                | "gemini"
                                | "zhipu"
                            )
                          }
                          type="password"
                          placeholder={t(
                            `dashboard.settings.ai.${model.id}.apiKey`
                          )}
                          className={inputClass}
                        />
                      </div>

                      {/* Model ID for providers that need it */}
                      {(model.id === "doubao" ||
                        model.id === "openai" ||
                        model.id === "gemini" ||
                        model.id === "zhipu") && (
                        <div className="space-y-4">
                          <Label className="text-base font-medium">
                            {t(
                              `dashboard.settings.ai.${model.id}.modelId`
                            )}
                          </Label>
                          <Input
                            value={
                              model.id === "doubao"
                                ? doubaoModelId
                                : model.id === "openai"
                                  ? openaiModelId
                                  : model.id === "gemini"
                                    ? geminiModelId
                                    : zhipuModelId
                            }
                            onChange={(e) =>
                              handleModelIdChange(
                                e,
                                model.id as
                                  | "doubao"
                                  | "openai"
                                  | "gemini"
                                  | "zhipu"
                              )
                            }
                            placeholder={t(
                              `dashboard.settings.ai.${model.id}.modelId`
                            )}
                            className={inputClass}
                          />
                        </div>
                      )}

                      {/* API Endpoint for OpenAI */}
                      {model.id === "openai" && (
                        <div className="space-y-4">
                          <Label className="text-base font-medium">
                            {t(
                              "dashboard.settings.ai.openai.apiEndpoint"
                            )}
                          </Label>
                          <Input
                            value={openaiApiEndpoint}
                            onChange={(e) =>
                              setOpenaiApiEndpoint(e.target.value)
                            }
                            placeholder={t(
                              "dashboard.settings.ai.openai.apiEndpoint"
                            )}
                            className={inputClass}
                          />
                        </div>
                      )}

                      {/* Test Connection */}
                      <div className="pt-4">
                        <Button
                          onClick={() => handleTestConnection(model.id)}
                          disabled={
                            connectionStatus[model.id] === "testing" ||
                            !(
                              model.id === "deepseek"
                                ? deepseekApiKey
                                : model.id === "doubao"
                                  ? doubaoApiKey && doubaoModelId
                                  : model.id === "gemini"
                                    ? geminiApiKey && geminiModelId
                                    : model.id === "zhipu"
                                      ? zhipuApiKey && zhipuModelId
                                      : openaiApiKey &&
                                        openaiModelId &&
                                        openaiApiEndpoint
                            )
                          }
                          variant="outline"
                          className={cn(
                            "w-full h-11",
                            connectionStatus[model.id] === "success" &&
                              "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950",
                            connectionStatus[model.id] === "error" &&
                              "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          )}
                        >
                          {connectionStatus[model.id] === "testing" ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {t(
                                "dashboard.settings.ai.testConnection.testing"
                              )}
                            </>
                          ) : connectionStatus[model.id] === "success" ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              {t(
                                "dashboard.settings.ai.testConnection.success"
                              )}
                            </>
                          ) : connectionStatus[model.id] === "error" ? (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {t(
                                "dashboard.settings.ai.testConnection.failed"
                              )}
                            </>
                          ) : (
                            t(
                              "dashboard.settings.ai.testConnection.button"
                            )
                          )}
                        </Button>
                        {connectionError[model.id] && (
                          <p className="text-xs text-red-500 mt-2">
                            {connectionError[model.id]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
            )}
        </div>
      </div>
    </div>
  );
};

const AISettingsPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <AISettingsContent />
    </Suspense>
  );
};

export const runtime = "edge";

export default AISettingsPage;
