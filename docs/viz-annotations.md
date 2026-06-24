# @viz 标注使用手册

`@viz` 标注是写在 C++ 源码注释中的指令，告诉可视化系统「这段代码里的哪个变量是什么数据结构、用哪些字段去遍历它」。

## 基本规则

- 每行一条 `// @viz`，可写在代码中的任何位置（通常放在 `main()` 上方或变量声明旁边）
- 一条源码可以有多条 `@viz`，每种类型可以写多个实例
- 标注不影响编译 — 它们就是普通注释

---

## 1. 数组 — `@viz array`

```
// @viz array(名称) var=数组变量.length_var=长度变量
```

| 参数 | 说明 |
|---|---|
| `名称` | 自定义标识符（如 A, T, arr），Canvas 左上角显示 |
| `数组变量` | C++ 数组变量名 |
| `长度变量` | 存储数组长度的 int 变量名 |

**示例**：
```cpp
// @viz array(A) var=arr.length_var=n
int arr[] = {5, 2, 8, 1, 9};
int n = 5;
```

**多数组**：可同时可视化多个数组，各自一行：
```cpp
// @viz array(T) var=text.length_var=n
// @viz array(N) var=next_val.length_var=m
char text[] = "ababc";
int next_val[10];
```

---

## 2. 链表 — `@viz linked_list`

### 2.1 单向链表
```
// @viz linked_list(名称) head=头指针.next_field=next字段名
```

**示例**：
```cpp
// @viz linked_list(L) head=head.next_field=next
struct ListNode { int val; ListNode* next; };
ListNode* head = createList(arr, 5);
```

### 2.2 双向链表
```
// @viz linked_list(名称) head=头指针.next_field=next字段名.prev_field=prev字段名
```

**示例**：
```cpp
// @viz linked_list(DL) head=head.next_field=next.prev_field=prev
struct DListNode { int val; DListNode* next; DListNode* prev; };
```

---

## 3. 二叉树 — `@viz binary_tree`

```
// @viz binary_tree(名称) root=根指针.left_field=left字段名.right_field=right字段名
```

**示例**：
```cpp
// @viz binary_tree(T) root=root.left_field=left.right_field=right
struct TreeNode { int val; TreeNode* left; TreeNode* right; };
TreeNode* root = new TreeNode(5);
```

---

## 4. 栈 — `@viz stack`

### 4.1 顺序栈（数组实现）
```
// @viz stack(名称) var=数组变量.top_var=栈顶索引变量
```

**示例**：
```cpp
// @viz stack(S) var=arr.top_var=top
int arr[10];
int top = -1;
```

### 4.2 链式栈
```
// @viz stack(名称) var=栈顶指针.next_field=next字段名
```

**示例**：
```cpp
// @viz stack(S) var=top.next_field=next
struct StackNode { int val; StackNode* next; };
StackNode* top = nullptr;
```

---

## 5. 队列 — `@viz queue`

### 5.1 循环队列（数组实现）
```
// @viz queue(名称) var=数组变量.front_var=队首索引.rear_var=队尾索引
```

**示例**：
```cpp
// @viz queue(Q) var=queue.front_var=front.rear_var=rear
int queue[10];
int front = 0, rear = 0;
```

### 5.2 链式队列
```
// @viz queue(名称) var=队首指针.next_field=next字段名
```

**示例**：
```cpp
// @viz queue(Q) var=front.next_field=next
struct QNode { int val; QNode* next; };
QNode *front = nullptr, *rear = nullptr;
```

---

## 6. 堆 — `@viz heap`

```
// @viz heap(名称) var=数组变量.length_var=长度变量
```

以完全二叉树形式渲染（索引 i 的左子 = 2i+1，右子 = 2i+2）。

**示例**：
```cpp
// @viz heap(H) var=arr.length_var=size
int arr[] = {9, 5, 7, 2, 1, 3};
int size = 6;
```

---

## 7. 图 — `@viz graph`

### 7.1 邻接矩阵
```
// @viz graph(名称) var=矩阵变量.mode=matrix.size_var=顶点数变量
```

**示例**：
```cpp
// @viz graph(G) var=mat.mode=matrix.size_var=n
int mat[4][4] = {{0,1,0,1},{1,0,1,0},{0,1,0,1},{1,0,1,0}};
int n = 4;
```

### 7.2 邻接表
```
// @viz graph(名称) var=邻接表变量.size_var=顶点数变量
```

**示例**：
```cpp
// @viz graph(G) var=adj.size_var=n
struct Node { int to; Node* next; };
Node* adj[4];
int n = 4;
```

---

## 8. 哈希表 — `@viz hashmap`

```
// @viz hashmap(名称) var=表变量.mode=模式
```

| 模式 | 说明 |
|---|---|
| `chaining` | 拉链法（桶 + 链表） |
| `open_addressing` | 开放定址法（线性探测） |

**示例**：
```cpp
// @viz hashmap(H) var=table.mode=chaining
HashNode* table[7];
```

---

## 9. 递归树 — `@viz recursion_tree`

```
// @viz recursion_tree(名称)
```

自动追踪递归函数调用，渲染为调用树。只需一行，**不需要**指定 root_var 等字段。

**示例**：
```cpp
// @viz recursion_tree(F)
int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}
```

---

## 10. B 树 / B+ 树 — `@viz b_tree` / `@viz bplustree`

```
// @viz b_tree(名称) root=根指针.order=阶数
// @viz bplustree(名称) root=根指针.order=阶数
```

**示例**：
```cpp
// @viz b_tree(BT) root=root.order=3
struct BNode { int keys[4]; BNode* children[5]; int n; bool leaf; };
BNode* root = new BNode();
```

---

## 11. 指针监视 — `@viz show`

```
// @viz show(变量1, 变量2, ...)
```

让指定变量在 Canvas 上显示为指针标签（铜色虚线 + 变量名标签），指向它们当前引用的节点。

**示例**：
```cpp
// @viz show(slow, fast)
ListNode* slow = head;
ListNode* fast = head;
```

---

## 完整示例

```cpp
#include <iostream>
using namespace std;

// @viz linked_list(L) head=head.next_field=next
// @viz show(slow, fast)
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

int main() {
    int arr[] = {1, 2, 3, 4, 5};
    // ... 构建链表 ...
    ListNode* slow = head;
    ListNode* fast = head;
    // ... 算法逻辑 ...
    return 0;
}
```

---

## 速查表

| 数据结构 | 语法 |
|---|---|
| 数组 | `@viz array(N) var=arr.length_var=n` |
| 单向链表 | `@viz linked_list(L) head=head.next_field=next` |
| 双向链表 | `@viz linked_list(L) head=head.next_field=next.prev_field=prev` |
| 二叉树 | `@viz binary_tree(T) root=root.left_field=left.right_field=right` |
| 顺序栈 | `@viz stack(S) var=arr.top_var=top` |
| 链栈 | `@viz stack(S) var=top.next_field=next` |
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
