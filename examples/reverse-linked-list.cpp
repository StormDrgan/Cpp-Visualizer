// LeetCode 206: Reverse Linked List
// 反转一个单链表 — 经典三指针迭代法
// @viz linked_list(L) head=head.next_field=next
// @viz show(prev, curr, next)

#include <iostream>
using namespace std;

struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

// 头插法构建链表：1 -> 2 -> 3 -> 4 -> 5 -> nullptr
ListNode* createList() {
    int arr[] = {1, 2, 3, 4, 5};
    int n = 5;
    ListNode* head = nullptr;
    for (int i = n - 1; i >= 0; i--) {
        ListNode* node = new ListNode(arr[i]);
        node->next = head;
        head = node;
    }
    return head;
}

void printList(ListNode* head) {
    ListNode* p = head;
    while (p) {
        cout << p->val << " -> ";
        p = p->next;
    }
    cout << "null" << endl;
}

int main() {
    // 1. 构建原始链表
    ListNode* head = createList();
    cout << "Original: ";
    printList(head);

    // 2. 迭代反转
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr) {
        ListNode* next = curr->next;  // 暂存后继
        curr->next = prev;            // 反转指针
        prev = curr;                  // prev 前进
        curr = next;                  // curr 前进
    }
    // 循环结束后 prev 指向新头节点

    // 3. 输出结果
    cout << "Reversed: ";
    printList(prev);

    return 0;
}
