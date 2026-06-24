# C/C++ 代码运行过程可视化 — 设计文档

> **目标用户**：个人开发者，用于理解复杂数据结构与算法代码
> **核心体验**：逐行步进 → 可前进/后退 → 指针位置实时可视化
> **版本**：v0.10，持续迭代

## 文档索引

| 文件 | 内容 |
|---|---|
| [01-product-overview.md](01-product-overview.md) | 产品概述 — 核心功能、数据结构三级清单、不做什么 |
| [02-architecture.md](02-architecture.md) | 架构总览 — 前后端架构图 |
| [03-backend.md](03-backend.md) | 后端设计 — 技术选型、API、LLDB Controller、快照、内存遍历器、安全隔离 |
| [04-frontend.md](04-frontend.md) | 前端设计 — 技术选型、页面布局、可视化渲染、标注系统、动画、状态机 |
| [05-communication.md](05-communication.md) | 通信协议 — WebSocket 消息格式、通信模式 |
| [06-visualization.md](06-visualization.md) | 数据结构可视化方案 — 标注设计哲学、自动识别、快照差分、代码图形互锁 |
| [07-roadmap.md](07-roadmap.md) | 开发路线图 — v0.1 到 v0.10 全部迭代记录 |
| [08-technical-details.md](08-technical-details.md) | 关键技术细节 — 模板系统、LLDB API、编译、性能、边界情况、手动标注语法 |
| [09-risks.md](09-risks.md) | 风险与备选方案 + 附录（参考资料、环境要求） |

> **文档版本**：v0.10 | **最后更新**：2026-06-23
