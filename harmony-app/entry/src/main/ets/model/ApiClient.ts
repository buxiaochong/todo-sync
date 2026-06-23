import http from '@ohos.net.http'
import { Todo, DeviceInfo } from '../model/Todo'

export class ApiClient {
  private baseURL: string
  private token: string = ''
  private httpClient: http.HttpRequest

  constructor(baseURL: string) {
    this.baseURL = baseURL
    this.httpClient = http.createHttp()
  }

  setToken(token: string) {
    this.token = token
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async register(): Promise<DeviceInfo> {
    const resp = await this.httpClient.request(
      `${this.baseURL}/api/register`,
      {
        method: http.RequestMethod.POST,
        extraData: JSON.stringify({ source: 'harmony' }),
        header: this.buildHeaders()
      }
    )
    const body = JSON.parse(resp.result as string)
    return DeviceInfo.fromJson(body)
  }

  async fetchTodos(since: string): Promise<Todo[]> {
    const resp = await this.httpClient.request(
      `${this.baseURL}/api/todos?since=${since}`,
      {
        method: http.RequestMethod.GET,
        header: this.buildHeaders()
      }
    )
    const body = JSON.parse(resp.result as string) as Record<string, Object>[]
    return body.map(item => Todo.fromJson(item))
  }

  async createTodo(todo: Todo): Promise<Todo> {
    const resp = await this.httpClient.request(
      `${this.baseURL}/api/todos`,
      {
        method: http.RequestMethod.POST,
        extraData: JSON.stringify({
          title: todo.title, notes: todo.notes,
          dueDate: todo.dueDate, priority: todo.priority,
          isCompleted: todo.isCompleted, source: 'harmony'
        }),
        header: this.buildHeaders()
      }
    )
    const body = JSON.parse(resp.result as string)
    return Todo.fromJson(body)
  }

  async updateTodo(id: string, fields: Record<string, Object>): Promise<Todo> {
    const resp = await this.httpClient.request(
      `${this.baseURL}/api/todos/${id}`,
      {
        method: http.RequestMethod.PUT,
        extraData: JSON.stringify({ fields }),
        header: this.buildHeaders()
      }
    )
    const body = JSON.parse(resp.result as string)
    return Todo.fromJson(body)
  }

  async deleteTodo(id: string): Promise<void> {
    await this.httpClient.request(
      `${this.baseURL}/api/todos/${id}`,
      {
        method: http.RequestMethod.DELETE,
        header: this.buildHeaders()
      }
    )
  }
}
