# Todo Sync - 跨平台待办同步项目

## 技术栈

- **macOS 端**: Swift, EventKit, MenuBar 应用
- **鸿蒙端**: ArkTS, ArkUI, @ohos.net.http
- **后端**: Node.js + Express + SQLite
- **同步协议**: REST API + WebSocket 双向同步

## 安全

- 所有 API 请求需携带 `Authorization: Bearer <token>`
- macOS 端首次启动时注册设备，后端返回 `{ token, expiresAt }`
- 鸿蒙端首次启动时注册设备，后端返回 `{ token, expiresAt }`
- 提供 `POST /api/token/refresh` 续期 token
- Token 泄露可在后端吊销
- WebSocket 认证：连接后首条消息发送 `{ "type": "auth", "token": "xxx" }`，不在 URL 中传 token
- 生产环境必须使用 HTTPS

## API 接口约定

### 数据结构

```json
{
  "id": "mac-<uuid>",  // 或 "hm-<uuid>"
  "title": "待办标题",
  "notes": "备注",
  "dueDate": "2026-06-23T10:00:00Z",
  "isCompleted": false,
  "priority": 0,
  "updatedAt": "2026-06-23T09:00:00Z",
  "deletedAt": null,   // 软删除，非空表示已删除
  "source": "macos"    // 或 "harmony"
}
```

### 冲突解决：逐字段合并

PUT 请求体格式：
```json
{
  "fields": {
    "title": { "value": "新标题", "updatedAt": "2026-06-23T10:00:00Z", "deviceId": "mac-xxx" },
    "notes": { "value": "新备注", "updatedAt": "2026-06-23T09:30:00Z", "deviceId": "hm-yyy" }
  }
}
```
服务端逐字段对比 `updatedAt`，取较新的值。`updatedAt` 相同时按 `deviceId` 字典序取较大者。

### 接口

- `POST /api/register` - 设备注册，返回 `{ token, expiresAt }`
- `POST /api/token/refresh` - token 续期
- `POST /api/todos` - 创建待办（body 传 `{ title, notes, dueDate, priority, isCompleted, source }`，后端生成 id）
- `GET /api/todos?since=<timestamp>` - 增量同步（since=0 或缺省返回全量）
- `PUT /api/todos/:id` - 逐字段更新待办
- `DELETE /api/todos/:id` - 软删除（设置 deletedAt）
- `GET /api/health` - 健康检查，返回 `{ status: "ok" }`
- `WebSocket /ws` - 实时推送变更（连接后先发 `{ "type": "auth", "token": "xxx" }`）
  - 推送跳过来源设备（根据 token 判断）
  - 推送消息格式：
    ```json
    { "type": "todo.created" | "todo.updated" | "todo.deleted", "data": { /* 完整待办对象 */ }, "timestamp": "2026-06-23T10:00:00Z" }
    ```
  - 断线重连：指数退避（1s → 2s → 4s → ... → max 60s）
  - 重连后拉取断线期间增量

## Agent 职责

### architecture-agent（架构师）
- 评审技术方案：数据流、同步冲突策略、安全性、扩展性
- 审查 API 设计是否合理
- 识别潜在风险（如 EventKit 同步限制、鸿蒙后台进程保活）
- 必须在 backend-agent 开始前签字通过
- 输出：《架构评审报告》，列出通过/不通过项及修改建议

### backend-agent
- 构建 Node.js + Express 后端
- 使用 sql.js（SQLite WASM）持久化
- 设备注册 & Token 认证（`POST /api/register`）
- 实现以上 REST API + WebSocket，包含逐字段合并冲突解决
- 服务端定期清理 deletedAt 超过 30 天的记录

### macos-agent
- Swift 菜单栏应用（MenuBarExtra）
- 首次启动时注册设备，获取 token
- 本地 SQLite 维护两张表：
  - `todos` - 待办数据缓存
  - `reminder_mapping` - 映射 `mac-<uuid>` ↔ EventKit 的 `calendarItemIdentifier`
- 同步方向 1（主动检出）：定时轮询 EventKit（每 30s），对比 `lastModifiedDate` 与本地缓存，发现变化后增量推送到后端
- 同步方向 2（被动接入）：接收 WebSocket 推送 → 写入本地 SQLite → 写入 EventKit
- 本地 SQLite 离线队列：EventKit 写入失败时暂存，网络恢复后重试
- 断线重连：指数退避

### harmony-agent
- ArkTS + ArkUI 开发手机端
- 首次启动时注册设备，获取 token
- 待办列表展示、新建、编辑、删除
- HTTP 请求与后端通信（携带 token）
- 本地 RDB（`@ohos.data.relationalStore`）离线缓存，网络恢复后增量同步
- 断线重连：指数退避

## 开发顺序

0. **architecture-agent** → 架构评审（连续 3 轮零问题方可进入下一步）
1. backend-agent → 先完成后端，提供可测试的 API
2. macos-agent → Swift 端读写 Reminders
3. harmony-agent → ArkTS UI 开发
4. 联调：三端互相同步测试

## 错误码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | Token 无效或过期 |
| 404 | 资源不存在 |
| 500 | 服务端错误 |

错误体格式：`{ "error": "message", "code": 401 }`

## 各端权限

### macOS（Info.plist）
- `NSCalendarsUsageDescription` - 读取日历权限描述
- `NSRemindersUsageDescription` - 读取提醒事项权限描述

### 鸿蒙（module.json5）
- `ohos.permission.INTERNET` - 网络请求

## MVP 部署方案

1. 开发阶段：后端运行在 `localhost:3000`，各端本地调试
2. 联调阶段：后端通过 **ngrok** 或同一局域网 IP 暴露，macOS 端和鸿蒙端连接同一地址
3. 后端地址通过各端配置文件或环境变量指定

## 编码规则

- 所有 API 请求/响应使用 JSON
- 时间戳统一使用 ISO 8601 UTC
- 错误响应格式：`{ "error": "message" }`
- 每个文件不超过 300 行
- 提交前运行 `npm run lint`
