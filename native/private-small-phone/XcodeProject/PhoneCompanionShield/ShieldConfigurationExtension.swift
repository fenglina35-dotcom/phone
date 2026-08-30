import CryptoKit
import FamilyControls
import Foundation
import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    private let appGroupID = "group.com.qianyi.PhoneCompanionTest"
    private let shieldRoleActorsKey = "companion.shield.roleActors.v1"
    private let shieldLimitDaysKey = "companion.shield.limitDays.v1"

    override func configuration(
        shielding application: Application
    ) -> ShieldConfiguration {
        makeConfiguration(
            appName: application.localizedDisplayName ?? "此 App",
            token: application.token
        )
    }

    override func configuration(
        shielding application: Application,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        makeConfiguration(
            appName: application.localizedDisplayName ?? "此 App",
            token: application.token
        )
    }

    private func makeConfiguration(
        appName: String,
        token: ApplicationToken?
    ) -> ShieldConfiguration {
        let defaults = UserDefaults(suiteName: appGroupID)
        let externalID = token.flatMap { stableExternalID(for: $0) } ?? ""
        let rawActor = (defaults?.dictionary(forKey: shieldRoleActorsKey)
            as? [String: String])?[externalID]?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let limitDay = (defaults?.dictionary(forKey: shieldLimitDaysKey)
            as? [String: String])?[externalID] ?? ""
        let isRoleLock = !rawActor.isEmpty
        let isDailyLimit = !isRoleLock && limitDay == usageDay(for: Date())
        let actor = String((rawActor.isEmpty ? "绑定角色" : rawActor).prefix(24))
        let titleText = isRoleLock
            ? "\(appName) 已被\(actor)锁定"
            : isDailyLimit
            ? "\(appName) 今日限额已达到"
            : "\(appName) 暂时已锁定"
        let subtitleText = isRoleLock
            ? "这是角色主动锁定，不是今日使用限额。请回到小手机找\(actor)。"
            : isDailyLimit
            ? "这是今天的使用时间达到限额，不是角色主动锁定。"
            : "锁定来源尚未同步；不会把它误写成角色锁定或今日限额。"

        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor(
                red: 0.055,
                green: 0.047,
                blue: 0.067,
                alpha: 0.96
            ),
            icon: UIImage(systemName: "lock.shield.fill"),
            title: ShieldConfiguration.Label(
                text: titleText,
                color: UIColor(
                    red: 1.0,
                    green: 0.29,
                    blue: 0.39,
                    alpha: 1.0
                )
            ),
            subtitle: ShieldConfiguration.Label(
                text: subtitleText,
                color: UIColor(
                    red: 0.78,
                    green: 0.76,
                    blue: 0.82,
                    alpha: 1.0
                )
            ),
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "知道了",
                color: .white
            ),
            primaryButtonBackgroundColor: UIColor(
                red: 0.76,
                green: 0.10,
                blue: 0.24,
                alpha: 1.0
            ),
            secondaryButtonLabel: nil
        )
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
