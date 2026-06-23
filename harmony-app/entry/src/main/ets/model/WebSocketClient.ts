import webSocket from '@ohos.net.webSocket'
import { PushMessage } from '../model/Todo'

export class WebSocketClient {
  private ws: webSocket.WebSocket
  private url: string
  private token: string
  private shouldReconnect: boolean = true
  private onMessageCallback: (msg: PushMessage) => void = () => {}

  constructor(baseURL: string, token: string) {
    const wsUrl = baseURL.replace('http', 'ws') + '/ws'
    this.url = wsUrl
    this.token = token
    this.ws = webSocket.createWebSocket()
  }

  set onMessage(callback: (msg: PushMessage) => void) {
    this.onMessageCallback = callback
  }

  connect() {
    this.ws.on('message', (data: string | ArrayBuffer) => {
      const text = typeof data === 'string' ? data : ''
      try {
        const json = JSON.parse(text) as Record<string, Object>
        if (json['type'] === 'auth' && json['status'] === 'ok') {
          console.info('WebSocket authenticated')
          return
        }
        this.onMessageCallback(PushMessage.fromJson(json))
      } catch (e) {
        console.error('WS parse error:', e)
      }
    })

    this.ws.on('close', () => {
      console.info('WebSocket closed')
      this.scheduleReconnect()
    })

    this.ws.on('error', () => {
      console.error('WebSocket error')
      this.scheduleReconnect()
    })

    this.ws.connect(this.url, (err) => {
      if (err) {
        console.error('WS connect error:', JSON.stringify(err))
        this.scheduleReconnect()
        return
      }
      this.sendAuth()
    })
  }

  private sendAuth() {
    const msg = JSON.stringify({ type: 'auth', token: this.token })
    this.ws.send(msg)
  }

  disconnect() {
    this.shouldReconnect = false
    this.ws.close()
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return
    setTimeout(() => {
      if (this.shouldReconnect) this.connect()
    }, 5000)
  }
}
