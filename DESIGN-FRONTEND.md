# C/C++ Visualizer 前端视觉设计文档 — “Graph Paper”

> **设计方向**：工程实验笔记本 — 暖白纸页、普鲁士蓝墨水、铜色指针、石墨网格
> **核心风险**：为开发者工具做浅色主题（行业内几乎全员深色）
> **版本**：v1.0 — 全量前端视觉重设计
> **依赖设计工具**：frontend-design（设计思维框架）+ ui-ux-pro-max（色板/字体/UX 规则参考库）
> **日期**：2026-06-24

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [Design Token 系统](#2-design-token-系统)
3. [页面布局](#3-页面布局)
4. [组件样式](#4-组件样式)
5. [Monaco 编辑器主题](#5-monaco-编辑器主题)
6. [Canvas 可视化重设计](#6-canvas-可视化重设计)
7. [动画设计](#7-动画设计)
8. [UX 检查清单](#8-ux-检查清单)
9. [实施路线图](#9-实施路线图)

---

## 1. 设计哲学

### 1.1 产品身份

**C/C++ Visualizer** 是一个教学/理解工具——用户（学生和开发者）用它来**观看代码在内存中执行**。它不是 IDE，不是分析器，而是一台「软件示波器」：把指针、堆内存、数据结构变化这些肉眼不可见的东西，变成可以逐帧观察的图形。

### 1.2 为什么选浅色

几乎每一个代码可视化工具都默认深色主题。深色当然省眼，但它也制造了一种「终端/黑客」的距离感。这个工具的用户大部分是**学习者**——他们在看书、记笔记、画草稿。一个暖白纸页的浅色环境，让数据结构图看起来像**课本插图**，这恰好是学习场景中最自然的信息载体。

### 1.3 三大 cliché 对照

| AI 设计模板 | 本设计 |
|---|---|
| 暖黄底 + 衬线体 + 陶土红 | 暖白底（更冷更中性），无衬线 UI + 等宽代码，蓝/铜双色 |
| 纯黑底 + 荧光绿/朱红 | 浅色主题，完全不适用 |
| 报纸式排版 + 极细线 | 清晰的卡片/面板布局，非密集列排版 |

### 1.4 不做的事

- 不做渐变按钮、玻璃态、发光阴影 — 这些与「墨水在纸上」的隐喻冲突
- 不做装饰性动画 — 仅保留功能性过渡（状态变化、节点增删）
- 不用 emoji 做图标 — 全部 SVG（Heroicons/Lucide 风格）
- 不在 canvas 上显示数据结构的 C++ 类型名和内存地址 — 仅展示关键值和指针标签

---

## 2. Design Token 系统

### 2.1 色板

| Token 名称 | Hex | 用途 |
|---|---|---|
| `--color-page` | `#fafaf7` | 页面底色 — 暖白纸，非纯白 |
| `--color-surface` | `#ffffff` | 面板、卡片、编辑器背景 |
| `--color-surface-alt` | `#f5f4f0` | 交替行底色、hover 态 |
| `--color-border` | `#e4e1da` | 分割线、卡片边框 — 像笔记本的淡横线 |
| `--color-grid` | `#ece9e2` | Canvas 点阵网格 — 坐标纸 |
| `--color-ink` | `#1e4d7b` | 主强调色 — 普鲁士蓝墨水。按钮、链接、执行行高亮、当前节点 |
| `--color-ink-light` | `#eaf1f7` | Ink 的浅色版本 — 选中背景、执行行底色 |
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
| `--color-text` | `#1c1c1c` | 主文字 — 近黑 |
| `--color-text-secondary` | `#6b6b65` | 次要文字 — 暖灰 |
| `--color-text-tertiary` | `#9c9b95` | 辅助/禁用文字 — 浅暖灰 |

**语义色（状态指示灯）**：

| 状态 | 颜色 | 说明 |
|---|---|---|
| idle | `#9c9b95` (text-tertiary) | 无会话 |
| ready | `#1e4d7b` (ink) | 停在入口，等待操作 |
| stepping / running | `#2d8a7b` (teal) | 执行中 |
| rewinding | `#b8703d` (copper) | 回退中 |
| paused | `#1e4d7b` (ink) | 暂停 |
| terminated | `#6b6b65` (text-secondary) | 程序结束 |
| error | `#c4312b` (red) | 错误 |

### 2.2 字体

| 角色 | 字体 | 权重 | 来源 |
|---|---|---|---|
| **UI** | IBM Plex Sans | 400 / 500 / 600 | Google Fonts |
| **代码** | JetBrains Mono | 400 / 500 | Google Fonts |
| **Canvas** | JetBrains Mono | 400 / 500 | Google Fonts |

**导入**：
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

**CSS font-family**：
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

### 2.3 间距（4px 基准）

| Token | 值 | 用途 |
|---|---|---|
| `--space-xs` | 4px | 紧凑内边距（badge、tag） |
| `--space-sm` | 8px | 按钮组间距、列表项间距 |
| `--space-md` | 12px | 面板内边距 |
| `--space-lg` | 16px | 区块分隔 |
| `--space-xl` | 24px | 主要布局分隔 |

### 2.4 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 3px | 指针标签、小 badge |
| `--radius-md` | 4px | 输入框、表格单元格、Canvas 矩形节点 |
| `--radius-lg` | 6px | 卡片、按钮、弹窗 |

### 2.5 阴影

**原则：浅色主题尽量不用阴影，用边框区分层次。**

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-popover` | `0 4px 24px rgba(0,0,0,0.10)` | 弹窗、下拉菜单 — 唯一使用阴影的地方 |
| 其他所有表面 | 无阴影 | 用 `border` 和背景色区分 |

### 2.6 边框

| Token | 值 | 用途 |
|---|---|---|
| `--border-hairline` | `1px solid var(--color-border)` | 面板分割、表格线 |
| `--border-focus` | `2px solid var(--color-ink)` | 键盘 focus ring（2px offset） |
| `--border-active` | `1.5px solid var(--color-ink)` | Canvas 中有指针指向的节点 |

---

## 3. 页面布局

### 3.1 Grid 结构

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

- **Header**：40px，Page 背景色
- **垂直分隔条**：4px 宽，默认 `color-border`，hover/drag 时变 `color-ink`
- **水平分隔条**：4px 高，同上
- **Canvas 最小占比**：25%（对应 Variable Panel 最大 75%）
- **Variable Panel 最小占比**：15%（对应 Canvas 最大 85%）
- **Code Editor 宽度**：20%–75%

### 3.2 响应式断点

| 断点 | 布局调整 |
|---|---|
| < 768px | Code Editor 和右侧面板上下堆叠 |
| 768–1024px | 两列，Code Editor 默认 35% |
| > 1024px | 两列，Code Editor 默认 40% |

---

## 4. 组件样式

### 4.1 Header（40px）

```
┌──────────────────────────────────────────────────────────┐
│ ◉ C/C++ Visualizer  │  [选择模板 ▾]  │  ● ready  L42     │
└──────────────────────────────────────────────────────────┘
```

- 背景：`var(--color-page)`
- 底边框：`var(--border-hairline)`
- 标题：`font-family: var(--font-mono)`, `font-size: 14px`, `font-weight: 500`, `letter-spacing: 0.04em`, `color: var(--color-text)`
- 标题前小图标：纯 SVG，`color-ink` 填充
- 分隔竖线：1px × 20px，`color-border`
- 模板选择器触发按钮：`font-family: var(--font-ui)`, `font-size: 12px`, `font-weight: 500`, `color: var(--color-text-secondary)`, hover 时 `color: var(--color-ink)`
- 状态指示器：8px 圆点 + 12px 标签（`font-ui`），颜色按 §2.1 语义色表
- 右侧信息：当前行号 `font-mono 12px`，函数名 `font-mono 11px color-ink`

### 4.2 TemplatePicker 弹窗

- 背景：`var(--color-surface)`
- 边框：无（纯白卡片）
- 阴影：`var(--shadow-popover)`
- 圆角：`var(--radius-lg)` = 6px
- 宽度：520px，最大高度：420px
- 搜索框：`font-mono 13px`，底部 1px `color-border` 分割
- 分类标题：`font-ui 10px weight-600`，`color-text-tertiary`，大写 tracked out
- 模板按钮：`font-ui 12px weight-500`，`color-text`，hover 时背景 `color-surface-alt`，选中时背景 `color-ink-light` + 文字 `color-ink`
- 模板图标：15px SVG，`color-text-secondary`

### 4.3 ControlBar（36px）

- 背景：`var(--color-surface)`
- 顶边框：`var(--border-hairline)`
- 内边距：`0 var(--space-md)`
- 按钮高度：28px
- 按钮字体：`font-ui 12px weight-500`

**按钮状态**：

| 状态 | 背景 | 文字/图标 | 边框 |
|---|---|---|---|
| 默认（次要） | transparent | `color-text-secondary` | 无 |
| hover | `color-surface-alt` | `color-text` | 无 |
| active/press | `color-surface-alt` + `scale(0.98)` | `color-ink` | 无 |
| 主要（Step 按钮） | `color-ink` | `#ffffff` | 无 |
| 主要 hover | `color-ink-hover` | `#ffffff` | 无 |
| 禁用 | transparent | `color-text-tertiary`（opacity 0.5） | 无 |

- 按钮间距：`var(--space-sm)` = 8px
- 按钮组间竖线分隔：1px × 20px，`color-border`
- 右侧步骤历史按钮：`font-mono 11px`，`color-text-secondary`
- 步骤历史弹窗：`font-mono 11px`，340px 宽，max 360px 高，`color-surface` 背景 + `shadow-popover`，当前步骤左边 2px `color-ink` 指示条

### 4.4 Variable Panel

- 背景：`var(--color-surface)`
- 顶边框：`var(--border-hairline)`
- 分区标题：`font-mono 11px weight-500`，`color-text-secondary`，tracked out 0.03em
- 折叠/展开箭头：12px SVG，`color-text-tertiary`，旋转动画 200ms

**局部变量表格**：

| 元素 | 样式 |
|---|---|
| 表头 | `font-mono 10px weight-500 color-text-tertiary`，大写 |
| 变量名 | `font-mono 12px weight-500 color-copper` |
| 类型 | `font-mono 11px weight-400 color-text-secondary` |
| 值 | `font-mono 12px weight-400 color-text` |
| 指针值（→ {…}） | `font-mono 12px weight-400 color-teal` |
| 行 hover | 背景 `color-surface-alt` |
| 行间分隔 | 底部 1px `color-border`（仅分割线，无全宽） |

**程序输出区**：
- 背景：`color-surface-alt`
- `font-mono 12px`，`color-text`
- 最大高度：200px，overflow-y: auto

**标注管理面板**：
- 标注项：`font-mono 11px`，图标 + 类型名 + 变量名 + 行号
- 删除按钮：16px × 图标，hover 时 `color-red`
- 「添加标注」按钮：`font-ui 11px weight-500 color-ink`，hover 下划线

**可视化目标面板**：
- Checkbox 列表：`font-mono 12px`，`color-text`
- 已选中：checkbox 填充 `color-ink`，标签 `color-text`
- 未选中：checkbox 边框 `color-border`，标签 `color-text-secondary`
- 类型推断标签：`font-mono 10px color-text-tertiary`（显示「→ 链表」「→ 二叉树」等）

### 4.5 Code Editor（Monaco）

见 §5 Monaco 编辑器主题。

编辑器编译错误面板：
- 背景：`color-red-light`
- 边框：顶部 1px `var(--color-red)`（opacity 0.3）
- 错误行文本：`font-mono 11px`，`color-red`

### 4.6 分隔条（Resize Dividers）

- 默认：4px，`color-page`（与背景同色，视觉消失）
- hover：4px，`color-border`
- 拖拽中：4px，`color-ink`，`cursor: col-resize` / `row-resize`

---

## 5. Monaco 编辑器主题

### 5.1 自定义浅色主题 `cppviz-light`

基于 Monaco 的 `vs` 主题定制：

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
    { "token": "delimiter", "foreground": "6b6b65" },
    { "token": "annotation", "foreground": "9c9b95", "fontStyle": "italic" }
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

### 5.2 装饰（Decorations）

| 装饰 | 样式 |
|---|---|
| 当前执行行 | 背景 `var(--color-ink-light)` (`#eaf1f7`)，整行高亮 |
| 错误行 | 背景 `var(--color-red-light)` (`#fef5f5`)，左侧 3px `color-red` |
| 断点标记 | 实心圆点，`color-red`，半径 5px，gutter 居中 |
| @viz 标注行 | gutter 中蓝色小标记 (`color-ink`，4px 圆点) |

### 5.3 Monaco 设置

```typescript
{
  fontSize: 13,
  lineHeight: 22,
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'on',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  glyphMargin: true,
  folding: true,
  lineNumbers: 'on',
}
```

---

## 6. Canvas 可视化重设计

### 6.0 全局规范

以下规范适用于 **所有** 数据结构渲染器。单个渲染器的特殊规则在对应小节中覆盖。

#### 背景

- 画布底色：`var(--color-page)` = `#fafaf7`
- **点阵网格**（新增）：24px 间距的点阵，每个点为 2px 直径圆，颜色 `var(--color-grid)` = `#ece9e2`
  - 实现：Konva Layer，在所有结构体内容下面渲染
  - 点阵随画布平移/缩放自然移动
  - 缩放到 < 0.5x 时点阵淡出（opacity 过渡），避免密集噪点

#### 节点通用样式

**矩形节点**（链表节点、数组单元格、栈单元、队列单元、哈希桶/B树节点等）：

| 属性 | 默认（无指针） | 有指针指向 | 当前操作中 |
|---|---|---|---|
| fill | `#ffffff` | `#ffffff` | `var(--color-ink-light)` `#eaf1f7` |
| stroke | `var(--color-border)` `#e4e1da` | `var(--color-ink)` `#1e4d7b` | `var(--color-ink)` `#1e4d7b` |
| strokeWidth | 1.5px | 1.5px | 1.5px |
| cornerRadius | `var(--radius-md)` = 4px | `var(--radius-md)` = 4px | `var(--radius-md)` = 4px |
| shadow | 无 | 无 | 无 |

**圆形节点**（树节点、图顶点、堆节点）：

| 属性 | 默认（无指针） | 有指针指向 | 当前操作中 |
|---|---|---|---|
| fill | `#ffffff` | `#ffffff` | `var(--color-ink-light)` `#eaf1f7` |
| stroke | `var(--color-border)` `#e4e1da` | `var(--color-ink)` `#1e4d7b` | `var(--color-ink)` `#1e4d7b` |
| strokeWidth | 1.5px | 1.5px | 1.5px |
| shadow | 无 | 无 | 无 |

#### 边（Edges）/箭头

- 所有边统一：`stroke: var(--color-teal)` = `#2d8a7b`，`strokeWidth: 1.5`
- 箭头尺寸：`pointerLength: 6`, `pointerWidth: 6`（小箭头）
- 链表水平连线：`pointerLength: 8`, `pointerWidth: 8`（稍大箭头）
- 双向链表反向箭头：`stroke: var(--color-text-tertiary)` = `#9c9b95`，`strokeWidth: 1.5`
- NULL 终点：`font-mono 12px` 文本 `∅`，`fill: var(--color-text-tertiary)`

#### 指针标签（Pointer Labels）

**这是统一新增的——之前仅在链表/二叉树/数组中有碎片化实现。现在所有结构体统一支持。**

| 属性 | 值 |
|---|---|
| 连接线 | 1px dashed `[3, 3]`，`stroke: var(--color-copper)` `#b8703d` |
| 背景矩形 | `fill: #ffffff`，`stroke: var(--color-copper)`，`strokeWidth: 1`，`cornerRadius: 3` |
| 文字 | `fontFamily: JetBrains Mono`，`fontSize: 10`，`fontWeight: 500`，`fill: var(--color-copper)` |
| 标签尺寸 | 动态宽度（文字宽 + 8px padding），固定高度 16px |
| 位置 | 节点下方，从 `nodeBottom + 12` 开始，每个标签间距 18px |
| 多标签堆叠 | 按字母顺序排列，第一个标签最靠近节点 |

#### 文字

- **所有 Canvas 文字**：`fontFamily: 'JetBrains Mono'`（Konva 中显式设置）
- **节点值**：`fontSize: 12`，`fontWeight: 500`，`fill: var(--color-text)` `#1c1c1c`
- **索引/下标**：`fontSize: 10`，`fontWeight: 400`，`fill: var(--color-text-secondary)` `#6b6b65`
- **结构体名称**（空状态标题）：`fontSize: 11`，`fontWeight: 400`，`fill: var(--color-text-tertiary)` `#9c9b95`

#### 空状态

所有结构体在无节点时显示统一空状态：

- 虚线矩形：60×40，`stroke: var(--color-border)`，`strokeWidth: 1`，`dash: [4, 3]`，`cornerRadius: 4`
- 文字："EMPTY"：`fontFamily: JetBrains Mono`，`fontSize: 11`，`fontWeight: 500`，`fill: var(--color-text-tertiary)`
- 结构体名称副标题（可选）：`fontSize: 10`，`fill: var(--color-text-tertiary)`

---

### 6.1 链表（Linked List）

**视觉隐喻**：水平排列的圆角矩形，铜色指针标签在下方，青绿色箭头连接。

```
  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  graph paper dots
        ┌──────┐  teal edge  ┌──────┐
        │  3   │──────────→ │  4   │
        └──────┘             └──────┘
           │                    │  ← copper dashed lines
        ┌──┴──┐             ┌──┴──┐
        │slow │             │fast │  ← copper label tags
        └─────┘             └─────┘
```

**渲染规格**：

| 元素 | 细节 |
|---|---|
| 节点尺寸 | W=88 H=44，cornerRadius=4 |
| 水平间距 | 70px（NODE_GAP） |
| 正向箭头 | y=节点垂直中心，从 `nodeA.right + 4` 到 `nodeB.left - 4`，teal 1.5px |
| 反向箭头（双向链表） | y=节点垂直中心 + 8px 偏移，从 `nodeB.left + 4` 到 `nodeA.right - 4`，tertiary grey 1.5px |
| NULL 标记 | 文本 `∅`，fontSize=14，color-text-tertiary，距最后节点 12px |
| 指针标签 | 按 §6.0 通用规范 |
| 环检测标记 | 环回边用弧形箭头（非直线），橙色系 dashed |

**动画**：
- 节点新增：从 scale 0.6/opacity 0 → scale 1/opacity 1，300ms EaseOut
- 节点删除：scale → 0 + opacity → 0，250ms EaseIn
- 指针移动：标签从旧节点移动到新节点，沿 edge 路径平移，250ms EaseInOut

---

### 6.2 二叉树（Binary Tree）

**视觉隐喻**：圆形节点，层级展开，像手绘树形图。

```
               ┌───┐
               │ 4 │          ← circle, teal edges
               └─┬─┘
          ┌──────┴──────┐
        ┌─┴─┐         ┌─┴─┐
        │ 2 │         │ 6 │
        └─┬─┘         └─┬─┘
       ┌──┴──┐      ┌──┴──┐
      ┌┴┐   ┌┴┐    ┌┴┐   ┌┴┐
      │1│   │3│    │5│   │7│      ← NULL children: small hollow circles
      └─┘   └─┘    └─┘   └─┘
```

**渲染规格**：

| 元素 | 细节 |
|---|---|
| 节点形状 | 圆形，半径=20（TREE_NODE_RADIUS） |
| 节点样式 | 按 §6.0 圆形节点通用规范 |
| 边 | 直线（非贝塞尔），从父节点底部到子节点顶部，teal 1.5px，小箭头 |
| NULL 子节点 | 空心小圆（r=4），`stroke: var(--color-border)`，`fill: none`，`strokeWidth: 1` |
| 当前访问节点 | fill=`var(--color-ink-light)`，stroke=`var(--color-ink)`，strokeWidth=2 |
| 搜索路径节点 | fill=`var(--color-teal-light)`，stroke=`var(--color-teal)` |
| 层高 | 72px（TREE_LEVEL_H） |
| 最小兄弟间距 | 56px（TREE_NODE_RADIUS*2 + 16） |
| 指针标签 | 按 §6.0 通用规范，从节点底部算起 |

**AVL 平衡因子**：在节点圆内右上角用小字号（9px）显示，`fill: var(--color-text-secondary)`

---

### 6.3 数组（Array）

**视觉隐喻**：水平排列的单元格，索引标注在下方，指针标签在上方。

```
  idx:   0       1       2       3       4
       ┌──────┬──────┬──────┬──────┬──────┐
       │  1   │  4   │  7   │  2   │  9   │
       └──────┴──────┴──────┴──────┴──────┘
                                    ↑
                                  pivot    ← copper label
```

**渲染规格**：

| 元素 | 细节 |
|---|---|
| 单元格尺寸 | W=72 H=40，cornerRadius=4 |
| 单元格间距 | 4px（ARRAY_GAP） |
| 单元格样式 | 按 §6.0 矩形节点通用规范 |
| 值文字 | `fontSize: 13`，居中 |
| 索引标注 | 单元格下方 2px，`fontSize: 10`，`fill: var(--color-text-secondary)`，格式 `[N]` |
| 指针标签 | 按 §6.0 通用规范，但位置在**单元格上方**（因下方被索引占据） |
| 排序比较动画 | 比较中的两个单元格 fill → `var(--color-ink-light)`，250ms |
| 排序交换动画 | 交换中的两个单元格 fill → `var(--color-copper-light)`，300ms |

---

### 6.4 栈（Stack）

**视觉隐喻**：垂直堆叠，自下而上增长，栈顶指示器在最上方。

**a) 顺序栈**：

```
                    ┌─────┐
     top ────────→  │  3  │  ← top indicator (copper)
                    ├─────┤
                    │  2  │
                    ├─────┤
                    │  1  │
                    └─────┘
```

| 元素 | 细节 |
|---|---|
| 单元格尺寸 | W=88 H=36，cornerRadius=3 |
| 垂直间距 | 3px（STACK_GAP） |
| 增长方向 | **从下往上**（index 0 在底部） |
| 单元格样式 | 按 §6.0 矩形节点通用规范 |
| 索引 | 单元格内右上角，`fontSize: 9`，`fill: var(--color-text-tertiary)`，格式 `[N]` |
| **top 指示器** | 虚线（dash=[3,3]）+ 标签 "top"，copper 色，在栈顶元素**上方** |
| 空栈 | "EMPTY" 空状态 + 虚线框 |

**b) 链式栈**：

| 元素 | 细节 |
|---|---|
| 布局 | 垂直排列，top 节点在最上方 |
| 箭头 | 从上节点底部 → 下节点顶部，teal 1.5px |
| 节点样式 | 与链表节点相同（W=88 H=44 cornerRadius=4） |
| top 指示器 | 与顺序栈相同 |
| 指针标签 | 按 §6.0 通用规范 |

**动画**：
- push：新节点从上方 60px 偏移滑入 + scale，300ms EaseOut
- pop：节点 scale → 0 + opacity → 0，250ms EaseIn

---

### 6.5 队列（Queue）

**视觉隐喻**：水平排列，front（队首）和 rear（队尾）指示器。

**a) 循环队列**：

```
     front                     rear
       ↓                        ↓
     ┌──────┬──────┬──────┬──────┬──────┐
     │  3   │  4   │  5   │      │      │
     └──────┴──────┴──────┴──────┴──────┘
        0      1      2      3      4     ← indices
```

| 元素 | 细节 |
|---|---|
| 单元格尺寸 | W=72 H=40，cornerRadius=4 |
| 单元格样式 | 按 §6.0 矩形节点通用规范 |
| 索引 | 单元格下方，`fontSize: 10`，`fill: var(--color-text-secondary)` |
| **front 标签** | ink 蓝色虚线 + 标签 "front"，在队首元素**上方** |
| **rear 标签** | copper 色虚线 + 标签 "rear"，在队尾元素**上方** |
| 空槽 | 虚线边框（dash=[4,3]）空心矩形 |

**b) 链式队列**：

| 元素 | 细节 |
|---|---|
| 布局 | 水平排列，与链表相同 |
| 节点样式 | 与链表节点相同 |
| front/rear 标签 | 与循环队列相同 |
| 指针标签 | 按 §6.0 通用规范 |

---

### 6.6 堆（Heap）

**视觉隐喻**：树形布局（完全二叉树），圆形节点，数组索引标注。

```
                ┌───┐
                │ 9 │[0]
                └─┬─┘
           ┌──────┴──────┐
         ┌─┴─┐[1]     ┌─┴─┐[2]
         │ 7 │        │ 5 │
         └─┬─┘        └─┬─┘
       ┌───┴───┐    ┌───┴───┐
    [3]┌┴┐[4]  ┌┴┐[5] [6]
      │3│     │2│   │1│
      └─┘     └─┘   └─┘
```

| 元素 | 细节 |
|---|---|
| 节点形状 | 圆形，r=20 |
| 节点样式 | 按 §6.0 圆形节点通用规范 |
| 布局 | 完全二叉树：左子=2i+1，右子=2i+2 |
| 边 | teal 1.5px，小箭头 |
| 数组索引 | 节点下方 6px，`fontSize: 9`，`fill: var(--color-text-secondary)`，格式 `[i]` |
| 指针标签 | 按 §6.0 通用规范（新增！之前缺失） |
| 上浮/下沉动画 | 路径上节点依次高亮 `color-copper-light`，250ms stagger |

---

### 6.7 图（Graph）

**视觉隐喻**：圆形顶点均匀分布在圆上，有向边用 teal 箭头。

```
         [0]
        /   \
       /     \
    [1]───────[2]
      \       /
       \     /
        [3]
```

| 元素 | 细节 |
|---|---|
| 顶点形状 | 圆形，r=22（GRAPH_NODE_RADIUS） |
| 顶点样式 | 按 §6.0 圆形节点通用规范 |
| 顶点标签 | 居中，`fontSize: 12`，`fontWeight: 500` |
| 顶点下标 | 顶点下方 4px，`fontSize: 9`，`fill: var(--color-text-secondary)` |
| 边 | 直线箭头，从源顶点边缘到目标顶点边缘，teal 1.5px |
| 边权重（可选） | 在边中点偏移处，`fontSize: 9`，`fill: var(--color-text-secondary)` |
| 布局 | 圆形布局（均匀分布），半径 `min(140, canvasSize*0.35)` |
| BFS 染色 | 已访问节点 fill → `color-teal-light`，当前层节点 fill → `color-ink-light` |
| DFS 染色 | 当前路径节点 fill → `color-ink-light`，回溯节点 fill → color-surface |
| 指针标签 | 按 §6.0 通用规范（新增！之前缺失） |

---

### 6.8 哈希表（Hash Map）

**视觉隐喻**：桶数组水平排列 + 链表垂直挂链，桶用靛蓝色边框。

```
   [0]      [1]      [2]      [3]
  ┌────┐  ┌────┐  ┌────┐  ┌────┐
  │    │  │ 5  │→│ 2  │  │ 7  │
  └────┘  └──┬─┘  └────┘  └──┬─┘
             │               │
          ┌──┴──┐         ┌──┴──┐
          │  8  │         │  3  │
          └─────┘         └──┬──┘
                             │
                          ┌──┴──┐
                          │  1  │
                          └─────┘
```

| 元素 | 细节 |
|---|---|
| 桶节点尺寸 | W=88 H=40，cornerRadius=4 |
| 桶节点样式 | `fill: #ffffff`，`stroke: #7986cb`（保留靛蓝色区分桶），`strokeWidth: 1.5` |
| 桶索引 | 左上角，`fontSize: 10`，`fill: #7986cb`，格式 `[N]` |
| 桶内值 | 居中偏右，`fontSize: 12`，`fontWeight: 500` |
| 链节点尺寸 | W=88 H=44，cornerRadius=4 |
| 链节点样式 | 按 §6.0 矩形节点通用规范 |
| 水平链箭头 | teal 1.5px |
| 空桶 | 桶样式 + 文字 "—"，`fill: var(--color-text-tertiary)` |

**模式区分**：
- **拉链法**：桶 + 右侧水平链表（如上图）
- **开放定址法**：仅桶数组，有值的桶正常显示，空桶显示 "—"，被标记删除的显示 "✕"（`color-red`）

**指针标签**（新增！之前哈希表缺失）：按 §6.0 通用规范，在链节点下方。

---

### 6.9 B 树（B-Tree）

**视觉隐喻**：横向多 key 矩形块，棕色系边框，子节点从 key 间隙向下引出。

```
               ┌─────────┐
               │ 5  │ 12 │                   ← 内部节点
               └──┬──┼──┬┘
              ┌───┘  │  └───┐
         ┌────▼──┐ ┌─▼──┐ ┌─▼────┐
         │ 3 │ 6 │ │ 8  │ │15│20 │          ← 叶子节点
         └───────┘ └────┘ └──────┘
```

| 元素 | 细节 |
|---|---|
| 节点块高度 | 48px（BTREE_KEY_H + BTREE_NODE_PAD*2） |
| 节点块宽度 | 动态：`keys.length * (BTREE_KEY_W + BTREE_KEY_GAP) - BTREE_KEY_GAP + BTREE_NODE_PAD*2` |
| 节点块样式 | `fill: #ffffff`，`stroke: #8d6e63`（棕色），`strokeWidth: 1.5`，`cornerRadius: 4` |
| 单个 key 格 | W=32 H=28，`cornerRadius: 3`，`fill: #f5f3f0`，`stroke: #d7ccc8`，`strokeWidth: 1` |
| key 文字 | `fontSize: 12`，`fontWeight: 500`，`fill: var(--color-text)`，居中 |
| 边 | 从父节点 key 间隙底部 → 子节点顶部中心，棕色 `#8d6e63`，1.5px |
| 层间距 | 90px（BTREE_LAYER_GAP） |
| 叶子节点 | 无向下边 |
| 指针标签 | 按 §6.0 通用规范（新增！之前缺失） |

**B+ 树额外元素**：

| 元素 | 细节 |
|---|---|
| 颜色主题 | 绿色系：`stroke: #689f38`，边 `#689f38`，key 格 `fill: #f1f8e9` `stroke: #aed581` |
| 叶子同级链接 | 水平虚线箭头（dash=[4,3]），淡绿 `#aed581`，指向前驱和后继叶子 |

---

### 6.10 递归树（Recursion Tree）

**视觉隐喻**：自上而下的调用树，每层表示递归深度。

```
                    fib(5)
                       │
           ┌───────────┴───────────┐
        fib(4)                 fib(3)
           │                       │
      ┌────┴────┐            ┌────┴────┐
   fib(3)    fib(2)       fib(2)    fib(1)
```

| 元素 | 细节 |
|---|---|
| 节点尺寸 | W=120 H=40，cornerRadius=4 |
| **活跃节点** | `fill: var(--color-ink-light)`，`stroke: var(--color-ink)`，`strokeWidth: 1.5`，`opacity: 1` |
| **已返回节点** | `fill: var(--color-surface-alt)`，`stroke: var(--color-border)`，`strokeWidth: 1`，`opacity: 0.4` |
| 边 | teal 1.5px，从父节点底部 → 子节点顶部 |
| 标签 | `fontSize: 12`，`fontWeight: 500`，显示函数名（`fields.function`） |
| 返回值标注 | 节点右下角，`fontSize: 9`，`fill: var(--color-teal)`，格式 `→ N` |
| 指针标签 | 不适用（递归树没有指针概念） |
| 层间距 | 70px |
| 最小兄弟间距 | 30px |

---

### 6.11 Canvas 点阵网格实现

```typescript
// 伪代码 — 在 CanvasArea/index.tsx 中新增一个 Konva Layer
function DotGridLayer({ width, height, stageX, stageY, stageScale }: {
  width: number; height: number; stageX: number; stageY: number; stageScale: number;
}) {
  const DOT_SPACING = 24; // px between dots
  const DOT_RADIUS = 1;   // 2px diameter
  const DOT_COLOR = '#ece9e2';
  
  // Calculate visible range based on stage position and scale
  const startX = Math.floor(-stageX / stageScale / DOT_SPACING) * DOT_SPACING;
  const startY = Math.floor(-stageY / stageScale / DOT_SPACING) * DOT_SPACING;
  const endX = startX + width / stageScale + DOT_SPACING;
  const endY = startY + height / stageScale + DOT_SPACING;
  
  const dots = [];
  for (let x = startX; x <= endX; x += DOT_SPACING) {
    for (let y = startY; y <= endY; y += DOT_SPACING) {
      dots.push(<Circle key={`${x},${y}`} x={x} y={y} radius={DOT_RADIUS} fill={DOT_COLOR} />);
    }
  }
  
  // Fade out at low zoom
  const opacity = stageScale < 0.5 ? (stageScale - 0.25) / 0.25 : 1;
  
  return (
    <Layer listening={false} opacity={Math.max(0, Math.min(1, opacity))}>
      {dots}
    </Layer>
  );
}
```

---

## 7. 动画设计

### 7.1 动画原则

- **意义驱动**：每个动画表达因果关系（节点被创建、指针移动、值改变）
- **时长统一**：微交互 150–250ms，结构变化 250–400ms
- **easing**：进入用 EaseOut（减速），退出用 EaseIn（加速）
- **尊重 reduced-motion**：检测 `prefers-reduced-motion`，全部动画秒切（duration=0）
- **不影响输入**：动画期间 UI 保持可交互

### 7.2 动画映射表

| 差分类型 | 动画 | 时长 | Easing |
|---|---|---|---|
| `node_created` | 节点 scale 0→1 + opacity 0→1 | 300ms | EaseOut |
| `node_removed` | 节点 scale 1→0 + opacity 1→0 | 250ms | EaseIn |
| `value_changed` | 旧值缩小 0.6x + 灰化 → 新值从 teal 色放大到正常 | 300ms | EaseOut |
| `pointer_relocated` | 指针标签沿 edge 路径平移到新节点 | 250ms | EaseInOut |
| `edge_rewired` | 旧连线淡出 + 新连线从节点伸展 | 250ms | EaseOut |
| `pointer_arrived` | 标签 opacity 0→1 + 节点边框脉冲一次 | 200ms | EaseOut |
| `pointer_departed` | 标签 opacity 1→0 | 200ms | EaseIn |
| `element_compared` | 单元格 fill → ink-light → 恢复 | 250ms × 2 | EaseInOut |
| `element_swapped` | 两个单元格 fill → copper-light + 值更新 | 400ms | EaseInOut |
| `node_pushed` | 新节点从 push 方向偏移滑入 | 300ms | EaseOut |
| `node_popped` | 节点缩小 + opacity → 0 | 250ms | EaseIn |
| `node_path_swapped` | 路径上节点依次闪烁 copper-light，stagger 150ms | 150ms × N | EaseInOut |

### 7.3 Canvas 缩放/平移

- **Ctrl+滚轮缩放**（现有实现保留，因为触控板双指缩放被浏览器保留）：
  - 缩放范围：0.25× ~ 3×
  - 缩放原点：光标位置
- **左键拖拽平移**：拖拽时 `cursor: grabbing`
- 所有变换即时跟随（非动画），保证操作手感

---

## 8. UX 检查清单

（来源：ui-ux-pro-max §1–§3 / CRITICAL + HIGH）

### 8.1 无障碍 (CRITICAL)

- [x] 正文对比度 `#1c1c1c` on `#fafaf7` = 17:1（WCAG AAA）
- [x] 强调色对比度 `#1e4d7b` on `#ffffff` = 8.5:1（WCAG AAA）
- [x] 铜色对比度 `#b8703d` on `#ffffff` = 4.6:1（WCAG AA — 仅用于 10px+ 文字/图标/边框，合规）
- [x] 所有可交互元素有 focus ring（`2px solid var(--color-ink)`，2px offset）
- [x] 纯图标按钮有 `aria-label`（ControlBar 按钮、折叠箭头等）
- [x] Canvas 空状态用文字说明，不纯靠图形
- [x] 颜色不是唯一信息载体 — 状态指示器同时包含颜色圆点和文字标签
- [x] `prefers-reduced-motion: reduce` → 所有动画 duration=0

### 8.2 交互 (CRITICAL)

- [x] ControlBar 按钮最小 44×44px 触摸区域（Web 端：36px 高度 × 足够宽的 padding）
- [x] 按钮间距 ≥ 8px
- [x] 异步操作期间 Step 按钮显示 loading 状态，防止重复点击
- [x] hover 不能是唯一交互方式（所有操作可通过点击完成）
- [x] 断点设置/取消有即时视觉反馈（左键 gutter margin）

### 8.3 性能 (HIGH)

- [x] JetBrains Mono 使用 `font-display: swap`，避免 FOIT
- [x] Canvas 点阵仅渲染可视区域（虚拟化）
- [x] Canvas 节点数 > 500 时降级渲染（简化边/标签）
- [x] 动画只使用 `transform` 和 `opacity`（Konva 层叠优化）

### 8.4 布局 (HIGH)

- [x] 移动端优先断点：375 / 768 / 1024 / 1440
- [x] 无横向滚动（移动端）
- [x] Code Editor 最小宽度 20%（防止被挤压消失）
- [x] Variable Panel 最小高度 15%
- [x] Canvas 最小高度 25%

---

## 9. 实施路线图

### Phase 1 — Design Token 基础设施

| # | 任务 | 文件 |
|---|---|---|
| P1.1 | 创建 `design-tokens.css`，定义全部 CSS custom properties | 新文件 `src/design-tokens.css` |
| P1.2 | 更新 `index.css`：引入 Google Fonts，导入 tokens，全局 body/font 覆盖 | `src/index.css` |
| P1.3 | 更新 `tailwind.config.js`：对齐新色板（如需保留 Tailwind） | `tailwind.config.js` |
| P1.4 | 更新 `index.html`：移除旧 Tailwind body class，设置正确的 font-family | `index.html` |

### Phase 2 — 组件重样式

| # | 任务 | 文件 |
|---|---|---|
| P2.1 | Header：新颜色、字体、状态指示器颜色 | `src/components/Header.tsx` |
| P2.2 | TemplatePicker：新颜色、字体、卡片样式 | `src/components/TemplatePicker.tsx` |
| P2.3 | ControlBar：按钮重设计（色、字体、间距）、步骤历史弹窗 | `src/components/ControlBar.tsx` |
| P2.4 | VariablePanel：分区样式、表格样式、折叠箭头 | `src/components/VariablePanel.tsx` |
| P2.5 | AnnotationPanel：标注列表样式 | `src/components/AnnotationPanel.tsx` |
| P2.6 | App 布局：Grid 分隔条颜色更新 | `src/App.tsx` |

### Phase 3 — Monaco 主题

| # | 任务 | 文件 |
|---|---|---|
| P3.1 | 创建 `defineTheme('cppviz-light', ...)` | `src/components/CodeEditor.tsx` |
| P3.2 | 更新装饰颜色：执行行 = `ink-light`，错误行 = `red-light`，断点 = `red` | `src/components/CodeEditor.tsx` |

### Phase 4 — Canvas 可视化重设计

| # | 任务 | 文件 |
|---|---|---|
| P4.1 | 更新 `constants.ts`：颜色常量替换为 design token 引用 | `src/components/CanvasArea/constants.ts` |
| P4.2 | 新增点阵网格 Layer（`DotGridLayer`） | `src/components/CanvasArea/index.tsx` |
| P4.3 | 统一所有渲染器的节点/边/文字颜色（按 §6.0 通用规范） | 全部 `renderers/*.tsx` |
| P4.4 | 统一所有渲染器的指针标签（样式 + 新增缺失的） | 全部 `renderers/*.tsx` |
| P4.5 | 统一所有渲染器的空状态样式 | 全部 `renderers/*.tsx` |
| P4.6 | 设置所有 Konva Text 的 `fontFamily: 'JetBrains Mono'` | 全部 `renderers/*.tsx` |
| P4.7 | 更新动画颜色（比较=ink-light，交换=copper-light 等） | `src/components/CanvasArea/index.tsx` |

### Phase 5 — 验证 & 打磨

| # | 任务 |
|---|---|
| P5.1 | 深色模式不需要做（本项目仅浅色主题） |
| P5.2 | 测试 375px / 768px / 1024px / 1440px 断点 |
| P5.3 | 测试 reduced-motion 下无动画 |
| P5.4 | 测试键盘导航（Tab 顺序、focus ring 可见） |
| P5.5 | 测试全部 28 个模板的可视化效果 |

---

> **文档版本**：v1.0
> **日期**：2026-06-24
> **状态**：设计阶段完成，待代码实施
> **下次更新**：实施 Phase 1–5 后更新为 v1.1
