# 联调测试指南

## 前置条件

| 端 | 工具 | 说明 |
|-----|------|------|
| 后端 | `npm start` | 运行在 `localhost:3000` |
| macOS | Xcode / `swift run` | 菜单栏应用 |
| 鸿蒙 | DevEco Studio | 手机/模拟器运行 |

## 测试流程

### 1. 启动后端

```bash
cd ~/Documents/todo-sync/backend
npm start
# Server running on http://localhost:3000
```

联调时需要让 macOS 和鸿蒙端能访问到同一后端，使用局域网 IP 或 ngrok：
```bash
ngrok http 3000
# → https://xxxx.ngrok-free.app
```

在两端代码中替换 `http://localhost:3000` 为 ngrok 地址。

---

### 2. 设备注册验证

```bash
# macOS 端注册
curl -s -X POST http://localhost:3000/api/register \
  -H 'Content-Type: application/json' \
  -d '{"source":"macos"}'
# → {"id":"xxx","token":"yyy","expiresAt":"..."}

# 鸿蒙端注册
curl -s -X POST http://localhost:3000/api/register \
  -H 'Content-Type: application/json' \
  -d '{"source":"harmony"}'
# → {"id":"xxx2","token":"yyy2","expiresAt":"..."}
```

---

### 3. 测试用例

| # | 测试项 | 步骤 | 预期 |
|---|--------|------|------|
| 1 | macOS → 后端 | 在 Mac 菜单栏点 "Sync Now" | 后端收到创建/更新请求 |
| 2 | 后端 → 鸿蒙 | 检查鸿蒙端待办列表 | 显示 macOS 添加的待办 |
| 3 | 鸿蒙 → 后端 | 在鸿蒙端新增待办 | 后端收到创建请求 |
| 4 | 后端 → macOS | 检查 macOS 端本地缓存 | 显示鸿蒙添加的待办 |
| 5 | 实时推送 | 在鸿蒙端新增待办 | macOS 菜单栏自动刷新 |
| 6 | 冲突合并 | 两端同时改同一待办标题 | 取 updatedAt 较新的值 |
| 7 | 软删除 | macOS 端删除待办 | 鸿蒙端待办标记为已删除 |
| 8 | 离线恢复 | 断开网络 → 两端修改 → 恢复网络 | 重连后增量同步 |

---

### 4. API 验证脚本

```bash
# 全流程自动化测试
BASE="http://localhost:3000"
echo "=== 1. Register ==="
MAC=$(curl -s -X POST $BASE/api/register -H 'Content-Type: application/json' -d '{"source":"macos"}')
MTOKEN=$(echo $MAC | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
HM=$(curl -s -X POST $BASE/api/register -H 'Content-Type: application/json' -d '{"source":"harmony"}')
HTOKEN=$(echo $HM | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

echo "=== 2. macOS creates todo ==="
TODO=$(curl -s -X POST $BASE/api/todos -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $MTOKEN" -d '{"title":"from Mac","source":"macos"}')
TID=$(echo $TODO | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

echo "=== 3. Harmony fetches ==="
curl -s "$BASE/api/todos?since=0" -H "Authorization: Bearer $HTOKEN"
echo ""

echo "=== 4. Harmony updates ==="
curl -s -X PUT "$BASE/api/todos/$TID" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $HTOKEN" \
  -d '{"fields":{"title":{"value":"updated on Harmony","updatedAt":"2026-07-01T00:00:00Z","deviceId":"hm-test"}}}'
echo ""

echo "=== 5. macOS fetches (should see update) ==="
curl -s "$BASE/api/todos?since=0" -H "Authorization: Bearer $MTOKEN"
echo ""
```

---

### 5. 常见问题排查

| 问题 | 原因 | 解决 |
|------|------|------|
| macOS 权限弹窗 | 未授予 Reminders 权限 | 系统设置 → 隐私 → 提醒事项 → 勾选 TodoSync |
| 鸿蒙端网络请求失败 | 未声明 INTERNET 权限 | 检查 module.json5 中 requestPermissions |
| WebSocket 连不上 | 地址写错或端口不通 | 检查 ngrok 是否暴露了 ws 端口 |
| 同步后数据重复 | ID 映射表未正确建立 | 检查 reminder_mapping 表 |
