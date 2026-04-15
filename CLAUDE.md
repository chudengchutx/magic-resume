# Magic Resume 桌面客户端 - 项目文档

## 项目概述

基于 **Tauri v2** 的 macOS 桌面客户端，前端复用 magic-resume Web 版代码（TanStack Router SPA 模式）。

## 架构

### 双构建模式

| | Web 版 | 桌面版 |
|---|---|---|
| 框架 | TanStack Start (SSR) | Tauri v2 (SPA) |
| Vite 配置 | `vite.config.ts` | `vite.config.tauri.ts` |
| 路由树 | `src/routeTree.gen.ts` | `src/routeTree.tauri.gen.ts` |
| 入口文件 | TanStack Start 入口 | `src/tauri-main.tsx` |
| HTML | SSR 动态生成 | `index.html`（SPA shell） |
| 构建产物 | `dist/` | `dist-tauri/` |
| 启动命令 | `pnpm dev` | `pnpm tauri:dev` |

### 关键技术模式

**环境检测：**
```typescript
import { isTauri } from "@/utils/tauriFileSystem";
// isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
```

**动态导入 Tauri API：** 避免 Web 构建报错
```typescript
const { writeTextFile } = await import("@tauri-apps/plugin-fs");
```

**条件分支：** 所有桌面增强都用 `if (isTauri)` 守卫，Web 版逻辑不受影响

### 目录结构（关键文件）

```
src-tauri/
├── tauri.conf.json          # Tauri 配置（窗口、CSP、构建命令）
├── Cargo.toml               # Rust 依赖
├── capabilities/default.json # 权限（FS、窗口、Shell）
├── src/
│   ├── lib.rs               # 主逻辑：菜单栏、托盘、窗口样式
│   └── main.rs              # 入口：调用 lib::run()
└── icons/                   # 应用图标

src/
├── tauri-main.tsx            # 桌面端 SPA 入口（自动导航到 dashboard）
├── utils/
│   ├── tauriFileSystem.ts    # Tauri FS 操作（保存/加载/删除简历）
│   ├── aiDirectClient.ts     # AI 直连客户端（绕过服务器代理）
│   ├── resumeOptimize.ts     # AI 简历优化的共享提示词和格式化
│   ├── export.ts             # PDF 导出（Tauri 走打印对话框）
│   └── print.ts              # 浏览器打印逻辑
├── hooks/
│   └── useTauriMenuHandler.ts # 监听原生菜单事件 → 前端动作
├── store/
│   ├── useResumeStore.ts     # 简历状态（已集成 Tauri FS）
│   ├── useAIConfigStore.ts   # AI 配置状态
│   └── useGrammarStore.ts    # 语法检查（已集成直连 AI）
├── config/
│   └── ai.ts                 # AI 服务商配置（豆包/DeepSeek/OpenAI/Gemini/智谱）
├── app/
│   ├── providers.tsx          # ThemeProvider（桌面默认跟随系统主题）
│   └── app/dashboard/ai/page.tsx # AI 设置页（已集成直连测试）
├── components/shared/ai/
│   ├── AIPolishDialog.tsx     # AI 润色（已集成直连）
│   └── AIOptimizeSuggestionDialog.tsx # AI 优化建议（已集成直连）
├── routes/
│   ├── __root.tsx             # 根组件（Tauri/Web 双模式渲染 + 菜单 hook）
│   └── api/                   # 服务端 API 路由（Tauri 构建排除）
└── components/shared/
    └── PdfExport.tsx          # PDF 导出 UI（监听菜单快捷键）
```

## 已完成功能 ✅

### 1. 本地文件系统集成
- 简历保存到 `~/Documents/MagicResume/{id}.json`
- 启动时从磁盘加载并合并到内存
- 防抖写入（1.5 秒）
- 文件：`tauriFileSystem.ts`, `useResumeStore.ts`, `tauri-main.tsx`

### 2. 桌面端直连 AI
- Tauri 模式直接调 AI 服务商 API，不走 `/api/*` 服务端路由
- 支持：语法检查、文本润色（流式）、简历优化分析、连接测试
- Gemini 走 REST API（不用 Node SDK）
- 文件：`aiDirectClient.ts`, `resumeOptimize.ts`

### 3. 原生 macOS 菜单栏 + 快捷键
- 文件菜单：Cmd+N 新建、Cmd+S 保存、Cmd+P 导出 PDF
- 编辑菜单：撤销/重做/剪切/复制/粘贴/全选（PredefinedMenuItem）
- 视图菜单：Cmd+1/2/3 导航、Cmd+, 设置、全屏
- 窗口菜单：最小化、缩放
- Rust 端 emit 事件 → 前端 `useTauriMenuHandler` hook 响应
- 文件：`lib.rs`, `useTauriMenuHandler.ts`, `__root.tsx`

### 4. 本地 PDF 导出
- Tauri 模式走 macOS 原生打印对话框（内置"存储为 PDF"）
- 不依赖远程服务器 `api.magicv.art`
- Cmd+P 菜单快捷键触发
- 文件：`export.ts`, `PdfExport.tsx`

### 5. 跟随系统主题
- 桌面端默认 `"system"` 主题（Web 默认 `"light"`）
- `TauriThemeSync` 组件监听 Tauri 原生主题变化事件
- 文件：`providers.tsx`

### 6. 托盘图标 + 后台运行
- 托盘菜单：显示/退出
- 关闭窗口不退出，托盘/Dock 点击重新显示
- macOS 透明标题栏
- 文件：`lib.rs`

### 7. 自定义 AI 中转服务 ✅
- 支持添加多个自定义 OpenAI 兼容的中转服务（one-api、new-api、七牛云等）
- 用户可配置：名称、API 地址、API Key、多模型标签（添加/删除/切换）
- `CustomProvider` 接口：`{ id, name, apiEndpoint, apiKey, models[], selectedModel }`
- `getActiveConfig()` 统一解析内置/自定义服务商，所有 AI 调用点无需修改
- 自定义服务商以 `modelType: "openai"` 走 OpenAI 兼容协议
- 文件：`ai.ts`, `useAIConfigStore.ts`, `ai/page.tsx`, `useGrammarStore.ts`, `AIPolishDialog.tsx`, `AIOptimizeSuggestionDialog.tsx`

## 待做功能 ❌

### 8. 拖拽导入
- 把 JSON/PDF 文件拖到窗口直接导入简历
- 需要：Tauri drag-and-drop 事件监听、JSON 解析导入、PDF 解析导入（可能需要 pdfjs）
- 涉及文件：可能需新建 hook + 修改 dashboard 页面

### 9. 自动更新
- 用 Tauri updater 插件实现应用自动更新
- 需要：`tauri-plugin-updater`、更新服务器配置、版本检查 UI
- 涉及文件：`Cargo.toml`, `tauri.conf.json`, 新建更新检查组件

### 10. 多窗口编辑
- 同时打开多份简历在不同窗口
- 需要：Tauri 多窗口 API、窗口间状态同步、简历编辑路由改造
- 涉及文件：`lib.rs`, `tauri.conf.json`, 路由/状态管理

## Tauri 权限配置

`src-tauri/capabilities/default.json` 当前权限：
- `core:default` + 窗口操作（show/hide/close/minimize/maximize/focus/dragging）
- FS：读写文本文件、读目录、判断存在、创建目录、删除文件
- FS 范围：`appdata-recursive` + `document-recursive`
- Shell + Opener

## 构建与运行

```bash
pnpm install              # 安装前端依赖
pnpm tauri:dev            # 开发模式（热重载）
pnpm tauri:build          # 构建 .app / .dmg
```

## Git 分支

- 开发分支：`claude/rubik-resume-mac-client-sW0Vq`
- 独立仓库：`chudengchutx/magic`（main 分支）
