import SwiftUI

@main
struct TodoSyncApp: App {
    @State private var syncService: SyncService?
    @State private var statusText = "Starting..."

    var body: some Scene {
        MenuBarExtra("Todo Sync", systemImage: "checklist") {
            VStack(alignment: .leading, spacing: 8) {
                Text("Todo Sync").font(.headline)
                Text(statusText).font(.caption).foregroundColor(.secondary)

                Divider()

                Button("Sync Now") {
                    Task { await syncService?.syncFromEventKit() }
                }

                Button("Sync from Server") {
                    Task { await syncService?.syncFromServer() }
                }

                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
            }
            .padding()
            .frame(width: 200)
            .onAppear {
                let service = SyncService(baseURL: "http://localhost:3000")
                syncService = service
                Task {
                    await service.setup()
                    statusText = "Running"
                }
            }
        }
    }
}
