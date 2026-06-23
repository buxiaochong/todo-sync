import Foundation
import SQLite3

class Database {
    private var db: OpaquePointer?

    init() {
        createTables()
    }

    func open() {
        let path = databasePath().path
        if sqlite3_open(path, &db) != SQLITE_OK {
            fatalError("Failed to open database: \(path)")
        }
    }

    private func databasePath() -> URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = appSupport.appendingPathComponent("TodoSync")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("todos.db")
    }

    private func createTables() {
        open()
        let sql = """
        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            due_date TEXT,
            is_completed INTEGER NOT NULL DEFAULT 0,
            priority INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            source TEXT NOT NULL,
            device_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reminder_mapping (
            local_id TEXT PRIMARY KEY,
            calendar_item_id TEXT UNIQUE NOT NULL
        );
        """
        exec(sql)
    }

    func exec(_ sql: String) {
        var errMsg: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, sql, nil, nil, &errMsg) != SQLITE_OK {
            if let err = errMsg { print("SQLite error: \(String(cString: err))") }
        }
    }

    func query(_ sql: String, params: [String] = []) -> [[String: Any]] {
        var stmt: OpaquePointer?
        var rows: [[String: Any]] = []

        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            for (i, param) in params.enumerated() {
                sqlite3_bind_text(stmt, Int32(i + 1), (param as NSString).utf8String, -1, nil)
            }
            while sqlite3_step(stmt) == SQLITE_ROW {
                let colCount = sqlite3_column_count(stmt)
                var row: [String: Any] = [:]
                for i in 0..<colCount {
                    let name = String(cString: sqlite3_column_name(stmt, i))
                    if let text = sqlite3_column_text(stmt, i) {
                        row[name] = String(cString: text)
                    }
                }
                rows.append(row)
            }
        }
        sqlite3_finalize(stmt)
        return rows
    }

    func insertTodo(_ todo: Todo) {
        let sql = """
        INSERT OR REPLACE INTO todos (id, title, notes, due_date, is_completed, priority, updated_at, deleted_at, source, device_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            bind(stmt, params: [todo.id, todo.title, todo.notes, todo.dueDate ?? "",
                               todo.isCompleted ? "1" : "0", "\(todo.priority)",
                               todo.updatedAt, todo.deletedAt ?? "", todo.source, ""])
            sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)
    }

    func getTodo(_ id: String) -> Todo? {
        let rows = query("SELECT * FROM todos WHERE id = ?", params: [id])
        return rows.first.flatMap { rowToTodo($0) }
    }

    func getAllTodos() -> [Todo] {
        return query("SELECT * FROM todos WHERE deleted_at IS NULL").compactMap { rowToTodo($0) }
    }

    func getLastSyncTime() -> String {
        let rows = query("SELECT MAX(updated_at) as max_time FROM todos")
        return rows.first?["max_time"] as? String ?? "0"
    }

    func saveMapping(localId: String, calendarItemId: String) {
        let sql = "INSERT OR REPLACE INTO reminder_mapping (local_id, calendar_item_id) VALUES (?, ?)"
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            bind(stmt, params: [localId, calendarItemId])
            sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)
    }

    func getLocalId(calendarItemId: String) -> String? {
        let rows = query("SELECT local_id FROM reminder_mapping WHERE calendar_item_id = ?", params: [calendarItemId])
        return rows.first?["local_id"] as? String
    }

    func getCalendarItemId(localId: String) -> String? {
        let rows = query("SELECT calendar_item_id FROM reminder_mapping WHERE local_id = ?", params: [localId])
        return rows.first?["calendar_item_id"] as? String
    }

    private func rowToTodo(_ row: [String: Any]) -> Todo? {
        guard let id = row["id"] as? String else { return nil }
        return Todo(
            id: id,
            title: row["title"] as? String ?? "",
            notes: row["notes"] as? String ?? "",
            dueDate: row["due_date"] as? String,
            isCompleted: (row["is_completed"] as? String) == "1",
            priority: Int(row["priority"] as? String ?? "0") ?? 0,
            updatedAt: row["updated_at"] as? String ?? "",
            deletedAt: row["deleted_at"] as? String,
            source: row["source"] as? String ?? "macos"
        )
    }

    private func bind(_ stmt: OpaquePointer?, params: [String]) {
        for (i, param) in params.enumerated() {
            sqlite3_bind_text(stmt, Int32(i + 1), (param as NSString).utf8String, -1, nil)
        }
    }
}
