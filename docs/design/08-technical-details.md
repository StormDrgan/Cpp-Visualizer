# 8. 关键技术细节

## 8.1 示例模板系统

预设模板 28 个，按 6 大分类组织，通过顶部 Header 的分类卡片弹窗选择（支持搜索过滤）：

### 链表（4 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 链表反转 | 🔗 | 三指针迭代反转，展示 prev/curr/next 指针移动 |
| 链表找中点 | 🔗 | 快慢指针法，slow 走一步 fast 走两步 |
| 链表环检测 | 🔗 | Floyd 判圈算法，检测环并找到环入口 |
| 双向链表 | 🔗 | 双 prev/next 指针的插入与删除操作 |

### 栈 / 队列（5 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 顺序栈 | 📚 | 数组存储，栈顶 top 索引，push/pop 动画（从下往上增长） |
| 链式栈 | 📚 | 指针存储，top 节点为栈顶，push/pop + 删除动画 |
| 循环队列 | 🚶 | 顺序循环队列，front/rear 双指针 |
| 链式队列 | 🚶 | 链表存储，front/rear 指针，enqueue/dequeue |
| 双端队列 | 🚶 | 数组存储，两端均可 push/pop |

### 树（5 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| BST 搜索 | 🌳 | 二叉搜索树查找，curr 指针沿树下降 |
| BST 插入构建 | 🌳 | 动态构建 BST，插入节点 + 指针追踪 |
| AVL 插入 | 🌳 | 平衡二叉树插入 + 四种旋转（LL/RR/LR/RL）|
| 哈夫曼树 | 🌳 | 哈夫曼编码树构建过程 |
| 斐波那契递归 | 🌀 | 递归树可视化，展示分治调用过程 |

### 堆 / 图（5 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 大顶堆 | ⛰️ | 完全二叉树数组存储，插入上浮 + 删除下沉 |
| 邻接表图 | 🕸️ | 图的邻接表存储，顶点 + 边链表 |
| 邻接矩阵图 | 🕸️ | 图的邻接矩阵存储，二维数组可视化 |
| BFS 遍历 | 🕸️ | 广度优先搜索，队列扩张 + 节点层级染色 |
| DFS 遍历 | 🕸️ | 深度优先搜索，递归栈 + 回溯路径染色 |

### 数组 / 查找（3 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 冒泡排序 | 📊 | 相邻比较交换，i/j 双指针 |
| 选择排序 | 📊 | 每轮选最小，i/j/minIdx 三指针 |
| 二分查找 | 📊 | lo/hi/mid 三指针，折半搜索 |

### 哈希表（2 个）

| 模板 | 图标 | 说明 |
|---|---|---|
| 哈希表（拉链法） | #️⃣ | 桶数组 + 链表挂链，冲突处理可视化 |
| 哈希表（开放定址） | #️⃣ | 线性探测/二次探测，槽位状态可视化 |

### B树 / B+树（4 个） 🆕

| 模板 | 图标 | 说明 |
|---|---|---|
| B树插入 (2-3树) | 🌲 | m=3 阶 B树，插入 8 个值（含分裂）|
| B树搜索 | 🌲 | 预建 3 层 B树，搜索目标 key=15 |
| B+树搜索 | 🌿 | m=4 阶 B+树，搜索 target=7 |
| B+树插入 | 🌿 | m=4 阶 B+树，插入 9 个值 + 叶子链表 |

## 8.2 自动识别（v0.5 新增）

当代码中没有 `// @viz` 标注时，系统自动检测数据结构：

1. 遍历 LLDB 局部变量 → 筛选 `is_pointer=True` 且 `deref_type` 非空的变量
2. 调用 `inspect_type` bridge 命令获取 struct 字段布局
3. 分类逻辑：
   - 2 个指向同类型的指针字段 → **二叉树**（优先 left/right 命名）
   - 1 个指向同类型的指针字段 → **链表**
4. 数组检测：正则匹配 `type [N]` 类型字符串 → **数组**
5. 自动生成 `auto_{var_name}` 标注，手动 @viz 标注始终优先

## 8.3 LLDB Python API 要点（当前实现）

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

## 8.4 编译命令

```bash
# 必须用 -g 生成调试信息，-O0 禁用优化（保持源代码对应关系）
clang++ -g -O0 -std=c++17 -fstandalone-debug source.cpp -o binary

# -fstandalone-debug：在 macOS 上确保调试信息不会被剥离到 .dSYM 里
```

## 8.5 性能考虑

| 场景 | 耗时估算 | 优化方案 |
|---|---|---|
| 编译代码 | ~1-2 秒 | 缓存编译结果（代码 hash 相同时复用）|
| 单步执行 + 抓状态 | ~100-300ms | LLDB step 本身就快；抓状态多了才慢 |
| 遍历长链表（1000+ 节点） | ~500ms | 分页，只遍历可视区域附近节点 |
| 后退一步（快照栈命中） | ~5ms | 纯内存操作，极快 |
| 后退到历史深处（需重跑） | ~(step数 × 100ms) | 每 10 步存一个完整 checkpoint |
| Docker 容器启动 | ~1-3 秒 | 预热容器池 |

## 8.6 边界情况处理

| 情况 | 处理 |
|---|---|
| 代码有无限循环 | 执行步数上限（如 10000 步），超时强制终止 |
| 代码 crash（段错误等） | LLDB catch signal，返回 crash 信息 + 堆栈 + 最后的内存状态 |
| 模板代码 | 编译时实例化，-g 确保模板调试信息完整 |
| 宏 | 没有直接的可视化方式；预处理后用 `clang -E` 展示展开结果 |
| 指针悬挂 | 显示地址，标记为 "freed / invalid" |
| STL 容器 | 不做深度遍历（STL 内部太复杂），只显示 `.size()` 和摘要 |
| 递归过深 | 限制 Memory Walker 递归深度 |
| 大数组 | 只传输前 100 个元素 + 总数；前端懒加载滚动 |

## 8.7 手动标注（兜底语法，v0.8+ auto_discover 覆盖 90% 场景）

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
