# 架构评审报告 - 第二轮

## 评审结论：⚠️ 有条件通过

修复以下问题后可进入第三轮。

---

## ✅ 第一轮问题修复确认

| # | 问题 | 状态 |
|---|------|------|
| 1 | 缺少用户认证 | ✅ 已修复（Token 认证） |
| 2 | 冲突策略过于简单 | ✅ 已修复（逐字段合并） |
| 3 | macOS 离线支持 | ✅ 已修复（离线队列） |
| 4 | UUID 冲突 | ✅ 已修复（前缀 mac-/hm-） |
| 5 | 删除同步方案 | ✅ 已修复（软删除） |
| 6 | WebSocket 重连 | ✅ 已修复（指数退避） |

## ⚠️ 本轮新发现

### 1. 中风险：Token 缺少管理机制

**问题**: 只说"注册获取 token"，没有续期、吊销机制。Token 泄露后无法撤销。

**建议**:
- `POST /api/register` 返回 `{ token, expiresAt }`
- 添加 `POST /api/token/refresh` 续期接口
- 后端可管理/吊销设备 token

### 2. 中风险：WebSocket token 暴露在 URL

**问题**: `/ws?token=<token>` 会使 token 出现在服务器日志、浏览器历史中。

**建议**: 改为 WebSocket 连接建立后，第一条消息发送认证：
```json
{ "type": "auth", "token": "xxx" }
```

### 3. 低风险：创建接口 id 生成逻辑不明确

**问题**: body 不传 id、后端生成，但约定 id 格式是 `mac-<uuid>` / `hm-<uuid>`，后端不知道来源。

**建议**: body 加 `source` 字段指明来源：
```json
POST /api/todos
{ "title": "...", "source": "macos" }
// 返回 { "id": "mac-<uuid>", ... }
```

### 4. 低风险：首次同步未定义

**问题**: `since` 为空时（首次启动）行为未说明。

**建议**: `since=0` 或 `since` 缺省时返回全量数据。

### 5. 低风险：鸿蒙端数据库方案

**问题**: 鸿蒙端写 "SQLite"，但 ArkTS 原生推荐用 RDB（关系型数据库）或 KVStore。

**建议**: 改用 `@ohos.data.relationalStore`（RDB）。

### 6. 低风险：Reminders 的 List 概念未覆盖

**问题**: Apple Reminders 有清单（List）概念，数据模型中未体现。

**建议**: 第一版可只同步默认清单，后续迭代扩展。

---

## 建议修改清单

| 优先级 | 修改项 |
|--------|--------|
| P0 | Token 续期/吊销机制 |
| P1 | WebSocket 改为消息内认证 |
| P1 | 创建接口 id 生成逻辑 |
| P2 | 首次同步行为 |
| P2 | 鸿蒙端改用 RDB |
| P2 | 备注 Reminders List 第一版暂不支持 |
