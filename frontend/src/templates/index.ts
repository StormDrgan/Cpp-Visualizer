import { NEW_TEMPLATES } from './new';

export interface Template {
  id: string;
  label: string;
  icon: string;
  description: string;
  code: string;
}

export const TEMPLATES: Template[] = [
  ...NEW_TEMPLATES,
  {
    id: 'linked_list_reverse',
    label: '链表反转',
    icon: '🔗',
    description: '构建链表并用双指针迭代反转',
    code: `#include <iostream>
using namespace std;

// 链表反转 — auto_discover 自动检测所有 ListNode* 指针变量
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

// 从数组创建链表，返回头节点
ListNode* createList(int arr[], int n) {
    if (n == 0) return nullptr;
    ListNode* head = new ListNode(arr[0]);
    ListNode* cur = head;
    for (int i = 1; i < n; i++) {
        cur->next = new ListNode(arr[i]);
        cur = cur->next;
    }
    return head;
}

int main() {
    int arr[] = {1, 2, 3, 4, 5};
    ListNode* head = createList(arr, 5);

    // 反转链表
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr) {
        ListNode* next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }

    // head 现在指向旧头，prev 指向新头
    cout << "reversed head = " << prev->val << endl;
    return 0;
}
`,
  },
  {
    id: 'linked_list_middle',
    label: '链表找中点',
    icon: '🔗',
    description: '快慢指针法找链表中点',
    code: `#include <iostream>
using namespace std;

// @viz linked_list(L) head=head.next_field=next
// @viz watch(slow, fast)
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

// 从数组创建链表，返回头节点
ListNode* createList(int arr[], int n) {
    if (n == 0) return nullptr;
    ListNode* head = new ListNode(arr[0]);
    ListNode* cur = head;
    for (int i = 1; i < n; i++) {
        cur->next = new ListNode(arr[i]);
        cur = cur->next;
    }
    return head;
}

int main() {
    int arr[] = {1, 2, 3, 4, 5, 6};
    ListNode* head = createList(arr, 6);

    // 快慢指针找中点
    ListNode* slow = head;
    ListNode* fast = head;

    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
    }

    cout << "middle = " << slow->val << endl;
    return 0;
}
`,
  },
  {
    id: 'bst_search',
    label: 'BST 搜索',
    icon: '🌳',
    description: '二叉搜索树构建与查找',
    code: `#include <iostream>
using namespace std;

// @viz binary_tree(T) root=root.left_field=left.right_field=right
// @viz watch(curr)
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

int main() {
    // 构建 BST:
    //        5
    //      /   \\
    //     3     8
    //    / \\     \\
    //   1   4     9
    TreeNode* root = new TreeNode(5);
    root->left = new TreeNode(3);
    root->right = new TreeNode(8);
    root->left->left = new TreeNode(1);
    root->left->right = new TreeNode(4);
    root->right->right = new TreeNode(9);

    // 搜索值为 4 的节点
    TreeNode* curr = root;
    int target = 4;
    while (curr) {
        if (curr->val == target) break;
        if (target < curr->val)
            curr = curr->left;
        else
            curr = curr->right;
    }

    if (curr)
        cout << "found " << target << endl;
    else
        cout << "not found" << endl;
    return 0;
}
`,
  },
  {
    id: 'bubble_sort',
    label: '冒泡排序',
    icon: '📊',
    description: '数组冒泡排序可视化（含比较/交换动画）',
    code: `#include <iostream>
using namespace std;

// @viz array(A) var=arr.length_var=n
// @viz watch(i, j)
int main() {
    int arr[] = {5, 2, 8, 1, 9, 3, 7, 6};
    int n = 8;

    // 冒泡排序
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                int tmp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = tmp;
            }
        }
    }

    cout << "sorted" << endl;
    return 0;
}
`,
  },
  {
    id: 'binary_search',
    label: '二分查找',
    icon: '📊',
    description: '有序数组二分查找（lo/hi/mid 指针追踪）',
    code: `#include <iostream>
using namespace std;

// @viz array(A) var=arr.length_var=n
// @viz watch(lo, hi, mid)
int main() {
    int arr[] = {1, 3, 5, 7, 9, 11, 13, 15};
    int n = 8;
    int target = 7;

    int lo = 0, hi = n - 1;
    int mid;

    while (lo <= hi) {
        mid = lo + (hi - lo) / 2;
        if (arr[mid] == target) break;
        if (arr[mid] < target)
            lo = mid + 1;
        else
            hi = mid - 1;
    }

    cout << "found at " << mid << endl;
    return 0;
}
`,
  },
  {
    id: 'bst_insert',
    label: 'BST 插入构建',
    icon: '🌳',
    description: '逐个插入节点构建二叉搜索树',
    code: `#include <iostream>
using namespace std;

// @viz binary_tree(T) root=root.left_field=left.right_field=right
// @viz watch(root, curr)
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

TreeNode* insert(TreeNode* root, int val) {
    if (!root) return new TreeNode(val);
    if (val < root->val)
        root->left = insert(root->left, val);
    else
        root->right = insert(root->right, val);
    return root;
}

int main() {
    TreeNode* root = nullptr;
    int vals[] = {5, 3, 8, 1, 4, 9, 7};
    int n = 7;

    // 逐个插入构建 BST
    for (int i = 0; i < n; i++) {
        root = insert(root, vals[i]);
    }

    if (root)
        cout << "root = " << root->val << endl;
    return 0;
}
`,
  },
  {
    id: 'linked_list_cycle',
    label: '链表环检测',
    icon: '🔗',
    description: 'Floyd 判圈算法（快慢指针检测环）',
    code: `#include <iostream>
using namespace std;

// @viz linked_list(L) head=head.next_field=next
// @viz watch(slow, fast)
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

// 从数组创建链表，返回头节点
ListNode* createList(int arr[], int n) {
    if (n == 0) return nullptr;
    ListNode* head = new ListNode(arr[0]);
    ListNode* cur = head;
    for (int i = 1; i < n; i++) {
        cur->next = new ListNode(arr[i]);
        cur = cur->next;
    }
    return head;
}

int main() {
    // 构建带环链表: 1 -> 2 -> 3 -> 4 -> 5 -> 6
    //                         ^              |
    //                         \\______________/
    int arr[] = {1, 2, 3, 4, 5, 6};
    ListNode* head = createList(arr, 6);

    // 找到节点 3 和尾节点 6
    ListNode* node3 = head->next->next;          // 第 3 个节点
    ListNode* tail = head;
    while (tail->next) tail = tail->next;        // 走到尾节点

    // 制造环: 6 指向 3
    tail->next = node3;

    // Floyd 判圈
    ListNode* slow = head;
    ListNode* fast = head;
    bool hasCycle = false;

    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) {
            hasCycle = true;
            break;
        }
    }

    cout << (hasCycle ? "cycle detected" : "no cycle") << endl;
    return 0;
}
`,
  },
  {
    id: 'selection_sort',
    label: '选择排序',
    icon: '📊',
    description: '选择排序（每次选出最小元素放到前面）',
    code: `#include <iostream>
using namespace std;

// @viz array(A) var=arr.length_var=n
// @viz watch(i, j, minIdx)
int main() {
    int arr[] = {5, 2, 8, 1, 9, 3, 7, 6};
    int n = 8;

    // 选择排序
    for (int i = 0; i < n - 1; i++) {
        int minIdx = i;
        for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[minIdx]) {
                minIdx = j;
            }
        }
        int tmp = arr[i];
        arr[i] = arr[minIdx];
        arr[minIdx] = tmp;
    }

    cout << "sorted" << endl;
    return 0;
}
`,
  },
  {
    id: 'stack_sequential',
    label: '顺序栈',
    icon: '📚',
    description: '顺序栈 push/pop 操作（数组实现）',
    code: `#include <iostream>
using namespace std;

// @viz stack(S) var=arr.top_var=top
// @viz watch(top)
int main() {
    int arr[10];
    int top = -1;  // 栈顶索引

    // push 5 个元素
    arr[++top] = 10;
    arr[++top] = 20;
    arr[++top] = 30;
    arr[++top] = 40;
    arr[++top] = 50;

    // pop 2 个元素
    int x = arr[top--];
    int y = arr[top--];

    // push 1 个元素
    arr[++top] = 99;

    cout << "top = " << arr[top] << endl;
    cout << "popped: " << x << ", " << y << endl;
    return 0;
}
`,
  },
  {
    id: 'queue_circular',
    label: '循环队列',
    icon: '🔄',
    description: '数组循环队列 — front/rear 环绕移动',
    code: `#include <iostream>
using namespace std;

// @viz queue(Q) var=queue.length_var=MAX.front_var=front.rear_var=rear
// @viz watch(front, rear)
int main() {
    const int MAX = 6;
    int queue[MAX] = {};
    int front = 0, rear = 0;

    // 入队 (enqueue)
    auto enqueue = [&](int x) {
        if ((rear + 1) % MAX != front) {  // 非满
            queue[rear] = x;
            rear = (rear + 1) % MAX;
        }
    };

    // 出队 (dequeue)
    auto dequeue = [&]() {
        if (front != rear) {  // 非空
            front = (front + 1) % MAX;
        }
    };

    enqueue(10);
    enqueue(20);
    enqueue(30);
    dequeue();           // 10 出队
    enqueue(40);
    enqueue(50);
    enqueue(60);         // 队满 (留一个空位)
    dequeue();           // 20 出队
    enqueue(70);         // rear 绕回

    cout << "front=" << front << " rear=" << rear << endl;
    return 0;
}
`,
  },
  {
    id: 'queue_linked',
    label: '链式队列',
    icon: '🚶',
    description: '链式队列 enqueue/dequeue 操作',
    code: `#include <iostream>
using namespace std;

// @viz queue(Q) var=front.next_field=next
// @viz watch(front, rear)
struct QNode {
    int val;
    QNode* next;
    QNode(int x) : val(x), next(nullptr) {}
};

int main() {
    // 链式队列: front → ... → rear
    QNode* front = nullptr;
    QNode* rear = nullptr;

    // enqueue 3 个元素
    QNode* n1 = new QNode(10);
    front = rear = n1;

    QNode* n2 = new QNode(20);
    rear->next = n2; rear = n2;

    QNode* n3 = new QNode(30);
    rear->next = n3; rear = n3;

    // dequeue 1 个元素
    QNode* tmp = front;
    front = front->next;
    delete tmp;

    // enqueue 1 个
    QNode* n4 = new QNode(99);
    rear->next = n4; rear = n4;

    if (front)
        cout << "front = " << front->val << endl;
    if (rear)
        cout << "rear = " << rear->val << endl;
    return 0;
}
`,
  },
  {
    id: 'huffman_tree',
    label: '哈夫曼树',
    icon: '🌲',
    description: '哈夫曼树构建 — 带权路径长度最小化',
    code: `#include <iostream>
#include <climits>
using namespace std;

struct HuffmanNode {
    int weight;
    HuffmanNode* left;
    HuffmanNode* right;
    HuffmanNode(int w) : weight(w), left(nullptr), right(nullptr) {}
};

// @viz binary_tree(T) root=root.left_field=left.right_field=right
// @viz watch(curr, min1, min2)
int main() {
    // 创建叶子节点（初始森林）
    HuffmanNode* nodes[] = {
        new HuffmanNode(5),
        new HuffmanNode(7),
        new HuffmanNode(10),
        new HuffmanNode(15),
        new HuffmanNode(20),
        new HuffmanNode(25),
    };
    int count = 6;

    // 哈夫曼合并过程：每次选两个最小权重的节点合并
    while (count > 1) {
        // 找最小和次小权重的节点
        int m1 = INT_MAX, m2 = INT_MAX;
        int i1 = -1, i2 = -1;
        for (int i = 0; i < count; i++) {
            if (nodes[i]->weight < m1) {
                m2 = m1; i2 = i1;
                m1 = nodes[i]->weight; i1 = i;
            } else if (nodes[i]->weight < m2) {
                m2 = nodes[i]->weight; i2 = i;
            }
        }
        HuffmanNode* min1 = nodes[i1];
        HuffmanNode* min2 = nodes[i2];

        // 合并为一个新节点
        HuffmanNode* parent = new HuffmanNode(min1->weight + min2->weight);
        parent->left = min1;
        parent->right = min2;

        // 用新节点替换合并的两个节点
        nodes[i1] = parent;
        nodes[i2] = nodes[count - 1];
        count--;
    }

    HuffmanNode* root = nodes[0];
    cout << "Huffman root weight = " << root->weight << endl;
    return 0;
}
`,
  },
  {
    id: 'deque_array',
    label: '双端队列',
    icon: '↔️',
    description: '数组循环双端队列 — 两端均可入队/出队',
    code: `#include <iostream>
using namespace std;

// @viz array(D) var=deque.length_var=N
// @viz watch(front, rear)
int main() {
    const int N = 8;
    int deque[N] = {};
    int front = 3;  // 前端指针
    int rear = 3;   // 后端指针
    int size = 0;

    // 后端入队 (push_back)
    auto push_back = [&](int x) {
        if (size < N) {
            deque[rear] = x;
            rear = (rear + 1) % N;
            size++;
        }
    };

    // 前端入队 (push_front)
    auto push_front = [&](int x) {
        if (size < N) {
            front = (front - 1 + N) % N;
            deque[front] = x;
            size++;
        }
    };

    // 后端出队 (pop_back)
    auto pop_back = [&]() {
        if (size > 0) {
            rear = (rear - 1 + N) % N;
            size--;
        }
    };

    // 前端出队 (pop_front)
    auto pop_front = [&]() {
        if (size > 0) {
            front = (front + 1) % N;
            size--;
        }
    };

    // 操作序列
    push_back(10);   // [10, _, _, _, _, _, _, _]
    push_back(20);   // [10, 20, _, _, _, _, _, _]
    push_front(5);   // [10, 20, _, _, _, _, _, 5]
    push_front(1);   // [10, 20, _, _, _, _, 1, 5]
    push_back(30);   // [10, 20, 30, _, _, _, 1, 5]
    pop_front();     // [10, 20, 30, _, _, _, 1, _]
    push_back(40);   // [10, 20, 30, 40, _, _, 1, _]
    pop_back();      // [10, 20, 30, _, _, _, 1, _]

    cout << "front=" << front << " rear=" << rear << " size=" << size << endl;
    return 0;
}
`,
  },
  {
    id: 'max_heap',
    label: '大顶堆',
    icon: '⛰️',
    description: '数组存储的二叉堆（树形可视化）',
    code: `#include <iostream>
using namespace std;

// @viz heap(H) var=arr.length_var=size
// @viz watch(i, j)
int main() {
    // 大顶堆（数组存储）
    // 索引 0 为根，左子 = 2i+1, 右子 = 2i+2
    int arr[15] = {0};
    int size = 0;

    // 插入函数（内联演示）
    auto push = [&](int val) {
        int i = size++;
        arr[i] = val;
        // sift-up
        while (i > 0) {
            int parent = (i - 1) / 2;
            if (arr[i] <= arr[parent]) break;
            int tmp = arr[i];
            arr[i] = arr[parent];
            arr[parent] = tmp;
            i = parent;
        }
    };

    push(50);
    push(30);
    push(70);
    push(20);
    push(60);
    push(40);
    push(80);

    cout << "max = " << arr[0] << endl;
    return 0;
}
`,
  },
  {
    id: 'graph_adjlist',
    label: '邻接表图',
    icon: '🕸️',
    description: '邻接表存储的有向图结构',
    code: `#include <iostream>
using namespace std;

struct EdgeNode {
    int to;
    EdgeNode* next;
    EdgeNode(int v, EdgeNode* n = nullptr) : to(v), next(n) {}
};

// @viz graph(G) var=adj.size_var=n
int main() {
    int n = 6;  // 6 个顶点 0-5
    EdgeNode* adj[6] = {nullptr};

    // 构建有向图:
    // 0 → 1, 2
    // 1 → 3
    // 2 → 3, 4
    // 3 → 5
    // 4 → 5
    // 5 → 0
    adj[0] = new EdgeNode(2, new EdgeNode(1));
    adj[1] = new EdgeNode(3);
    adj[2] = new EdgeNode(4, new EdgeNode(3));
    adj[3] = new EdgeNode(5);
    adj[4] = new EdgeNode(5);
    adj[5] = new EdgeNode(0);

    // 输出邻接表
    for (int i = 0; i < n; i++) {
        cout << i << " → ";
        EdgeNode* cur = adj[i];
        while (cur) {
            cout << cur->to << " ";
            cur = cur->next;
        }
        cout << endl;
    }
    return 0;
}
`,
  },
  {
    id: 'graph_adjmatrix',
    label: '邻接矩阵图',
    icon: '🕸️',
    description: '邻接矩阵存储的有向图结构',
    code: `#include <iostream>
using namespace std;

// @viz graph(G) var=mat.mode=matrix.size_var=n
int main() {
    int n = 5;  // 5 个顶点 0-4
    int mat[5][5] = {0};

    // 构建有向图:
    // 0 → 1, 3
    // 1 → 2
    // 2 → 0, 3, 4
    // 3 → 4
    // 4 → 1
    mat[0][1] = 1; mat[0][3] = 1;
    mat[1][2] = 1;
    mat[2][0] = 1; mat[2][3] = 1; mat[2][4] = 1;
    mat[3][4] = 1;
    mat[4][1] = 1;

    // 输出邻接矩阵 + 统计出度
    for (int i = 0; i < n; i++) {
        int out = 0;
        for (int j = 0; j < n; j++) {
            if (mat[i][j]) out++;
            cout << mat[i][j] << " ";
        }
        cout << "| out=" << out << endl;
    }
    return 0;
}
`,
  },
  {
    id: 'hashmap_open_addressing',
    label: '哈希表（开放定址法）',
    icon: '#️⃣',
    description: '线性探测开放定址哈希表',
    code: `#include <iostream>
using namespace std;

// 开放定址哈希表项
struct Entry {
    int key;
    int val;
    bool occupied;  // 标记槽位是否被占用
};

// @viz hashmap(H) var=table.mode=open_addressing
int main() {
    const int M = 11;
    Entry table[M] = {};
    for (int i = 0; i < M; i++) {
        table[i].key = 0;
        table[i].val = 0;
        table[i].occupied = false;
    }

    // 线性探测插入
    auto put = [&](int key, int val) {
        int idx = key % M;
        while (table[idx].occupied) {
            idx = (idx + 1) % M;  // 线性探测
        }
        table[idx].key = key;
        table[idx].val = val;
        table[idx].occupied = true;
    };

    put(10, 100);
    put(22, 220);  // 22 % 11 = 0 → 冲突！探测到槽 1
    put(33, 330);  // 33 % 11 = 0 → 又冲突！探测到槽 2
    put(15, 150);  // 15 % 11 = 4
    put(26, 260);  // 26 % 11 = 4 → 冲突！探测到槽 5
    put(7, 70);
    put(18, 180);  // 18 % 11 = 7 → 冲突！探测到槽 8

    // 输出哈希表
    for (int i = 0; i < M; i++) {
        cout << "[" << i << "] ";
        if (table[i].occupied)
            cout << table[i].key << " -> " << table[i].val;
        else
            cout << "empty";
        cout << endl;
    }
    return 0;
}
`,
  },
  {
    id: 'hashmap_chaining',
    label: '哈希表（拉链法）',
    icon: '#️⃣',
    description: '拉链法哈希表插入与查找',
    code: `#include <iostream>
using namespace std;

struct HashNode {
    int key;
    int val;
    HashNode* next;
    HashNode(int k, int v, HashNode* n = nullptr) : key(k), val(v), next(n) {}
};

// @viz hashmap(H) var=table.mode=chaining
// @viz watch(cur)
int main() {
    const int M = 7;
    HashNode* table[M] = {nullptr};

    // 链表头插法
    auto put = [&](int key, int val) {
        int idx = key % M;
        table[idx] = new HashNode(key, val, table[idx]);
    };

    put(10, 100);
    put(20, 200);
    put(3, 30);   // 3 % 7 = 3
    put(17, 170); // 17 % 7 = 3 → 冲突！挂到 3 号桶的链上
    put(7, 70);   // 7 % 7 = 0 → 冲突！挂到 0 号桶的链上
    put(14, 140); // 14 % 7 = 0 → 又冲突！
    put(24, 240); // 24 % 7 = 3 → 又冲突！

    // 查找 key=17
    int target = 17;
    HashNode* cur = table[target % M];
    while (cur && cur->key != target) {
        cur = cur->next;
    }
    if (cur)
        cout << "found: " << cur->val << endl;
    return 0;
}
`,
  },
];

/** 默认模板 ID */
export const DEFAULT_TEMPLATE_ID = 'linked_list_reverse';
