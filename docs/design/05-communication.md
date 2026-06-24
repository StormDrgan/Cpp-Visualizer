# 5. 通信协议

## 5.1 WebSocket 消息格式

```json
// ========== 前端 → 后端 ==========

// 加载代码
{"type": "load", "payload": {"code": "...", "annotations": [...]}}

// 步进指令
{"type": "step", "payload": {"mode": "step_over"}}
{"type": "step", "payload": {"mode": "step_into"}}
{"type": "step", "payload": {"mode": "step_out"}}

// 运行到指定行
{"type": "run_to", "payload": {"line": 42}}
{"type": "run_to", "payload": {"mode": "next_breakpoint"}}

// 后退
{"type": "back", "payload": {"steps": 1}}
{"type": "back", "payload": {"steps": 5}}  // 一次回退多步

// 重置
{"type": "reset"}

// 设置/删除断点
{"type": "set_breakpoint", "payload": {"line": 15}}
{"type": "remove_breakpoint", "payload": {"line": 15}}

// 修改变量
{"type": "set_var", "payload": {"name": "counter", "value": "10"}}

// 执行表达式
{"type": "eval", "payload": {"expression": "slow->next->val"}}

// 更新标注
{"type": "update_annotations", "payload": {"annotations": [...]}}


// ========== 后端 → 前端 ==========

// 编译结果
{"type": "compiled", "payload": {"success": true}}

// 编译错误
{"type": "compile_error", "payload": {"errors": [{"line": 10, "message": "..."}]}}

// 状态快照（每次步进/后退后推送）
{"type": "snapshot", "payload": {...}}  // 内容见 3.4 节

// 程序终止
{"type": "terminated", "payload": {"exit_code": 0, "stdout": "..."}}

// 错误
{"type": "error", "payload": {"message": "LLDB 通信超时"}}

// 运行时输出
{"type": "stdout", "payload": {"text": "Hello World\n"}}
```

## 5.2 通信模式（v0.5 实现）

**当前模式：WebSocket 为主，HTTP 为回退**

- WebSocket 端点 `/ws/{session_id}` — 持久连接，双向 JSON 消息
- 前端 `WebSocketClient` 类 — 自动重连（指数退避，最多 5 次）
- Zustand store 双通道：`wsClient?.connected` 时优先 `ws.send()`，否则 `api.xxx()` HTTP fallback
- Vite dev proxy 同时代理 `/api`（HTTP）和 `/ws`（WebSocket）
- HTTP REST API 完整保留，断网或 WS 故障时无缝降级
- 消息类型与 §5.1 一致：`load`/`step`/`back`/`forward`/`run_to`/`reset`/`set_breakpoint`/`remove_breakpoint`/`eval`
