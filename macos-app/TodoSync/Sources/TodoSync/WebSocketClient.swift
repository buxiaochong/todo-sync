import Foundation

class WebSocketClient: NSObject, @unchecked Sendable {
    var onMessage: ((PushMessage) -> Void)?
    var onConnected: (() -> Void)?
    var onDisconnected: (() -> Void)?
    private var webSocketTask: URLSessionWebSocketTask?
    private let url: URL
    private let token: String
    private var shouldReconnect = true

    init(url: URL, token: String) {
        self.url = url
        self.token = token
        super.init()
    }

    func connect() {
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        sendAuth()
        receiveMessage()
    }

    private func sendAuth() {
        let auth = ["type": "auth", "token": token]
        if let data = try? JSONSerialization.data(withJSONObject: auth),
           let str = String(data: data, encoding: .utf8) {
            webSocketTask?.send(.string(str)) { _ in }
        }
    }

    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                if case .string(let text) = message,
                   let data = text.data(using: .utf8),
                   let pushMsg = try? JSONDecoder().decode(PushMessage.self, from: data) {
                    self.onMessage?(pushMsg)
                }
                self.receiveMessage()
            case .failure:
                self.onDisconnected?()
                self.scheduleReconnect(delay: 1)
            }
        }
    }

    func disconnect() {
        shouldReconnect = false
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
    }

    private func scheduleReconnect(delay seconds: UInt64) {
        guard shouldReconnect else { return }
        DispatchQueue.global().asyncAfter(deadline: .now() + .seconds(Int(seconds))) { [weak self] in
            guard let self = self, self.shouldReconnect else { return }
            self.connect()
            self.scheduleReconnect(delay: min(seconds * 2, 60))
        }
    }
}

extension WebSocketClient: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        onConnected?()
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        onDisconnected?()
        scheduleReconnect(delay: 1)
    }
}
