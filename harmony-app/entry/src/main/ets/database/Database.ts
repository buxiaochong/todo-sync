import relationalStore from '@ohos.data.relationalStore'
import { Todo } from '../model/Todo'

const DB_NAME = 'todo_sync.db'
const TABLE_TODOS = 'todos'
const TABLE_MAPPING = 'reminder_mapping'

export class Database {
  private rdb: relationalStore.RdbStore

  async init(context: Context): Promise<void> {
    const config: relationalStore.StoreConfig = {
      name: DB_NAME,
      securityLevel: relationalStore.SecurityLevel.S1
    }
    this.rdb = await relationalStore.getRdbStore(context, config)

    await this.rdb.executeSql(`
      CREATE TABLE IF NOT EXISTS ${TABLE_TODOS} (
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
      )
    `)

    await this.rdb.executeSql(`
      CREATE TABLE IF NOT EXISTS ${TABLE_MAPPING} (
        local_id TEXT PRIMARY KEY,
        calendar_item_id TEXT UNIQUE NOT NULL
      )
    `)
  }

  async insertTodo(todo: Todo): Promise<void> {
    const sql = `INSERT OR REPLACE INTO ${TABLE_TODOS}
      (id, title, notes, due_date, is_completed, priority, updated_at, deleted_at, source, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    await this.rdb.executeSql(sql, [
      todo.id, todo.title, todo.notes, todo.dueDate || null,
      todo.isCompleted ? 1 : 0, todo.priority, todo.updatedAt,
      todo.deletedAt || null, todo.source, ''
    ])
  }

  async getAllTodos(): Promise<Todo[]> {
    const predicates = new relationalStore.RdbPredicates(TABLE_TODOS)
    predicates.isNull('deleted_at')
    const resultSet = await this.rdb.query(predicates, ['*'])
    const todos: Todo[] = []
    while (resultSet.goToNextRow()) {
      todos.push(this.rowToTodo(resultSet))
    }
    resultSet.close()
    return todos
  }

  async getLastSyncTime(): Promise<string> {
    const predicates = new relationalStore.RdbPredicates(TABLE_TODOS)
    const resultSet = await this.rdb.query(predicates, ['MAX(updated_at) as max_time'])
    let result = '0'
    if (resultSet.goToFirstRow()) {
      result = resultSet.getString(resultSet.getColumnIndex('max_time')) || '0'
    }
    resultSet.close()
    return result
  }

  async getTodo(id: string): Promise<Todo | null> {
    const predicates = new relationalStore.RdbPredicates(TABLE_TODOS)
    predicates.equalTo('id', id)
    const resultSet = await this.rdb.query(predicates, ['*'])
    if (resultSet.goToFirstRow()) {
      const todo = this.rowToTodo(resultSet)
      resultSet.close()
      return todo
    }
    resultSet.close()
    return null
  }

  private rowToTodo(rs: relationalStore.ResultSet): Todo {
    return new Todo(
      rs.getString(rs.getColumnIndex('id')),
      rs.getString(rs.getColumnIndex('title')),
      rs.getString(rs.getColumnIndex('notes')),
      rs.getString(rs.getColumnIndex('due_date')),
      rs.getLong(rs.getColumnIndex('is_completed')) === 1,
      rs.getLong(rs.getColumnIndex('priority')),
      rs.getString(rs.getColumnIndex('updated_at')),
      rs.getString(rs.getColumnIndex('deleted_at')),
      rs.getString(rs.getColumnIndex('source'))
    )
  }
}
