import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

extension ManagedSettingsStore.Name {
    static let dailyLimit = Self("dailyLimit")
}

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    private let appGroupID = "group.com.qianyi.PhoneCompanionTest"
    private let tokenKeyPrefix = "limit.token."
    private let lockedLimitTokensKey = "limit.lockedTokens"
    private let store = ManagedSettingsStore(named: .dailyLimit)

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        store.shield.applications = nil
        sharedDefaults?.removeObject(forKey: lockedLimitTokensKey)
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        store.shield.applications = nil
        sharedDefaults?.removeObject(forKey: lockedLimitTokensKey)
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
        }
    }
}
