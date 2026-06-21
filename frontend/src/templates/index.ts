import type { Annotation } from '../types';

export interface Template {
  id: string;
  label: string;
  icon: string;
  description: string;
  code: string;
  annotations: Annotation[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'linked_list_reverse',
    label: '链表反转',
    icon: '🔗',
    description: '构建链表并用双指针迭代反转',
    code: `#include <iostream>
using namespace std;

// @viz linked_list(L) head=head.next_field=next
// @viz watch(curr, prev)
struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

int main() {
    // 构建链表: 1 -> 2 -> 3 -> 4 -> 5
    ListNode* head = new ListNode(1);
    head->next = new ListNode(2);
    head->next->next = new ListNode(3);
    head->next->next->next = new ListNode(4);
    head->next->next->next->next = new ListNode(5);

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
    annotations: [
      {
        struct_type: 'linked_list',
        name: 'L',
        root_var: 'head',
        next_field: 'next',
        left_field: '',
        right_field: '',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['curr', 'prev'],
      },
    ],
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

int main() {
    // 构建链表: 1 -> 2 -> 3 -> 4 -> 5 -> 6
    ListNode* head = new ListNode(1);
    head->next = new ListNode(2);
    head->next->next = new ListNode(3);
    head->next->next->next = new ListNode(4);
    head->next->next->next->next = new ListNode(5);
    head->next->next->next->next->next = new ListNode(6);

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
    annotations: [
      {
        struct_type: 'linked_list',
        name: 'L',
        root_var: 'head',
        next_field: 'next',
        left_field: '',
        right_field: '',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['slow', 'fast'],
      },
    ],
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
    annotations: [
      {
        struct_type: 'binary_tree',
        name: 'T',
        root_var: 'root',
        next_field: '',
        left_field: 'left',
        right_field: 'right',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['curr'],
      },
    ],
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
    annotations: [
      {
        struct_type: 'array',
        name: 'A',
        root_var: 'arr',
        next_field: '',
        left_field: '',
        right_field: '',
        length_var: 'n',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['i', 'j'],
      },
    ],
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
    annotations: [
      {
        struct_type: 'array',
        name: 'A',
        root_var: 'arr',
        next_field: '',
        left_field: '',
        right_field: '',
        length_var: 'n',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['lo', 'hi', 'mid'],
      },
    ],
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
    annotations: [
      {
        struct_type: 'binary_tree',
        name: 'T',
        root_var: 'root',
        next_field: '',
        left_field: 'left',
        right_field: 'right',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['root'],
      },
    ],
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

int main() {
    // 构建带环链表: 1 -> 2 -> 3 -> 4 -> 5 -> 6
    //                         ^              |
    //                         \\______________/
    ListNode* head = new ListNode(1);
    head->next = new ListNode(2);
    head->next->next = new ListNode(3);
    head->next->next->next = new ListNode(4);
    head->next->next->next->next = new ListNode(5);
    head->next->next->next->next->next = new ListNode(6);

    // 制造环: 6 指向 3
    head->next->next->next->next->next->next = head->next->next;

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
    annotations: [
      {
        struct_type: 'linked_list',
        name: 'L',
        root_var: 'head',
        next_field: 'next',
        left_field: '',
        right_field: '',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['slow', 'fast'],
      },
    ],
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
    annotations: [
      {
        struct_type: 'array',
        name: 'A',
        root_var: 'arr',
        next_field: '',
        left_field: '',
        right_field: '',
        length_var: 'n',
        watched_vars: [],
      },
      {
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        left_field: '',
        right_field: '',
        watched_vars: ['i', 'j', 'minIdx'],
      },
    ],
  },
];

/** 默认模板 ID */
export const DEFAULT_TEMPLATE_ID = 'linked_list_reverse';
