export class Todo {
  id: string
  title: string
  notes: string
  dueDate: string
  isCompleted: boolean
  priority: number
  updatedAt: string
  deletedAt: string
  source: string

  constructor(id: string, title: string, notes: string, dueDate: string,
    isCompleted: boolean, priority: number, updatedAt: string,
    deletedAt: string, source: string) {
    this.id = id
    this.title = title
    this.notes = notes
    this.dueDate = dueDate
    this.isCompleted = isCompleted
    this.priority = priority
    this.updatedAt = updatedAt
    this.deletedAt = deletedAt
    this.source = source
  }

  static fromJson(json: Record<string, Object>): Todo {
    return new Todo(
      json['id'] as string,
      json['title'] as string,
      json['notes'] as string,
      json['dueDate'] as string,
      json['isCompleted'] as boolean,
      json['priority'] as number,
      json['updatedAt'] as string,
      json['deletedAt'] as string,
      json['source'] as string
    )
  }

  toJson(): Record<string, Object> {
    return {
      'id': this.id, 'title': this.title, 'notes': this.notes,
      'dueDate': this.dueDate, 'isCompleted': this.isCompleted,
      'priority': this.priority, 'updatedAt': this.updatedAt,
      'deletedAt': this.deletedAt, 'source': this.source
    }
  }
}

export class DeviceInfo {
  id: string
  token: string
  expiresAt: string

  constructor(id: string, token: string, expiresAt: string) {
    this.id = id
    this.token = token
    this.expiresAt = expiresAt
  }

  static fromJson(json: Record<string, Object>): DeviceInfo {
    return new DeviceInfo(
      json['id'] as string,
      json['token'] as string,
      json['expiresAt'] as string
    )
  }
}

export class PushMessage {
  type: string
  data: Todo
  timestamp: string

  constructor(type: string, data: Todo, timestamp: string) {
    this.type = type
    this.data = data
    this.timestamp = timestamp
  }

  static fromJson(json: Record<string, Object>): PushMessage {
    return new PushMessage(
      json['type'] as string,
      Todo.fromJson(json['data'] as Record<string, Object>),
      json['timestamp'] as string
    )
  }
}
