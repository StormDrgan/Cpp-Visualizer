# 4. 前端设计 — “Graph Paper” 视觉系统

> **设计方向**：工程实验笔记本 — 暖白纸页、普鲁士蓝墨水、铜色指针、石墨网格
> **核心风险**：为开发者工具做浅色主题（行业内几乎全员深色）
> **版本**：v1.0
> **设计工具**：frontend-design（设计思维）+ ui-ux-pro-max（色板/字体/UX 规则）
> **最后更新**：2026-06-24

---

## 4.1 设计哲学

### 产品身份

C/C++ Visualizer 是一个教学/理解工具——用户用它来**观看代码在内存中执行**。它不是 IDE，不是分析器，而是一台「软件示波器」：把指针、堆内存、数据结构变化这些肉眼不可见的东西，变成可以逐帧观察的图形。

### 为什么选浅色

几乎每一个代码可视化工具都默认深色主题。这个工具的用户大部分是**学习者**——他们在看书、记笔记、画草稿。一个暖白纸页的浅色环境，让数据结构图看起来像课本插图，这恰好是学习场景中最自然的信息载体。

### 三大 cliché 对照

| AI 设计模板 | 本设计 |
|---|---|
| 暖黄底 + 衬线体 + 陶土红 | 暖白底（更冷更中性），无衬线 UI + 等宽代码，蓝/铜双色 |
| 纯黑底 + 荧光绿/朱红 | 浅色主题，完全不适用 |
| 报纸式排版 + 极细线 | 清晰的卡片/面板布局，非密集列排版 |

### 不做的事

- 不做渐变按钮、玻璃态、发光阴影
- 不做装饰性动画 — 仅保留功能性过渡（状态变化、节点增删）
- 不用 emoji 做图标 — 全部 SVG
- Canvas 不显示 C++ 类型名和内存地址 — 仅展示关键值和指针标签

---

## 4.2 技术选型

| 组件 | 选型 | 理由 |
|---|---|---|
| 框架 | React 18+ | 生态成熟，状态管理方便 |
| 语言 | TypeScript | 类型安全 |
| 代码编辑器 | Monaco Editor | 语法高亮、断点、diff 开箱即用 |
| 可视化渲染 | Konva.js (react-konva) | Canvas 图形操作灵活，性能好 |
| 布局引擎 | 手写（链表/栈/队列/数组）+ 自实现树/图布局 | 可控性优先 |
| 动画 | Konva.Tween + requestAnimationFrame | 节点级精准动画控制 |
| WebSocket | 原生 WebSocket API | 双向实时通信，自动重连 |
| 状态管理 | Zustand | 轻量，不引入 Redux 复杂度 |
| CSS | Tailwind CSS + CSS Custom Properties | Token 化色彩系统 + 原子类 |

---

## 4.3 Design Token 系统

### 4.3.1 色板

| Token | Hex | 用途 |
|---|---|---|
| `--color-page` | `#fafaf7` | 页面底色 — 暖白纸，非纯白 |
| `--color-surface` | `#ffffff` | 面板、卡片、编辑器背景 |
| `--color-surface-alt` | `#f5f4f0` | 交替行底色、hover 态 |
| `--color-border` | `#e4e1da` | 分割线、卡片边框 |
| `--color-grid` | `#ece9e2` | Canvas 点阵网格 — 坐标纸 |
| `--color-ink` | `#1e4d7b` | 主强调色 — 普鲁士蓝。按钮、链接、执行行高亮、当前节点 |
| `--color-ink-light` | `#eaf1f7` | Ink 浅色 — 选中背景、执行行底色 |
| `--color-ink-hover` | `#163d62` | Ink 深色 — 按钮 hover/active |
| `--color-copper` | `#b8703d` | 指针强调色 — 铜迹线。指针标签、内存地址、警示 |
| `--color-copper-light` | `#fdf3e8` | Copper 浅色 — 指针标签背景、交换动画 |
| `--color-teal` | `#2d8a7b` | 数据强调色 — 深绿松石。图边、数据节点边框、成功态 |
| `--color-teal-light` | `#edf7f5` | Teal 浅色 — 数据节点填充 |
| `--color-red` | `#c4312b` | 错误/断点 — 红笔批改色 |
| `--color-red-light` | `#fef5f5` | Red 浅色 — 错误背景 |

**文字色阶**：

| Token | Hex | 用途 |
|---|---|---|
| `--color-text` | `#1c1c1c` | 主文字 |
| `--color-text-secondary` | `#6b6b65` | 次要文字 |
| `--color-text-tertiary` | `#9c9b95` | 辅助/禁用文字 |

**语义状态色**：

| 状态 | 颜色 | 说明 |
|---|---|---|
| idle | `#9c9b95` | 无会话 |
| ready | `#1e4d7b` | 停在入口，等待操作 |
| stepping / running | `#2d8a7b` | 执行中 |
| rewinding | `#b8703d` | 回退中 |
| paused | `#1e4d7b` | 暂停 |
| terminated | `#6b6b65` | 程序结束 |
| error | `#c4312b` | 错误 |

### 4.3.2 字体

| 角色 | 字体 | 权重 | 来源 |
|---|---|---|---|
| **UI** | IBM Plex Sans | 400 / 500 / 600 | Google Fonts |
| **代码** | JetBrains Mono | 400 / 500 | Google Fonts |
| **Canvas** | JetBrains Mono | 400 / 500 | Google Fonts |

导入：
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

CSS：
```css
--font-ui: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace;
```

**字号阶梯**：

| 层级 | 大小 | 行高 | 字重 | 用途 |
|---|---|---|---|---|
| body | 13px | 1.5 | 400 | 面板正文、变量值 |
| ui | 12px | 1.5 | 500 | 按钮、标签、面板标题 |
| caption | 11px | 1.4 | 400 | 辅助信息、步骤编号 |
| code | 13px | 22px | 400 | Monaco 编辑器 |
| canvas-node | 12px | 1.2 | 500 | Canvas 节点标签 |
| canvas-label | 10px | 1.2 | 500 | Canvas 指针标签、索引 |
| display | 14px | 1.4 | 500 | 应用标题（tracked out 0.04em） |

### 4.3.3 间距（4px 基准）

| Token | 值 | 用途 |
|---|---|---|
| `--space-xs` | 4px | 紧凑内边距 |
| `--space-sm` | 8px | 按钮组间距 |
| `--space-md` | 12px | 面板内边距 |
| `--space-lg` | 16px | 区块分隔 |
| `--space-xl` | 24px | 主要布局分隔 |

### 4.3.4 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 3px | 指针标签、小 badge |
| `--radius-md` | 4px | 输入框、表格单元格、Canvas 矩形节点 |
| `--radius-lg` | 6px | 卡片、按钮、弹窗 |

### 4.3.5 阴影与边框

- **阴影**：仅 `--shadow-popover: 0 4px 24px rgba(0,0,0,0.10)` 用于弹窗。其他表面用边框区分层次。
- **边框**：`--border-hairline: 1px solid var(--color-border)` | `--border-focus: 2px solid var(--color-ink)` offset 2px | `--border-active: 1.5px solid var(--color-ink)`

---

## 4.4 页面布局

### Grid 结构

```
┌──────────────────────────────────────────────────────────┐
│ Header                             40px  Page bg          │
│ ───────────────────────────────────────────────────────── │ ← hairline border
├──────────────────┬───────────────────────────────────────┤
│                  │  Canvas Area        flex: 1            │
│  Code Editor     │  (dot-grid bg, overflow: auto)        │
│  (Monaco)        │                                       │
│  min 20%         ├───────────────────────────────────────┤ ← hairline border
│  max 75%         │  Variable Panel     flex: 0 1 auto    │
│                  │  (collapsible sections)               │
├──────────────────┴───────────────────────────────────────┤
│ ───────────────────────────────────────────────────────── │ ← hairline border
│ Control Bar                          36px                │
└──────────────────────────────────────────────────────────┘
```

- **Header**：40px，`color-page` 背景
- **ControlBar**：36px
- **垂直分隔条**：4px 宽，默认透明 → hover `color-border` → drag `color-ink`
- **水平分隔条**：4px 高，同上
- Code Editor 宽度：20%–75%
- Canvas 最小 25%，Variable Panel 最小 15%

### 响应式断点

| 断点 | 布局 |
|---|---|
| < 768px | Code Editor 和右侧面板上下堆叠 |
| 768–1024px | 两列，Code Editor 默认 35% |
| > 1024px | 两列，Code Editor 默认 40% |

---

## 4.5 组件样式

### Header（40px）

- 背景：`var(--color-page)`，底边：`var(--border-hairline)`
- 标题：`font-mono 14px weight-500 letter-spacing: 0.04em color-text`
- 标题前 SVG 图标：`color-ink` 填充
- 状态指示器：8px 圆点（语义色）+ 12px `font-ui` 标签
- 模板选择器触发按钮：`font-ui 12px weight-500 color-text-secondary`，hover → `color-ink`
- 行号：`font-mono 12px`，函数名：`font-mono 11px color-ink`

### TemplatePicker

- 背景：`color-surface`，阴影：`shadow-popover`，圆角：`radius-lg`
- 宽 520px，max-height 420px
- 搜索框：`font-mono 13px`
- 分类标题：`font-ui 10px weight-600 color-text-tertiary`
- 模板按钮：`font-ui 12px weight-500`，选中态 `ink-light` 背景 + `ink` 文字

### ControlBar（36px）

- 背景：`color-surface`，顶边：`border-hairline`
- 按钮高度：28px，字体：`font-ui 12px weight-500`
- 次要按钮：透明背景 + `color-text-secondary` 文字，hover → `surface-alt`
- 主要 Step 按钮：`color-ink` 背景 + 白字
- 步骤历史弹窗：`font-mono 11px`，340px 宽，当前步左边 2px `ink` 指示条

### VariablePanel

- 分区标题：`font-mono 11px weight-500 color-text-secondary letter-spacing: 0.03em`
- 折叠箭头：`color-text-tertiary`，旋转动画 200ms

**局部变量表格**：

| 元素 | 样式 |
|---|---|
| 表头 | `font-mono 10px weight-500 color-text-tertiary` |
| 变量名 | `font-mono 12px weight-500 color-copper` |
| 类型 | `font-mono 11px weight-400 color-text-secondary` |
| 值 | `font-mono 12px weight-400 color-text` |
| 指针值（→ {…}） | `font-mono 12px weight-400 color-teal` |
| 行 hover | 背景 `color-surface-alt` |

**程序输出区**：`color-surface-alt` 背景，`font-mono 12px`，max-height 200px

**可视化目标**：checkbox `ink` 填充，标签 `font-mono 12px`，类型推断标签 `font-mono 10px color-text-tertiary`

### 分隔条

- 默认：4px，与背景同色（视觉消失）
- hover：`color-border`
- 拖拽中：`color-ink`

---

## 4.6 Monaco 编辑器主题

### 自定义浅色主题 `cppviz-light`

基于 Monaco `vs` 主题定制：

```json
{
  "base": "vs",
  "inherit": true,
  "rules": [
    { "token": "comment", "foreground": "9c9b95", "fontStyle": "italic" },
    { "token": "keyword", "foreground": "1e4d7b", "fontStyle": "bold" },
    { "token": "string", "foreground": "2d8a7b" },
    { "token": "number", "foreground": "b8703d" },
    { "token": "type", "foreground": "1e4d7b" },
    { "token": "identifier", "foreground": "1c1c1c" },
    { "token": "delimiter", "foreground": "6b6b65" }
  ],
  "colors": {
    "editor.background": "#ffffff",
    "editor.foreground": "#1c1c1c",
    "editor.lineHighlightBackground": "#fafaf7",
    "editor.selectionBackground": "#eaf1f7",
    "editor.inactiveSelectionBackground": "#f5f4f0",
    "editorLineNumber.foreground": "#c5c2ba",
    "editorLineNumber.activeForeground": "#6b6b65",
    "editorCursor.foreground": "#1e4d7b",
    "editorBracketMatch.background": "#f5f4f0",
    "editorBracketMatch.border": "#e4e1da",
    "editorGutter.background": "#fafaf7",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#e4e1da"
  }
}
```

### 装饰

| 装饰 | 样式 |
|---|---|
| 当前执行行 | 背景 `#eaf1f7`（ink-light），整行高亮 |
| 错误行 | 背景 `#fef5f5`（red-light），左侧 3px `color-red` |
| 断点标记 | 实心圆点，`color-red`，半径 5px |
| @viz 标注行 | gutter 中 `color-ink` 4px 圆点 |

### Monaco 设置

```typescript
{
  fontSize: 13, lineHeight: 22,
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
  tabSize: 4, insertSpaces: true, wordWrap: 'on',
  minimap: { enabled: false }, scrollBeyondLastLine: false,
  glyphMargin: true, folding: true, lineNumbers: 'on',
}
```

---

## 4.7 Canvas 可视化系统

### 4.7.0 全局规范（所有渲染器遵循）

**背景**：
- 画布底色：`var(--color-page)` = `#fafaf7`
- 点阵网格：24px 间距，2px 直径圆，`var(--color-grid)` = `#ece9e2`
- 缩放到 < 0.5x 时网格淡出

**矩形节点**（链表、数组、栈、队列、哈希桶、B 树等）：

| 属性 | 默认（无指针） | 有指针指向 | 当前操作中 |
|---|---|---|---|
| fill | `#ffffff` | `#ffffff` | `#eaf1f7` (ink-light) |
| stroke | `#e4e1da` (border) | `#1e4d7b` (ink) | `#1e4d7b` (ink) |
| strokeWidth | 1.5px | 1.5px | 1.5px |
| cornerRadius | 4px | 4px | 4px |
| shadow | 无 | 无 | 无 |

**圆形节点**（树、图、堆）：

| 属性 | 默认 | 有指针 | 当前操作中 |
|---|---|---|---|
| fill | `#ffffff` | `#ffffff` | `#eaf1f7` |
| stroke | `#e4e1da` | `#1e4d7b` | `#1e4d7b` |
| strokeWidth | 1.5px | 1.5px | 1.5px |

**边（Edges）**：
- 统一：`stroke: #2d8a7b` (teal)，`strokeWidth: 1.5`
- B 树保留：`#8d6e63`（棕色），B+ 树保留：`#689f38`（绿色）
- 链表水平箭头：pointerLength=8，pointerWidth=8；其他：pointerLength=6，pointerWidth=6

**指针标签**：
- 连接线：1px dashed `[3,3]`，`stroke: #b8703d` (copper)
- 背景矩形：`fill: #ffffff`，`stroke: #b8703d`，`strokeWidth: 1`，`cornerRadius: 3`
- 文字：`fontFamily: JetBrains Mono`，`fontSize: 10`，`fontWeight: 500`，`fill: #b8703d`
- 位置：节点下方 `nodeBottom + 12`，多标签间距 18px

**文字**：
- 所有 Canvas Text：`fontFamily='JetBrains Mono'`
- 节点值：`fontSize: 12`，`fontWeight: 500`，`fill: #1c1c1c`
- 索引/下标：`fontSize: 10`，`fontWeight: 400`，`fill: #6b6b65`
- 结构体名称：`fontSize: 11`，`fontWeight: 400`，`fill: #9c9b95`

**空状态**：
- 虚线矩形：60×40，`stroke: #e4e1da`，`strokeWidth: 1`，`dash: [4,3]`，`cornerRadius: 4`
- 文字 "EMPTY"：`fontFamily: JetBrains Mono`，`fontSize: 11`，`fontWeight: 500`，`fill: #9c9b95`

### 4.7.1 链表

水平排列，矩形节点 W=88 H=44 cornerRadius=4，间距 70px。正向箭头居中（cy），teal 1.5px。双向链表反向箭头 cy + 8px。NULL 标记 `∅` text-tertiary。指针标签在节点下方。

### 4.7.2 二叉树

圆形节点 r=20，层高 72px，teal 直线边。NULL 子节点空心小圆 r=4。当前访问节点 fill=ink-light，搜索路径 fill=teal-light。

### 4.7.3 数组

矩形单元格 W=72 H=40 cornerRadius=4，间距 4px。索引在下方（text-secondary）。指针标签在上方。排序比较→ink-light，交换→copper-light。

### 4.7.4 栈

垂直堆叠，自下而上。矩形 W=88 H=36 cornerRadius=3。top 指示器 copper 虚线+标签在栈顶上方。链式栈节点与链表同规格。

### 4.7.5 队列

水平排列 W=72 H=40 cornerRadius=4。front 标签 ink 色上方，rear 标签 copper 色上方。链式队列节点与链表同规格。

### 4.7.6 堆

圆形节点 r=20，完全二叉树布局（2i+1/2i+2）。teal 边。数组索引 `[i]` 在节点下方 text-secondary。

### 4.7.7 图

圆形顶点 r=22，圆形布局。teal 有向边。BFS 染色 teal-light/ink-light。

### 4.7.8 哈希表

桶 W=88 H=40 stroke=#7986cb（靛蓝保留）。链节点同链表。拉链法桶+水平链。开放定址仅桶数组，空桶"—"，已删"✕"red。

### 4.7.9 B 树 / B+ 树

B 树：横排 key 格（32×28），棕色边框 `#8d6e63`。B+ 树：绿色边框 `#689f38`，叶子间水平虚线箭头。

### 4.7.10 递归树

W=120 H=40。活跃节点 fill=ink-light stroke=ink。已返回节点 fill=surface-alt stroke=border opacity=0.4。

---

## 4.8 动画设计

### 原则

- 意义驱动：每个动画表达因果关系
- 时长统一：微交互 150–250ms，结构变化 250–400ms
- easing：进入 EaseOut，退出 EaseIn
- 尊重 `prefers-reduced-motion` → 全部 duration=0

### 动画映射表

| 差分类型 | 动画 | 时长 | Easing |
|---|---|---|---|
| `node_created` | scale 0→1 + opacity 0→1 | 300ms | EaseOut |
| `node_removed` | scale 1→0 + opacity 1→0 | 250ms | EaseIn |
| `value_changed` | 旧值缩小灰化 → 新值 teal 放大恢复 | 300ms | EaseOut |
| `pointer_relocated` | 标签沿 edge 平移 | 250ms | EaseInOut |
| `edge_rewired` | 旧连线淡出 + 新连线伸展 | 250ms | EaseOut |
| `pointer_arrived` | 标签 fade in + 边框脉冲 | 200ms | EaseOut |
| `pointer_departed` | 标签 fade out | 200ms | EaseIn |
| `element_compared` | fill → ink-light → 恢复 | 250ms × 2 | EaseInOut |
| `element_swapped` | fill → copper-light + 值更新 | 400ms | EaseInOut |
| `node_pushed` | 从偏移方向滑入 | 300ms | EaseOut |
| `node_popped` | 缩小 + fade out | 250ms | EaseIn |
| `node_path_swapped` | 路径节点依次闪烁，stagger 150ms | 150ms × N | EaseInOut |

### 缩放/平移

- Ctrl+滚轮缩放：0.25× ~ 3×，光标原点
- 左键拖拽平移：`cursor: grabbing`
- 变换即时跟随（非动画）

---

## 4.9 前端状态机

```
                    ┌──────────┐
        加载页面 →  │  IDLE    │  ← 无代码，无会话
                    └────┬─────┘
                         │ 用户提交代码 + 编译成功
                    ┌────▼─────┐
                    │  READY   │  ← 停在 main 入口，等待用户操作
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼─────┐   ┌────▼─────┐   ┌─────▼──────┐
    │ STEPPING │   │ RUNNING  │   │  REWINDING │
    │(单步模式)│   │(跑到断点)│   │  (后退中)  │
    └────┬─────┘   └────┬─────┘   └─────┬──────┘
         │              │               │
         │ 一步完成      │ 到达断点       │ 快照已加载
         │              │               │
    ┌────▼─────┐   ┌────▼─────┐         │
    │  PAUSED  │◄──│TERMINATED│         │
    │(暂停中)  │   │(程序结束)│         │
    └────┬─────┘   └──────────┘         │
         │                               │
         └───────────────────────────────┘
                 回到 PAUSED
```

---

## 4.10 Canvas 颜色常量速查表

实现时参考 `frontend/src/components/CanvasArea/constants.ts`：

| 常量 | Hex | 说明 |
|---|---|---|
| `NODE_FILL` | `#ffffff` | 节点默认填充 |
| `NODE_STROKE` | `#e4e1da` | 节点默认描边 |
| `NODE_STROKE_WIDTH` | `1.5` | 节点描边宽度 |
| `NODE_POINTED_STROKE` | `#1e4d7b` | 有指针指向时描边 |
| `NODE_ACTIVE_FILL` | `#eaf1f7` | 当前操作节点填充 |
| `EDGE_STROKE` | `#2d8a7b` | 所有边颜色 |
| `EDGE_WIDTH` | `1.5` | 边宽度 |
| `POINTER_LINE_COLOR` | `#b8703d` | 指针标签连接线 |
| `POINTER_TAG_FILL` | `#ffffff` | 指针标签背景 |
| `POINTER_TAG_STROKE` | `#b8703d` | 指针标签边框 |
| `POINTER_TEXT_COLOR` | `#b8703d` | 指针标签文字 |
| `CANVAS_FONT` | `JetBrains Mono` | Canvas 字体 |
| `EMPTY_FILL` | `#f5f4f0` | 空状态矩形填充 |
| `EMPTY_STROKE` | `#e4e1da` | 空状态矩形描边 |
| `DOT_GRID_COLOR` | `#ece9e2` | 点阵网格颜色 |
| `HMAP_BUCKET_STROKE` | `#7986cb` | 哈希桶特有描边 |
| `BTREE_STROKE` | `#8d6e63` | B 树特有描边 |
| `BPLUSTREE_STROKE` | `#689f38` | B+ 树特有描边 |

---

## 4.11 UX 检查清单

- 正文对比度 `#1c1c1c` on `#fafaf7` = 17:1（WCAG AAA）
- Ink Blue `#1e4d7b` on white = 8.5:1（WCAG AAA）
- Copper `#b8703d` on white = 4.6:1（WCAG AA，仅用于 10px+）
- 所有交互元素有 focus ring（2px ink，2px offset）
- `prefers-reduced-motion: reduce` → 所有动画 duration=0
- `font-display: swap` 防止 FOIT
- 颜色不是唯一信息载体（状态同时有色点 + 文字标签）
- ControlBar 按钮触摸区域 ≥ 44×44px
- 纯图标按钮有 `aria-label`

---

> **文档版本**：v1.0 | **最后更新**：2026-06-24 | **状态**：已实施
