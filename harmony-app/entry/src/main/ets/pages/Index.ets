import { Todo } from '../model/Todo'
import { SyncService } from '../service/SyncService'

@Entry
@Component
struct Index {
  @State todos: Todo[] = []
  @State newTodoTitle: string = ''
  @State loading: boolean = true
  private syncService: SyncService | null = null

  aboutToAppear() {
    const context = getContext(this)
    this.syncService = new SyncService('http://localhost:3000', context)
    this.syncService.onDataChange = () => {
      this.refreshTodos()
    }
    this.syncService.setup(context).then(() => {
      this.refreshTodos()
      this.loading = false
    })
  }

  async refreshTodos() {
    this.todos = await this.syncService?.getTodos() || []
  }

  async onAdd() {
    if (!this.newTodoTitle.trim()) return
    await this.syncService?.createTodo(this.newTodoTitle.trim(), '')
    this.newTodoTitle = ''
    await this.refreshTodos()
  }

  async onToggle(todo: Todo) {
    todo.isCompleted = !todo.isCompleted
    await this.syncService?.updateTodo(todo)
    await this.refreshTodos()
  }

  async onDelete(todo: Todo) {
    await this.syncService?.deleteTodo(todo.id)
    await this.refreshTodos()
  }

  build() {
    Column() {
      Text('Todo Sync').fontSize(24).fontWeight(FontWeight.Bold).margin({ top: 24 })

      Row() {
        TextInput({ placeholder: 'Add a new todo...', text: this.newTodoTitle })
          .layoutWeight(1)
          .onChange(v => this.newTodoTitle = v)
        Button('Add').onClick(() => this.onAdd())
      }
      .padding(12)
      .width('100%')

      if (this.loading) {
        LoadingProgress().width(32).height(32).margin({ top: 40 })
      } else if (this.todos.length === 0) {
        Text('No todos yet').fontColor('#999').margin({ top: 40 })
      } else {
        List() {
          ForEach(this.todos, (item: Todo) => {
            ListItem() {
              Row() {
                Checkbox()
                  .select(item.isCompleted)
                  .onChange(() => this.onToggle(item))

                Column() {
                  Text(item.title)
                    .fontSize(16)
                    .decoration({
                      type: item.isCompleted ? TextDecorationType.LineThrough : TextDecorationType.None
                    })
                    .fontColor(item.isCompleted ? '#999' : '#000')
                  if (item.notes) {
                    Text(item.notes).fontSize(12).fontColor('#666')
                  }
                }
                .layoutWeight(1)
                .padding({ left: 8 })

                Button() {
                  Text('✕').fontSize(16).fontColor('#ff4444')
                }
                .width(36).height(36)
                .backgroundColor('#fff')
                .onClick(() => this.onDelete(item))
              }
              .padding(12)
              .width('100%')
            }
          }, (item: Todo) => item.id)
        }
        .width('100%')
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#f5f5f5')
  }
}
