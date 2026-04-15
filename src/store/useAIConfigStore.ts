import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AI_MODEL_CONFIGS,
  AIModelConfig,
  AIModelType,
  CustomProvider,
  isCustomProvider,
  getCustomProviderConfig,
} from "@/config/ai";

/** Resolved config for the currently active AI provider */
export interface ActiveAIConfig {
  modelType: AIModelType | string;
  apiKey: string;
  modelId: string;
  apiEndpoint?: string;
  config: AIModelConfig;
}

interface AIConfigState {
  selectedModel: string; // AIModelType or "custom_xxx"
  doubaoApiKey: string;
  doubaoModelId: string;
  deepseekApiKey: string;
  deepseekModelId: string;
  openaiApiKey: string;
  openaiModelId: string;
  openaiApiEndpoint: string;
  geminiApiKey: string;
  geminiModelId: string;
  zhipuApiKey: string;
  zhipuModelId: string;
  requireGeminiConfig: boolean;
  customProviders: CustomProvider[];
  setSelectedModel: (model: string) => void;
  setDoubaoApiKey: (apiKey: string) => void;
  setDoubaoModelId: (modelId: string) => void;
  setDeepseekApiKey: (apiKey: string) => void;
  setDeepseekModelId: (modelId: string) => void;
  setOpenaiApiKey: (apiKey: string) => void;
  setOpenaiModelId: (modelId: string) => void;
  setOpenaiApiEndpoint: (endpoint: string) => void;
  setGeminiApiKey: (apiKey: string) => void;
  setGeminiModelId: (modelId: string) => void;
  setZhipuApiKey: (apiKey: string) => void;
  setZhipuModelId: (modelId: string) => void;
  setRequireGeminiConfig: (require: boolean) => void;
  addCustomProvider: (provider: Omit<CustomProvider, "id">) => string;
  updateCustomProvider: (id: string, updates: Partial<Omit<CustomProvider, "id">>) => void;
  removeCustomProvider: (id: string) => void;
  isConfigured: () => boolean;
  /** Resolve full config for the currently selected provider */
  getActiveConfig: () => ActiveAIConfig | null;
}

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      selectedModel: "doubao",
      doubaoApiKey: "",
      doubaoModelId: "",
      deepseekApiKey: "",
      deepseekModelId: "",
      openaiApiKey: "",
      openaiModelId: "",
      openaiApiEndpoint: "",
      geminiApiKey: "",
      geminiModelId: "gemini-flash-latest",
      zhipuApiKey: "",
      zhipuModelId: "glm-4-flash",
      requireGeminiConfig: false,
      customProviders: [],
      setSelectedModel: (model: string) => set({ selectedModel: model }),
      setDoubaoApiKey: (apiKey: string) => set({ doubaoApiKey: apiKey }),
      setDoubaoModelId: (modelId: string) => set({ doubaoModelId: modelId }),
      setDeepseekApiKey: (apiKey: string) => set({ deepseekApiKey: apiKey }),
      setDeepseekModelId: (modelId: string) => set({ deepseekModelId: modelId }),
      setOpenaiApiKey: (apiKey: string) => set({ openaiApiKey: apiKey }),
      setOpenaiModelId: (modelId: string) => set({ openaiModelId: modelId }),
      setOpenaiApiEndpoint: (endpoint: string) => set({ openaiApiEndpoint: endpoint }),
      setGeminiApiKey: (apiKey: string) => set({ geminiApiKey: apiKey }),
      setGeminiModelId: (modelId: string) => set({ geminiModelId: modelId }),
      setZhipuApiKey: (apiKey: string) => set({ zhipuApiKey: apiKey }),
      setZhipuModelId: (modelId: string) => set({ zhipuModelId: modelId }),
      setRequireGeminiConfig: (require: boolean) => set({ requireGeminiConfig: require }),

      addCustomProvider: (provider) => {
        const id = `custom_${Date.now()}`;
        set((state) => ({
          customProviders: [...state.customProviders, { ...provider, id }],
        }));
        return id;
      },
      updateCustomProvider: (id, updates) => {
        set((state) => ({
          customProviders: state.customProviders.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },
      removeCustomProvider: (id) => {
        set((state) => ({
          customProviders: state.customProviders.filter((p) => p.id !== id),
          // If the deleted provider was selected, switch back to doubao
          selectedModel: state.selectedModel === id ? "doubao" : state.selectedModel,
        }));
      },

      isConfigured: () => {
        const state = get();
        if (isCustomProvider(state.selectedModel)) {
          const provider = state.customProviders.find((p) => p.id === state.selectedModel);
          return !!(provider?.apiKey && provider?.selectedModel && provider?.apiEndpoint);
        }
        const config = AI_MODEL_CONFIGS[state.selectedModel as AIModelType];
        return config?.validate(state) ?? false;
      },

      getActiveConfig: () => {
        const state = get();

        if (isCustomProvider(state.selectedModel)) {
          const provider = state.customProviders.find((p) => p.id === state.selectedModel);
          if (!provider) return null;
          return {
            modelType: "openai" as AIModelType, // custom providers are OpenAI-compatible
            apiKey: provider.apiKey,
            modelId: provider.selectedModel,
            apiEndpoint: provider.apiEndpoint,
            config: getCustomProviderConfig(provider),
          };
        }

        const modelType = state.selectedModel as AIModelType;
        const config = AI_MODEL_CONFIGS[modelType];
        if (!config) return null;

        let apiKey: string;
        let modelId: string;
        let apiEndpoint: string | undefined;

        switch (modelType) {
          case "doubao":
            apiKey = state.doubaoApiKey;
            modelId = state.doubaoModelId;
            break;
          case "deepseek":
            apiKey = state.deepseekApiKey;
            modelId = state.deepseekModelId || config.defaultModel || "";
            break;
          case "openai":
            apiKey = state.openaiApiKey;
            modelId = state.openaiModelId;
            apiEndpoint = state.openaiApiEndpoint;
            break;
          case "gemini":
            apiKey = state.geminiApiKey;
            modelId = state.geminiModelId;
            break;
          case "zhipu":
            apiKey = state.zhipuApiKey;
            modelId = state.zhipuModelId || config.defaultModel || "";
            break;
          default:
            return null;
        }

        return { modelType, apiKey, modelId, apiEndpoint, config };
      },
    }),
    {
      name: "ai-config-storage",
    }
  )
);
