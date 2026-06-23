import type { Template } from './types';

export const NEW_TEMPLATES: Template[] = [
  {
    id: 'btree_insert',
    label: 'B树插入 (2-3树)',
    icon: '🌲',
    description: 'B-tree 插入构建 — m=3 阶',
    code: `#include <iostream>
using namespace std;

struct BNode {
    int keys[4];
    BNode* children[5];
    int n;
    bool leaf;
    BNode() : n(0), leaf(true) {
        for (int i = 0; i < 5; i++) children[i] = nullptr;
        for (int i = 0; i < 4; i++) keys[i] = 0;
    }
};

// @viz b_tree(BT) root=root.order=3
int main() {
    BNode* root = new BNode();
    int vals[] = {10, 20, 5, 6, 12, 30, 7, 17};
    for (int i = 0; i < 8; i++) {
        int k = vals[i];
        if (root->n == 0) {
            root->keys[0] = k;
            root->n = 1;
            continue;
        }
        BNode* cur = root;
        if (cur->n == 3) {
            BNode* s = new BNode();
            s->leaf = cur->leaf;
            s->children[0] = cur->children[2];
            s->children[1] = cur->children[3];
            s->keys[0] = cur->keys[3];
            s->n = 1;
            cur->n = 1;
            cur->children[2] = nullptr;
            cur->children[3] = nullptr;
            BNode* nr = new BNode();
            nr->leaf = false;
            nr->keys[0] = cur->keys[1];
            nr->children[0] = cur;
            nr->children[1] = s;
            nr->n = 1;
            root = nr;
            if (k < nr->keys[0]) cur = nr->children[0];
            else cur = nr->children[1];
        }
        while (!cur->leaf) {
            int ci = cur->n;
            for (int j = 0; j < cur->n; j++) {
                if (k < cur->keys[j]) { ci = j; break; }
            }
            cur = cur->children[ci];
        }
        int pos = cur->n - 1;
        while (pos >= 0 && cur->keys[pos] > k) {
            cur->keys[pos + 1] = cur->keys[pos];
            pos--;
        }
        cur->keys[pos + 1] = k;
        cur->n++;
    }
    cout << "B-tree built, root keys=" << root->keys[0] << endl;
    return 0;
}
`,
  },
  {
    id: 'bplustree_search',
    label: 'B+树搜索',
    icon: '🌿',
    description: 'B+树搜索 — m=4 阶, 叶子链表',
    code: `#include <iostream>
using namespace std;

struct BPNode {
    int keys[5];
    BPNode* children[6];
    int n;
    bool leaf;
    BPNode* next;
    BPNode() : n(0), leaf(true), next(nullptr) {
        for (int i = 0; i < 6; i++) children[i] = nullptr;
        for (int i = 0; i < 5; i++) keys[i] = 0;
    }
};

// @viz bplustree(BP) root=root.order=4
int main() {
    BPNode* root = new BPNode();
    root->keys[0] = 5; root->n = 1;

    BPNode* l1 = new BPNode();
    l1->keys[0] = 1; l1->keys[1] = 3; l1->n = 2;
    BPNode* l2 = new BPNode();
    l2->keys[0] = 7; l2->keys[1] = 9; l2->n = 2;

    l1->next = l2;
    root->children[0] = l1;
    root->children[1] = l2;
    root->leaf = false;

    int target = 7;
    BPNode* cur = root;
    while (!cur->leaf) {
        int i = 0;
        while (i < cur->n && target >= cur->keys[i]) i++;
        cur = cur->children[i];
    }
    bool found = false;
    for (int i = 0; i < cur->n; i++) {
        if (cur->keys[i] == target) { found = true; break; }
    }
    cout << "search " << target << " = " << (found ? "found" : "not found") << endl;
    return 0;
}
`,
  },
  {
    id: 'btree_search',
    label: 'B树搜索',
    icon: '🌲',
    description: 'B-tree 搜索 — m=3 阶查找',
    code: `#include <iostream>
using namespace std;

struct BNode {
    int keys[4];
    BNode* children[5];
    int n;
    bool leaf;
    BNode() : n(0), leaf(true) {
        for (int i = 0; i < 5; i++) children[i] = nullptr;
        for (int i = 0; i < 4; i++) keys[i] = 0;
    }
};

// @viz b_tree(BT) root=root.order=3
// @viz show(cur)
int main() {
    BNode* root = new BNode();
    root->keys[0] = 10; root->keys[1] = 20; root->n = 2;

    BNode* c1 = new BNode();
    c1->keys[0] = 5; c1->n = 1;
    BNode* c2 = new BNode();
    c2->keys[0] = 15; c2->n = 1;
    BNode* c3 = new BNode();
    c3->keys[0] = 25; c3->keys[1] = 30; c3->n = 2;

    root->children[0] = c1;
    root->children[1] = c2;
    root->children[2] = c3;
    root->leaf = false;

    int target = 15;
    BNode* cur = root;
    bool found = false;
    while (cur) {
        int i = 0;
        while (i < cur->n && target > cur->keys[i]) i++;
        if (i < cur->n && cur->keys[i] == target) {
            found = true; break;
        }
        if (cur->leaf) break;
        cur = cur->children[i];
    }
    cout << "search " << target << " = " << (found ? "found" : "not found") << endl;
    return 0;
}
`,
  },
  {
    id: 'bplustree_insert',
    label: 'B+树插入',
    icon: '🌿',
    description: 'B+树插入构建 — m=4 阶, 叶子链表',
    code: `#include <iostream>
using namespace std;

struct BPNode {
    int keys[5];
    BPNode* children[6];
    int n;
    bool leaf;
    BPNode* next;
    BPNode() : n(0), leaf(true), next(nullptr) {
        for (int i = 0; i < 6; i++) children[i] = nullptr;
        for (int i = 0; i < 5; i++) keys[i] = 0;
    }
};

// @viz bplustree(BP) root=root.order=4
// @viz show(cur)
int main() {
    BPNode* root = new BPNode();
    int vals[] = {8, 3, 10, 1, 6, 14, 4, 7, 13};
    BPNode* cur;
    for (int vi = 0; vi < 9; vi++) {
        int k = vals[vi];
        if (root->n == 0) {
            root->keys[0] = k; root->n = 1;
            continue;
        }
        cur = root;
        // Find leaf
        while (!cur->leaf) {
            int ci = cur->n;
            for (int j = 0; j < cur->n; j++) {
                if (k < cur->keys[j]) { ci = j; break; }
            }
            cur = cur->children[ci];
        }
        // Insert into leaf (simplified, no split for demo)
        int pos = cur->n - 1;
        while (pos >= 0 && cur->keys[pos] > k) {
            cur->keys[pos + 1] = cur->keys[pos];
            pos--;
        }
        cur->keys[pos + 1] = k;
        cur->n++;
        // Link leaves
        if (vi > 0 && vi % 3 == 0) {
            BPNode* prev = root;
            while (!prev->leaf) prev = prev->children[0];
            while (prev->next) prev = prev->next;
            cur->next = new BPNode();
            cur->next->keys[0] = vals[vi+1];
            cur->next->n = 1;
        }
    }
    cout << "B+tree built, root keys=" << root->keys[0] << endl;
    return 0;
}
`,
  },

  {
    id: 'stack_linked',
    label: '链式栈',
    icon: '📚',
    description: '链式栈 push/pop 操作（指针实现）',
    code: `#include <iostream>
using namespace std;

// @viz stack(S) var=top.next_field=next
// @viz show(cur, top)
struct SNode {
    int val;
    SNode* next;
    SNode(int x, SNode* n = nullptr) : val(x), next(n) {}
};

int main() {
    SNode* top = nullptr;
    SNode* cur;

    // push 5 个元素
    top = new SNode(10, top);
    top = new SNode(20, top);
    top = new SNode(30, top);
    top = new SNode(40, top);
    top = new SNode(50, top);

    // pop 2 个元素
    cur = top; top = top->next; delete cur;
    cur = top; top = top->next; delete cur;

    // push 1 个元素
    top = new SNode(99, top);

    cout << "top = " << top->val << endl;
    return 0;
}
`,
  },

  {
    id: 'doubly_linked_list',
    label: '双向链表',
    icon: '🔗',
    description: '双向链表插入/删除（prev/next 指针）',
    code: `#include <iostream>
using namespace std;

// @viz linked_list(DL) head=head.next_field=next.prev_field=prev
// @viz show(curr)
struct DListNode {
    int val;
    DListNode* prev;
    DListNode* next;
    DListNode(int x) : val(x), prev(nullptr), next(nullptr) {}
};

int main() {
    DListNode* head = new DListNode(1);
    DListNode* n2 = new DListNode(2);
    DListNode* n3 = new DListNode(3);
    DListNode* n4 = new DListNode(4);
    DListNode* n5 = new DListNode(5);
    head->next = n2; n2->prev = head;
    n2->next = n3; n3->prev = n2;
    n3->next = n4; n4->prev = n3;
    n4->next = n5; n5->prev = n4;

    DListNode* curr = n3;
    DListNode* newNode = new DListNode(99);
    newNode->next = curr->next;
    newNode->prev = curr;
    if (curr->next) curr->next->prev = newNode;
    curr->next = newNode;

    curr = n4;
    if (curr->prev) curr->prev->next = curr->next;
    if (curr->next) curr->next->prev = curr->prev;
    delete curr;

    cout << "done" << endl;
    return 0;
}
`,
  },
  {
    id: 'bfs_traversal',
    label: 'BFS 遍历',
    icon: '🕸️',
    description: '广度优先搜索 — 层级染色推进',
    code: `#include <iostream>
#include <queue>
using namespace std;

struct EdgeNode {
    int to;
    EdgeNode* next;
    EdgeNode(int v, EdgeNode* n = nullptr) : to(v), next(n) {}
};

// @viz graph(G) var=adj.size_var=n
// @viz show(curr)
int main() {
    int n = 5;
    EdgeNode* adj[5] = {nullptr};
    adj[0] = new EdgeNode(2, new EdgeNode(1));
    adj[1] = new EdgeNode(3);
    adj[2] = new EdgeNode(4, new EdgeNode(3));
    adj[3] = new EdgeNode(4);

    bool visited[5] = {false};
    queue<int> q;
    q.push(0); visited[0] = true;
    int curr;

    while (!q.empty()) {
        curr = q.front(); q.pop();
        EdgeNode* cur = adj[curr];
        while (cur) {
            if (!visited[cur->to]) {
                visited[cur->to] = true;
                q.push(cur->to);
            }
            cur = cur->next;
        }
    }
    cout << "BFS done" << endl;
    return 0;
}
`,
  },
  {
    id: 'dfs_traversal',
    label: 'DFS 遍历',
    icon: '🕸️',
    description: '深度优先搜索 — 栈式遍历',
    code: `#include <iostream>
using namespace std;

struct EdgeNode {
    int to;
    EdgeNode* next;
    EdgeNode(int v, EdgeNode* n = nullptr) : to(v), next(n) {}
};

// @viz graph(G) var=adj.size_var=n
// @viz show(curr)
int main() {
    int n = 5;
    EdgeNode* adj[5] = {nullptr};
    adj[0] = new EdgeNode(2, new EdgeNode(1));
    adj[1] = new EdgeNode(3);
    adj[2] = new EdgeNode(4, new EdgeNode(3));
    adj[3] = new EdgeNode(4);

    bool visited[5] = {false};
    int stack[10]; int top = -1;
    stack[++top] = 0; visited[0] = true;
    int curr;

    while (top >= 0) {
        curr = stack[top--];
        EdgeNode* cur = adj[curr];
        while (cur) {
            if (!visited[cur->to]) {
                visited[cur->to] = true;
                stack[++top] = cur->to;
            }
            cur = cur->next;
        }
    }
    cout << "DFS done" << endl;
    return 0;
}
`,
  },
  {
    id: 'fibonacci_recursion',
    label: '斐波那契递归',
    icon: '🌀',
    description: '递归调用树可视化 fib(n)',
    code: `#include <iostream>
using namespace std;

// @viz recursion_tree(F)
int fib(int n) {
    if (n <= 1) return n;
    int a = fib(n - 1);
    int b = fib(n - 2);
    return a + b;
}

int main() {
    int result = fib(5);
    cout << "fib(5) = " << result << endl;
    return 0;
}
`,
  },
  {
    id: 'avl_insert',
    label: 'AVL 插入',
    icon: '🌳',
    description: 'AVL 树插入构建（含高度字段）',
    code: `#include <iostream>
#include <algorithm>
using namespace std;

struct AVLNode {
    int val;
    int height;
    AVLNode* left;
    AVLNode* right;
    AVLNode(int x) : val(x), height(1), left(nullptr), right(nullptr) {}
};

// @viz binary_tree(T) root=root.left_field=left.right_field=right
// @viz show(curr)
AVLNode* insert(AVLNode* node, int val) {
    if (!node) return new AVLNode(val);
    if (val < node->val)
        node->left = insert(node->left, val);
    else if (val > node->val)
        node->right = insert(node->right, val);
    else return node;
    int lh = node->left ? node->left->height : 0;
    int rh = node->right ? node->right->height : 0;
    node->height = 1 + max(lh, rh);
    return node;
}

int main() {
    AVLNode* root = nullptr;
    int vals[] = {10, 20, 30, 40, 50, 25};
    for (int i = 0; i < 6; i++)
        root = insert(root, vals[i]);
    cout << "root=" << root->val << " h=" << root->height << endl;
    return 0;
}
`,
  },
];
