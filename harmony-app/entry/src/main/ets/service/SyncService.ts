import { Todo, PushMessage } from '../model/Todo'
import { ApiClient } from '../model/ApiClient'
import { WebSocketClient } from '../model/WebSocketClient'
import { Database } from '../database/Database'

export class SyncService {
  private api: ApiClient
  private db: Database
  private ws: WebSocketClient
  private token: string = ''
  private deviceId: string

  constructor(baseURL: string, context: Context) {
    this.api = new ApiClient(baseURL)
    this.db = new Database()
    this.deviceId = 'hm-' + this.generateId()
    this.ws = new WebSocketClient(baseURL, '')
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }

  async setup(context: Context): Promise<void> {
    await this.db.init(context)
    const prefs = context.getApplicationContext().getPreferences('todo_sync_prefs')
    const savedToken = prefs.get('token', '')
    const savedId = prefs.get('device_id', '')

    if (savedToken && savedId) {
      this.token = savedToken as string
      this.api.setToken(this.token)
    } else {
      const info = await this.api.register()
      this.token = info.token
      this.api.setToken(this.token)
      prefs.put('token', this.token)
      prefs.put('device_id', info.id)
      prefs.flush()
    }

    this.setupWebSocket()

    this.syncFromServer()
  }

  private setupWebSocket() {
    this.ws.onMessage = (msg: PushMessage) => {
      this.handlePush(msg)
    }
    this.ws.connect()
  }

  async syncFromServer(): Promise<void> {
    const since = await this.db.getLastSyncTime()
    try {
      const todos = await this.api.fetchTodos(since)
      for (const todo of todos) {
        if (todo.source === 'harmony') continue
        await this.db.insertTodo(todo)
      }
    } catch (e) {
      console.error('syncFromServer error:', e)
    }
  }

  async createTodo(title: string, notes: string): Promise<Todo> {
    const id = 'hm-' + this.generateId()
    const now = new Date().toISOString()
    const todo = new Todo(id, title, notes, '', false, 0, now, '', 'harmony')

    await this.db.insertTodo(todo)
    try {
      await this.api.createTodo(todo)
    } catch (e) {
      console.error('createTodo push error:', e)
    }
    return todo
  }

  async updateTodo(todo: Todo): Promise<void> {
    const now = new Date().toISOString()
    const updated = new Todo(todo.id, todo.title, todo.notes, todo.dueDate,
      todo.isCompleted, todo.priority, now, todo.deletedAt, 'harmony')

    await this.db.insertTodo(updated)
    try {
      const fields: Record<string, Object> = {
        title: { value: todo.title, updatedAt: now, deviceId: this.deviceId },
        notes: { value: todo.notes, updatedAt: now, deviceId: this.deviceId },
        isCompleted: { value: todo.isCompleted, updatedAt: now, deviceId: this.deviceId }
      }
      await this.api.updateTodo(todo.id, fields)
    } catch (e) {
      console.error('updateTodo push error:', e)
    }
  }

  async deleteTodo(id: string): Promise<void> {
    await this.db.insertTodo(
      new Todo(id, '', '', '', false, 0, new Date().toISOString(),
        new Date().toISOString(), 'harmony')
    )
    try {
      await this.api.deleteTodo(id)
    } catch (e) {
      console.error('deleteTodo push error:', e)
    }
  }

  async getTodos(): Promise<Todo[]> {
    return await this.db.getAllTodos()
  }

  private handlePush(msg: PushMessage) {
    if (msg.data.source === 'harmony') return
    this.db.insertTodo(msg.data)
    if (msg.type === 'todo.deleted') {
      this.notifyDataChange()
    }
  }

  // Used to trigger UI refresh from push
  private onChangeCallback: (() => void) | null = null
  set onDataChange(callback: () => void) {
    this.onChangeCallback = callback
  }
  private notifyDataChange() {
    this.onChangeCallback?.()
  }
}
