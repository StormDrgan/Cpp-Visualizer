# 6. 数据结构可视化方案

## 6.1 为什么需要标注 — 调试器给你内存，不给你语义

LLDB 本质上是**内存查看器**，不是代码理解器。它能告诉你：

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

### 链表 vs 数组 — 为什么一个有「天然终点」另一个没有

链表自带终止哨兵：最后一个节点的 `next == nullptr`，walker 碰到 `0x0` 自然停。数组是裸内存块，地址连续，没有边界标记 — 不告诉它停在哪，它会一直读下去（读到其他变量、已释放内存、甚至段错误）。

```
链表: [1|→] → [2|→] → [3|→] → nullptr   ✅ 走到 null 自动停
数组: [1][2][3][?][?][?]...                ❌ 没有哨兵，必须给 n
```

### 这个设计的历史定位

v0.2–v0.7：标注是**主要入口**。系统对代码一无所知，用户通过 `@viz` 注释或表单告诉系统一切。

v0.8+：`auto_discover` 通过 `inspect_type`（LLDB 类型自省）自动获取字段布局 + 分类，标注**降级为兜底** — 只在字段命名不常规或 auto_discover 判断出错时手动纠正。

## 6.2 自动识别 — 让系统适应代码（v0.5 引入，v0.8 成熟）

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

## 6.3 可视化动画的触发机制 — 快照差分检测

> **核心思想**：不试图"理解 C++ 代码的语义"，而是**比较前后两帧快照的差异**，从差异中自动判定发生了什么操作，再生成对应动画。
> LLDB 提供的是内存的 ground truth，差分结果天然正确。

### 6.3.1 为什么不用「代码语义分析」？

```
❌ 方案 A：解析 C++ 代码语义
   问题：C++ 语法极复杂（模板/宏/重载/指针运算），解析代码来"知道用户在干什么"几乎不可能。
   例子：*p = node->next;  // 这是修改指针还是赋值？语义取决于上下文

❌ 方案 B：Hook malloc / new
   问题：不是所有数据结构都通过 malloc 创建（可能是栈上数组、全局变量、STL 容器）。
   而且 hook 只能检测分配，检测不到修改、删除、指针移动。

✅ 方案 C：快照差分（Snapshot Diffing）
   原理：每执行一步，遍历一次完整数据结构。比较两次遍历的结果，差异即"发生了什么操作"。
   不需要理解源代码语义 — LLDB 替我们读出了所有状态。
```

### 6.3.2 差分检测流程

```
每次用户点击 "前进一步" 之后，后端执行：

  Step 0: LLDB 执行 step/next
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

### 6.3.3 差分 → 动画映射表

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

### 6.3.4 具体示例：链表插入操作

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

### 6.3.5 为什么这个方案可靠？

```
1. LLDB 是 ground truth — 内存里有什么就是什么，不存在误解
2. 与源代码语义解耦 — 不管是 malloc/new/数组/全局变量，
   只要内存里出现了数据结构，遍历就能发现
3. 自动适应任何操作 — 插入/删除/修改/旋转/交换，
   都是节点和字段的增删改，差分统一处理
4. 天然支持时间旅行 — 快照栈已经存了每一帧的完整状态，
   后退时直接切换，不需要"反向动画"
5. 一个 diff 算法覆盖所有数据结构 —
   链表/树/图/数组只是遍历方式不同，diff 逻辑完全相同
```

### 6.3.6 动画与执行步的关系

```
一个重要细节：LLDB 执行一行代码 = 一个 step；但一行代码可能产生多个 diff 变化。

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

## 6.4 可视化的代码与图形互锁

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
