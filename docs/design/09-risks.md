# 9. 风险与备选方案

## 9.1 主要风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| LLDB 在某些平台上不稳定 | 步进失败 | 重试机制 + 多版本兼容测试 |
| C++ 模板/STL 太复杂 | 遍历困难 | 限制范围，STL 容器只读 size/empty |
| Docker 部署复杂 | 部署门槛高 | 开发阶段不用 Docker，本地直接跑 |
| 用户代码安全性 | 服务器被攻击 | Docker 强隔离 + seccomp + 无网络 |
| 可视化性能 | 大结构图渲染卡 | Canvas 而非 SVG，虚拟化渲染 |

## 9.2 备选方案

| 原方案 | 备选 | 何时启用 |
|---|---|---|
| LLDB 后端驱动 | 插桩（Instrumentation）方案 | LLDB 不稳定时 |
| Docker 隔离 | exec 沙箱（nsjail / firejail） | Docker 太重时 |
| Canvas 手绘渲染 | vis-network + D3.js | 手绘太复杂时快速替代 |
| HTTP 轮询 | WebSocket | 需要更实时推送时 |
| Python FastAPI | Go + delve 调试器 | Python 接口有性能瓶颈时 |

---

## 附录 A：参考资料

| 项目 | 链接 | 参考价值 |
|---|---|---|
| Python Tutor | https://pythontutor.com/ | UI/UX 参考，但只有 Python/JS/Java |
| LLDB GUI | — | 浏览器端 LLDB 前端 |
| rr | https://rr-project.org/ | 时间旅行调试，可参考其录制/重放机制 |
| Godbolt | https://godbolt.org/ | 编译输出展示 |
| Sourcetrail | https://github.com/CoatiSoftware/Sourcetrail | C++ 代码索引可视化，已停更但思路可参考 |
| Konva.js | https://konvajs.org/ | Canvas 图形库 |
| dagre | https://github.com/dagrejs/dagre | 有向图分层布局 |
| ElkJS | https://github.com/kieler/elkjs | 更现代的图布局引擎 |

## 附录 B：环境要求

| 依赖 | 最低版本 | 用途 |
|---|---|---|
| Python | 3.11+ | 后端 |
| Node.js | 18+ | 前端构建 |
| clang++ 或 g++ | clang 14+ / gcc 12+ | 编译 C++ 代码 |
| LLDB | Xcode 自带 | 调试驱动 |
| Docker | 24+ | 安全隔离（可选，开发阶段不需要） |
