# C/C++ 代码运行过程可视化 — 设计文档

> **目标用户**：个人开发者，用于理解复杂数据结构与算法代码
> **核心体验**：逐行步进 → 可前进/后退 → 指针位置实时可视化
> **版本**：v0.3，持续迭代

---

## 目录

1. [产品概述](#1-产品概述)
2. [架构总览](#2-架构总览)
3. [后端设计](#3-后端设计)
4. [前端设计](#4-前端设计)
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

### 3.5 内存遍历器

```python
# 伪代码，表示逻辑而非实现

class MemoryWalker:
    """
    根据用户标注，从 GDB 中遍历 heap 数据结构。
    用户标注格式（写在代码注释中）：
      // @viz linked_list(list1) head=l1.next_field=next
      // @viz binary_tree(tree1) root=root.left_field=left.right_field=right
      // @viz array(arr1) ptr=data.length_field=size
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

## 4. 前端设计

### 4.1 技术选型

| 组件 | 选型 | 理由 |
|---|---|---|
| 框架 | React 18+ | 生态成熟，状态管理方便 |
| 语言 | TypeScript | 类型安全 |
| 代码编辑器 | Monaco Editor（VS Code 的编辑器核心） | 语法高亮、断点、diff 等开箱即用 |
| 可视化渲染 | Canvas API（手绘）或 **Konva.js / PixiJS** | 图形操作灵活，性能好 |
| 布局引擎 | 手写（链表简单）+ **dagre / elkjs**（树/图自动布局） | dagre 对 DAG/树支持好 |
| 动画 | CSS Transitions / requestAnimationFrame | 指针移动、节点高亮过渡动画 |
| WebSocket 客户端 | 原生 WebSocket API | 简单够用 |
| 状态管理 | Zustand 或 React Context + useReducer | 轻量，不引入 Redux 的复杂度 |
| CSS | Tailwind CSS | 快速出 UI |

### 4.2 页面布局

**当前布局（v0.3）：左侧代码，右侧上下分割（画布上 + 变量下）**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Header: 标题 + 会话状态指示器（● 运行中 / ● 暂停 / ● 结束）          │
├───────────────────┬──────────────────────────────────────────────────┤
│                   │  可视化画布（上部 ~55%）                           │
│   代码编辑区       │  (Konva Canvas，支持拖拽平移 + 滚轮缩放)         │
│  (Monaco Editor)  │                                                  │
│                   │   ┌──4──┐                                        │
│  ┌──────────────┐ │      /    \          [链表] [3]→[4]→[5]          │
│  │              │ │   ┌─2─┐ ┌─6─┐       ↑      ↑                   │
│  │  1  ListNode │ │   1   3 5   7      slow   fast                  │
│  │  2  *merge(..│ │                                                  │
│  │  3    slow = │ ├──────────────────────────────────────────────────┤
│  │  4    while..│ │  信息面板（下部 ~45%）                            │
│  │> 5    fast = │ │  ┌─────────────────────────────────────────────┐ │
│  │  6    ...    │ │  │ 📦 局部变量                                  │ │
│  │              │ │  │ head   ListNode*  {val=1, next=…}           │ │
│  └──────────────┘ │  │ slow   ListNode*  {val=3, next=…}           │ │
│                   │  └─────────────────────────────────────────────┘ │
│                   │  ┌─────────────────────────────────────────────┐ │
│                   │  │ 📚 调用栈                                   │ │
│                   │  └─────────────────────────────────────────────┘ │
│                   │  ┌─────────────────────────────────────────────┐ │
│                   │  │ 🏷️ 标注                                    │ │
│                   │  └─────────────────────────────────────────────┘ │
├───────────────────┴──────────────────────────────────────────────────┤
│ 控制栏 [后退 ◀] [▶ 前进一步] [⏩ 运行] [↺ 重置] [Step Over ▾]       │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 可视化画布 — 不同数据结构的渲染方式

#### 链表渲染

```
链表节点渲染为矩形方块，指针渲染为带标签的小箭头：

  ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐
  │  3  │────→│  4  │────→│  5  │────→│  6  │──→ nullptr
  └─────┘     └─────┘     └─────┘     └─────┘
     ↑                       ↑
  ┌──┴──┐               ┌───┴──┐
  │slow │               │ fast │
  └─────┘               └──────┘

- 有指针指向的节点用特定颜色边框高亮
- 当前正在被修改的节点闪动
- 如果是环形链表，最后一个节点指向入口形成一个环
- next 字段用实线箭头，prev 字段（双向链表）用虚线箭头
```

#### 二叉树渲染

```
标准树形布局（可切换多种布局）：

  水平展开（默认）：
        ┌──4──┐
     ┌──2──┐ ┌──6──┐
     1     3 5     7

  紧凑展开：
          4
        /   \
       2     6
      / \   / \
     1   3 5   7

- 当前访问节点高亮（比如 BST 搜索，当前比较的节点亮黄色）
- 已访问路径用不同颜色（比如搜索路径红色标出）
- NULL 子节点用小空心圆表示
- 新增/删除节点有过渡动画

树形布局算法：dagre 或自实现 Reingold-Tilford 算法
```

#### 数组渲染

```
数组每个元素一个格子，下标标在下方：

  idx:  0     1     2     3     4     5     6
     ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
     │  1  │  4  │  7  │  2  │  9  │  3  │  6  │
     └─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                                     ↑
                                   pivot

- 排序算法中：比较的元素闪动，交换动画
- 二分搜索：lo/hi/mid 指针标注
- 滑动窗口：窗口区域高亮背景色
```

### 4.4 用户标注系统

用户需要在代码中添加特殊注释来告诉系统"这段代码里有什么数据结构需要可视化"。

**语法：**

```cpp
// @viz linked_list(list1) head=head_ptr.next_field=next
//     ^       ^              ^              ^
//     指令   标注名        起始变量      结构字段名
//     类型

// @viz binary_tree(tree1) root=root_ptr.left_field=left.right_field=right

// @viz array(arr1) ptr=data_ptr.length_field=size
```

**在 UI 中也可以图形化配置标注**（右侧面板），不强制写注释。写注释的好处是可以和代码一起保存，下次打开自动识别。

### 4.5 动画设计

```
指针移动动画：
  slow 从节点 A 移动到节点 B：
  1. 节点 A 的 "slow" 标签淡出（~200ms）
  2. "slow" 标签沿连线平移到节点 B（~300ms，ease-in-out）
  3. 节点 B 的边框高亮脉冲一次
  4. "slow" 标签在节点 B 上方淡入

节点新增动画（链表插入）：
  1. 旧连线断开 → 消失动画
  2. 新节点从上方滑入
  3. 两条新连线从新节点向两侧伸展
  4. 整体微调布局（节点间距重新均匀分布）

值修改动画：
  1. 旧值缩小 + 变灰（~150ms）
  2. 新值放大 + 高亮（~250ms）
  3. 恢复正常大小和颜色（~150ms）
```

### 4.6 前端状态机

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

### 5.2 通信模式选择

**开发阶段：HTTP + 轮询（更简单）**

- POST `/api/session/:id/step` → 同步返回 State Snapshot JSON
- 简单直接，不用维护 WebSocket 长连接
- 对于每步 ~200ms 的场景，HTTP 开销可忽略

**后续可升级为 WebSocket**（如果需要推送 stdout 流）

---

## 6. 数据结构可视化方案

### 6.1 数据结构的识别与遍历

```
用户的标注信息 → 告诉后端：
  1. 这是什么类型的数据结构 (linked_list / binary_tree / array / graph)
  2. 从哪个 GDB 变量出发开始遍历
  3. 各节点之间通过什么字段连接

后端 Memory Walker 做的事：
  1. 从 root/head 变量开始
  2. 沿连接字段逐节点 GDB 查询
  3. 检测环路（Floyd 判圈算法）
  4. 返回完整结构图 JSON
  5. 根据局部变量中的指针值，匹配到节点上（pointers_pointing_here 字段）
```

### 6.2 自动识别（进阶，v0.5+）

```
自动推断算法（不需要用户标注时使用）：

1. 扫描局部变量中所有指针类型变量
2. 对每个指针，尝试 deref 看看指向什么类型
3. 如果多个指针指向相同类型的 struct，且 struct 中有
   指向同类型的指针字段 → 可能是链表/树
4. 从可能的 head/root 出发遍历
5. 启发式判断：
   - 每个节点只有一个出边 → 很可能是链表
   - 节点有 left/right 两个出边 → 很可能是树
   - 节点有多个出边 → 可能是图
6. 自动生成标注，用户可手动调整
```

前提条件：需要 GDB 能拿到完整的类型信息（编译时 `-g`）。

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

### v0.4 — 数组可视化 + 断点

**目标：排序算法、二分搜索可视化**

| 任务 | 预估 |
|---|---|
| Memory Walker - 数组 | 数组自动检测 |
| Canvas 数组渲染 | 柱状图 + 格子模式 |
| 排序动画 | 比较/交换闪动 |
| 断点系统 | 设置/删除/运行到断点 |
| **示例模板切换** | 顶部下拉框：链表反转 / BST 搜索 / 数组排序… 一键切换独立示例，不用手写代码 |

### v0.5 — 打磨

| 任务 | 预估 |
|---|---|
| WebSocket 通信 | 替代 HTTP 轮询 |
| Docker 隔离 | 安全加固 |
| 多文件支持 | 项目级编译 |
| 自动识别 | 启发式数据结构检测 |
| 历史步骤列表 | 点击任意历史步骤跳转 |
| 移动端适配 | 响应式布局 |

---

## 8. 关键技术细节

### 8.1 示例模板系统（v0.4 规划）

每个数据结构有独立的代码模板，用户一键切换：

```
顶部模板选择器： [🔗 链表反转 ▾] [🌳 BST 查找] [📊 冒泡排序] …

切换后：
  1. 代码编辑器加载预设 C++ 代码（含 @viz 标注）
  2. 标注列表自动更新
  3. 断点自动设置在关键行
  4. 点击「编译运行」即可开始调试
```

预设模板列表（随版本迭代扩充）：

| 模板 | 数据结构 | @viz 标注 |
|---|---|---|
| 链表反转 | linked_list | `@viz linked_list(L) head=head.next_field=next` + `@viz watch(curr, prev)` |
| 链表找中点 | linked_list | `@viz linked_list(L) head=head.next_field=next` + `@viz watch(slow, fast)` |
| BST 插入 | binary_tree | `@viz binary_tree(T) root=root.left_field=left.right_field=right` |
| BST 搜索 | binary_tree | 同上 + `@viz watch(curr)` |
| 冒泡排序 | array | `@viz array(A) ptr=arr.length_field=n` |
| 二分查找 | array | 同上 + `@viz watch(lo, hi, mid)` |

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

### 8.5 用户标注的高级用法

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

> **文档版本**：v0.3
> **最后更新**：2026-06-20
> **状态**：持续迭代中，v0.2 链表 + v0.3 二叉树已完成
