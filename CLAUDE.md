# Magic Resume 桌面客户端 - 项目文档

## 项目概述

基于 **Tauri v2** 的 macOS 桌面客户端，前端复用 magic-resume Web 版代码（TanStack Router SPA 模式）。

## 架构

### 双构建模式

| | Web 版 | 桌面版 |
|---|---|---|
| 框架 | TanStack Start (SSR) | Tauri v2 (SPA) |
| Vite 配置 | `vite.config.ts` | `vite.config.tauri.ts`（`base: "./"` 相对路径） |
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

### 已踩过的坑（重要！）

1. **WKWebView 不能用 browser fetch 调外部 API** → 必须用 `@tauri-apps/plugin-http`（Rust 端 HTTP）
2. **Tauri SPA 资源路径必须用相对路径** → `vite.config.tauri.ts` 设 `base: "./"`，所有静态资源引用用 `./` 开头
3. **`showDirectoryPicker` 在 Tauri WebView 不可用** → Tauri 模式隐藏文件夹选择器
4. **macOS 透明标题栏（objc hack）会导致窗口不能拖动** → 已删除，用标准原生标题栏
5. **JSON 文件不要用 Edit 工具改** → 可能产生 smart quote，用 Python `json.dump` 改

### 目录结构（关键文件）

```
src-tauri/
├── tauri.conf.json          # Tauri 配置（窗口、CSP、构建命令）
├── Cargo.toml               # Rust 依赖（无 objc，无 macos-private-api）
├── capabilities/default.json # 权限（FS、窗口、Shell、HTTP）
├── src/
│   ├── lib.rs               # 主逻辑：菜单栏、托盘、标准原生窗口
│   └── main.rs              # 入口：调用 lib::run()

src/
├── tauri-main.tsx            # 桌面端 SPA 入口
├── utils/
│   ├── tauriFileSystem.ts    # Tauri FS 操作
│   ├── aiDirectClient.ts     # AI 直连（tauriFetch 封装、语法检查、润色、优化建议、PDF导入、连接测试）
│   └── resumeOptimize.ts     # AI 简历优化 prompt
├── store/
│   ├── useResumeStore.ts     # 简历状态（集成 Tauri FS + 自动快照）
│   ├── useAIConfigStore.ts   # AI 配置（getActiveConfig 统一入口）
│   ├── useHistoryStore.ts    # 历史快照（30s 防抖自动保存）
│   └── useGrammarStore.ts    # 语法检查（集成直连 AI）
├── config/ai.ts              # AI 服务商配置
├── hooks/
│   ├── useTauriMenuHandler.ts # 原生菜单事件
│   └── useDragDropImport.ts   # 拖拽导入 hook
├── components/editor/
│   ├── EditorHeader.tsx       # 编辑器顶栏
│   └── HistoryPanel.tsx       # 历史版本面板
├── generated/
│   └── templateSnapshotManifest.ts # 模版预览图路径（必须用 ./ 相对路径）
└── lib/
    └── templatePreview.ts     # 模版预览路径生成（getTemplateSnapshotPath 用 ./ 开头）
```

## 已完成功能 ✅

### 1. 本地文件系统集成
简历保存到 `~/Documents/MagicResume/{id}.json`，启动时从磁盘加载，防抖写入 1.5s

### 2. 桌面端直连 AI（所有 AI 功能）
- `tauriFetch` 封装：Tauri 用 `@tauri-apps/plugin-http`，Web 用 browser fetch
- 支持功能：语法检查、文本润色（流式 SSE）、简历优化分析、PDF 导入识别、连接测试
- Gemini 走 REST API，其他走 OpenAI 兼容协议
- PDF 导入：`directResumeImport()` 支持 Gemini vision + OpenAI vision API

### 3. 原生 macOS 菜单栏 + 快捷键
Cmd+N/S/P、编辑菜单、视图导航、窗口菜单。Rust emit → 前端 hook 响应

### 4. 本地 PDF 导出
macOS 原生打印对话框，内置"存储为 PDF"

### 5. 跟随系统主题
桌面端默认 system 主题

### 6. 托盘图标 + 后台运行
关闭窗口不退出，托盘/Dock 点击恢复，最小化后可恢复（unminimize）

### 7. 自定义 AI 中转服务
`getActiveConfig()` 统一解析内置/自定义服务商，自定义走 OpenAI 兼容协议

### 8. 拖拽导入
HTML5 drag 事件，JSON 直接解析，PDF 走 AI 识别

### 9. 历史版本快照
30s 防抖自动保存，AI 润色/模版切换前立即保存，最多 50 条

## 待做功能 ❌

### 历史版本/撤销记录（UI 已有，待用户验证）
### 简历模板市场（未开始）

## 窗口配置（当前状态）

- **标题栏**：标准 macOS 原生标题栏（`decorations: true`），可正常拖动
- **无 objc hack**：不使用透明标题栏、不使用 macos-private-api
- **窗口**：1280x800，最小 960x600，可缩放，居中显示

## 构建

```bash
pnpm install && pnpm tauri build --bundles app
# .app 在 src-tauri/target/release/bundle/macos/
# 如果 DMG 打包失败，用 --bundles app 跳过 DMG
```

**未签名安装：** `xattr -cr /Applications/Magic\ Resume.app`

## Git

- 分支：`claude/rubik-resume-mac-client-sW0Vq`
- 仓库：`chudengchutx/magic-resume`

### 用户本地 remote 配置（重要！）

| remote 名 | 指向 | 说明 |
|-----------|------|------|
| `origin` | `JOYCEQL/magic-resume` | 上游原仓库 |
| `fork` | `chudengchutx/magic-resume` | 用户的 fork |

**告诉用户 git 命令时必须用 `fork`，不能用 `origin`。**

```bash
# 正确
git pull fork claude/rubik-resume-mac-client-sW0Vq

# 错误（这是上游，没有这个分支）
git pull origin claude/rubik-resume-mac-client-sW0Vq
```

## 用户

- **初灯**（陆稼民），ToB 产品经理，正在找工作
- 沟通风格：直接，不客套，该质疑就质疑
- 设备：MacBook + Mac Mini，NAS 同步数据，NAS 上跑 AI 中转（雪顶等）
- 关联项目：Peek（chudengchutx/peek）

## 协作原则

- 改完先自查再推，不要推了让用户当测试
- 不要甩 git 命令，给最简路径（下载 ZIP 或 git pull）
- 做完功能说清楚怎么获取和验证
- 该质疑就质疑，不无脑执行
- JSON 文件用 Python json.dump 改，不用 Edit 工具
- Tauri 原生功能的调试不适合云端做，需要实机运行验证的交给本地
- 涉及平台原生 API 的方案先查文档确认可行性，不靠猜
- 多个相关修复合并为一次 push，不要改一个推一个
- 用户报告问题时先确认 commit hash，不说"代码没问题"

## 复盘文档

- [`docs/postmortem-tauri-desktop-v1.md`](docs/postmortem-tauri-desktop-v1.md) — 2026-04-15 桌面端 bug 修复阶段的完整复盘
