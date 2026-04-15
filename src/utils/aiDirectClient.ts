/**
 * Direct AI provider client for Tauri desktop app.
 * Calls AI APIs directly from the client, bypassing server API routes.
 * Uses Tauri's native HTTP plugin to bypass WebView fetch restrictions.
 */

import { AIModelType, AI_MODEL_CONFIGS } from "@/config/ai";
import { isTauri } from "@/utils/tauriFileSystem";

/**
 * Fetch wrapper that uses Tauri's native HTTP plugin when in desktop mode.
 * Browser fetch in WKWebView can fail with "Load failed" for external URLs.
 */
async function tauriFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  if (isTauri) {
    const { fetch: tFetch } = await import("@tauri-apps/plugin-http");
    return tFetch(url, {
      method: options.method || "GET",
      headers: options.headers as Record<string, string>,
      body: options.body as any,
      signal: options.signal,
    });
  }
  return fetch(url, options);
}

interface AIRequestParams {
  apiKey: string;
  model: string;
  modelType: AIModelType;
  apiEndpoint?: string;
}

// ─── Gemini REST API helpers ───────────────────────────────────────

function geminiGenerateUrl(model: string, apiKey: string, stream = false): string {
  const action = stream ? "streamGenerateContent" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}`;
}

function buildGeminiBody(
  systemPrompt: string,
  userContent: string,
  generationConfig?: Record<string, unknown>
) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig,
  };
}

function extractGeminiText(data: unknown): string {
  const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── Grammar Check ─────────────────────────────────────────────────

export async function directGrammarCheck(params: AIRequestParams & { content: string }) {
  const { apiKey, model, modelType, apiEndpoint, content } = params;

  const systemPrompt = `你是一个专业的中文简历校对助手。你的任务是**仅**找出简历中的**错别字**和**标点符号错误**。

**严格禁止**：
1. ❌ **禁止**提供任何风格、语气、润色或改写建议。如果句子在语法上是正确的（即使读起来不够优美），也**绝对不要**报错。
2. ❌ **禁止**报告"无明显错误"或类似的信息。如果没有发现错别字或标点错误，"errors" 数组必须为空。
3. ❌ **禁止**对专业术语进行过度纠正，除非通过上下文非常确定是打字错误。

**仅检查以下两类错误**：
1. ✅ **错别字**：例如将"作为"写成"做为"，将"经理"写成"经里"。
2. ✅ **严重标点错误**：仅报告重复标点（如"，，"）或完全错误的符号位置。

**重要例外（绝不报错）**：
- ❌ **忽略中英文标点混用**：在技术简历中，中文内容使用英文标点（如使用英文逗号, 代替中文逗号，或使用英文句点. 代替中文句号）是**完全接受**的风格。**绝对不要**报告此类"错误"。
- ❌ **忽略空格使用**：不要报告中英文之间的空格遗漏或多余。

返回格式示例（JSON）：
{
  "errors": [
    {
      "context": "包含错误的完整句子（必须是原文）",
      "text": "具体的错误部分（必须是原文中实际存在的字符串）",
      "suggestion": "仅包含修正后的词汇或片段（**不要**返回整句，除非整句都是错误的）",
      "reason": "错别字 / 标点错误",
      "type": "spelling"
    }
  ]
}

再次强调：**只找错别字和标点错误，不要做任何润色！**`;

  if (modelType === "gemini") {
    const geminiModel = model || "gemini-flash-latest";
    const url = geminiGenerateUrl(geminiModel, apiKey);
    const body = buildGeminiBody(systemPrompt, content, {
      temperature: 0,
      responseMimeType: "application/json",
    });

    const response = await tauriFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = extractGeminiText(data);
    return { choices: [{ message: { content: text } }] };
  }

  // OpenAI-compatible providers
  const modelConfig = AI_MODEL_CONFIGS[modelType];
  const response = await tauriFetch(modelConfig.url(apiEndpoint), {
    method: "POST",
    headers: modelConfig.headers(apiKey),
    body: JSON.stringify({
      model: modelConfig.requiresModelId ? model : modelConfig.defaultModel,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    }),
  });

  return await response.json();
}

// ─── Polish (streaming) ────────────────────────────────────────────

export async function directPolish(
  params: AIRequestParams & { content: string; customInstructions?: string },
  signal?: AbortSignal
): Promise<Response> {
  const { apiKey, model, modelType, apiEndpoint, content, customInstructions } = params;

  let systemPrompt = `你是一个专业的简历优化助手。请帮助优化以下 Markdown 格式的文本，使其更加专业和有吸引力。

优化原则：
1. 使用更专业的词汇和表达方式
2. 突出关键成就和技能
3. 保持简洁清晰
4. 使用主动语气
5. 保持原有信息的完整性
6. 严格保留原有的 Markdown 格式结构（列表项保持为列表项，加粗保持加粗等）

请直接返回优化后的 Markdown 文本，不要包含任何解释或其他内容。`;

  if (customInstructions?.trim()) {
    systemPrompt += `\n\n用户额外要求：\n${customInstructions.trim()}`;
  }

  if (modelType === "gemini") {
    const geminiModel = model || "gemini-flash-latest";
    const url = geminiGenerateUrl(geminiModel, apiKey, true) + "&alt=sse";
    const body = buildGeminiBody(systemPrompt, content, { temperature: 0.4 });

    const response = await tauriFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText.slice(0, 200)}`);
    }

    // Transform Gemini SSE into plain text stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const data = JSON.parse(line.slice(5).trim());
            const text = extractGeminiText(data);
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // skip unparseable lines
          }
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // OpenAI-compatible providers: stream SSE
  const modelConfig = AI_MODEL_CONFIGS[modelType];
  const requestUrl = modelConfig.url(apiEndpoint);
  const response = await tauriFetch(requestUrl, {
    method: "POST",
    headers: modelConfig.headers(apiKey),
    body: JSON.stringify({
      model: modelConfig.requiresModelId ? model : modelConfig.defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorBody = await response.text();
      const errorJson = JSON.parse(errorBody);
      errorDetail = errorJson.error?.message || errorJson.message || errorBody;
    } catch {
      // use status code
    }
    throw new Error(errorDetail);
  }

  // Transform SSE stream into plain text stream
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");
      for (const line of lines) {
        if (line.includes("[DONE]")) continue;
        if (!line.startsWith("data:")) continue;
        try {
          const data = JSON.parse(line.slice(5));
          if (data.error) {
            controller.enqueue(
              encoder.encode(`\n[错误] ${data.error.message || JSON.stringify(data.error)}`)
            );
            controller.close();
            return;
          }
          const deltaContent = data.choices?.[0]?.delta?.content;
          if (deltaContent) {
            controller.enqueue(encoder.encode(deltaContent));
          }
        } catch {
          // skip unparseable lines
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ─── Optimize Suggest ──────────────────────────────────────────────

import { formatResumeContent, SYSTEM_PROMPT_ZH, SYSTEM_PROMPT_EN } from "@/utils/resumeOptimize";

export async function directOptimizeSuggest(params: {
  resumeData: Record<string, unknown>;
  modelType: AIModelType;
  apiKey: string;
  modelId?: string;
  apiEndpoint?: string;
  locale?: string;
}) {
  const { resumeData, modelType, apiKey, modelId, apiEndpoint, locale } = params;

  if (!apiKey || !resumeData) {
    return { success: false, error: "Missing API key or resume data" };
  }

  const modelConfig = AI_MODEL_CONFIGS[modelType];
  if (!modelConfig) {
    return { success: false, error: "Invalid model type" };
  }

  const systemPrompt = locale === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
  const resumeContent = formatResumeContent(resumeData, locale);
  const userContent = `${locale === "en" ? "Here is the resume content:" : "以下是简历内容："}\n\n${resumeContent}`;

  let resultText: string;

  try {
    if (modelType === "gemini") {
      const geminiModel = modelId || "gemini-flash-latest";
      const url = geminiGenerateUrl(geminiModel, apiKey);
      const body = buildGeminiBody(systemPrompt, userContent, {
        temperature: 0.7,
        maxOutputTokens: 4096,
      });

      const response = await tauriFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {}
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      resultText = extractGeminiText(data);
    } else {
      const model = modelConfig.requiresModelId
        ? modelId || modelConfig.defaultModel
        : modelConfig.defaultModel;

      const response = await tauriFetch(modelConfig.url(apiEndpoint), {
        method: "POST",
        headers: modelConfig.headers(apiKey),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          if (errorText) errorMessage = errorText.slice(0, 200);
        }
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      resultText = data.choices?.[0]?.message?.content || "";
    }

    // Parse JSON result
    const jsonMatch = resultText.match(/```json\s*([\s\S]*?)```/);
    let suggestions;

    if (jsonMatch) {
      try {
        suggestions = JSON.parse(jsonMatch[1].trim());
      } catch {
        try {
          suggestions = JSON.parse(resultText);
        } catch {
          return { success: false, error: "Failed to parse AI response" };
        }
      }
    } else {
      try {
        suggestions = JSON.parse(resultText);
      } catch {
        return { success: false, error: "Failed to parse AI response" };
      }
    }

    return { success: true, data: suggestions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ─── Test Connection ───────────────────────────────────────────────

export async function directTestConnection(params: {
  modelType: AIModelType;
  apiKey: string;
  modelId?: string;
  apiEndpoint?: string;
}) {
  const { modelType, apiKey, modelId, apiEndpoint } = params;

  if (!apiKey) return { success: false, error: "API Key is required" };

  const modelConfig = AI_MODEL_CONFIGS[modelType];
  if (!modelConfig) return { success: false, error: "Invalid model type" };

  if (modelConfig.requiresModelId && !modelId) {
    return { success: false, error: "Model ID is required" };
  }

  if (modelType === "openai" && !apiEndpoint) {
    return { success: false, error: "API Endpoint is required" };
  }

  let testUrl: string;
  let testBody: Record<string, unknown>;
  let headers: Record<string, string>;

  if (modelType === "gemini") {
    testUrl = `${modelConfig.url()}/models/${modelId}:generateContent?key=${apiKey}`;
    headers = { "Content-Type": "application/json" };
    testBody = {
      contents: [{ parts: [{ text: "Hi" }] }],
      generationConfig: { maxOutputTokens: 10 },
    };
  } else {
    testUrl = modelConfig.url(apiEndpoint);
    headers = modelConfig.headers(apiKey);
    testBody = {
      model: modelConfig.requiresModelId ? modelId : modelConfig.defaultModel,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 10,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await tauriFetch(testUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(testBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText.slice(0, 200);
      }
      return { success: false, error: errorMessage };
    }

    return { success: true, message: "Connection successful" };
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error) {
      if (fetchError.name === "AbortError") {
        return { success: false, error: "Connection timeout (30s)" };
      }
      return { success: false, error: fetchError.message };
    }
    return { success: false, error: "Unknown connection error" };
  }
}

// ─── Resume Import from PDF images ───────────────────────────────

function extractBase64Payload(dataUrl: string) {
  const matched = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (matched) {
    return { mimeType: matched[1] || "image/jpeg", data: matched[2] || "" };
  }
  return { mimeType: "image/jpeg", data: dataUrl };
}

function parseJsonPayload(content: string) {
  const text = content.trim();
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const objectBlock = text.match(/\{[\s\S]*\}/);
  if (objectBlock?.[0]) { try { return JSON.parse(objectBlock[0]); } catch {} }
  return null;
}

export async function directResumeImport(params: {
  modelType: AIModelType;
  apiKey: string;
  modelId?: string;
  apiEndpoint?: string;
  images: string[];
  locale?: string;
}) {
  const { modelType, apiKey, modelId, apiEndpoint, images, locale } = params;
  const language = locale === "en" ? "English" : "Chinese";

  const systemPrompt = `你是一个专业的简历结构化助手。根据用户提供的简历内容，提取信息并只输出一个合法 JSON 对象。

输出约束：
1. 只允许输出 JSON，不要输出 Markdown，不要输出解释。
2. 如果某个字段不确定，使用空字符串或空数组。
3. 请使用 ${language} 输出内容文本。
4. description/details 字段输出字符串数组，每一项为一句可读内容。

JSON 结构：
{
  "title": "简历标题",
  "basic": {
    "name": "",
    "title": "",
    "email": "",
    "phone": "",
    "location": "",
    "employementStatus": "",
    "birthDate": ""
  },
  "education": [
    {
      "school": "",
      "major": "",
      "degree": "",
      "startDate": "",
      "endDate": "",
      "gpa": "",
      "description": ["", ""]
    }
  ],
  "experience": [
    {
      "company": "",
      "position": "",
      "date": "",
      "details": ["", ""]
    }
  ],
  "projects": [
    {
      "name": "",
      "role": "",
      "date": "",
      "description": ["", ""],
      "link": "",
      "linkLabel": ""
    }
  ],
  "skills": ["", ""]
}`;

  const userText = "请识别以下简历页面图片中的信息，并严格按 JSON 结构输出。";

  try {
    let resultText: string;

    if (modelType === "gemini") {
      const geminiModel = modelId || "gemini-flash-latest";
      const url = geminiGenerateUrl(geminiModel, apiKey);

      const imageParts = images.map((img) => {
        const { mimeType, data } = extractBase64Payload(img);
        return { inlineData: { mimeType, data } };
      });

      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userText }, ...imageParts] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      };

      const response = await tauriFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      resultText = extractGeminiText(data);
    } else {
      // OpenAI-compatible providers (vision API)
      const modelConfig = AI_MODEL_CONFIGS[modelType];
      const model = modelConfig.requiresModelId
        ? modelId || modelConfig.defaultModel
        : modelConfig.defaultModel;

      const imageContent = images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img },
      }));

      const response = await tauriFetch(modelConfig.url(apiEndpoint), {
        method: "POST",
        headers: modelConfig.headers(apiKey),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [{ type: "text", text: userText }, ...imageContent],
            },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          if (errorText) errorMessage = errorText.slice(0, 200);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      resultText = data.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJsonPayload(resultText);
    if (!parsed) {
      return { success: false, error: "Failed to parse AI response as JSON" };
    }

    return { success: true, resume: parsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export { isTauri };
