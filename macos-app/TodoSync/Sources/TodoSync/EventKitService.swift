import Foundation
import EventKit

@MainActor
class EventKitService {
    let store = EKEventStore()

    func requestPermission() async -> Bool {
        return await withCheckedContinuation { continuation in
            if #available(macOS 14.0, *) {
                store.requestFullAccessToReminders { granted, _ in
                    continuation.resume(returning: granted)
                }
            } else {
                store.requestAccess(to: .reminder) { granted, _ in
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    func fetchAllReminders() -> [EKReminder] {
        let semaphore = DispatchSemaphore(value: 0)
        var result: [EKReminder] = []

        let predicate = store.predicateForIncompleteReminders(
            withDueDateStarting: nil, ending: nil, calendars: nil)
        store.fetchReminders(matching: predicate) { reminders in
            result = reminders ?? []
            semaphore.signal()
        }
        semaphore.wait()

        let completedPredicate = store.predicateForCompletedReminders(
            withCompletionDateStarting: nil, ending: nil, calendars: nil)
        store.fetchReminders(matching: completedPredicate) { reminders in
            result.append(contentsOf: reminders ?? [])
            semaphore.signal()
        }
        semaphore.wait()

        return result
    }

    func createReminder(from todo: Todo) -> EKReminder {
        let reminder = EKReminder(eventStore: store)
        reminder.title = todo.title
        reminder.calendar = store.defaultCalendarForNewReminders()
        if !todo.notes.isEmpty { reminder.notes = todo.notes }
        if let dateStr = todo.dueDate {
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: dateStr) {
                reminder.dueDateComponents = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute], from: date)
            }
        }
        reminder.priority = todo.priority
        reminder.isCompleted = todo.isCompleted
        try? store.save(reminder, commit: true)
        return reminder
    }

    func updateReminder(_ reminder: EKReminder, from todo: Todo) {
        reminder.title = todo.title
        reminder.notes = todo.notes
        if let dateStr = todo.dueDate {
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: dateStr) {
                reminder.dueDateComponents = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute], from: date)
            }
        }
        reminder.priority = todo.priority
        reminder.isCompleted = todo.isCompleted
        try? store.save(reminder, commit: true)
    }

    func deleteReminder(_ reminder: EKReminder) {
        try? store.remove(reminder, commit: true)
    }

    func getReminder(byIdentifier id: String) -> EKReminder? {
        return store.calendarItem(withIdentifier: id) as? EKReminder
    }
}
