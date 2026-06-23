# 架构评审报告 - 第 4 轮

## 评审结论：❌ 未通过（发现 2 项问题）

---

## ✅ 前三轮问题验证

所有 17 项问题已在 AGENTS.md 中修复。

## ❌ 本轮新发现

### 1. 中风险：macOS 端缺少 EventKit 变化检测机制

**问题**: 
macOS App 需要检测用户在 Reminders App 中直接新增/修改/删除的待办，但当前架构只描述了"定时同步 + 接收 WebSocket 推送写入本地 Reminders"，缺少"从 EventKit 读取变化"的方向。

**建议**: 
- macOS App 启动后开启定时轮询（如每 30 秒）
- 对比本地 SQLite 中缓存的上次同步时间戳与 EventKit 中 reminder 的 `lastModifiedDate`
- 发现有新变化时，经本地 SQLite 同步到后端

架构中补充：
```
macOS 同步方向：
  轮询 EventKit → 对比本地缓存 → 增量同步到后端
  后端 WebSocket 推送 → 写入本地 SQLite → 写入 EventKit
```

### 2. 低风险：缺少 EventKit ID 与业务 ID 的映射

**问题**: 
EventKit 的 Reminder 使用 `calendarItemIdentifier` 作为唯一标识，而我们的数据模型使用 `mac-<uuid>`。两者之间没有建立映射关系，无法判断一条 EventKit 中的 reminder 是否已经同步过。

**建议**: 
macOS 端本地 SQLite 中维护映射表：
```sql
CREATE TABLE reminder_mapping (
    local_id TEXT PRIMARY KEY,   -- mac-<uuid>
    calendar_item_id TEXT UNIQUE -- EventKit calendarItemIdentifier
);
```

---

## 修复后需重新评审

修复以上 2 项后进入下一轮。
