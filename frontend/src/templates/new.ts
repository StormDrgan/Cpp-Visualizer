export const NEW_TEMPLATES = [
  {
    id: 'doubly_linked_list',
    label: '双向链表',
    icon: '🔗',
    description: '双向链表插入/删除（prev/next 指针）',
    code: `#include <iostream>
using namespace std;

// @viz linked_list(DL) head=head.next_field=next.prev_field=prev
// @viz watch(curr)
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
// @viz watch(curr)
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
// @viz watch(curr)
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
// @viz watch(curr)
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
