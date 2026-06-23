import Foundation

struct Todo: Codable, Identifiable, Equatable {
    let id: String
    var title: String
    var notes: String
    var dueDate: String?
    var isCompleted: Bool
    var priority: Int
    var updatedAt: String
    var deletedAt: String?
    var source: String
}

struct DeviceInfo: Codable {
    let id: String
    let token: String
    let expiresAt: String
}

struct PushMessage: Codable {
    let type: String
    let data: Todo
    let timestamp: String
}

struct ErrorResponse: Codable {
    let error: String
    let code: Int
}

struct FieldUpdate: Codable {
    let value: AnyCodable
    let updatedAt: String
    let deviceId: String
}

struct TodoUpdateBody: Codable {
    let fields: [String: FieldUpdate]
}

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let int = try? container.decode(Int.self) { value = int }
        else if let double = try? container.decode(Double.self) { value = double }
        else if let bool = try? container.decode(Bool.self) { value = bool }
        else if let str = try? container.decode(String.self) { value = str }
        else { value = try container.decode(String.self) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let int = value as? Int { try container.encode(int) }
        else if let double = value as? Double { try container.encode(double) }
        else if let bool = value as? Bool { try container.encode(bool) }
        else if let str = value as? String { try container.encode(str) }
        else { try container.encode("\(value)") }
    }
}
