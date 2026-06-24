# C/C++ 代码运行过程可视化 — 设计文档

> **目标用户**：个人开发者，用于理解复杂数据结构与算法代码
> **核心体验**：逐行步进 → 可前进/后退 → 指针位置实时可视化
> **版本**：v0.10
>
> **📐 前端视觉规范**：§4 是前端设计的唯一权威来源。所有前端修改必须先阅读 §4（Design Token、组件样式、Canvas 渲染器规格、动画映射表），严格遵循其中规范。

---

## 目录

1. [产品概述](#1-产品概述)
2. [架构总览](#2-架构总览)
3. [后端设计](#3-后端设计)
4. [前端设计 — “Graph Paper”](#4-前端设计--graph-paper-视觉系统)
   - [4.1 设计哲学](#41-设计哲学)
   - [4.2 技术选型](#42-技术选型)
   - [4.3 Design Token 系统](#43-design-token-系统)
   - [4.4 页面布局](#44-页面布局)
   - [4.5 组件样式](#45-组件样式)
   - [4.6 Monaco 编辑器主题](#46-monaco-编辑器主题)
   - [4.7 Canvas 可视化系统](#47-canvas-可视化系统)
   - [4.8 动画设计](#48-动画设计)
   - [4.9 前端状态机](#49-前端状态机)
   - [4.10 Canvas 颜色常量速查表](#410-canvas-颜色常量速查表)
   - [4.11 UX 检查清单](#411-ux-检查清单)
5. [通信协议](#5-通信协议)
6. [数据结构可视化方案](#6-数据结构可视化方案)
7. [开发路线图](#7-开发路线图)
8. [关键技术细节](#8-关键技术细节)
9. [风险与备选方案](#9-风险与备选方案)

---

## 1. 产品概述

### 1.1 一句话描述

> 一个 Web 端的 C/C++ 代码逐行执行可视化工具，支持时间旅行调试，直观展示指针、数据结构在内存中的状态变化。

### 1.2 核心功能

| 功能 | 优先级 | 说明 |
|---|---|---|
| 逐行步进执行 | P0 | Step Over / Step Into，每一步都更新可视化 |
| 后退上一步 | P0 | 通过状态快照栈回退，不需要反向执行程序 |
| 指针位置显示 | P0 | 在结构图中标注指针变量当前指向哪个节点 |
| 源码高亮当前行 | P0 | Monaco Editor 中高亮正在执行的行 |
| 变量面板 | P0 | 显示当前作用域内所有变量的名称、类型、值 |
| 断点设置 | P1 | 运行到断点停止 |
| 运行到光标 | P1 | 从当前位置跑到光标所在行 |
| 重置执行 | P1 | 清除状态，回到程序入口 |
| 变量修改 | P2 | 在执行中修改变量值 |
| 多文件支持 | P2 | 支持多个源文件 |
| 项目级别索引 | P3 | 跨文件 Call Graph / 继承图 |

### 1.3 能可视化的数据结构（三级实现，参考 802 考纲）

> **考纲依据**：重庆邮电大学 2026 年 802《数据结构》+ F031《算法设计与分析》考试大纲（见附录 C）。
> 所有数据结构按照「考研应试刚需 → 进阶理解 → 高阶/研究级」分为三级。

#### Level 1 — 核心必做（P0，考研 802 全覆盖 + 高频考点）

| 数据结构 | 存储方式 | 对应 802 考点 |
|---|---|---|
| **线性表 — 顺序存储** | 数组，含动态扩容 | 一、(二)-1 顺序存储 |
| **线性表 — 链式存储** | 单向链表、双向链表、循环链表 | 一、(二)-2 链式存储 |
| **栈** | 顺序栈 + 链栈 | 二、(二)(三) 栈的顺序/链式存储 |
| **队列** | 顺序循环队列 + 链式队列 + 双端队列 | 二、(二)(三) 队列的顺序/链式存储 |
| **二叉树** | 链式存储（left/right 指针）、顺序存储 | 三、(二)-1/2 二叉树定义/存储 |
| **二叉搜索树 (BST)** | 链式存储 | 五、(七)-1 二叉搜索树 |
| **平衡二叉树 (AVL)** | 链式存储，含四种旋转动画 | 五、(七)-2 平衡二叉树 |
| **哈夫曼树** | 链式存储，含构建过程 | 三、(四)-1 哈夫曼树 |
| **堆（大顶堆/小顶堆）** | 数组存储 | 六、(七) 堆排序相关 |
| **图 — 邻接矩阵** | 二维数组 | 四、(二)-1 邻接矩阵法 |
| **图 — 邻接表** | 数组 + 链表 | 四、(二)-2 邻接表法 |
| **哈希表** | 拉链法 + 开放定址法 | 五、(六) 散列表 |

#### Level 2 — 进阶必做（P1，802 全覆盖 + 重要扩展）

| 数据结构 | 存储方式 | 对应 802 考点 |
|---|---|---|
| **线索二叉树** | 链式 + 线索标志位 | 三、(二)-4 线索二叉树 |
| **B 树** | 多路存储，含插入/删除分裂合并动画 | 五、(五) B 树及其基本操作 |
| **B+ 树** | 多路存储，展示与 B 树的区别 | 五、(五) B+ 树基本概念 |
| **树与森林** | 双亲/孩子/兄弟表示法，含与二叉树互转 | 三、(三) 树、森林的存储与转换 |
| **特殊矩阵压缩** | 对称矩阵、三角矩阵、稀疏矩阵的三元组 | 二、(五) 特殊矩阵压缩存储 |
| **广义表** | 头尾链表存储结构 | 二、(八) 广义表定义与存储 |
| **邻接多重表 / 十字链表** | 图的链式存储变体 | 四、(二)-3 邻接多重表 |
| **多维数组** | 行优先/列优先映射到一维 | 二、(四) 多维数组存储 |

#### Level 3 — 高阶扩展（P2，F031 算法设计 + 进阶主题）

| 数据结构 | 存储方式 | 对应考点 |
|---|---|---|
| **红黑树** | 链式，含变色/旋转动画 | F031 六-3 平衡查找树扩展 |
| **跳跃表** | 多层链表 | LeetCode 经典 / 算法导论 |
| **不相交集（并查集）** | 数组存储，含路径压缩 | F031 九 Kruskal 算法依赖 |
| **线段树 / 树状数组** | 数组存储 | 竞赛 / 区间查询经典 |
| **Trie 字典树** | 多叉链式 | 字符串算法经典 |
| **自定义 struct** | 内存布局图（GDB 遍历） | cpp-visualizer 独有功能 |
| **环形缓冲区** | 数组 | 系统编程 / 网络缓冲 |

### 1.4 不做什么

- 不是在线 IDE（不提供编辑 + 运行 + 调试完整工作流）
- 不是性能分析工具（不做火焰图、内存泄漏检测）
- 不追求多线程可视化的完整性（太难，先只做单线程）

---

## 2. 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         浏览器（前端）                              │
│                                                                    │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐   │
│  │ Monaco      │  │ 右侧面板（上下结构）                        │   │
│  │ Editor      │  │                                           │   │
│  │             │  │  ┌─────────────────────────────────────┐  │   │
│  │ 高亮当前行  │  │  │ 可视化画布 (Canvas / Konva.js)       │  │   │
│  │ 断点标记    │  │  │ - 链表/二叉树/数组/图 的图形化展示    │  │   │
│  │             │  │  │ - 拖拽平移 + 滚轮缩放                │  │   │
│  └─────────────┘  │  │ - 差分动画（节点弹出/值闪烁）        │  │   │
│                   │  └─────────────────────────────────────┘  │   │
│                   │  ┌─────────────────────────────────────┐  │   │
│                   │  │ 信息面板                              │  │   │
│                   │  │ - 局部变量（解引用显示）              │  │   │
│                   │  │ - 调用栈                             │  │   │
│                   │  │ - 标注管理（链表/二叉树/监视）       │  │   │
│                   │  └─────────────────────────────────────┘  │   │
│                   └──────────────────────────────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 控制栏                                                       │   │
│  │ [后退 ◀] [▶ 前进一步] [⏩ 运行到断点] [↺ 重置] [步进模式切换]  │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────┬──────────────────────────────────────────────┘
                    │ HTTP API（JSON 通信）
                    │
┌───────────────────▼──────────────────────────────────────────────┐
│                         后端（Python）                              │
│                                                                    │
│  ┌───────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ Session       │  │ LLDB Controller│  │ Code Compiler       │  │
│  │ Manager       │  │ (子进程桥接)    │  │                     │  │
│  │               │  │                │  │ - 接收用户代码      │  │
│  │ - 用户会话管理 │  │ - 起 LLDB 进程  │  │ - 写入临时文件      │  │
│  │ - 超时清理    │  │ - step/next    │  │ - clang++ 编译      │  │
│  │ - 资源隔离    │  │ - break/watch   │  │ - 返回编译错误      │  │
│  │               │  │ - info locals   │  │                     │  │
│  └───────────────┘  └────────────────┘  └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 后端设计

### 3.1 技术选型

| 组件 | 选型 | 理由 |
|---|---|---|
| HTTP 框架 | FastAPI（Python） | WebSocket 原生支持，async 友好 |
| GDB 驱动 | `pygdbmi`（Python GDB MI 接口） | 解析 GDB Machine Interface 输出，稳定可靠 |
| 编译器 | 系统安装的 `clang++` 或 `g++` | 必须带 `-g` 调试符号 |
| 代码格式化 | `clang-format` | 保证展示一致性 |
| 安全隔离 | Docker 容器 | 用户代码在容器内编译执行，不污染宿主机 |

### 3.2 核心 API 设计

```
POST   /api/session              → 创建新会话，返回 session_id
POST   /api/session/:id/load     → 加载源码，编译（-g），启动 GDB
POST   /api/session/:id/step     → 执行一步，返回当前完整状态
POST   /api/session/:id/back     → 从服务器快照栈退回一步
POST   /api/session/:id/run-to   → 运行到指定行/断点
POST   /api/session/:id/reset    → 重置：杀 GDB，清快照，重新编译
DELETE /api/session/:id          → 清理会话资源

POST   /api/session/:id/annotate → 更新用户对数据结构的标注
POST   /api/session/:id/eval     → 在暂停点执行任意表达式
POST   /api/session/:id/set-var  → 修改变量值

GET    /api/health               → 健康检查
```

### 3.3 GDB Controller 设计要点

```
GDB 会话生命周期：
1. 用户提交代码 → 写临时文件 → clang++ -g -O0 source.cpp -o binary
2. 起 GDB：gdb -quiet -interpreter=mi2 ./binary
3. 设断点在 main 入口：break main
4. run → 停在 main 第一行 → 初始化状态快照
5. 循环：等待前端指令 → step/next → 抓状态 → 返回快照 → 压入历史栈
6. 收到 back 指令 → 从历史栈 pop → 不需要操作 GDB（不移动程序计数器）
7. 但：如果用户后退后又往前走 → 需要 GDB 实际 step 到目标行
```

**后退的实现细节（重要）：**

```
服务器维护两层状态：

┌─────────────────────────┐
│  history_stack          │  [snap_0, snap_1, snap_2, ..., snap_cur]
│                         │  snap_N = 第 N 步时的完整状态
└─────────────────────────┘

┌─────────────────────────┐
│  gdb_current_position   │  当前 GDB 实际停在哪一行
│                         │  （只增不降，GDB 不能反着跑）
└─────────────────────────┘

"前进一步" 的三种情况：
  Case A: gdb 位置 == history 栈顶位置 → 正常 step，push 新快照
  Case B: gdb 位置 < 目标位置 → GDB 继续 step 直到追上
  Case C: gdb 位置 > 目标位置（用户回退后改了代码）→ 清空 GDB，重跑

"后退一步"：
  history_stack.pop()
  返回 history_stack[-1] 的快照
  GDB 本身不受影响（保持在原位置）
```

### 3.4 State Snapshot 数据结构

```json
{
  "step_number": 15,
  "source_line": 23,
  "file": "main.cpp",
  "current_function": "mergeTwoLists",
  "call_stack": [
    {"function": "main", "line": 42, "file": "main.cpp"},
    {"function": "mergeTwoLists", "line": 23, "file": "main.cpp"}
  ],
  "locals": [
    {
      "name": "slow",
      "type": "ListNode*",
      "value": "0x5555555a3c40",
      "display_value": "{val=3, next=…}",
      "is_pointer": true,
      "deref_type": "ListNode"
    },
    {
      "name": "fast",
      "type": "ListNode*",
      "value": "0x5555555a3c80",
      "display_value": "{val=5, next=…}",
      "is_pointer": true,
      "deref_type": "ListNode"
    },
    {
      "name": "counter",
      "type": "int",
      "value": "3",
      "is_pointer": false
    }
  ],
  "watched_expressions": [
    {"expression": "slow->val", "value": "3"},
    {"expression": "*fast", "value": "{val = 5, next = 0x5555555a3ca0}"}
  ],
  "heap_structures": [
    {
      "annotation_name": "list1",
      "structure_type": "linked_list",
      "root_node_addr": "0x5555555a3c40",
      "nodes": [
        {
          "addr": "0x5555555a3c40",
          "label": "ListNode(3)",
          "fields": {"val": 3, "next": "0x5555555a3c60"},
          "pointers_pointing_here": ["slow"]
        },
        {
          "addr": "0x5555555a3c60",
          "label": "ListNode(4)",
          "fields": {"val": 4, "next": "0x5555555a3c80"},
          "pointers_pointing_here": []
        },
        {
          "addr": "0x5555555a3c80",
          "label": "ListNode(5)",
          "fields": {"val": 5, "next": "0x5555555a3ca0"},
          "pointers_pointing_here": ["fast"]
        }
      ],
      "cycle_detected": false
    }
  ],
  "stdout": "",
  "is_terminated": false,
  "exit_code": null
}
```

### 3.5 内存遍历器（v0.8 auto_discover 自动化大部分调用）

```python
# 手动调用 API（v0.2–v0.7 主入口，v0.8+ 降级为兜底）
# auto_discover() 自动生成 Annotation → 内部调用这些 walker

class MemoryWalker:
    """
    根据标注，从 LLDB 中遍历 heap 数据结构。
    标注来源：
      - auto_discover() 自动生成（v0.8 默认）— inspect_type 获取字段布局
      - 手动 @viz 注释（兜底）— 字段名不常规时使用
    """

    def walk_linked_list(self, gdb, head_addr, next_field):
        """从 head 出发，沿 next 走完整个链，检测环"""
        nodes = []
        visited = set()
        addr = head_addr
        while addr != "0x0" and addr != "0":
            if addr in visited:
                # 检测到环
                return nodes, True
            visited.add(addr)
            node = self.read_struct(gdb, addr)
            nodes.append(node)
            addr = node["fields"].get(next_field, "0x0")
        return nodes, False

    def walk_binary_tree(self, gdb, root_addr, left_field, right_field):
        """递归遍历二叉树"""
        if root_addr in ("0x0", "0"):
            return None
        node = self.read_struct(gdb, root_addr)
        node["left"] = self.walk_binary_tree(
            gdb, node["fields"][left_field], left_field, right_field
        )
        node["right"] = self.walk_binary_tree(
            gdb, node["fields"][right_field], left_field, right_field
        )
        return node

    def read_struct(self, gdb, addr):
        """用 GDB x 命令读取 struct 内存内容"""
        # gdb.execute(f"x/10gx {addr}")
        # 解析 struct 各字段的值
        ...
```

### 3.6 安全隔离

```
每个用户会话的隔离策略：
┌──────────────────────────────────────────┐
│ Docker 容器（每个会话独立）                │
│                                           │
│ - CPU 限制：1 核                          │
│ - 内存限制：512 MB                        │
│ - 执行超时：30 秒                         │
│ - 磁盘：只读 rootfs + tmpfs 临时目录       │
│ - 网络：完全禁用（--network=none）         │
│ - 禁止的系统调用：fork, exec, socket 等    │
│ - seccomp 策略：最小权限                  │
│                                           │
│ 容器内运行：编译过程 + GDB + 目标程序      │
│ 宿主机只负责：HTTP 服务 + 容器管理         │
└──────────────────────────────────────────┘
```

备选方案（开发阶段）：开发时不启动 Docker，直接在宿主机跑。加 `ulimit` 限制，且不上生产环境。

---

## 4. 前端设计 — “Graph Paper” 视觉系统

> **设计方向**：工程实验笔记本 — 暖白纸页、普鲁士蓝墨水、铜色指针、石墨网格
> **核心风险**：为开发者工具做浅色主题（行业内几乎全员深色）
> **版本**：v1.0
> **设计工具**：frontend-design（设计思维）+ ui-ux-pro-max（色板/字体/UX 规则）
> **最后更新**：2026-06-24

---

### 4.1 设计哲学

**产品身份**：C/C++ Visualizer 是一个教学/理解工具——用户用它来**观看代码在内存中执行**。它不是 IDE，而是一台「软件示波器」：把指针、堆内存、数据结构变化这些肉眼不可见的东西，变成可以逐帧观察的图形。

**为什么选浅色**：几乎每一个代码可视化工具都默认深色主题。这个工具的用户大部分是**学习者**——他们在看书、记笔记、画草稿。一个暖白纸页的浅色环境，让数据结构图看起来像课本插图，这恰好是学习场景中最自然的信息载体。

**三大 cliché 对照**：

| AI 设计模板 | 本设计 |
|---|---|
| 暖黄底 + 衬线体 + 陶土红 | 暖白底（更冷更中性），无衬线 UI + 等宽代码，蓝/铜双色 |
| 纯黑底 + 荧光绿/朱红 | 浅色主题，完全不适用 |
| 报纸式排版 + 极细线 | 清晰的卡片/面板布局，非密集列排版 |

**不做的事**：不做渐变按钮、玻璃态、发光阴影。不做装饰性动画 — 仅保留功能性过渡。不用 emoji 做图标 — 全部 SVG。Canvas 不显示 C++ 类型名和内存地址 — 仅展示关键值和指针标签。

---

### 4.2 技术选型

| 组件 | 选型 | 理由 |
|---|---|---|
| 框架 | React 18+ | 生态成熟，状态管理方便 |
| 语言 | TypeScript | 类型安全 |
| 代码编辑器 | Monaco Editor | 语法高亮、断点、diff 开箱即用 |
| 可视化渲染 | Konva.js (react-konva) | Canvas 图形操作灵活，性能好 |
| 布局引擎 | 手写（链表/栈/队列/数组）+ 自实现树/图布局 | 可控性优先 |
| 动画 | Konva.Tween + requestAnimationFrame | 节点级精准动画控制 |
| WebSocket | 原生 WebSocket API | 双向实时通信 |
| 状态管理 | Zustand | 轻量，不引入 Redux 复杂度 |
| CSS | Tailwind CSS + CSS Custom Properties | Token 化色彩系统 + 原子类 |

---

### 4.3 Design Token 系统

#### 4.3.1 色板

| Token | Hex | 用途 |
|---|---|---|
| `--color-page` | `#fafaf7` | 页面底色 — 暖白纸 |
| `--color-surface` | `#ffffff` | 面板、卡片、编辑器背景 |
| `--color-surface-alt` | `#f5f4f0` | 交替行底色、hover 态 |
| `--color-border` | `#e4e1da` | 分割线、卡片边框 |
| `--color-grid` | `#ece9e2` | Canvas 点阵网格 — 坐标纸 |
| `--color-ink` | `#1e4d7b` | 主强调色 — 普鲁士蓝。按钮、链接、执行行高亮 |
| `--color-ink-light` | `#eaf1f7` | Ink 浅色 — 选中背景 |
| `--color-ink-hover` | `#163d62` | Ink 深色 — 按钮 hover |
| `--color-copper` | `#b8703d` | 指针强调色 — 铜迹线。指针标签、内存地址 |
| `--color-copper-light` | `#fdf3e8` | Copper 浅色 — 指针标签背景 |
| `--color-teal` | `#2d8a7b` | 数据强调色 — 深绿松石。图边、数据节点 |
| `--color-teal-light` | `#edf7f5` | Teal 浅色 |
| `--color-red` | `#c4312b` | 错误/断点 — 红笔批改色 |
| `--color-red-light` | `#fef5f5` | Red 浅色 — 错误背景 |

**文字色阶**：`--color-text` `#1c1c1c` | `--color-text-secondary` `#6b6b65` | `--color-text-tertiary` `#9c9b95`

**语义状态色**：idle=`#9c9b95` | ready=`#1e4d7b` | stepping/running=`#2d8a7b` | rewinding=`#b8703d` | paused=`#1e4d7b` | terminated=`#6b6b65` | error=`#c4312b`

#### 4.3.2 字体

| 角色 | 字体 | 权重 |
|---|---|---|
| **UI** | IBM Plex Sans | 400 / 500 / 600 |
| **代码** | JetBrains Mono | 400 / 500 |
| **Canvas** | JetBrains Mono | 400 / 500 |

Google Fonts 导入：
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

**字号阶梯**：body=13px | ui=12px | caption=11px | code=13px | canvas-node=12px | canvas-label=10px | display=14px

#### 4.3.3 间距、圆角、阴影、边框

- **间距**：4px 基准（4/8/12/16/24）
- **圆角**：sm=3px | md=4px | lg=6px
- **阴影**：仅 `--shadow-popover: 0 4px 24px rgba(0,0,0,0.10)` 用于弹窗，其他表面用边框区分层次
- **边框**：`--border-hairline: 1px solid var(--color-border)` | `--border-focus: 2px solid var(--color-ink)` | `--border-active: 1.5px solid var(--color-ink)`

---

### 4.4 页面布局

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

- Header=40px，ControlBar=36px
- 垂直/水平分隔条=4px，默认透明，hover→`color-border`，drag→`color-ink`
- Code Editor 宽度 20%–75%，Canvas 最小 25%，Variable Panel 最小 15%
- 响应式断点：<768px 上下堆叠，768–1024px Editor 35%，>1024px Editor 40%

---

### 4.5 组件样式

**Header（40px）**：`color-page` 背景 + hairline 底边。标题 `font-mono 14px weight-500 tracked 0.04em`。状态指示器 8px 圆点（按语义色）+ 12px `font-ui` 标签。

**TemplatePicker**：`color-surface` 卡片 + `shadow-popover`。搜索 `font-mono 13px`。分类标题 `font-ui 10px weight-600 color-text-tertiary`。模板按钮 `font-ui 12px weight-500`，选中态 `ink-light` 背景。

**ControlBar（36px）**：`color-surface` 背景 + hairline 顶边。次要按钮透明/无色，hover→`surface-alt`。主要 Step 按钮 `ink` 背景+白字。步骤历史弹窗 `font-mono 11px`，当前步左边 2px `ink` 指示条。

**VariablePanel**：分区标题 `font-mono 11px weight-500 color-text-secondary tracked`。局部变量表格：变量名 `font-mono 12px color-copper`，类型 `color-text-secondary`，值 `color-text`，指针值 `color-teal`。程序输出区 `surface-alt` 背景。

**分隔条**：默认与背景同色，hover→`color-border`，drag→`color-ink`。

---

### 4.6 Monaco 编辑器主题

自定义浅色主题 `cppviz-light`：

- **Token 颜色**：comment=`#9c9b95` | keyword=`#1e4d7b` bold | string=`#2d8a7b` | number=`#b8703d` | type=`#1e4d7b`
- **编辑器色彩**：背景 `#ffffff`，行高亮 `#fafaf7`，选区 `#eaf1f7`，光标 `#1e4d7b`，行号 `#c5c2ba`，gutter `#fafaf7`
- **装饰**：执行行=ink-light 整行高亮，错误行=red-light 背景+3px red 左边，断点=red 实心圆点
- **设置**：fontSize=13，lineHeight=22，fontFamily=JetBrains Mono，minimap=false

---

### 4.7 Canvas 可视化系统

#### 4.7.0 全局规范（所有渲染器遵循）

**背景**：`color-page` 底色 + 24px 间距点阵网格（2px 直径圆，`color-grid`），缩放 <0.5x 时淡出。

**节点**：
- 矩形（链表/数组/栈/队列/哈希桶/B树）：默认 `fill=#ffffff stroke=#e4e1da 1.5px`，有指针时 `stroke=#1e4d7b`。cornerRadius=4px，无阴影。
- 圆形（树/图/堆）：默认 `fill=#ffffff stroke=#e4e1da 1.5px`，有指针时 `stroke=#1e4d7b`。半径 20–22px，无阴影。

**边**：所有边 `stroke=#2d8a7b 1.5px`（B树保留棕色 `#8d6e63`，B+树保留绿色 `#689f38`）。

**指针标签**：1px dashed copper 连接线 + 白底 copper 边框标签 + copper 文字。`fontFamily=JetBrains Mono fontSize=10 weight=500`。

**文字**：所有 Canvas Text → `fontFamily='JetBrains Mono'`。节点值 fontSize=12 fill=text。索引 fontSize=10 fill=text-secondary。

**空状态**：60×40 虚线矩形（`fill=surface-alt stroke=border dash=[4,3]`）+ "EMPTY" 文字（fontSize=11 JetBrains Mono text-tertiary）。

#### 4.7.1 链表

水平排列，矩形节点 W=88 H=44，间距 70px。正向箭头居中（cy），teal 1.5px。双向链表反向箭头 cy + 8px。NULL 标记 `∅`。指针标签在节点下方。

#### 4.7.2 二叉树

圆形节点 r=20，层级展开，层高 72px。边为直线 teal 1.5px。NULL 子节点用空心小圆（r=4）。当前访问节点 fill=ink-light，搜索路径节点 fill=teal-light。

#### 4.7.3 数组

矩形单元格 W=72 H=40，间距 4px。索引标注在下方。指针标签在上方。排序比较动画→ink-light，交换动画→copper-light。

#### 4.7.4 栈

垂直堆叠，自下而上增长。矩形 W=88 H=36 cornerRadius=3。top 指示器用 copper 虚线+标签在栈顶上方。链式栈与链表节点相同。

#### 4.7.5 队列

循环队列：水平排列 W=72 H=40，front 标签 ink 色在上方，rear 标签 copper 色在上方。链式队列与链表节点相同。

#### 4.7.6 堆

圆形节点 r=20，完全二叉树布局（2i+1/2i+2）。teal 边。数组索引在节点下方。

#### 4.7.7 图

圆形顶点 r=22，圆形布局。teal 有向边。BFS 染色→teal-light/ink-light，DFS 染色→ink-light。

#### 4.7.8 哈希表

桶 W=88 H=40 stroke=#7986cb（靛蓝）。链节点与链表节点相同。拉链法：桶+水平链。开放定址：仅桶数组，空桶 "—"，已删 "✕" red。

#### 4.7.9 B 树 / B+ 树

B 树：横排 key 格（32×28），棕色边框 `#8d6e63`。B+ 树：绿色边框 `#689f38`，叶子节点间水平虚线箭头。

#### 4.7.10 递归树

W=120 H=40。活跃节点 fill=ink-light stroke=ink。已返回节点 fill=surface-alt stroke=border opacity=0.4。teal 边。

---

### 4.8 动画设计

**原则**：意义驱动、时长统一（微交互 150–250ms，结构变化 250–400ms）、进入 EaseOut 退出 EaseIn、尊重 reduced-motion。

| 差分类型 | 动画 | 时长 |
|---|---|---|
| `node_created` | scale 0→1 + opacity 0→1 | 300ms EaseOut |
| `node_removed` | scale 1→0 + opacity 1→0 | 250ms EaseIn |
| `value_changed` | 旧值缩小灰化 → 新值 teal 放大恢复 | 300ms |
| `pointer_relocated` | 标签沿 edge 平移 | 250ms EaseInOut |
| `edge_rewired` | 旧连线淡出 + 新连线伸展 | 250ms |
| `element_compared` | fill→ink-light→恢复 | 250ms×2 |
| `element_swapped` | fill→copper-light + 值更新 | 400ms |
| `node_pushed` | 从偏移方向滑入 | 300ms EaseOut |
| `node_popped` | 缩小+fade | 250ms EaseIn |
| `node_path_swapped` | 路径节点依次闪烁，stagger 150ms | 150ms×N |

**缩放/平移**：Ctrl+滚轮缩放（0.25×–3×，光标原点），左键拖拽平移。

---

### 4.9 前端状态机

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

### 4.10 Canvas 颜色常量速查表

用于代码实现时的快速参考（对应 `CanvasArea/constants.ts`）：

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

### 4.11 UX 检查清单

- 正文对比度 `#1c1c1c` on `#fafaf7` = 17:1（WCAG AAA）
- Ink Blue `#1e4d7b` on white = 8.5:1（WCAG AAA）
- Copper `#b8703d` on white = 4.6:1（WCAG AA，仅用于 10px+ 文字/图标/边框）
- 所有可交互元素有 focus ring（2px ink，2px offset）
- `prefers-reduced-motion: reduce` → 所有动画 duration=0
- `font-display: swap` 防止 FOIT
- 颜色不是唯一信息载体（状态同时有色点+文字标签）

---

## 5. 通信协议

### 5.1 WebSocket 消息格式

```json
// ========== 前端 → 后端 ==========

// 加载代码
{"type": "load", "payload": {"code": "...", "annotations": [...]}}

// 步进指令
{"type": "step", "payload": {"mode": "step_over"}}
{"type": "step", "payload": {"mode": "step_into"}}
{"type": "step", "payload": {"mode": "step_out"}}

// 运行到指定行
{"type": "run_to", "payload": {"line": 42}}
{"type": "run_to", "payload": {"mode": "next_breakpoint"}}

// 后退
{"type": "back", "payload": {"steps": 1}}
{"type": "back", "payload": {"steps": 5}}  // 一次回退多步

// 重置
{"type": "reset"}

// 设置/删除断点
{"type": "set_breakpoint", "payload": {"line": 15}}
{"type": "remove_breakpoint", "payload": {"line": 15}}

// 修改变量
{"type": "set_var", "payload": {"name": "counter", "value": "10"}}

// 执行表达式
{"type": "eval", "payload": {"expression": "slow->next->val"}}

// 更新标注
{"type": "update_annotations", "payload": {"annotations": [...]}}


// ========== 后端 → 前端 ==========

// 编译结果
{"type": "compiled", "payload": {"success": true}}

// 编译错误
{"type": "compile_error", "payload": {"errors": [{"line": 10, "message": "..."}]}}

// 状态快照（每次步进/后退后推送）
{"type": "snapshot", "payload": {...}}  // 内容见 3.4 节

// 程序终止
{"type": "terminated", "payload": {"exit_code": 0, "stdout": "..."}}

// 错误
{"type": "error", "payload": {"message": "GDB 通信超时"}}

// 运行时输出
{"type": "stdout", "payload": {"text": "Hello World\n"}}
```

### 5.2 通信模式（v0.5 实现）

**当前模式：WebSocket 为主，HTTP 为回退**

- WebSocket 端点 `/ws/{session_id}` — 持久连接，双向 JSON 消息
- 前端 `WebSocketClient` 类 — 自动重连（指数退避，最多 5 次）
- Zustand store 双通道：`wsClient?.connected` 时优先 `ws.send()`，否则 `api.xxx()` HTTP fallback
- Vite dev proxy 同时代理 `/api`（HTTP）和 `/ws`（WebSocket）
- HTTP REST API 完整保留，断网或 WS 故障时无缝降级
- 消息类型与 §5.1 一致：`load`/`step`/`back`/`forward`/`run_to`/`reset`/`set_breakpoint`/`remove_breakpoint`/`eval`

---

## 6. 数据结构可视化方案

### 6.1 为什么需要标注 — 调试器给你内存，不给你语义

LLDB/GDB 本质上是**内存查看器**，不是代码理解器。它能告诉你：

```
变量 slow → 类型 ListNode* → 值 0x5555555a3c40 → 解引用得到 {val=3, next=0x5555555a3c60}
```

但它**不知道**：

| LLDB 不知道的事 | 为什么不知道 | 需要用户告诉什么 |
|---|---|---|
| 这是什么数据结构 | 同样两个指针字段，可能是链表（next+prev）也可能是二叉树（left+right） | **struct_type** — 决定用哪种遍历策略 |
| 从哪个变量开始走 | 代码里可能有 head、curr、prev、temp 一堆指针，哪个算「入口」| **root_var** — 指定遍历起点 |
| 哪个字段是「下一个」 | 字段名叫 next 还是 succ、link、nxt 完全取决于程序员命名 | **next_field / left_field / right_field** — 连接关系 |
| 数组有几个元素 | `new int[n]` 之后，LLDB 只看到 `int*`，长度信息 n 是运行时变量，不在指针类型里 | **length_var** — 读到第几个停止 |

#### 链表 vs 数组 — 为什么一个有「天然终点」另一个没有

链表自带终止哨兵：最后一个节点的 `next == nullptr`，walker 碰到 `0x0` 自然停。数组是裸内存块，地址连续，没有边界标记 — 不告诉它停在哪，它会一直读下去（读到其他变量、已释放内存、甚至段错误）。

```
链表: [1|→] → [2|→] → [3|→] → nullptr   ✅ 走到 null 自动停
数组: [1][2][3][?][?][?]...                ❌ 没有哨兵，必须给 n
```

#### 这个设计的历史定位

v0.2–v0.7：标注是**主要入口**。系统对代码一无所知，用户通过 `@viz` 注释或表单告诉系统一切。

v0.8+：`auto_discover` 通过 `inspect_type`（LLDB 类型自省）自动获取字段布局 + 分类，标注**降级为兜底** — 只在字段命名不常规或 auto_discover 判断出错时手动纠正。

### 6.2 自动识别 — 让系统适应代码（v0.5 引入，v0.8 成熟）

> **设计哲学转折**：v0.7 之前是「用户适应系统」（学 `@viz` 语法、填表单），v0.8 之后是「系统适应代码」（你写你的，系统自动看懂）。

**auto_discover 如何消除上述四个手动输入：**

```
用户代码:                            auto_discover 自动获取:
  ListNode* head = new ListNode(1);   → 变量名 = "head"
  ListNode* test = head->next->next;  → 变量名 = "test"
  ListNode* prev = nullptr;           → 值为 null → 跳过
  ListNode* curr = head;              → 变量名 = "curr"
                                      ↓
                         inspect_type("ListNode") →
                         fields: [{name:"val", is_pointer:false},
                                  {name:"next", is_pointer:true, points_to_same_type:true}]
                                      ↓
                         1 个同类型指针字段 → linked_list
                         next_field = "next"
```

| 旧标注需要的输入 | auto_discover 怎么拿到 |
|---|---|
| struct_type（链表/树/数组）| 统计同类型指针字段数量：1 个 → 链表，2 个 → 二叉树。数组通过正则匹配类型字符串 `int [N]` |
| root_var（从哪个变量开始）| 遍历 `locals` 中所有 `is_pointer=true` 的变量 |
| next_field / left_field / right_field | `inspect_type` 返回字段列表，直接拿到字段名 |
| length_var（数组长度）| 栈数组从类型字符串 `int [8]` 提取 `8`；堆数组 `new int[n]` 仍需手动（见下文） |

**auto_discover 的已知局限：**

| 场景 | 为什么还搞不定 | 兜底方案 |
|---|---|---|
| 堆数组 `int* arr = new int[n]` | LLDB 看到 `int*`，不知道 `n` 是长度还是普通 int | 手动标注 `length_var=n` 或表达式 |
| 字段命名不常规 `succ` / `link` | 自定义 struct 叫 `next`/`left`/`right` 才匹配最佳 | 手动标注 `next_field=succ` |
| AVL 树 / 红黑树 | 多了 `height`/`bf`/`color` 字段，但不影响链表/树分类 | v0.9 B2 计划识别 |
| 双向链表 | 2 个同类型指针字段，当前会被分到二叉树 | v0.9 B2 计划增加 prev 检测 |

**前提条件**：编译时带 `-g` 调试符号，确保 LLDB 能拿到完整类型信息。

### 6.3 可视化动画的触发机制 — 快照差分检测

> **核心思想**：不试图“理解 C++ 代码的语义”，而是**比较前后两帧快照的差异**，从差异中自动判定发生了什么操作，再生成对应动画。
> GDB 提供的是内存的 ground truth，差分结果天然正确。

#### 6.3.1 为什么不用「代码语义分析」？

```
❌ 方案 A：解析 C++ 代码语义
   问题：C++ 语法极复杂（模板/宏/重载/指针运算），解析代码来"知道用户在干什么"几乎不可能。
   例子：*p = node->next;  // 这是修改指针还是赋值？语义取决于上下文

❌ 方案 B：Hook malloc / new
   问题：不是所有数据结构都通过 malloc 创建（可能是栈上数组、全局变量、STL 容器）。
   而且 hook 只能检测分配，检测不到修改、删除、指针移动。

✅ 方案 C：快照差分（Snapshot Diffing）
   原理：每执行一步，遍历一次完整数据结构。比较两次遍历的结果，差异即"发生了什么操作"。
   不需要理解源代码语义 — GDB 替我们读出了所有状态。
```

#### 6.3.2 差分检测流程

```
每次用户点击 "前进一步" 之后，后端执行：

  Step 0: GDB 执行 step/next
  Step 1: Memory Walker 遍历数据结构 → 得到 current_snapshot（当前快照）
  Step 2: 和 previous_snapshot（上一帧快照）做 diff
  Step 3: 将 diff 结果分类为操作类型
  Step 4: 返回 {snapshot, diff_actions} 给前端
  Step 5: 前端根据 diff_actions 播放对应动画

diff 算法核心（逐个标注的数据结构做）：

  previous = prev_snapshot.heap_structures[i]
  current = curr_snapshot.heap_structures[i]

  prev_nodes = {addr: node for node in previous.nodes}
  curr_nodes = {addr: node for node in current.nodes}

  new_addrs      = curr_nodes.keys() - prev_nodes.keys()   // 新增的节点
  deleted_addrs  = prev_nodes.keys() - curr_nodes.keys()   // 被删除/释放的节点
  common_addrs   = prev_nodes.keys() & curr_nodes.keys()   // 存活的节点

  对 common_addrs 中的每个节点：
    对比每个 field 的值：
      - 指针字段变了 → pointer_relocated（比如 slow = slow->next）
      - 值字段变了 → value_changed（比如 node->val = 5）
      - 节点标签变了 → node_modified（比如 ListNode(3) → ListNode(99)）

  对 pointers_pointing_here 的变化：
      - 某地址新出现指针标签 → pointer_arrived
      - 某地址指针标签消失 → pointer_departed
```

#### 6.3.3 差分 → 动画映射表

| diff 检测到 | 判定条件 | 生成的动画类型 | 视觉表现 |
|---|---|---|---|
| `node_created` | addr ∈ curr 且 addr ∉ prev | 节点创建动画 | 新节点从上方滑入 / 从中心放大出现 |
| `node_removed` | addr ∈ prev 且 addr ∉ curr | 节点删除动画 | 节点缩小 + 淡出 + 连线收缩 |
| `value_changed` | 同 addr，非指针字段值变了 | 值修改动画 | 旧值缩小灰化 → 新值放大高亮 → 恢复 |
| `pointer_relocated` | 同 addr，指针字段指向了不同的 addr | 指针移动动画 | 指针标签沿连线平移到新节点上方 |
| `edge_rewired` | 指针字段从 addr_A→addr_B 变为 addr_A→addr_C | 连线重连动画 | 旧连线断开淡出 + 新连线从节点伸展 |
| `pointer_arrived` | pointers_pointing_here 列表增加 | 指针到达动画 | 指针标签在节点上方淡入 + 节点边框脉冲 |
| `pointer_departed` | pointers_pointing_here 列表减少 | 指针离开动画 | 指针标签淡出，节点边框恢复默认 |
| `no_change` | 没有任何字段/节点变化 | 无动画 | 仅执行行高亮，图形保持静止 |

#### 6.3.4 具体示例：链表插入操作

```
用户代码：
  // @viz linked_list(L) head=head.next_field=next
  ListNode* new_node = new ListNode(4);    // 第 10 行
  new_node->next = curr->next;             // 第 11 行
  curr->next = new_node;                   // 第 12 行

执行到第 10 行后 → 差分检测到：
  - 堆上出现新地址 0x...C80（但不在链表遍历路径中）
  → 分类：node_created（游离节点，尚未连入链表）
  → 动画：新节点从上方滑入，半透明显示（游离状态）

执行到第 11 行后 → 差分检测到：
  - 0x...C80 的 next 字段从 0x0 变为 0x...D00
  - 但链表从 head 出发还访问不到这个新节点
  → 分类：value_changed（新节点内部变化）+ edge_rewired（新节点→后继）
  → 动画：新节点伸出一条连线指向 curr->next

执行到第 12 行后 → 差分检测到：
  - curr 节点(0x...B00)的 next 字段从 0x...D00 变为 0x...C80
  - 0x...C80 现在出现在链表遍历路径中（从 head 可达）
  → 分类：edge_rewired（curr→next 重新指向新节点）
  → 动画：旧连线断开，新连线从 curr 连到新节点，新节点变为实色（已入链）
```

#### 6.3.5 为什么这个方案可靠？

```
1. GDB 是 ground truth — 内存里有什么就是什么，不存在误解
2. 与源代码语义解耦 — 不管是 malloc/new/数组/全局变量，
   只要内存里出现了数据结构，遍历就能发现
3. 自动适应任何操作 — 插入/删除/修改/旋转/交换，
   都是节点和字段的增删改，差分统一处理
4. 天然支持时间旅行 — 快照栈已经存了每一帧的完整状态，
   后退时直接切换，不需要"反向动画"
5. 一个 diff 算法覆盖所有数据结构 —
   链表/树/图/数组只是遍历方式不同，diff 逻辑完全相同
```

#### 6.3.6 动画与执行步的关系

```
一个重要细节：GDB 执行一行代码 = 一个 step；但一行代码可能产生多个 diff 变化。

例如：swap(a, b) → 一行代码产生两个 value_changed

前端处理：
  1. 收到一帧的 diff_actions = [action1, action2, ...]
  2. 按 action 类型的优先级排序（先删后增，让动画有层次）
  3. 并行执行独立动画（不同节点的变化可以同时播）
  4. 所有动画播放完毕 → 高亮代码移动到下一行
  5. 用户可拖动时间轴看动画过程（v0.5+）

动画时长参考：
  - 指针移动：300ms（沿连线平移动画）
  - 节点创建：400ms（滑入 + 弹性效果）
  - 节点删除：300ms（缩小淡出）
  - 值修改：300ms（旧值→新值过渡）
  - 整体一帧：所有动画并行，最长路径 ≤ 500ms
```

### 6.4 可视化的代码与图形互锁

```
双向联动：
  代码 → 图形：
    - 执行到某行时，相关变量变化 → 图形更新
    - 点击代码中的变量名 → 在图形中高亮对应元素

  图形 → 代码：
    - 鼠标悬停图形中的节点 → 代码编辑器中高亮该节点对应的代码行
      （这个比较难，因为节点和源码行的对应关系不是直接的）
    - 点击节点 → 变量面板显示该节点的详细信息
```

---

## 7. 开发路线图

### v0.1 — 最小可用原型（MVP）

**目标：能 step，能看变量，能后退**

| 任务 | 预估 |
|---|---|
| FastAPI 后端骨架 | 会话创建/销毁 |
| GDB Controller | 编译代码 → 起 GDB → step → 抓 locals |
| State Snapshot | 构建 JSON 结构，history stack 压入弹出 |
| 前端骨架 | React + Monaco Editor + 控制栏 |
| 前端 ↔ 后端 | HTTP API 通信 |
| 变量面板 | 显示 locals 列表 |

### v0.2 — 链表可视化 ✅ 已完成

**目标：跑通一个完整的链表算法**

| 任务 | 状态 |
|---|---|
| 用户标注解析 | ✅ 前端标注输入 + 后端解析 + 融合 |
| Memory Walker - 链表 | ✅ 沿 next 遍历，检测环 |
| Canvas 链表渲染 | ✅ 节点矩形 + 连线 + 指针标签 |
| 指针动画 | ✅ slow/fast 移动动画 + 节点弹出动画 |
| 后退功能 | ✅ 快照栈 + history/future 双向 |
| 指针解引用 | ✅ 自定义 struct 遍历子字段显示 |

### v0.3 — 二叉树可视化 ✅ 已完成

**目标：跑通树遍历、BST 操作**

| 任务 | 状态 |
|---|---|
| Memory Walker - 二叉树 | ✅ BFS 遍历 left/right，返回节点 + 边 |
| Canvas 树渲染 | ✅ 圆形节点 + 层级自动布局 + 父子箭头连线 |
| 标注扩展 | ✅ @viz binary_tree 标注语法 |
| UI 布局调整 | ✅ 左侧代码 + 右侧上下分割（画布上/变量下） |
| 变量显示优化 | ✅ 隐藏原始地址，只显示解引用后的结构体内容 |
| Canvas 溢出处理 | ✅ 拖拽平移 + 滚轮缩放（0.25x ~ 3x） |

### v0.4 — 数组可视化 + 断点 ✅ 已完成

**目标：排序算法、二分搜索可视化**

| 任务 | 状态 |
|---|---|
| Memory Walker - 数组 | ✅ `walk_array`：LLDB 循环 evaluate `arr[i]`，返回索引+值+地址，max 500 元素 |
| Canvas 数组渲染 | ✅ 水平格子模式：72×40 单元格 + 索引标签 + watched 指针标签 |
| @viz array 标注 | ✅ `@viz array(A) var=arr.length_var=n` 正则解析 + VariablePanel 表单 |
| 断点系统 | ✅ 设置/删除/运行到断点，LLDB 层真正删除（`target.BreakpointDelete`）|
| 示例模板切换 | ✅ Header 下拉框 8 个模板：链表反转/找中点/BST搜索/BST插入/冒泡排序/二分查找/链表环检测/选择排序 |
| 断点移除修复 | ✅ `remove_breakpoint` 遍历 `target.GetNumBreakpoints()` 按行号+源文件匹配删除 |
| Watched 指针双相匹配 | ✅ Phase 1 地址匹配（指针变量）+ Phase 2 索引匹配（数组下标 i/j/lo/hi/mid）|

### v0.5 — 通信 + 自动识别 + 动画 ✅ 已完成

**目标：实时通信、零标注可视化、排序动画**

| 任务 | 状态 |
|---|---|
| WebSocket 通信 | ✅ `/ws/{session_id}` 端点，9 种消息类型，Zustand 双通道（WS 优先 → HTTP 回退），自动重连（指数退避最多 5 次）|
| 共享状态模块 | ✅ `backend/state.py` — `_debuggers`/`_compilers`/`_walkers` 等 7 个 dict + getter/setter，HTTP 和 WS 路由共享 |
| 自动识别 | ✅ `inspect_type` bridge 命令（`SBType.GetFields` 枚举）→ `MemoryWalker.auto_discover` → 无 @viz 标注时自动检测链表/二叉树/数组 |
| 排序动画 — 比较 | ✅ `element_compared` diff action：两元素格子闪黄（#ffa726, 0.3s）→ 恢复原色 |
| 排序动画 — 交换 | ✅ `element_swapped` diff action：两格闪橙（#ef6c00, 0.08s）→ 旧值灰化 → 更新文本 → 闪绿恢复（0.48s total）|
| back/forward 动画 | ✅ 后退/前进也计算 diff_actions 返回前端，时间旅行也有动画效果 |
| 前端 WebSocketClient | ✅ `connect()`/`send()`/`on()`/`disconnect()` + 自动重连，浏览器原生 WebSocket API |
| Vite WS 代理 | ✅ `/ws` 代理到 `ws://127.0.0.1:8000`，开发环境无缝 |

### v0.6 — 新数据结构 + 算法动画 + 体验增强 ✅ 已完成

**目标：802 考纲 Level 1 全覆盖，排序/遍历动画增强，历史时间轴**

#### 一、新数据结构（P0，802 考纲 Level 1 必做）

| 数据结构 | 类别 | @viz 标注 | 渲染要点 | 状态 |
|---|---|---|---|---|
| **栈（顺序栈）** | 线性表 — 顺序存储 | `@viz stack(S) var=arr.top_var=top` | 垂直堆叠格子 + top 箭头指示 | ✅ |
| **栈（链栈）** | 线性表 — 链式存储 | `@viz stack(S) var=top.next_field=next` | 复用链表渲染 + 栈顶标签 | ✅ |
| **队列（循环队列）** | 线性表 — 顺序存储 | `@viz queue(Q) var=arr.front_var=front.rear_var=rear` | 数组格子 + front/rear 指示器 | ✅ |
| **队列（链式队列）** | 线性表 — 链式存储 | `@viz queue(Q) var=front.next_field=next` | 复用链表渲染 + 队首队尾标签 | ✅ |
| **堆（大顶堆/小顶堆）** | 树 — 数组存储 | `@viz heap(H) var=arr.length_var=size` | 数组→树形布局（i→2i+1,2i+2）+ 圆节点 | ✅ |
| **邻接矩阵 / 邻接表（图）** | 图 — 两种存储 | `@viz graph(G) var=mat.mode=matrix` 或 `var=adj_list.size_var=n` | 圆形顶点布局 + 有向边箭头 | ✅ |
| **哈希表（拉链法）** | 查找 — 散列 | `@viz hashmap(H) var=table.mode=chaining` | 桶数组 + 链表挂链 | ✅ |
| **哈希表（开放定址法）** | 查找 — 散列 | `@viz hashmap(H) var=table.mode=open_addressing` | 槽位数组 + 空/占标记 | ✅ |

**关键技术实现：**
- 栈（顺序）复用 `walk_array` walker；栈（链式）复用 `walk_linked_list` walker
- 队列（循环）复用 `walk_array` walker；队列（链式）复用 `walk_linked_list` walker
- 堆：数组 walk → Canvas 层按完全二叉树关系 (2i+1, 2i+2) 计算树形坐标
- 图（邻接矩阵）：`_walk_adjacency_matrix` 遍历二维数组，`mat[i][j] != 0` 生成边
- 图（邻接表）：`_walk_adjacency_list` 遍历数组 + 链式边节点，生成顶点 + 有向边
- 哈希表（拉链）：`_walk_hashmap_chaining` 遍历桶数组 + 链式节点，生成桶→链边
- 哈希表（开放定址）：`_walk_hashmap_open_addressing` 遍历槽位，标记空/占

#### 二、算法动画增强（P1，v0.7 规划）

| 功能 | 说明 |
|---|---|
| **排序动画增强** | watched 指针（i, j, minIdx）直接推断比较/交换目标，不依赖 diff 交叉匹配；单步内区分「比较」和「交换」两个阶段 |
| **栈/队列操作动画** | push/pop/enqueue/dequeue 节点级动画（滑入、弹出、淡出） |
| **堆操作动画** | 上浮（sift-up）/ 下沉（sift-down）节点沿路径交换动画 |
| **图遍历动画** | BFS 队列扩张 + 节点染色；DFS 递归栈 + 回溯染色 |
| **递归树可视化** | 递归调用栈渲染为树形结构，展示分治过程 |

#### 三、体验增强（P1–P2，v0.7 规划）

| 功能 | 优先级 | 说明 |
|---|---|---|
| **历史步骤列表** | P1 | 左侧步骤时间轴，展示每步行号+操作摘要，点击任意步骤跳转（利用现有 history 栈，低成本）|
| **自动识别增强** | P1 | 识别更多结构（双向链表、循环链表、AVL），减少手动标注 |
| **Docker 隔离** | P2 | 编译安全加固，多用户编译/运行隔离 |

#### 当前进度总览

```
v0.1 ✅ 最小可用原型        v0.5 ✅ WebSocket + 自动识别 + 排序动画
v0.2 ✅ 链表可视化          v0.6 ✅ 9 种新数据结构 + 图/哈希表渲染
v0.3 ✅ 二叉树可视化        v0.7 ✅ auto_discover v2 + 面板折叠 + 画布拖拽 + stdout
v0.4 ✅ 数组可视化 + 断点    v0.8 ✅ 可视化目标勾选 + 即时过滤（标注降级为兜底）
                            v0.9 🎯 算法动画增强 + 体验升级（规划中）
                            v0.10 🚧 Level 2 部分完成（B树/B+树渲染+模板 ✅，栈方向修正 ✅，双链表双箭头 ✅，Ctrl+滚轮缩放 ✅，全部结构居中 ✅，指针标签位置修复 ✅；其余 Level 2 规划中）
```

---

### v0.7 — 多实例可视化 + 指针标注 + 交互体验 ✅ 已完成

**目标：多个数据结构实例正确区分、指针标签自动标注、面板折叠/画布拖拽/可调分隔条/stdout 输出**

#### 一、auto_discover v2 — 多实例支持 + 指针值显示

**核心改动：** 每个指针变量独立创建 Annotation（而不是每种类型只建一个），节点地址集去重合并。

| 任务 | 说明 |
|---|---|
| **per-variable 标注** | `auto_discover` 不再按 `deref_type` 去重，每个 `ListNode*` 指针各自生成 `auto_{var_name}` 标注 |
| **post-walk 去重** | 新增 `_dedup_structures()` — 比较节点地址 frozenset：完全匹配→合并（多个指针指向同一链），子集→合并到超集（小链是大链的一部分），互斥→保留独立结构 |
| **根变量标签** | 合并结构时收集各子结构的 `annotation_name`，注入 `pointers_pointing_here` 标签。主结构自身的 root 也加入标签（e.g., prev 节点上显示 `prev` 标签） |
| **空结构过滤** | `_dedup_structures` 丢弃 `nodes.length === 0` 的结构（nullptr root） → Canvas `nonEmptyStructures` 二次过滤 |
| **类型缓存** | `_type_cache` 字典缓存 `inspect_type` 结果，同 struct 类型只调一次 LLDB |
| **空指针跳过** | 新增 `_is_null_addr()` — 跳过值为 0x0 / 空 / 未初始化的指针，避免在 main 第一行就显示幽灵节点 |
| **垂直堆叠布局** | 多个结构体按 yOffset 垂直排列，`structLayouts` 累加布局 |

**效果：** 链表反转中 prev（反向链）和 curr（剩余链）在迭代过程中各自独立显示，节点上标注哪些指针指向它，互不干扰。

#### 二、指针值显示

| 层级 | 改动 |
|---|---|
| **LLDB 桥接层** | `_build_state` 对指针变量做 `Dereference()` → 读子成员非指针字段 → 格式化为 `{val=1, key=3}` 摘要 |
| **display_value** | `"0x5555555592b0 → {val=1}"` — 同时展示地址和指向的内容 |
| **前端 fmtDisplay** | 缩短地址为 `"…92b0 → {val=1}"`，完整地址在 title tooltip 中 |

#### 三、模板切换立即重置

| 改动 | 说明 |
|---|---|
| `loadTemplate()` | 切换模板时清空 `snapshot`、`status`、`diffActions`、`compileErrors`、`error` + 清除旧代码断点 |
| 效果 | 下拉切换模板 → 画布立即回 placeholder、状态灯灰色、变量面板清空，**不等点击运行按钮** |

#### 四、面板折叠 / 输出区 / 可调分隔条

| 功能 | 说明 |
|---|---|
| **折叠按钮** | 四个区域（📦局部变量 / 💻程序输出 / 📚调用栈 / 🏷️标注）均支持点击标题栏折叠/展开，默认展开变量+输出，折叠调用栈+标注 |
| **程序输出区** | LLDB 桥接层通过 `AddOpenFileAction(1, tmpfile)` 重定向调试进程 stdout → `_build_state` 读取 → 前端 `<pre>` 展示 |
| **可拖拽分隔条** | 垂直分隔条（代码区 ↔ 可视化区，20%–75%）+ 水平分隔条（画布 ↔ 变量面板，15%–85%），拖拽时 `col-resize` / `row-resize` 光标 |

#### 五、画布交互 — 左键拖拽平移

| 功能 | 说明 |
|---|---|
| **左键拖拽** | `mousedown` 记录起点 → `mousemove` 程序化 `scrollTo` → `mouseup` 结束，光标 `grab`/`grabbing` |
| **滚动** | `overflow: auto` 保留浏览器原生滚轮滚动 |

---

### v0.8 — 可视化目标选择交互 ✅ 已完成

**目标：运行后自动扫出候选变量 → 点击勾选即时过滤，标注降级为兜底**

#### 核心理念

当前手动标注需要用户记忆 `@viz linked_list(name) head=var.next_field=next` 语法或填写表单（选类型→填根变量→填字段名）。这些信息（类型归属、字段名）`auto_discover` 已经能自动推断出来，不需要用户重复输入。

#### 交互流程

```
写代码 → 系统调用 inspect_type 扫出所有可展示变量 →
  右侧面板列出：
  ┌─────────────────────────────┐
  │ 🎯 可视化目标                │
  │                             │
  │ ☑ head  (ListNode* → 链表)  │
  │ ☐ prev  (ListNode* → 链表)  │
  │ ☐ curr  (ListNode* → 链表)  │
  │ ☑ arr   (int[8] → 数组)    │
  │                             │
  │ [编译运行]                   │
  └─────────────────────────────┘
→ 勾选想展示的 → 运行 → 只渲染勾选的
→ 取消勾选 → 步进即可（过滤在渲染层，不用重新编译）
```

#### 关键改动点

| 改动 | 说明 |
|---|---|
| **前端「可视化目标」面板** | 替换现有标注表单，渲染成 checkbox 列表；每个候选项显示变量名 + 推断的类型（链表/树/数组） |
| **运行前候选扫描** | `loadCode` 前先调一次 `GetVariables` + `inspect_type` 获取候选列表（不启动完整调试会话，或用临时进程） |
| **前端 ws send 携带选中状态** | `{type: "load", payload: {..., selected_vars: ["head", "arr"]}}` — 只传勾选的变量名 |
| **后端过滤** | `_build_heap_structures` 收到 `selected_vars` 后，`auto_discover` 只对指定变量生成标注 |
| **动态调整** | 步进中取消勾选 → 前端过滤 `heap_structures` 渲染（不调后端），立即生效 |

#### 优势

| 对比 | 旧方式（v0.7） | 新方式（v0.8） |
|---|---|---|
| 用户记忆负担 | struct_type、root_var、next_field 名 | 变量名（代码里已有） |
| 操作 | 写注释 / 填 6 个表单字段 | 点一下勾选框 |
| 修改生效 | 重新编译运行 | 即时（纯前端过滤） |
| 多实例发现 | 手动每个指定 | 自动扫出全部，用户挑 |

---

### v0.9 — 算法动画增强 + 体验升级（部分完成 🚧）

**目标：排序/栈/队列/堆/图遍历动画提升 + 历史步骤时间轴 + 自动识别增强**

#### 一、已完成的体验增强（UI 重构）

| # | 任务 | 说明 |
|---|------|------|
| ✅ | **分类模板选择器** | 24 个模板按 6 大分类组织（链表/栈队列/树/堆图/数组查找/哈希表），卡片弹窗 + 搜索过滤，替换原生 `<select>` |
| ✅ | **步骤历史集成** | 控制栏"Step 5/20 ▾"按钮 → 点击弹出向上步骤列表弹窗（每行显示步号+行号+代码片段），点击跳转任意步骤 |
| ✅ | **@viz 标注交互重构** | 右键行号区域 → 弹出类型选择器（3 列网格，16 种类型）；Ctrl/Cmd/Alt + 左键行号区域作为备选快捷方式；点击弹窗外自动关闭 |
| ✅ | **标注面板简化** | 🏷️ 标注管理面板使用光标所在行作为插入位置，选择类型后自动检测变量名、自动生成标注，无需填写表单 |
| ✅ | **Level 1 全覆盖** | 新增 5 个模板（邻接矩阵图、哈希表开放定址、哈夫曼树、双端队列、循环队列），12 种 802 考纲 Level 1 数据结构全部覆盖 |
| ✅ | **Cmd+Click Mac 修复** | 修复 Mac 上 Cmd+Click 行号区域不触发 @viz 弹窗（Monaco 多光标拦截），改用 DOM 级 contextmenu 事件监听 |

#### 二、算法动画增强（P1，规划中）

| # | 任务 | 说明 |
|---|------|------|
| **A1** | **排序动画增强** | watched 指针（i, j, minIdx）直接推断比较/交换目标，不依赖 diff 交叉匹配。单步内区分「比较」和「交换」两个阶段 |
| **A2** | **栈/队列操作动画** | push/pop/enqueue/dequeue 节点级动画 — 新元素从上方滑入，弹出元素缩小淡出 |
| **A3** | **堆操作动画** | sift-up（上浮）/ sift-down（下沉）节点沿完全二叉树路径交换动画 |
| **A4** | **图遍历动画** | BFS 队列扩张 + 节点染色（层级推进，渐变色）；DFS 递归栈 + 回溯染色 |
| **A5** | **递归树可视化** | 递归调用栈渲染为树形结构，展示分治/回溯的调用树 |

#### 三、自动识别增强（P1，规划中）

| # | 任务 | 说明 |
|---|------|------|
| **B2** | **自动识别增强** | 识别更多结构 — 双向链表（检测 prev 字段）、循环链表（next 回到 head）、AVL 树（检测 balance_factor 字段）|

#### 四、当前进度总览

```
v0.1 ✅ 最小可用原型        v0.5 ✅ WebSocket + 自动识别 + 排序动画
v0.2 ✅ 链表可视化          v0.6 ✅ 9 种新数据结构 + 图/哈希表渲染
v0.3 ✅ 二叉树可视化        v0.7 ✅ auto_discover v2 + 面板折叠 + 画布拖拽 + stdout
v0.4 ✅ 数组可视化 + 断点    v0.8 ✅ 可视化目标勾选 + 即时过滤（标注降级为兜底）
                            v0.9 🚧 UI 重构 + @viz 交互 + L1 全覆盖 + 统一样式（算法动画待实现）
                            v0.10 🚧 Level 2 部分完成（B树/B+树渲染+模板 ✅，栈方向修正 ✅，双链表双箭头 ✅，Ctrl+滚轮缩放 ✅，全部结构居中 ✅，指针标签位置修复 ✅；其余 Level 2 规划中）
```

---

### v0.10 — Level 2 数据结构全覆盖（部分完成 🚧）

**目标：802 考纲 Level 2 全部实现，线索树/B树/B+树/森林/特殊矩阵/广义表/十字链表逐项突破**

#### 数据结构清单

| # | 数据结构 | @viz 标注语法 | 渲染要点 | 存储方式 |
|---|---------|---------------|---------|---------|
| **C1** | **线索二叉树** | `@viz threaded_tree(T) root=root` | 圆形节点 + 实线（子节点）/ 虚线（线索到前驱后继），线索标志位可视化 | 链式 + 线索标志位 |
| **C2** | **B 树** | `@viz btree(T) root=root.t=3` | 多路节点块（横向 keys 数组 + children 指针），插入/删除的分裂合并动画 | 多路存储 |
| **C3** | **B+ 树** | `@viz bplustree(T) root=root.t=3` | 内部节点 + 叶子层链表串联，区分 B 树（叶子和内部节点结构不同） | 多路存储 |
| **C4** | **树与森林** | `@viz forest(F) root=root` | 双亲/孩子/兄弟表示法三种视图切换 + 森林↔二叉树互转动画 | 双亲/孩子/兄弟表示法 |
| **C5** | **特殊矩阵压缩** | `@viz matrix(M) var=mat.mode=symmetric` | 对称/三角/稀疏矩阵的压缩存储映射 — 行优先压缩下标对应热力图 | 对称/三角/稀疏矩阵 |
| **C6** | **广义表** | `@viz glist(L) var=head` | 头尾链表存储结构，原子节点（圆角方块）+ 子表节点（嵌套框），递归渲染 | 头尾链表 |
| **C7** | **邻接多重表 / 十字链表** | `@viz multigraph(G) var=vertices` | 边节点 + 顶点节点的多重链接，无向图边共享、有向图十字链 | 链式存储变体 |

**关键技术实现：**
- C1 线索树：`walk_threaded_tree` → LLDB 读取 `ltag`/`rtag` 标志位 → 虚线/实线区分
- C2/C3 B 树/B+ 树：`walk_btree` → BFS 遍历 keys + children 数组 → 节点块水平排列
- C4 森林：`walk_forest` → 遍历孩子-兄弟链表 → Canvas 层三种表示法切换（双亲数组/孩子链表/兄弟链表）
- C5 矩阵压缩：`walk_compressed_matrix` → 展示逻辑索引 → 物理索引的映射关系 + 空白区灰色
- C6 广义表：`walk_glist` → 递归遍历 → 原子节点用圆角方块、子表用嵌套框
- C7 多重表：`walk_multigraph` → 边节点遍历 → 边→顶点→边 多重链接渲染

#### 每个结构独立为模块

```
每个 C 任务的实现模式（6 步）：
  Step 1: 后端 walker 方法（walk_xxx）
  Step 2: LLDB 桥接层 handler（handle_walk_xxx）
  Step 3: 前端 Canvas 渲染函数（renderXxx）
  Step 4: @viz 标注解析
  Step 5: 预设示例模板
  Step 6: VariablePanel 标注表单
```

---

## 8. 关键技术细节

### 8.1 示例模板系统

预设模板 28 个，按 6 大分类组织，通过顶部 Header 的分类卡片弹窗选择（支持搜索过滤）：

#### 链表（4 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 链表反转 | 🔗 | 三指针迭代反转，展示 prev/curr/next 指针移动 |
| 链表找中点 | 🔗 | 快慢指针法，slow 走一步 fast 走两步 |
| 链表环检测 | 🔗 | Floyd 判圈算法，检测环并找到环入口 |
| 双向链表 | 🔗 | 双 prev/next 指针的插入与删除操作 |

#### 栈 / 队列（5 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 顺序栈 | 📚 | 数组存储，栈顶 top 索引，push/pop 动画（从下往上增长） |
| 链式栈 | 📚 | 指针存储，top 节点为栈顶，push/pop + 删除动画 |
| 循环队列 | 🚶 | 顺序循环队列，front/rear 双指针 |
| 链式队列 | 🚶 | 链表存储，front/rear 指针，enqueue/dequeue |
| 双端队列 | 🚶 | 数组存储，两端均可 push/pop |

#### 树（5 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| BST 搜索 | 🌳 | 二叉搜索树查找，curr 指针沿树下降 |
| BST 插入构建 | 🌳 | 动态构建 BST，插入节点 + 指针追踪 |
| AVL 插入 | 🌳 | 平衡二叉树插入 + 四种旋转（LL/RR/LR/RL） |
| 哈夫曼树 | 🌳 | 哈夫曼编码树构建过程 |
| 斐波那契递归 | 🌀 | 递归树可视化，展示分治调用过程 |

#### 堆 / 图（5 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 大顶堆 | ⛰️ | 完全二叉树数组存储，插入上浮 + 删除下沉 |
| 邻接表图 | 🕸️ | 图的邻接表存储，顶点 + 边链表 |
| 邻接矩阵图 | 🕸️ | 图的邻接矩阵存储，二维数组可视化 |
| BFS 遍历 | 🕸️ | 广度优先搜索，队列扩张 + 节点层级染色 |
| DFS 遍历 | 🕸️ | 深度优先搜索，递归栈 + 回溯路径染色 |

#### 数组 / 查找（3 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 冒泡排序 | 📊 | 相邻比较交换，i/j 双指针 |
| 选择排序 | 📊 | 每轮选最小，i/j/minIdx 三指针 |
| 二分查找 | 📊 | lo/hi/mid 三指针，折半搜索 |

#### 哈希表（2 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 哈希表（拉链法） | #️⃣ | 桶数组 + 链表挂链，冲突处理可视化 |
| 哈希表（开放定址） | #️⃣ | 线性探测/二次探测，槽位状态可视化 |

#### B树 / B+树（4 个） 🆕

| 模板 | 图标 | 说明 |
|---|---|---|
| B树插入 (2-3树) | 🌲 | m=3 阶 B树，插入 8 个值（含分裂） |
| B树搜索 | 🌲 | 预建 3 层 B树，搜索目标 key=15 |
| B+树搜索 | 🌿 | m=4 阶 B+树，搜索 target=7 |
| B+树插入 | 🌿 | m=4 阶 B+树，插入 9 个值 + 叶子链表 |

### 8.1.1 自动识别（v0.5 新增）

当代码中没有 `// @viz` 标注时，系统自动检测数据结构：

1. 遍历 LLDB 局部变量 → 筛选 `is_pointer=True` 且 `deref_type` 非空的变量
2. 调用 `inspect_type` bridge 命令获取 struct 字段布局
3. 分类逻辑：
   - 2 个指向同类型的指针字段 → **二叉树**（优先 left/right 命名）
   - 1 个指向同类型的指针字段 → **链表**
4. 数组检测：正则匹配 `type [N]` 类型字符串 → **数组**
5. 自动生成 `auto_{var_name}` 标注，手动 @viz 标注始终优先

### 8.2 LLDB Python API 要点（当前实现）

项目使用 **LLDB**（非 GDB）作为调试后端。LLDB 的 Python 绑定绑定在 Xcode 的 Python 3.9 中，
通过子进程桥接（`lldb_bridge.py`）与 FastAPI 通信。

```python
import lldb

# 起程序
debugger = lldb.SBDebugger.Create()
target = debugger.CreateTarget("./binary", None, None, False, error)
target.BreakpointCreateByName("main")
process = target.Launch(launch_info, error)

# 步进
thread.StepOver()   # step over
thread.StepInto()   # step into
thread.StepOut()    # step out

# 获取局部变量
values = frame.GetVariables(True, True, False, False)
for i in range(values.GetSize()):
    val = values.GetValueAtIndex(i)
    name = val.GetName()
    type_name = val.GetTypeName()
    raw_value = val.GetValue()
    summary = val.GetSummary()

# 指针解引用
deref_val = val.Dereference()
if deref_val and deref_val.IsValid():
    for j in range(deref_val.GetNumChildren()):
        child = deref_val.GetChildAtIndex(j)

# 执行表达式
result = frame.EvaluateExpression("slow->val")

# 类型自省（v0.5 新增，供自动识别使用）
sbtype = target.FindFirstType("ListNode")
for i in range(sbtype.GetNumberOfFields()):
    field = sbtype.GetFieldAtIndex(i)
    field_name = field.GetName()       # "val", "next"
    field_type = field.GetType()
    type_name = field_type.GetName()   # "int", "ListNode *"
    pointee = field_type.GetPointeeType()  # 指针指向的类型
```

### 8.2 编译命令

```bash
# 必须用 -g 生成调试信息，-O0 禁用优化（保持源代码对应关系）
clang++ -g -O0 -std=c++17 -fstandalone-debug source.cpp -o binary

# -fstandalone-debug：在 macOS 上确保调试信息不会被剥离到 .dSYM 里
```

### 8.3 性能考虑

| 场景 | 耗时估算 | 优化方案 |
|---|---|---|
| 编译代码 | ~1-2 秒 | 缓存编译结果（代码 hash 相同时复用） |
| 单步执行 + 抓状态 | ~100-300ms | GDB step 本身就快；抓状态多了才慢 |
| 遍历长链表（1000+ 节点） | ~500ms | 分页，只遍历可视区域附近节点 |
| 后退一步（快照栈命中） | ~5ms | 纯内存操作，极快 |
| 后退到历史深处（需重跑） | ~(step数 × 100ms) | 每 10 步存一个完整 checkpoint |
| Docker 容器启动 | ~1-3 秒 | 预热容器池 |

### 8.4 边界情况处理

| 情况 | 处理 |
|---|---|
| 代码有无限循环 | 执行步数上限（如 10000 步），超时强制终止 |
| 代码 crash（段错误等） | GDB catch signal，返回 crash 信息 + 堆栈 + 最后的内存状态 |
| 模板代码 | 编译时实例化，-g 确保模板调试信息完整 |
| 宏 | 没有直接的可视化方式；预处理后用 `clang -E` 展示展开结果 |
| 指针悬挂 | 显示地址，标记为 "freed / invalid" |
| STL 容器 | 不做深度遍历（STL 内部太复杂），只显示 `.size()` 和摘要 |
| 递归过深 | 限制 Memory Walker 递归深度 |
| 大数组 | 只传输前 100 个元素 + 总数；前端懒加载滚动 |

### 8.5 手动标注（兜底语法，v0.8+ auto_discover 覆盖 90% 场景）

```cpp
// 基础用法
// @viz linked_list(mylist) head=head.next_field=next

// 双向链表
// @viz linked_list(dll) head=head.next_field=next.prev_field=prev

// 二叉树
// @viz binary_tree(bst) root=root.left_field=left.right_field=right

// 有父指针的树
// @viz binary_tree(t) root=root.left_field=left.right_field=right.parent_field=parent

// 数组
// @viz array(nums) ptr=nums.length_field=size

// 自定义图
// @viz graph(g) start=0.edges_field=neighbors

// 关注特定指针的移动（这些指针在可视化中显示标签）
// @viz watch(slow, fast, curr)

// 复合结构（一个数据结构里有另一个）
// @viz linked_list(outer) head=heads.next_field=next
//   @viz linked_list(inner) head=node->sublist.next_field=next
```

---

## 9. 风险与备选方案

### 9.1 主要风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| GDB 在某些平台上不稳定 | 步进失败 | 重试机制 + 多 GDB 版本兼容测试 |
| C++ 模板/STL 太复杂 | 遍历困难 | 限制范围，STL 容器只读 size/empty |
| Docker 部署复杂 | 部署门槛高 | 开发阶段不用 Docker，本地直接跑 |
| 用户代码安全性 | 服务器被攻击 | Docker 强隔离 + seccomp + 无网络 |
| 可视化性能 | 大结构图渲染卡 | Canvas 而非 SVG，虚拟化渲染 |

### 9.2 备选方案

| 原方案 | 备选 | 何时启用 |
|---|---|---|
| GDB 后端驱动 | 插桩（Instrumentation）方案 | GDB 不稳定时 |
| Docker 隔离 | exec 沙箱（nsjail / firejail） | Docker 太重时 |
| Canvas 手绘渲染 | vis-network + D3.js | 手绘太复杂时快速替代 |
| HTTP 轮询 | WebSocket | 需要更实时推送时 |
| Python FastAPI | Go + delve 调试器 | Python GDB 接口有性能瓶颈时 |

---

## 附录 A：参考资料

| 项目 | 链接 | 参考价值 |
|---|---|---|
| Python Tutor | https://pythontutor.com/ | UI/UX 参考，但只有 Python/JS/Java |
| GDBgui | https://www.gdbgui.com/ | 浏览器端 GDB 前端 |
| rr | https://rr-project.org/ | 时间旅行调试，可参考其录制/重放机制 |
| Godbolt | https://godbolt.org/ | 编译输出展示 |
| Sourcetrail | https://github.com/CoatiSoftware/Sourcetrail | C++ 代码索引可视化，已停更但思路可参考 |
| pygdbmi | https://github.com/cs01/pygdbmi | GDB MI 接口 Python 封装 |
| Konva.js | https://konvajs.org/ | Canvas 图形库 |
| dagre | https://github.com/dagrejs/dagre | 有向图分层布局 |
| ElkJS | https://github.com/kieler/elkjs | 更现代的图布局引擎 |

## 附录 B：环境要求

| 依赖 | 最低版本 | 用途 |
|---|---|---|
| Python | 3.11+ | 后端 |
| Node.js | 18+ | 前端构建 |
| clang++ 或 g++ | clang 14+ / gcc 12+ | 编译 C++ 代码 |
| GDB | 12+ | 调试驱动 |
| Docker | 24+ | 安全隔离（可选，开发阶段不需要） |

---

> **文档版本**：v0.10
> **最后更新**：2026-06-23
> **状态**：v0.10 B树/B+树渲染 + 模板已完成；栈增长方向修正 + top指示器统一样式；双向链表双箭头；Ctrl+滚轮缩放；所有结构居中；指针标签位置修复
