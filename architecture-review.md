# 架构评审报告

## 评审结论：⚠️ 有条件通过

修复以下中/高风险项后可进入开发阶段。

---

## ✅ 通过项

| 项 | 说明 |
|---|------|
| 技术栈选择 | Node.js+Express+SQLite 适合轻量同步服务，开发效率高 |
| 数据结构 | JSON 设计合理，包含必要字段 |
| REST API 设计 | 符合 RESTful 规范，增量同步方案正确 |
| 开发顺序 | backend → macos → harmony 的依赖关系正确 |

## ⚠️ 需修复项

### 1. 高风险：缺少用户认证

**问题**: API 完全开放，任何知晓服务地址的人可读写所有数据。

**建议**: 添加简单 Token 认证：
- macOS 端首次启动时注册设备，服务端返回 token
- 后续请求在 Header 携带 `Authorization: Bearer <token>`
- 鸿蒙端同理

### 2. 中风险：冲突解决策略过于简单

**问题**: "按 updatedAt 取最新的" 会导致：Mac 上修改标题、鸿蒙上修改备注，后保存的会覆盖先保存的。

**建议**: 使用 **逐字段合并（per-field merge）**：
```json
{
  "id": "xxx",
  "fields": {
    "title": { "value": "新标题", "updatedAt": "..." },
    "notes": { "value": "新备注", "updatedAt": "..." },
    "isCompleted": { "value": false, "updatedAt": "..." }
  }
}
```
或者退一步，先做 **最后写入者获胜 + 服务端记录冲突日志**，后续迭代改逐字段合并。

### 3. 中风险：macOS 端缺少离线支持

**问题**: macos-agent 只描述了"本地 SQLite 缓存"，但 EventKit 本身需要在联网时才能同步 iCloud。Mac App 如果离线，EventKit 操作可能失败。

**建议**: 
- Mac 端本地也用 SQLite 做离线队列
- 网络恢复后批量推送到后端
- EventKit 作为最终持久化层，本地 SQLite 作为同步缓冲区

### 4. 中风险：UUID 生成冲突

**问题**: Mac 端和鸿蒙端各自由 `uuid` 字段生成 ID，可能导致冲突。

**建议**:
- 后端生成 ID（`POST` 返回 id）
- 或者使用 UUID v4 并加前缀：`mac-<uuid>` / `hm-<uuid>`

### 5. 低风险：缺少删除同步方案

**问题**: `DELETE /api/todos/:id` 之后，另一端如何知道某条待办已被删除？

**建议**:
- 使用**软删除**：添加 `deletedAt` 字段，`GET /api/todos?since=` 返回时排除 `deletedAt` 不为空的项
- 服务端定期清理已删除超过 30 天的记录

### 6. 低风险：WebSocket 重连未说明

**问题**: 两端都依赖 WebSocket 接收实时推送，未说明断线重连策略。

**建议**:
- 指数退避重连（1s → 2s → 4s → 8s → max 60s）
- 重连后全量拉取 `since=断线时间` 的增量

---

## 建议修改清单

| 优先级 | 修改项 | 涉及文件 |
|--------|--------|----------|
| P0 | 添加 Token 认证 | AGENTS.md API 接口、backend 代码 |
| P1 | 冲突策略改为逐字段合并 | AGENTS.md 数据结构 |
| P1 | macOS 离线队列 | macos-agent 职责描述 |
| P1 | UUID 冲突方案 | AGENTS.md 约定 |
| P2 | 软删除 | AGENTS.md API 接口 |
| P2 | WebSocket 重连策略 | AGENTS.md 补充 |
