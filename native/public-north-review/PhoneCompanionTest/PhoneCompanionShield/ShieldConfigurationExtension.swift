import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    private let appGroupID = "group.com.qianyi.PhoneCompanionTest"
    private let shieldActorKey = "companion.shield.actor.v1"

    override func configuration(
        shielding application: Application
    ) -> ShieldConfiguration {
        makeConfiguration(
            appName: application.localizedDisplayName ?? "此 App"
        )
    }

    override func configuration(
        shielding application: Application,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        makeConfiguration(
            appName: application.localizedDisplayName ?? "此 App"
        )
    }

    private func makeConfiguration(
        appName: String
    ) -> ShieldConfiguration {
        let rawActor = UserDefaults(suiteName: appGroupID)?
            .string(forKey: shieldActorKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let actor = rawActor.isEmpty
            ? "绑定角色"
            : String(rawActor.prefix(24))

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
                text: "\(appName) 已被\(actor)锁定",
                color: UIColor(
                    red: 1.0,
                    green: 0.29,
                    blue: 0.39,
                    alpha: 1.0
                )
            ),
            subtitle: ShieldConfiguration.Label(
                text: "已达到今日使用限额。若要继续使用，请回到小手机找\(actor)解锁。",
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
}

