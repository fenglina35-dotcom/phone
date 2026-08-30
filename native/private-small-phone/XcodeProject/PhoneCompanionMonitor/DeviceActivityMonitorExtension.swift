import DeviceActivity
import FamilyControls
import Foundation
import CryptoKit
import ManagedSettings

extension ManagedSettingsStore.Name {
    static let dailyLimit = Self("dailyLimit")
}

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    private let appGroupID = "group.com.qianyi.PhoneCompanionTest"
    private let tokenKeyPrefix = "limit.token."
    private let lockedLimitTokensKey = "limit.lockedTokens"
    private let lockedLimitDayKey = "limit.lockedUsageDay"
    private let shieldLimitDaysKey = "companion.shield.limitDays.v1"
    private let store = ManagedSettingsStore(named: .dailyLimit)

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        clearDailyLimitLock()
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        clearDailyLimitLock()
    }

    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity)

        guard
            let defaults = sharedDefaults,
            let tokenData = defaults.data(
                forKey: tokenKeyPrefix + event.rawValue
            ),
            let token = try? JSONDecoder().decode(
                ApplicationToken.self,
                from: tokenData
            )
        else {
            return
        }

        let today = usageDay(for: Date())
        let savedDay = defaults.string(forKey: lockedLimitDayKey) ?? ""
        if savedDay.isEmpty,
           defaults.data(forKey: lockedLimitTokensKey) != nil {
            // Preserve a same-day lock created by an older build once, then
            // all following reads have an explicit day boundary.
            defaults.set(today, forKey: lockedLimitDayKey)
        } else if savedDay != today {
            store.shield.applications = nil
            defaults.removeObject(forKey: lockedLimitTokensKey)
            defaults.removeObject(forKey: lockedLimitDayKey)
        }

        var lockedTokens = Set<ApplicationToken>()

        if let savedData = defaults.data(forKey: lockedLimitTokensKey),
           let savedTokens = try? JSONDecoder().decode(
               Set<ApplicationToken>.self,
               from: savedData
           ) {
            lockedTokens = savedTokens
        }

        lockedTokens.insert(token)
        store.shield.applications = lockedTokens

        if let encoded = try? JSONEncoder().encode(lockedTokens) {
            defaults.set(encoded, forKey: lockedLimitTokensKey)
            defaults.set(today, forKey: lockedLimitDayKey)
            if let externalID = stableExternalID(for: token) {
                var days = defaults.dictionary(forKey: shieldLimitDaysKey)
                    as? [String: String] ?? [:]
                days[externalID] = today
                defaults.set(days, forKey: shieldLimitDaysKey)
            }
        }
    }

    private func clearDailyLimitLock() {
        store.shield.applications = nil
        sharedDefaults?.removeObject(forKey: lockedLimitTokensKey)
        sharedDefaults?.removeObject(forKey: lockedLimitDayKey)
        sharedDefaults?.removeObject(forKey: shieldLimitDaysKey)
    }

    private func stableExternalID(
        for token: ApplicationToken
    ) -> String? {
        guard let tokenData = try? JSONEncoder().encode(token) else {
            return nil
        }
        let digest = SHA256.hash(data: tokenData)
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return "ios." + hex
    }

    private func usageDay(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
