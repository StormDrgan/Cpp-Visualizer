# C/C++ Visualizer

Web 端 C/C++ 代码逐行执行可视化工具，支持时间旅行调试。

**v0.1 MVP** — 逐行步进 + 变量查看 + 历史回退

## 快速开始

### 环境要求

- Python 3.11+（FastAPI 后端）
- Node.js 18+（React 前端）
- Xcode（提供 LLDB + Python 3.9 绑定）
- clang++（编译 C++ 代码）

### 安装

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 运行

```bash
# 终端 1 — 启动后端
cd backend
python main.py
# → http://127.0.0.1:8000

# 终端 2 — 启动前端
cd frontend
npm run dev
# → http://localhost:5173
```

打开浏览器访问 http://localhost:5173，在编辑器中编写 C++ 代码，按 Cmd+Enter 加载并开始调试。

## 架构

```
前端 (React + Monaco Editor + Zustand)
       ↕  HTTP API (JSON)
后端 (FastAPI + lldb_bridge.py)
       ↕  JSON 子进程通信
LLDB 桥接脚本 (Xcode Python 3.9 + LLDB API)
```

## 路线图

- [x] v0.1 — MVP：步进、后退、变量面板
- [ ] v0.2 — 链表可视化
- [ ] v0.3 — 二叉树可视化
- [ ] v0.4 — 数组可视化 + 断点
- [ ] v0.5 — WebSocket + Docker + 多文件
