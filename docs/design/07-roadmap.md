# 7. 开发路线图

## v0.1 — 最小可用原型（MVP）

**目标：能 step，能看变量，能后退**

| 任务 | 预估 |
|---|---|
| FastAPI 后端骨架 | 会话创建/销毁 |
| LLDB Controller | 编译代码 → 起 LLDB → step → 抓 locals |
| State Snapshot | 构建 JSON 结构，history stack 压入弹出 |
| 前端骨架 | React + Monaco Editor + 控制栏 |
| 前端 ↔ 后端 | HTTP API 通信 |
| 变量面板 | 显示 locals 列表 |

## v0.2 — 链表可视化 ✅ 已完成

**目标：跑通一个完整的链表算法**

| 任务 | 状态 |
|---|---|
| 用户标注解析 | ✅ 前端标注输入 + 后端解析 + 融合 |
| Memory Walker - 链表 | ✅ 沿 next 遍历，检测环 |
| Canvas 链表渲染 | ✅ 节点矩形 + 连线 + 指针标签 |
| 指针动画 | ✅ slow/fast 移动动画 + 节点弹出动画 |
| 后退功能 | ✅ 快照栈 + history/future 双向 |
| 指针解引用 | ✅ 自定义 struct 遍历子字段显示 |

## v0.3 — 二叉树可视化 ✅ 已完成

**目标：跑通树遍历、BST 操作**

| 任务 | 状态 |
|---|---|
| Memory Walker - 二叉树 | ✅ BFS 遍历 left/right，返回节点 + 边 |
| Canvas 树渲染 | ✅ 圆形节点 + 层级自动布局 + 父子箭头连线 |
| 标注扩展 | ✅ @viz binary_tree 标注语法 |
| UI 布局调整 | ✅ 左侧代码 + 右侧上下分割（画布上/变量下） |
| 变量显示优化 | ✅ 隐藏原始地址，只显示解引用后的结构体内容 |
| Canvas 溢出处理 | ✅ 拖拽平移 + 滚轮缩放（0.25x ~ 3x） |

## v0.4 — 数组可视化 + 断点 ✅ 已完成

**目标：排序算法、二分搜索可视化**

| 任务 | 状态 |
|---|---|
| Memory Walker - 数组 | ✅ `walk_array`：LLDB 循环 evaluate `arr[i]`，返回索引+值+地址，max 500 元素 |
| Canvas 数组渲染 | ✅ 水平格子模式：72×40 单元格 + 索引标签 + watched 指针标签 |
| @viz array 标注 | ✅ `@viz array(A) var=arr.length_var=n` 正则解析 + VariablePanel 表单 |
| 断点系统 | ✅ 设置/删除/运行到断点，LLDB 层真正删除（`target.BreakpointDelete`）|
| 示例模板切换 | ✅ Header 下拉框 8 个模板 |
| 断点移除修复 | ✅ `remove_breakpoint` 遍历 `target.GetNumBreakpoints()` 按行号+源文件匹配删除 |
| Watched 指针双相匹配 | ✅ Phase 1 地址匹配（指针变量）+ Phase 2 索引匹配（数组下标）|

## v0.5 — 通信 + 自动识别 + 动画 ✅ 已完成

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

## v0.6 — 新数据结构 + 算法动画 + 体验增强 ✅ 已完成

**目标：802 考纲 Level 1 全覆盖，排序/遍历动画增强，历史时间轴**

### 一、新数据结构（P0，802 考纲 Level 1 必做）

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

### 二、算法动画增强（P1）

| 功能 | 说明 |
|---|---|
| **排序动画增强** | watched 指针（i, j, minIdx）直接推断比较/交换目标，不依赖 diff 交叉匹配；单步内区分「比较」和「交换」两个阶段 |
| **栈/队列操作动画** | push/pop/enqueue/dequeue 节点级动画（滑入、弹出、淡出） |
| **堆操作动画** | 上浮（sift-up）/ 下沉（sift-down）节点沿路径交换动画 |
| **图遍历动画** | BFS 队列扩张 + 节点染色；DFS 递归栈 + 回溯染色 |
| **递归树可视化** | 递归调用栈渲染为树形结构，展示分治过程 |

### 三、体验增强（P1–P2）

| 功能 | 优先级 | 说明 |
|---|---|---|
| **历史步骤列表** | P1 | 左侧步骤时间轴，展示每步行号+操作摘要，点击任意步骤跳转（利用现有 history 栈，低成本）|
| **自动识别增强** | P1 | 识别更多结构（双向链表、循环链表、AVL），减少手动标注 |
| **Docker 隔离** | P2 | 编译安全加固，多用户编译/运行隔离 |

---

## v0.7 — 多实例可视化 + 指针标注 + 交互体验 ✅ 已完成

**目标：多个数据结构实例正确区分、指针标签自动标注、面板折叠/画布拖拽/可调分隔条/stdout 输出**

### 一、auto_discover v2 — 多实例支持 + 指针值显示

**核心改动：** 每个指针变量独立创建 Annotation（而不是每种类型只建一个），节点地址集去重合并。

| 任务 | 说明 |
|---|---|
| **per-variable 标注** | `auto_discover` 不再按 `deref_type` 去重，每个 `ListNode*` 指针各自生成 `auto_{var_name}` 标注 |
| **post-walk 去重** | 新增 `_dedup_structures()` — 比较节点地址 frozenset：完全匹配→合并（多个指针指向同一链），子集→合并到超集（小链是大链的一部分），互斥→保留独立结构 |
| **根变量标签** | 合并结构时收集各子结构的 `annotation_name`，注入 `pointers_pointing_here` 标签。主结构自身的 root 也加入标签 |
| **空结构过滤** | `_dedup_structures` 丢弃 `nodes.length === 0` 的结构（nullptr root） → Canvas `nonEmptyStructures` 二次过滤 |
| **类型缓存** | `_type_cache` 字典缓存 `inspect_type` 结果，同 struct 类型只调一次 LLDB |
| **空指针跳过** | 新增 `_is_null_addr()` — 跳过值为 0x0 / 空 / 未初始化的指针 |
| **垂直堆叠布局** | 多个结构体按 yOffset 垂直排列，`structLayouts` 累加布局 |

**效果：** 链表反转中 prev（反向链）和 curr（剩余链）在迭代过程中各自独立显示，节点上标注哪些指针指向它，互不干扰。

### 二、指针值显示

| 层级 | 改动 |
|---|---|
| **LLDB 桥接层** | `_build_state` 对指针变量做 `Dereference()` → 读子成员非指针字段 → 格式化为 `{val=1, key=3}` 摘要 |
| **display_value** | `"0x5555555592b0 → {val=1}"` — 同时展示地址和指向的内容 |
| **前端 fmtDisplay** | 缩短地址为 `"…92b0 → {val=1}"`，完整地址在 title tooltip 中 |

### 三、模板切换立即重置

| 改动 | 说明 |
|---|---|
| `loadTemplate()` | 切换模板时清空 `snapshot`、`status`、`diffActions`、`compileErrors`、`error` + 清除旧代码断点 |
| 效果 | 下拉切换模板 → 画布立即回 placeholder、状态灯灰色、变量面板清空 |

### 四、面板折叠 / 输出区 / 可调分隔条

| 功能 | 说明 |
|---|---|
| **折叠按钮** | 四个区域（📦局部变量 / 💻程序输出 / 📚调用栈 / 🏷️标注）均支持点击标题栏折叠/展开，默认展开变量+输出，折叠调用栈+标注 |
| **程序输出区** | LLDB 桥接层通过 `AddOpenFileAction(1, tmpfile)` 重定向调试进程 stdout → `_build_state` 读取 → 前端 `<pre>` 展示 |
| **可拖拽分隔条** | 垂直分隔条（代码区 ↔ 可视化区，20%–75%）+ 水平分隔条（画布 ↔ 变量面板，15%–85%），拖拽时 `col-resize` / `row-resize` 光标 |

### 五、画布交互 — 左键拖拽平移

| 功能 | 说明 |
|---|---|
| **左键拖拽** | `mousedown` 记录起点 → `mousemove` 程序化 `scrollTo` → `mouseup` 结束，光标 `grab`/`grabbing` |
| **滚动** | `overflow: auto` 保留浏览器原生滚轮滚动 |

---

## v0.8 — 可视化目标选择交互 ✅ 已完成

**目标：运行后自动扫出候选变量 → 点击勾选即时过滤，标注降级为兜底**

### 核心理念

当前手动标注需要用户记忆 `@viz linked_list(name) head=var.next_field=next` 语法或填写表单（选类型→填根变量→填字段名）。这些信息（类型归属、字段名）`auto_discover` 已经能自动推断出来，不需要用户重复输入。

### 交互流程

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

### 关键改动点

| 改动 | 说明 |
|---|---|
| **前端「可视化目标」面板** | 渲染成 checkbox 列表；每个候选项显示变量名 + 推断的类型（链表/树/数组）|
| **运行前候选扫描** | `loadCode` 前先调一次 `GetVariables` + `inspect_type` 获取候选列表 |
| **前端 ws send 携带选中状态** | `{type: "load", payload: {..., selected_vars: ["head", "arr"]}}` — 只传勾选的变量名 |
| **后端过滤** | `_build_heap_structures` 收到 `selected_vars` 后，`auto_discover` 只对指定变量生成标注 |
| **动态调整** | 步进中取消勾选 → 前端过滤 `heap_structures` 渲染（不调后端），立即生效 |

### 优势

| 对比 | 旧方式（v0.7） | 新方式（v0.8） |
|---|---|---|
| 用户记忆负担 | struct_type、root_var、next_field 名 | 变量名（代码里已有） |
| 操作 | 写注释 / 填 6 个表单字段 | 点一下勾选框 |
| 修改生效 | 重新编译运行 | 即时（纯前端过滤） |
| 多实例发现 | 手动每个指定 | 自动扫出全部，用户挑 |

---

## v0.9 — 算法动画增强 + 体验升级（部分完成 🚧）

**目标：排序/栈/队列/堆/图遍历动画提升 + 历史步骤时间轴 + 自动识别增强**

### 一、已完成的体验增强（UI 重构）

| # | 任务 | 说明 |
|---|------|------|
| ✅ | **分类模板选择器** | 24 个模板按 6 大分类组织（链表/栈队列/树/堆图/数组查找/哈希表），卡片弹窗 + 搜索过滤，替换原生 `<select>` |
| ✅ | **步骤历史集成** | 控制栏"Step 5/20 ▾"按钮 → 点击弹出向上步骤列表弹窗（每行显示步号+行号+代码片段），点击跳转任意步骤 |
| ✅ | **@viz 标注交互重构** | 右键行号区域 → 弹出类型选择器（3 列网格，16 种类型）；Ctrl/Cmd/Alt + 左键行号区域作为备选快捷方式；点击弹窗外自动关闭 |
| ✅ | **标注面板简化** | 🏷️ 标注管理面板使用光标所在行作为插入位置，选择类型后自动检测变量名、自动生成标注，无需填写表单 |
| ✅ | **Level 1 全覆盖** | 新增 5 个模板（邻接矩阵图、哈希表开放定址、哈夫曼树、双端队列、循环队列），12 种 802 考纲 Level 1 数据结构全部覆盖 |
| ✅ | **Cmd+Click Mac 修复** | 修复 Mac 上 Cmd+Click 行号区域不触发 @viz 弹窗（Monaco 多光标拦截），改用 DOM 级 contextmenu 事件监听 |

### 二、算法动画增强（P1，规划中）

| # | 任务 | 说明 |
|---|------|------|
| **A1** | **排序动画增强** | watched 指针（i, j, minIdx）直接推断比较/交换目标，不依赖 diff 交叉匹配。单步内区分「比较」和「交换」两个阶段 |
| **A2** | **栈/队列操作动画** | push/pop/enqueue/dequeue 节点级动画 — 新元素从上方滑入，弹出元素缩小淡出 |
| **A3** | **堆操作动画** | sift-up（上浮）/ sift-down（下沉）节点沿完全二叉树路径交换动画 |
| **A4** | **图遍历动画** | BFS 队列扩张 + 节点染色（层级推进，渐变色）；DFS 递归栈 + 回溯染色 |
| **A5** | **递归树可视化** | 递归调用栈渲染为树形结构，展示分治/回溯的调用树 |

### 三、自动识别增强（P1，规划中）

| # | 任务 | 说明 |
|---|------|------|
| **B2** | **自动识别增强** | 识别更多结构 — 双向链表（检测 prev 字段）、循环链表（next 回到 head）、AVL 树（检测 balance_factor 字段）|

---

## v0.10 — Level 2 数据结构全覆盖（部分完成 🚧）

**目标：802 考纲 Level 2 全部实现，线索树/B树/B+树/森林/特殊矩阵/广义表/十字链表逐项突破**

### 数据结构清单

| # | 数据结构 | @viz 标注语法 | 渲染要点 | 存储方式 |
|---|---------|---------------|---------|---------|
| **C1** | **线索二叉树** | `@viz threaded_tree(T) root=root` | 圆形节点 + 实线（子节点）/ 虚线（线索到前驱后继），线索标志位可视化 | 链式 + 线索标志位 |
| **C2** | **B 树** | `@viz btree(T) root=root.t=3` | 多路节点块（横向 keys 数组 + children 指针），插入/删除的分裂合并动画 | 多路存储 |
| **C3** | **B+ 树** | `@viz bplustree(T) root=root.t=3` | 内部节点 + 叶子层链表串联，区分 B 树（叶子和内部节点结构不同）| 多路存储 |
| **C4** | **树与森林** | `@viz forest(F) root=root` | 双亲/孩子/兄弟表示法三种视图切换 + 森林↔二叉树互转动画 | 双亲/孩子/兄弟表示法 |
| **C5** | **特殊矩阵压缩** | `@viz matrix(M) var=mat.mode=symmetric` | 对称/三角/稀疏矩阵的压缩存储映射 — 行优先压缩下标对应热力图 | 对称/三角/稀疏矩阵 |
| **C6** | **广义表** | `@viz glist(L) var=head` | 头尾链表存储结构，原子节点（圆角方块）+ 子表节点（嵌套框），递归渲染 | 头尾链表 |
| **C7** | **邻接多重表 / 十字链表** | `@viz multigraph(G) var=vertices` | 边节点 + 顶点节点的多重链接，无向图边共享、有向图十字链 | 链式存储变体 |

**关键技术实现：**
- C1 线索树：`walk_threaded_tree` → LLDB 读取 `ltag`/`rtag` 标志位 → 虚线/实线区分
- C2/C3 B 树/B+ 树：`walk_btree` → BFS 遍历 keys + children 数组 → 节点块水平排列
- C4 森林：`walk_forest` → 遍历孩子-兄弟链表 → Canvas 层三种表示法切换
- C5 矩阵压缩：`walk_compressed_matrix` → 展示逻辑索引 → 物理索引的映射关系 + 空白区灰色
- C6 广义表：`walk_glist` → 递归遍历 → 原子节点用圆角方块、子表用嵌套框
- C7 多重表：`walk_multigraph` → 边节点遍历 → 边→顶点→边 多重链接渲染

### 每个结构独立为模块

```
每个 C 任务的实现模式（6 步）：
  Step 1: 后端 walker 方法（walk_xxx）
  Step 2: LLDB 桥接层 handler（handle_walk_xxx）
  Step 3: 前端 Canvas 渲染函数（renderXxx）
  Step 4: @viz 标注解析
  Step 5: 预设示例模板
  Step 6: VariablePanel 标注表单
```

### 当前进度总览

```
v0.1 ✅ 最小可用原型        v0.5 ✅ WebSocket + 自动识别 + 排序动画
v0.2 ✅ 链表可视化          v0.6 ✅ 9 种新数据结构 + 图/哈希表渲染
v0.3 ✅ 二叉树可视化        v0.7 ✅ auto_discover v2 + 面板折叠 + 画布拖拽 + stdout
v0.4 ✅ 数组可视化 + 断点    v0.8 ✅ 可视化目标勾选 + 即时过滤（标注降级为兜底）
                            v0.9 🚧 UI 重构 + @viz 交互 + L1 全覆盖 + 统一样式（算法动画待实现）
                            v0.10 🚧 Level 2 部分完成（B树/B+树渲染+模板 ✅，栈方向修正 ✅，双链表双箭头 ✅，Ctrl+滚轮缩放 ✅，全部结构居中 ✅，指针标签位置修复 ✅；其余 Level 2 规划中）
```
