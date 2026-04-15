# 复盘报告：Magic Resume Tauri 桌面端开发协作

> 时间：2026-04-15  
> 参与方：初灯（产品/开发/测试）、Claude Code（AI 编码助手）  
> 项目：magic-resume macOS 桌面客户端（Tauri v2）  
> 分支：`claude/rubik-resume-mac-client-sW0Vq`

---

## 一、背景与目标

magic-resume 是一个开源简历编辑器 Web 应用（TanStack Start + React），已有完整的 Web 版。目标是基于 Tauri v2 构建 macOS 桌面客户端，复用前端代码，新增本地文件系统、原生菜单、AI 直连、PDF 导出等桌面端特性。

整个桌面端从零搭建到功能基本完成，在一天内通过云端 AI 编码完成了 20+ 个 commit，涵盖：

- Tauri v2 项目脚手架（双构建模式）
- 本地文件系统集成（简历读写）
- 桌面端 AI 直连（语法检查、润色、优化建议、PDF 导入）
- 原生 macOS 菜单栏 + 快捷键
- 托盘图标 + 后台运行
- 跟随系统主题
- 拖拽导入
- 历史版本快照

**问题出在最后的 bug 修复阶段。** 4 个 bug 花了将近 2 小时的反复验证才最终解决，用户体验极差。

---

## 二、出了什么问题

### 2.1 需要修复的 4 个 Bug

| # | Bug | 根因 | 修复方案 |
|---|-----|------|---------|
| 1 | 窗口不能拖动 | macOS objc hack 设置了透明标题栏，导致原生拖拽失效 | 删除 objc hack，恢复标准原生标题栏 |
| 2 | 最小化后无法恢复 | `show_main_window` 只调了 `show()` + `set_focus()`，没调 `unminimize()` | 在 show 之前加 `win.unminimize()` |
| 3 | 模板预览图不显示 | Tauri SPA 用 `tauri://localhost/` 协议，绝对路径 `/template-snapshots/` 解析到系统根目录 | `vite.config.tauri.ts` 设 `base: "./"`，所有资源路径改为相对路径 |
| 4 | PDF 导入写死 Gemini | Web 版只集成了 Gemini API，桌面端需要支持用户配置的任意 AI 服务商 | 新增 `directResumeImport()` 支持 Gemini + OpenAI 兼容协议，UI 文字改为通用 "AI" |

**这 4 个 bug 的代码修复本身是正确的。问题在于修复过程。**

### 2.2 修复过程的灾难性展开

#### 时间线

```
13:38  commit e3f2df2 — 第一次推修复（包含 objc hack 删除、unminimize、模板路径、PDF 导入）
       但同时错误地加了 data-tauri-drag-region 和 traffic light padding
       
13:54  commit c95fc63 — 撤销 drag-region 和 padding，恢复原始 UI 代码
       同时修改 i18n 文字

13:57  commit 35c7bfa — 更新 CLAUDE.md 文档
```

**用户在 13:38 之前就已经在本地 build 了旧版本的 .app。** 此后的所有交流，用户看到的都是旧版本的行为，而我在云端看到的是新代码。

#### 来回过程

1. **用户报告窗口拖不动** → 我加了 `data-tauri-drag-region` HTML 属性（错误方案）
2. **用户测试仍然拖不动** → 我才意识到 WKWebView 不支持这个属性
3. **改为删除 objc hack + 恢复原生标题栏**（正确方案，但已经浪费了一轮）
4. **推送后告诉用户 `git pull origin ...`** → 用户的 remote 叫 `fork` 不叫 `origin`，拉取失败
5. **用户 checkout 后 build** → 发现是旧 commit `a4fdb9e`，没拉到最新的 3 个 commit
6. **用户再次 pull** → 终于到 `35c7bfa`，但又要重新 build 20 分钟

**总计：用户至少经历了 3 次无效的 build 周期，每次约 20 分钟。**

---

## 三、根因分析

### 3.1 结构性问题：云端开发 + 本地验证

这是最核心的问题。Tauri 桌面端开发的验证链路：

```
云端改代码 → git push → 用户 git pull → pnpm install → pnpm tauri build (Rust 编译 + 前端打包) → 打开 .app 测试
```

单次循环耗时 **20-30 分钟**，且中间任何一步出错（remote 名不对、没拉到最新 commit、build 缓存）都会导致整个循环无效。

对比本地开发：

```
改代码 → pnpm tauri:dev → 立即看效果（HMR 热更新，Rust 增量编译）
```

**桌面端原生功能的开发和调试，不应该通过云端完成。**

### 3.2 方案验证缺失

`data-tauri-drag-region` 方案在推送前就应该被排除：

- Tauri 文档明确说明这个属性在某些 WebView 引擎下不可靠
- macOS WKWebView 是已知的问题场景
- 如果我在写代码前先查文档，就不会推这个方案，省去一轮无效循环

**教训：涉及平台原生 API 的方案，必须先查官方文档确认可行性，不能靠猜。**

### 3.3 增量推送 vs 批量推送

4 个 bug 被拆成了多次 push，每次 push 用户都要重新 pull + build。正确做法：

1. 在云端把所有修复写完
2. 逐一自查代码逻辑（不依赖运行验证）
3. 一次性 push
4. 用户 pull + build 一次，验证所有修复

### 3.4 用户环境信息没记住

用户的本地 git 配置：
- `origin` → `JOYCEQL/magic-resume`（上游原仓库）  
- `fork` → `chudengchutx/magic-resume`（用户的 fork）

我多次告诉用户用 `git pull origin ...`，但正确的命令是 `git pull fork ...`。这个信息在对话早期就已经出现过，没有记住，导致用户拉取失败，进一步加剧挫败感。

### 3.5 沟通断层

当用户报告"还是老版本"时，我的回应是"代码没问题，你需要 pull"。从我的角度这是事实——代码确实已经改了。但从用户角度：

- 我按你说的做了
- 打开 app 什么都没变
- 你告诉我"代码没问题"
- **感觉就是在被忽悠**

正确的沟通方式应该是：先确认用户本地的 commit hash，定位到具体是哪个环节断了，而不是反复说"代码没问题"。

---

## 四、数据统计

| 指标 | 数值 |
|------|------|
| 功能开发 commit 数 | 17 |
| bug 修复 commit 数 | 6（含 2 个来回撤销） |
| 文档 commit 数 | 8 |
| 用户无效 build 次数 | ≥ 3 |
| 用户浪费时间（估算） | ≥ 1.5 小时 |
| 加了又删的代码 | `data-tauri-drag-region` + traffic light padding（2 个文件） |
| remote 名搞错次数 | ≥ 2 |

---

## 五、改进措施

### 5.1 开发模式选择

| 场景 | 推荐模式 |
|------|---------|
| Tauri 原生功能（窗口、菜单、托盘、文件系统） | **本地开发**，`pnpm tauri:dev` 实时验证 |
| 纯前端 UI/逻辑（组件、状态管理、样式） | 云端可以做，`pnpm dev` 即可验证 |
| AI 相关逻辑（API 调用封装、prompt） | 云端可以做，逻辑层不依赖原生环境 |
| Bug 修复（涉及原生行为） | **本地开发**，必须能运行验证 |

**结论：这个项目后续的 Tauri 原生相关开发应该在本地进行。** 云端 AI 编码适合做代码生成、review、逻辑层开发，不适合做需要运行验证的原生桌面端调试。

### 5.2 推送纪律

- 所有相关修复合并为一次 push
- push 前完成代码自查 checklist（见附录）
- 不推未经方案验证的代码

### 5.3 环境信息持久化

用户的关键环境信息必须记录在 CLAUDE.md 中：

```
用户本地 git remote:
- origin → JOYCEQL/magic-resume（上游）
- fork → chudengchutx/magic-resume（用户 fork）

告诉用户 git 命令时用 fork，不用 origin。
```

### 5.4 沟通规范

- 用户报告问题时，先确认 `git log --oneline -1` 的 commit hash，再排查
- 不说"代码没问题"，说"我查一下你本地跑的是哪个版本"
- 给 git 命令时带上完整的 remote name 和分支名，不让用户猜

---

## 六、附录：代码自查 Checklist

每次推送前逐项确认：

- [ ] Rust 代码：`cargo check` 无 error（warning 可接受）
- [ ] 前端代码：关键文件的改动逻辑是否自洽
- [ ] i18n：zh.json 和 en.json 的同一个 key 是否都改了
- [ ] 路径：Tauri SPA 下所有静态资源路径是否用 `./` 开头
- [ ] Tauri 配置：`tauri.conf.json` 的 CSP、权限、窗口配置是否正确
- [ ] 环境守卫：所有桌面端特性是否用 `if (isTauri)` 守卫
- [ ] 动态导入：Tauri API 是否用 `await import()` 避免 Web 构建报错
- [ ] 没有加了又删的来回改动
- [ ] commit message 准确描述了改动内容
- [ ] 告诉用户的 git 命令使用 `fork` 而不是 `origin`

---

## 七、总结

这次协作的功能产出是实质性的——一天内从零搭建了完整的 macOS 桌面客户端。但最后的 bug 修复阶段暴露了**云端开发桌面端应用**的根本局限性：无法运行验证。

核心教训：**能力边界要诚实。** 云端 AI 编码擅长代码生成和逻辑实现，不擅长需要实机运行验证的原生平台调试。识别到这个边界后应该立即告知用户，而不是硬做然后让用户承担验证成本。

对用户来说，最直接的感受是：**浪费时间**。改完一个推一个、来回撤销、remote 名搞错、反复要求 build——这些本不该发生。

这份报告的目的不是辩解，是留一个记录：下次遇到类似场景，知道什么该做、什么不该做。
