import AlarmKit
import CryptoKit
import Foundation
import SwiftUI
import UserNotifications

struct SmallPhoneAlarmMetadata: AlarmMetadata {
    let webAlarmID: String
    let roleID: String
}

@available(iOS 26.0, *)
@MainActor
final class NativeAlarmService {
    static let shared = NativeAlarmService()

    private struct StoredAlarm: Codable {
        let nativeID: UUID
        let signature: String
        let expectedFireAt: Date
        let repeatsDaily: Bool
    }

    private struct RequestedAlarm {
        let webID: String
        let roleID: String
        let roleName: String
        let label: String
        let companionText: String
        let hour: Int
        let minute: Int
        let repeatsDaily: Bool

        var signature: String {
            [roleID, roleName, label, String(hour), String(minute), repeatsDaily ? "daily" : "once"]
                .joined(separator: "|")
        }
    }

    private let manager = AlarmManager.shared
    private let storeKey = "small-phone.native-alarm-records.v1"
    private let tappedEventStoreKey = "small-phone.alarm-tapped-events.v1"

    private init() {}

    func synchronize(_ payload: [[String: Any]]) async throws -> [String: Any] {
        let requested = payload.compactMap(parseRequestedAlarm)
        var stored = loadRecords()
        let current = try manager.alarms
        var liveIDs = Set(current.map(\.id))
        var cancelled = 0
        var scheduled = 0
        var firedIDs: [String] = []
        var firedEvents = await deliveredRoleEvents()
        firedEvents.append(contentsOf: consumeTappedRoleEvents())
        firedEvents = deduplicatedEvents(firedEvents)

        let requestedIDs = Set(requested.map(\.webID))
        for (webID, record) in Array(stored) where !requestedIDs.contains(webID) {
            if liveIDs.contains(record.nativeID) {
                try manager.cancel(id: record.nativeID)
                liveIDs.remove(record.nativeID)
                cancelled += 1
            }
            cancelRoleNotification(webID: webID)
            stored.removeValue(forKey: webID)
        }

        if requested.isEmpty {
            saveRecords(stored)
            return result(
                authorized: manager.authorizationState == .authorized,
                scheduled: scheduled,
                cancelled: cancelled,
                firedIDs: firedIDs,
                firedEvents: firedEvents
            )
        }

        var authorization = manager.authorizationState
        if authorization == .notDetermined {
            authorization = try await manager.requestAuthorization()
        }
        guard authorization == .authorized else {
            saveRecords(stored)
            return result(
                authorized: false,
                scheduled: 0,
                cancelled: cancelled,
                firedIDs: firedIDs,
                firedEvents: firedEvents
            )
        }

        let now = Date()
        for item in requested {
            let nativeID = deterministicID(for: item.webID)
            let signature = digest(item.signature)
            let expectedFireAt = nextFireDate(hour: item.hour, minute: item.minute, after: now)

            if let old = stored[item.webID],
               !old.repeatsDaily,
               old.expectedFireAt <= now,
               !liveIDs.contains(old.nativeID),
               old.signature == signature {
                firedIDs.append(item.webID)
                cancelRoleNotification(webID: item.webID)
                stored.removeValue(forKey: item.webID)
                continue
            }

            if let old = stored[item.webID],
               old.signature == signature,
               liveIDs.contains(old.nativeID) {
                try? await scheduleRoleNotification(
                    item,
                    expectedFireAt: expectedFireAt
                )
                continue
            }

            if liveIDs.contains(nativeID) {
                try manager.cancel(id: nativeID)
                liveIDs.remove(nativeID)
                cancelled += 1
            }

            let time = Alarm.Schedule.Relative.Time(hour: item.hour, minute: item.minute)
            let recurrence: Alarm.Schedule.Relative.Recurrence = item.repeatsDaily
                ? .weekly([.monday, .tuesday, .wednesday, .thursday, .friday, .saturday, .sunday])
                : .never
            let schedule = Alarm.Schedule.relative(.init(time: time, repeats: recurrence))
            let title = [item.roleName, item.label].filter { !$0.isEmpty }.joined(separator: " · ")
            let titleResource = LocalizedStringResource(
                "small_phone_alarm_dynamic_title",
                defaultValue: String.LocalizationValue(stringLiteral: title.isEmpty ? "小手机闹钟" : title)
            )
            let alert = AlarmPresentation.Alert(
                title: titleResource,
                secondaryButton: AlarmButton(
                    text: "打开小手机",
                    textColor: .pink,
                    systemImageName: "iphone"
                ),
                secondaryButtonBehavior: .custom
            )
            let attributes = AlarmAttributes(
                presentation: AlarmPresentation(alert: alert),
                metadata: SmallPhoneAlarmMetadata(webAlarmID: item.webID, roleID: item.roleID),
                tintColor: Color.pink
            )
            let configuration = AlarmManager.AlarmConfiguration<SmallPhoneAlarmMetadata>.alarm(
                schedule: schedule,
                attributes: attributes
            )
            _ = try await manager.schedule(id: nativeID, configuration: configuration)
            try? await scheduleRoleNotification(
                item,
                expectedFireAt: expectedFireAt
            )
            liveIDs.insert(nativeID)
            stored[item.webID] = StoredAlarm(
                nativeID: nativeID,
                signature: signature,
                expectedFireAt: expectedFireAt,
                repeatsDaily: item.repeatsDaily
            )
            scheduled += 1
        }

        saveRecords(stored)
        return result(
            authorized: true,
            scheduled: scheduled,
            cancelled: cancelled,
            firedIDs: firedIDs,
            firedEvents: firedEvents
        )
    }

    private func parseRequestedAlarm(_ raw: [String: Any]) -> RequestedAlarm? {
        guard (raw["enabled"] as? Bool) != false,
              let webID = raw["id"] as? String,
              !webID.isEmpty,
              let time = raw["time"] as? String else { return nil }
        let pieces = time.split(separator: ":")
        guard pieces.count == 2,
              let hour = Int(pieces[0]),
              let minute = Int(pieces[1]),
              (0...23).contains(hour),
              (0...59).contains(minute) else { return nil }
        return RequestedAlarm(
            webID: webID,
            roleID: raw["contactId"] as? String ?? "",
            roleName: raw["roleName"] as? String ?? "",
            label: raw["label"] as? String ?? "闹钟",
            companionText: raw["companionText"] as? String ?? "",
            hour: hour,
            minute: minute,
            repeatsDaily: (raw["repeat"] as? String) == "daily"
        )
    }

    private func nextFireDate(hour: Int, minute: Int, after date: Date) -> Date {
        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        return Calendar.autoupdatingCurrent.nextDate(
            after: date,
            matching: components,
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        ) ?? date.addingTimeInterval(24 * 60 * 60)
    }

    private func deterministicID(for webID: String) -> UUID {
        let bytes = Array(SHA256.hash(data: Data("small-phone-alarm:\(webID)".utf8)).prefix(16))
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        let value = "\(hex.prefix(8))-\(hex.dropFirst(8).prefix(4))-\(hex.dropFirst(12).prefix(4))-\(hex.dropFirst(16).prefix(4))-\(hex.dropFirst(20).prefix(12))"
        return UUID(uuidString: value) ?? UUID()
    }

    private func digest(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func loadRecords() -> [String: StoredAlarm] {
        guard let data = UserDefaults.standard.data(forKey: storeKey) else { return [:] }
        return (try? JSONDecoder().decode([String: StoredAlarm].self, from: data)) ?? [:]
    }

    private func saveRecords(_ records: [String: StoredAlarm]) {
        guard let data = try? JSONEncoder().encode(records) else { return }
        UserDefaults.standard.set(data, forKey: storeKey)
    }

    func recordInteractedRoleAlarm(
        _ raw: [String: Any],
        deliveredAt: Date
    ) {
        guard let event = roleEvent(raw, deliveredAt: deliveredAt) else {
            return
        }
        var rows = UserDefaults.standard.array(
            forKey: tappedEventStoreKey
        ) as? [[String: String]] ?? []
        rows.append(event)
        if rows.count > 20 {
            rows = Array(rows.suffix(20))
        }
        UserDefaults.standard.set(rows, forKey: tappedEventStoreKey)
    }

    private func scheduleRoleNotification(
        _ item: RequestedAlarm,
        expectedFireAt: Date
    ) async throws {
        let content = UNMutableNotificationContent()
        content.title = item.roleName.isEmpty ? "角色" : item.roleName
        content.body = item.companionText.isEmpty
            ? "\(item.label)的时间到了。先去做，做完告诉我。"
            : item.companionText
        content.threadIdentifier = "small-phone-role-\(item.roleID)"
        let alarmInfo: [String: String] = [
            "alarmId": item.webID,
            "roleId": item.roleID,
            "roleName": item.roleName,
            "label": item.label,
            "message": content.body
        ]
        content.userInfo = [
            "smallPhoneAlarm": alarmInfo,
            "rolePush": [
                "roleId": item.roleID,
                "kind": "alarm"
            ]
        ]
        let calendar = Calendar.autoupdatingCurrent
        let components: DateComponents
        if item.repeatsDaily {
            components = DateComponents(hour: item.hour, minute: item.minute)
        } else {
            components = calendar.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: expectedFireAt
            )
        }
        let trigger = UNCalendarNotificationTrigger(
            dateMatching: components,
            repeats: item.repeatsDaily
        )
        let request = UNNotificationRequest(
            identifier: roleNotificationID(for: item.webID),
            content: content,
            trigger: trigger
        )
        try await UNUserNotificationCenter.current().add(request)
    }

    private func cancelRoleNotification(webID: String) {
        let identifier = roleNotificationID(for: webID)
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        center.removeDeliveredNotifications(withIdentifiers: [identifier])
    }

    private func roleNotificationID(for webID: String) -> String {
        "small-phone-role-alarm-\(digest(webID).prefix(20))"
    }

    private func deliveredRoleEvents() async -> [[String: String]] {
        let center = UNUserNotificationCenter.current()
        let notifications: [UNNotification] = await withCheckedContinuation {
            (continuation: CheckedContinuation<[UNNotification], Never>) in
            center.getDeliveredNotifications { rows in
                continuation.resume(returning: rows)
            }
        }
        var events: [[String: String]] = []
        var identifiers: [String] = []
        for notification in notifications {
            guard notification.request.identifier.hasPrefix(
                "small-phone-role-alarm-"
            ), let raw = notification.request.content.userInfo[
                "smallPhoneAlarm"
            ] as? [String: Any],
                  let event = roleEvent(
                    raw,
                    deliveredAt: notification.date
                  ) else { continue }
            events.append(event)
            identifiers.append(notification.request.identifier)
        }
        if !identifiers.isEmpty {
            center.removeDeliveredNotifications(withIdentifiers: identifiers)
        }
        return events
    }

    private func consumeTappedRoleEvents() -> [[String: String]] {
        let defaults = UserDefaults.standard
        let rows = defaults.array(forKey: tappedEventStoreKey)
            as? [[String: String]] ?? []
        defaults.removeObject(forKey: tappedEventStoreKey)
        return rows
    }

    private func roleEvent(
        _ raw: [String: Any],
        deliveredAt: Date
    ) -> [String: String]? {
        guard let alarmID = raw["alarmId"] as? String,
              !alarmID.isEmpty else { return nil }
        return [
            "alarmId": alarmID,
            "roleId": raw["roleId"] as? String ?? "",
            "roleName": raw["roleName"] as? String ?? "角色",
            "label": raw["label"] as? String ?? "闹钟",
            "message": raw["message"] as? String ?? "",
            "firedAt": String(Int(deliveredAt.timeIntervalSince1970 * 1000))
        ]
    }

    private func deduplicatedEvents(
        _ rows: [[String: String]]
    ) -> [[String: String]] {
        var seen = Set<String>()
        return rows.filter { row in
            let day = String((Int64(row["firedAt"] ?? "0") ?? 0) / 86_400_000)
            return seen.insert("\(row["alarmId"] ?? "")|\(day)").inserted
        }
    }

    private func result(
        authorized: Bool,
        scheduled: Int,
        cancelled: Int,
        firedIDs: [String],
        firedEvents: [[String: String]]
    ) -> [String: Any] {
        [
            "supported": true,
            "authorized": authorized,
            "scheduled": scheduled,
            "cancelled": cancelled,
            "firedIds": firedIDs,
            "firedEvents": firedEvents
        ]
    }
}
