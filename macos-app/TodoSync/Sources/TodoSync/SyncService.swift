import Foundation
import EventKit

@MainActor
class SyncService {
    let api: ApiClient
    let db: Database
    let eventKit: EventKitService
    var ws: WebSocketClient?
    var deviceInfo: DeviceInfo?
    let deviceId: String
    var pollingTimer: Timer?

    let defaults = UserDefaults.standard
    let deviceIdKey = "todo_sync_device_id"
    let tokenKey = "todo_sync_token"

    init(baseURL: String) {
        self.api = ApiClient(baseURL: baseURL)
        self.db = Database()
        self.eventKit = EventKitService()
        self.deviceId = UUID().uuidString
    }

    func setup() async {
        if let savedId = defaults.string(forKey: deviceIdKey),
           let savedToken = defaults.string(forKey: tokenKey) {
            deviceInfo = DeviceInfo(id: savedId, token: savedToken, expiresAt: "")
            api.token = savedToken
        } else {
            guard let info = try? await api.register() else { return }
            deviceInfo = info
            api.token = info.token
            defaults.set(info.id, forKey: deviceIdKey)
            defaults.set(info.token, forKey: tokenKey)
        }

        if let url = URL(string: api.baseURL
            .replacingOccurrences(of: "http", with: "ws") + "/ws") {
            ws = WebSocketClient(url: url, token: api.token ?? "")
            ws?.onMessage = { [weak self] msg in
                Task { @MainActor in self?.handlePush(msg) }
            }
            ws?.connect()
        }

        startPolling()
    }

    private func startPolling() {
        pollingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.syncFromEventKit() }
        }
        Task { @MainActor in await syncFromEventKit() }
    }

    func syncFromEventKit() async {
        guard await eventKit.requestPermission() else { return }

        let reminders = eventKit.fetchAllReminders()
        let lastSync = db.getLastSyncTime()

        for reminder in reminders {
            let calId = reminder.calendarItemIdentifier
            let modDate = reminder.lastModifiedDate ?? Date.distantPast
            let modDateStr = ISO8601DateFormatter().string(from: modDate)

            if modDateStr <= lastSync { continue }

            if let localId = db.getLocalId(calendarItemId: calId) {
                let existing = db.getTodo(localId)
                if existing?.updatedAt ?? "" < modDateStr {
                    let todo = makeTodo(id: localId, reminder: reminder, modDateStr: modDateStr)
                    db.insertTodo(todo)
                    try? await api.pushLocalChanges(todos: [todo], deviceId: deviceId)
                }
            } else {
                let localId = "mac-\(UUID().uuidString)"
                db.saveMapping(localId: localId, calendarItemId: calId)
                let todo = makeTodo(id: localId, reminder: reminder, modDateStr: modDateStr)
                db.insertTodo(todo)
                try? await api.createTodo(todo)
            }
        }
    }

    private func makeTodo(id: String, reminder: EKReminder, modDateStr: String) -> Todo {
        Todo(
            id: id,
            title: reminder.title ?? "",
            notes: reminder.notes ?? "",
            dueDate: nil,
            isCompleted: reminder.isCompleted,
            priority: reminder.priority,
            updatedAt: modDateStr,
            deletedAt: nil,
            source: "macos"
        )
    }

    func syncFromServer() async {
        let since = db.getLastSyncTime()
        guard let todos = try? await api.fetchTodos(since: since) else { return }

        for todo in todos {
            if todo.source == "macos" { continue }
            db.insertTodo(todo)

            if todo.deletedAt != nil {
                if let calId = db.getCalendarItemId(localId: todo.id),
                   let reminder = eventKit.getReminder(byIdentifier: calId) {
                    eventKit.deleteReminder(reminder)
                }
                continue
            }

            if let calId = db.getCalendarItemId(localId: todo.id),
               let reminder = eventKit.getReminder(byIdentifier: calId) {
                eventKit.updateReminder(reminder, from: todo)
            } else {
                let reminder = eventKit.createReminder(from: todo)
                db.saveMapping(localId: todo.id, calendarItemId: reminder.calendarItemIdentifier)
            }
        }
    }

    func handlePush(_ msg: PushMessage) {
        if msg.data.source == "macos" { return }
        db.insertTodo(msg.data)

        switch msg.type {
        case "todo.deleted":
            if let calId = db.getCalendarItemId(localId: msg.data.id),
               let reminder = eventKit.getReminder(byIdentifier: calId) {
                eventKit.deleteReminder(reminder)
            }
        case "todo.created":
            let reminder = eventKit.createReminder(from: msg.data)
            db.saveMapping(localId: msg.data.id, calendarItemId: reminder.calendarItemIdentifier)
        case "todo.updated":
            if let calId = db.getCalendarItemId(localId: msg.data.id),
               let reminder = eventKit.getReminder(byIdentifier: calId) {
                eventKit.updateReminder(reminder, from: msg.data)
            } else {
                let reminder = eventKit.createReminder(from: msg.data)
                db.saveMapping(localId: msg.data.id, calendarItemId: reminder.calendarItemIdentifier)
            }
        default:
            break
        }
    }
}
