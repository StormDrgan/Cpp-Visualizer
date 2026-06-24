# 3. 后端设计

## 3.1 技术选型

| 组件 | 选型 | 理由 |
|---|---|---|
| HTTP 框架 | FastAPI（Python） | WebSocket 原生支持，async 友好 |
| LLDB 驱动 | `lldb` Python 绑定（Xcode 自带 Python 3.9） | 通过子进程桥接与 FastAPI 通信 |
| 编译器 | 系统安装的 `clang++` 或 `g++` | 必须带 `-g` 调试符号 |
| 代码格式化 | `clang-format` | 保证展示一致性 |
| 安全隔离 | Docker 容器 | 用户代码在容器内编译执行，不污染宿主机 |

## 3.2 核心 API 设计

```
POST   /api/session              → 创建新会话，返回 session_id
POST   /api/session/:id/load     → 加载源码，编译（-g），启动 LLDB
POST   /api/session/:id/step     → 执行一步，返回当前完整状态
POST   /api/session/:id/back     → 从服务器快照栈退回一步
POST   /api/session/:id/run-to   → 运行到指定行/断点
POST   /api/session/:id/reset    → 重置：杀 LLDB，清快照，重新编译
DELETE /api/session/:id          → 清理会话资源

POST   /api/session/:id/annotate → 更新用户对数据结构的标注
POST   /api/session/:id/eval     → 在暂停点执行任意表达式
POST   /api/session/:id/set-var  → 修改变量值

GET    /api/health               → 健康检查
```

## 3.3 LLDB Controller 设计要点

```
LLDB 会话生命周期：
1. 用户提交代码 → 写临时文件 → clang++ -g -O0 source.cpp -o binary
2. 起 LLDB：debugger.CreateTarget → BreakpointCreateByName("main") → Launch
3. 停在 main 第一行 → 初始化状态快照
4. 循环：等待前端指令 → step/next → 抓状态 → 返回快照 → 压入历史栈
5. 收到 back 指令 → 从历史栈 pop → 不需要操作 LLDB（不移动程序计数器）
6. 但：如果用户后退后又往前走 → 需要 LLDB 实际 step 到目标行
```

**后退的实现细节（重要）：**

```
服务器维护两层状态：

┌─────────────────────────┐
│  history_stack          │  [snap_0, snap_1, snap_2, ..., snap_cur]
│                         │  snap_N = 第 N 步时的完整状态
└─────────────────────────┘

┌─────────────────────────┐
│  lldb_current_position  │  当前 LLDB 实际停在哪一行
│                         │  （只增不降，LLDB 不能反着跑）
└─────────────────────────┘

"前进一步" 的三种情况：
  Case A: lldb 位置 == history 栈顶位置 → 正常 step，push 新快照
  Case B: lldb 位置 < 目标位置 → LLDB 继续 step 直到追上
  Case C: lldb 位置 > 目标位置（用户回退后改了代码）→ 清空 LLDB，重跑

"后退一步"：
  history_stack.pop()
  返回 history_stack[-1] 的快照
  LLDB 本身不受影响（保持在原位置）
```

## 3.4 State Snapshot 数据结构

```json
{
  "step_number": 15,
  "source_line": 23,
  "file": "main.cpp",
  "current_function": "mergeTwoLists",
  "call_stack": [
    {"function": "main", "line": 42, "file": "main.cpp"},
    {"function": "mergeTwoLists", "line": 23, "file": "main.cpp"}
  ],
  "locals": [
    {
      "name": "slow",
      "type": "ListNode*",
      "value": "0x5555555a3c40",
      "display_value": "{val=3, next=…}",
      "is_pointer": true,
      "deref_type": "ListNode"
    },
    {
      "name": "fast",
      "type": "ListNode*",
      "value": "0x5555555a3c80",
      "display_value": "{val=5, next=…}",
      "is_pointer": true,
      "deref_type": "ListNode"
    },
    {
      "name": "counter",
      "type": "int",
      "value": "3",
      "is_pointer": false
    }
  ],
  "watched_expressions": [
    {"expression": "slow->val", "value": "3"},
    {"expression": "*fast", "value": "{val = 5, next = 0x5555555a3ca0}"}
  ],
  "heap_structures": [
    {
      "annotation_name": "list1",
      "structure_type": "linked_list",
      "root_node_addr": "0x5555555a3c40",
      "nodes": [
        {
          "addr": "0x5555555a3c40",
          "label": "ListNode(3)",
          "fields": {"val": 3, "next": "0x5555555a3c60"},
          "pointers_pointing_here": ["slow"]
        },
        {
          "addr": "0x5555555a3c60",
          "label": "ListNode(4)",
          "fields": {"val": 4, "next": "0x5555555a3c80"},
          "pointers_pointing_here": []
        },
        {
          "addr": "0x5555555a3c80",
          "label": "ListNode(5)",
          "fields": {"val": 5, "next": "0x5555555a3ca0"},
          "pointers_pointing_here": ["fast"]
        }
      ],
      "cycle_detected": false
    }
  ],
  "stdout": "",
  "is_terminated": false,
  "exit_code": null
}
```

## 3.5 内存遍历器（v0.8 auto_discover 自动化大部分调用）

```python
# 手动调用 API（v0.2–v0.7 主入口，v0.8+ 降级为兜底）
# auto_discover() 自动生成 Annotation → 内部调用这些 walker

class MemoryWalker:
    """
    根据标注，从 LLDB 中遍历 heap 数据结构。
    标注来源：
      - auto_discover() 自动生成（v0.8 默认）— inspect_type 获取字段布局
      - 手动 @viz 注释（兜底）— 字段名不常规时使用
    """

    def walk_linked_list(self, gdb, head_addr, next_field):
        """从 head 出发，沿 next 走完整个链，检测环"""
        nodes = []
        visited = set()
        addr = head_addr
        while addr != "0x0" and addr != "0":
            if addr in visited:
                # 检测到环
                return nodes, True
            visited.add(addr)
            node = self.read_struct(gdb, addr)
            nodes.append(node)
            addr = node["fields"].get(next_field, "0x0")
        return nodes, False

    def walk_binary_tree(self, gdb, root_addr, left_field, right_field):
        """递归遍历二叉树"""
        if root_addr in ("0x0", "0"):
            return None
        node = self.read_struct(gdb, root_addr)
        node["left"] = self.walk_binary_tree(
            gdb, node["fields"][left_field], left_field, right_field
        )
        node["right"] = self.walk_binary_tree(
            gdb, node["fields"][right_field], left_field, right_field
        )
        return node

    def read_struct(self, gdb, addr):
        """用 LLDB 命令读取 struct 内存内容"""
        ...
```

## 3.6 安全隔离

```
每个用户会话的隔离策略：
┌──────────────────────────────────────────┐
│ Docker 容器（每个会话独立）                │
│                                           │
│ - CPU 限制：1 核                          │
│ - 内存限制：512 MB                        │
│ - 执行超时：30 秒                         │
│ - 磁盘：只读 rootfs + tmpfs 临时目录       │
│ - 网络：完全禁用（--network=none）         │
│ - 禁止的系统调用：fork, exec, socket 等    │
│ - seccomp 策略：最小权限                  │
│                                           │
│ 容器内运行：编译过程 + LLDB + 目标程序     │
│ 宿主机只负责：HTTP 服务 + 容器管理         │
└──────────────────────────────────────────┘
```

备选方案（开发阶段）：开发时不启动 Docker，直接在宿主机跑。加 `ulimit` 限制，且不上生产环境。
