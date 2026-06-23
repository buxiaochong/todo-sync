# 架构评审报告 - 第 5 轮

## 评审结论：❌ 未通过（发现 3 项问题）

---

## ✅ 前四轮问题验证

所有 19 项问题已在 AGENTS.md 中修复。

## ❌ 本轮新发现

### 1. 中风险：WebSocket 推送消息格式未定义

**问题**: 当后端通过 WebSocket 推送变更时，客户端收到的消息结构未定义。不同端可能实现不同的格式，导致解析失败。

**建议**: 定义统一推送格式：
```json
{
  "type": "todo.created" | "todo.updated" | "todo.deleted",
  "data": { /* 完整待办对象或 id */ },
  "timestamp": "2026-06-23T10:00:00Z"
}
```

### 2. 低风险：创建接口字段不完整

**问题**: `POST /api/todos` body 为 `{ title, notes, source }`，但数据结构支持 `dueDate`、`priority`、`isCompleted`，创建时无法设置这些字段。

**建议**: 创建接口 body 扩展为支持所有字段：
```json
{ "title": "...", "notes": "...", "dueDate": "...", "priority": 0, "isCompleted": false, "source": "macos" }
```

### 3. 低风险：缺少首次联调部署方案

**问题**: 联调时 macOS 端和鸿蒙端需要连接同一台后端服务器。本地 `localhost` 对端侧设备不可达。

**建议**: 补充 MVP 阶段的部署方案——使用内网穿透（如 ngrok）或局域网 IP。

---

## 修复后继续下一轮
