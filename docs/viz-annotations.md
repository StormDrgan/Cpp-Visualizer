# @viz 标注参考手册

（面向用户 + AI 生成）

---

## 概述

`@viz` 是写在 C++ 注释中的指令，告诉可视化引擎如何遍历并渲染数据结构。

- 每行一条 `// @viz ...`
- 不影响编译（就是普通注释）
- 一条源码可有多条 `@viz`

---

# 第一部分：语法参考（人类可读）

## 1. 数组 `@viz array`

```
// @viz array(名称) var=数组变量.length_var=长度变量
```

| 参数 | 含义 |
|------|------|
| `名称` | 自定义标识符（如 A / T / arr），Canvas 标签 |
| `数组变量` | C++ 数组变量名 |
| `长度变量` | 存有数组长度的 int 变量 |

```cpp
// @viz array(A) var=arr.length_var=n
int arr[] = {5, 2, 8, 1, 9};
int n = 5;

// 同一代码中可声明多个数组
// @viz array(T) var=text.length_var=n
// @viz array(N) var=next_val.length_var=m
```

## 2. 链表 `@viz linked_list`

### 单向
```
// @viz linked_list(名称) head=头指针.next_field=next字段名
```

### 双向
```
// @viz linked_list(名称) head=头指针.next_field=next字段名.prev_field=prev字段名
```

```cpp
struct ListNode { int val; ListNode* next; };
// @viz linked_list(L) head=head.next_field=next

struct DListNode { int val; DListNode* next; DListNode* prev; };
// @viz linked_list(DL) head=head.next_field=next.prev_field=prev
```

## 3. 二叉树 `@viz binary_tree`

```
// @viz binary_tree(名称) root=根指针.left_field=left字段名.right_field=right字段名
```

```cpp
struct TreeNode { int val; TreeNode* left; TreeNode* right; };
// @viz binary_tree(T) root=root.left_field=left.right_field=right
```

**AVL 识别**：系统检测到 `height` / `bf` / `balance` 字段会自动标记为 AVL 树。

## 4. 栈 `@viz stack`

### 顺序栈（数组）
```
// @viz stack(名称) var=数组变量.top_var=栈顶索引
```

### 链式栈（指针）
```
// @viz stack(名称) var=栈顶指针.next_field=next字段名
```

```cpp
// 顺序栈
// @viz stack(S) var=arr.top_var=top
int arr[10]; int top = -1;

// 链式栈
// @viz stack(S2) var=top.next_field=next
struct StackNode { int val; StackNode* next; };
StackNode* top = nullptr;
```

## 5. 队列 `@viz queue`

### 循环队列（数组）
```
// @viz queue(名称) var=数组变量.front_var=队首索引.rear_var=队尾索引
```

### 链式队列（指针）
```
// @viz queue(名称) var=队首指针.next_field=next字段名
```

## 6. 堆 `@viz heap`

```
// @viz heap(名称) var=数组变量.length_var=长度变量
```

以完全二叉树渲染（i 的左子 = 2i+1，右子 = 2i+2）。

## 7. 图 `@viz graph`

### 邻接矩阵
```
// @viz graph(名称) var=矩阵变量.mode=matrix.size_var=顶点数
```

### 邻接表
```
// @viz graph(名称) var=邻接表变量.size_var=顶点数
```

## 8. 哈希表 `@viz hashmap`

```
// @viz hashmap(名称) var=表变量.mode=模式
```

- `mode=chaining` — 拉链法
- `mode=open_addressing` — 开放定址法

## 9. 递归树 `@viz recursion_tree`

```
// @viz recursion_tree(名称)
```

无需其他参数，系统自动从调用栈提取。

## 10. B 树 / B+ 树 `@viz b_tree` / `@viz bplustree`

```
// @viz b_tree(名称) root=根指针.order=阶数
// @viz bplustree(名称) root=根指针.order=阶数
```

## 11. 指针监视 `@viz show`

```
// @viz show(变量1, 变量2, ...)
```

在 Canvas 上对这些变量画铜色指针标签。

---

# 第二部分：速查表

| 数据结构 | 语法 |
|----------|------|
| 数组 | `@viz array(N) var=arr.length_var=n` |
| 单向链表 | `@viz linked_list(L) head=head.next_field=next` |
| 双向链表 | `@viz linked_list(L) head=head.next_field=next.prev_field=prev` |
| 二叉树 | `@viz binary_tree(T) root=root.left_field=left.right_field=right` |
| 顺序栈 | `@viz stack(S) var=arr.top_var=top` |
| 链式栈 | `@viz stack(S) var=top.next_field=next` |
| 循环队列 | `@viz queue(Q) var=arr.front_var=front.rear_var=rear` |
| 链式队列 | `@viz queue(Q) var=front.next_field=next` |
| 堆 | `@viz heap(H) var=arr.length_var=size` |
| 图(邻接矩阵) | `@viz graph(G) var=mat.mode=matrix.size_var=n` |
| 图(邻接表) | `@viz graph(G) var=adj.size_var=n` |
| 哈希表 | `@viz hashmap(H) var=table.mode=chaining` |
| 递归树 | `@viz recursion_tree(F)` |
| B 树 | `@viz b_tree(BT) root=root.order=3` |
| B+ 树 | `@viz bplustree(BP) root=root.order=4` |
| 指针监视 | `@viz show(i, j, key)` |

---

# 第三部分：AI 生成规范

## A. AI 输出 JSON Schema

AI 必须返回严格符合以下结构的 JSON：

```json
{
  "annotations": [
    "// @viz linked_list(L) head=head.next_field=next",
    "// @viz show(slow, fast)"
  ],
  "reasoning": "检测到 ListNode struct 含有一个自引用指针字段 next → 识别为单向链表。slow 和 fast 是遍历指针 → 加入 show。"
}
```

**字段约束**：
| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `annotations` | `string[]` | 是 | `// @viz ...` 字符串数组，可为空 `[]` |
| `reasoning` | `string` | 是 | 中文说明，解释为何生成这些标注 |

**每条 annotation 必须是合法的 @viz 语法**，变量名和字段名必须来自源码中真实存在的标识符。

---

## B. 决策流程（按优先级）

分析代码时按以下顺序判断：

```
1. 查看 struct 定义 → 确定有哪些指针字段
   ├─ 只有一个自引用指针字段（如 next）       → linked_list（单向）
   ├─ 有两个自引用指针字段
   │   ├─ 命名为 prev / next                   → linked_list（双向）
   │   └─ 命名为 left / right 或类似           → binary_tree
   ├─ 有 keys[] 和 children[] 数组            → b_tree 或 bplustree
   ├─ 有 HashNode 数组 + 链表                  → hashmap（chaining）
   └─ 没有自引用指针字段                       → 不是链式结构，跳到步骤 2

2. 查看 main() 中的数组声明
   ├─ 一维数组 + 排序/遍历算法（i, j 指针）    → array + show(i, j)
   ├─ 一维数组 + top 变量（push/pop 操作）     → stack（顺序栈）
   ├─ 一维数组 + front/rear 变量               → queue（循环队列）
   ├─ 一维数组 + heapify / 堆相关操作          → heap
   ├─ 二维数组 + 边遍历                        → graph（邻接矩阵）
   └─ 指针数组 + 链表挂载                      → graph（邻接表）或 hashmap（chaining）

3. 查看函数调用
   ├─ 递归函数（函数体内调用自身）              → recursion_tree
   └─ 非递归                                    → 不处理
```

---

## C. 变量名提取规则

### C.1 头指针 / 根指针（root_var）
从变量声明中提取：
```cpp
ListNode* head = ...;     // → head
TreeNode* root = ...;     // → root
BNode* root = ...;        // → root（B 树）
```

**优先级**：先看函数调用结果赋给了谁，再看 main 中最后使用的指针变量。

### C.2 字段名（next_field / left_field / right_field 等）
从 struct 定义中提取，**必须是结构体成员名**：
```cpp
struct ListNode {
    int val;
    ListNode* next;   // → next_field = next
};
struct TreeNode {
    int val;
    TreeNode* left;   // → left_field = left
    TreeNode* right;  // → right_field = right
};
```

### C.3 长度变量（length_var / size_var）
从数组声明或长度变量中提取：
```cpp
int arr[] = {5, 2, 8, 1, 9};
int n = 5;            // → length_var = n

char text[] = "ababc";
int n = strlen(text); // → length_var = n
```

### C.4 @viz show 变量
选择算法中用来遍历/比较/交换的局部指针或索引变量：
- 双指针：`slow, fast`（快慢指针）
- 排序：`i, j, minIdx / key / pivot`
- 搜索：`lo, hi, mid`
- 遍历：`curr, prev, next`

**规则**：选择在循环或递归中被反复修改的变量，不要选常量或不参与遍历的变量。

---

## D. 典型代码 → 标注映射

### D.1 单链表 + 快慢指针
```cpp
struct ListNode { int val; ListNode* next; };
ListNode* head = createList(arr, 5);
ListNode* slow = head, *fast = head;
while (fast && fast->next) { slow = slow->next; fast = fast->next->next; }
```
→
```
// @viz linked_list(L) head=head.next_field=next
// @viz show(slow, fast)
```

### D.2 数组排序（冒泡 / 选择 / 插入）
```cpp
int arr[] = {5, 2, 8, 1, 9}; int n = 5;
for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - 1 - i; j++) {
        if (arr[j] > arr[j + 1]) { /* swap */ }
    }
}
```
→
```
// @viz array(A) var=arr.length_var=n
// @viz show(i, j)
```

### D.3 二叉树 + 搜索
```cpp
struct TreeNode { int val; TreeNode* left; TreeNode* right; };
TreeNode* root = buildTree();
TreeNode* curr = root;
while (curr) {
    if (target < curr->val) curr = curr->left;
    else if (target > curr->val) curr = curr->right;
    else break;
}
```
→
```
// @viz binary_tree(T) root=root.left_field=left.right_field=right
// @viz show(curr)
```

### D.4 顺序栈
```cpp
int arr[10]; int top = -1;
arr[++top] = 10;  // push
int val = arr[top--];  // pop
```
→
```
// @viz stack(S) var=arr.top_var=top
```

### D.5 循环队列
```cpp
int queue[10]; int front = 0, rear = 0;
queue[rear] = x; rear = (rear + 1) % 10;  // enqueue
x = queue[front]; front = (front + 1) % 10;  // dequeue
```
→
```
// @viz queue(Q) var=queue.front_var=front.rear_var=rear
```

### D.6 链式栈
```cpp
struct StackNode { int val; StackNode* next; };
StackNode* top = nullptr;
StackNode* n = new StackNode(x); n->next = top; top = n;  // push
```
→
```
// @viz stack(S) var=top.next_field=next
```

### D.7 大顶堆
```cpp
int arr[] = {9, 5, 7, 2, 1, 3}; int size = 6;
// heapify / siftDown 操作
```
→
```
// @viz heap(H) var=arr.length_var=size
```

### D.8 B 树
```cpp
struct BNode { int keys[4]; BNode* children[5]; int n; bool leaf; };
BNode* root = new BNode();
```
→
```
// @viz b_tree(BT) root=root.order=3
```

### D.9 递归（斐波那契 / 阶乘 / 分治）
```cpp
int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}
```
→
```
// @viz recursion_tree(F)
```

### D.10 图 BFS / DFS（邻接表）
```cpp
struct Node { int to; Node* next; };
Node* adj[6]; int n = 6;
// BFS/DFS 遍历
```
→
```
// @viz graph(G) var=adj.size_var=n
// @viz show(queue, visited)
```

### D.11 哈希表（拉链法）
```cpp
struct HashNode { int key; int val; HashNode* next; };
HashNode* table[7];
```
→
```
// @viz hashmap(H) var=table.mode=chaining
```

---

## E. 常见错误（AI 应避免）

| 错误 | 说明 |
|------|------|
| 变量名不存在 | `head` 写成 `head_ptr` — 必须严格匹配源码中的标识符 |
| 字段名不匹配 | struct 中是 `next` 却写成 `next_field=link` |
| 多余的空格或字符 | `// @viz  linked_list (L)` — 语法要求 `// @viz linked_list(L)` |
| 类型错误 | 链式队列错误地使用 `front_var` 参数 — 链式队列应使用 `next_field` |
| 忘记 `@viz show` | 排序/搜索算法没有追踪关键指针，可视化缺少铜色标签 |
| 为无关变量写标注 | 不应为主函数中所有局部变量都写 @viz，只在确认是数据结构时写 |
| 误判数据结构 | 只有单个自引用指针但硬写成二叉树 — 检查字段数量 |
| 注解过多 | 同一个节点集写了多个 @viz 标注重复覆盖 — 系统会自动去重，但 AI 应避免冗余 |
| 递归树注解过度 | 只在确实使用递归时写 `@viz recursion_tree`，普通的链式遍历不需要 |

---

## F. 检查清单（AI 生成后自检）

- [ ] 每个 `@viz` 的变量名是否在源码中存在？
- [ ] struct 字段名是否与源码定义一致？
- [ ] 双向链表是否同时写了 `.next_field` 和 `.prev_field`？
- [ ] 二叉树是否同时写了 `.left_field` 和 `.right_field`？
- [ ] 链式栈/队列是否使用了 `.next_field`（而非 `.top_var` / `.front_var`）？
- [ ] 循环队列是否同时写了 `.front_var` 和 `.rear_var`？
- [ ] 是否对排序/搜索/遍历场景添加了 `@viz show`？
- [ ] 数量是否合理？（典型场景 1-3 条 @viz 即可）
- [ ] `reasoning` 是否为中文，是否解释了判断依据？
