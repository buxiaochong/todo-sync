import Foundation

@MainActor
class ApiClient {
    let baseURL: String
    var token: String?
    let session = URLSession.shared

    init(baseURL: String) {
        self.baseURL = baseURL
    }

    func register() async throws -> DeviceInfo {
        let url = URL(string: "\(baseURL)/api/register")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["source": "macos"])
        let (data, _) = try await session.data(for: req)
        return try JSONDecoder().decode(DeviceInfo.self, from: data)
    }

    func fetchTodos(since: String) async throws -> [Todo] {
        let url = URL(string: "\(baseURL)/api/todos?since=\(since)")!
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token ?? "")", forHTTPHeaderField: "Authorization")
        let (data, _) = try await session.data(for: req)
        return try JSONDecoder().decode([Todo].self, from: data)
    }

    func createTodo(_ todo: Todo) async throws -> Todo {
        let url = URL(string: "\(baseURL)/api/todos")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token ?? "")", forHTTPHeaderField: "Authorization")
        let body: [String: Any] = [
            "title": todo.title, "notes": todo.notes,
            "dueDate": todo.dueDate ?? "", "priority": todo.priority,
            "isCompleted": todo.isCompleted, "source": "macos"
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await session.data(for: req)
        return try JSONDecoder().decode(Todo.self, from: data)
    }

    func updateTodo(id: String, fields: [String: [String: Any]]) async throws -> Todo {
        let url = URL(string: "\(baseURL)/api/todos/\(id)")!
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token ?? "")", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["fields": fields])
        let (data, _) = try await session.data(for: req)
        return try JSONDecoder().decode(Todo.self, from: data)
    }

    func deleteTodo(id: String) async throws {
        let url = URL(string: "\(baseURL)/api/todos/\(id)")!
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        req.setValue("Bearer \(token ?? "")", forHTTPHeaderField: "Authorization")
        let _ = try await session.data(for: req)
    }

    // Called when user adds/edits reminders directly in Reminders.app
    func pushLocalChanges(todos: [Todo], deviceId: String) async throws {
        for todo in todos {
            var fields: [String: [String: Any]] = [:]
            let now = ISO8601DateFormatter().string(from: Date())
            fields["title"] = ["value": todo.title, "updatedAt": now, "deviceId": deviceId]
            fields["notes"] = ["value": todo.notes, "updatedAt": now, "deviceId": deviceId]
            fields["isCompleted"] = ["value": todo.isCompleted, "updatedAt": now, "deviceId": deviceId]
            _ = try await updateTodo(id: todo.id, fields: fields)
        }
    }
}
