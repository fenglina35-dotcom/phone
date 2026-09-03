import Combine
import Foundation
import HealthKit
import UIKit

@MainActor
final class CompanionWellnessService: ObservableObject {
    @Published private(set) var batteryLevelPercent: Int?
    @Published private(set) var batteryStateText = "未知"
    @Published private(set) var lowPowerModeEnabled = false
    @Published private(set) var healthSyncEnabled: Bool
    @Published private(set) var healthStatusText = "未开启"
    @Published private(set) var healthSnapshot: [String: Any]?

    private let healthStore = HKHealthStore()
    private let healthSyncKey = "phone.companion.health.summary.enabled.v1"
    private var observers: [NSObjectProtocol] = []
    private var lastHealthRefreshDate: Date?

    init() {
        healthSyncEnabled = UserDefaults.standard.bool(forKey: healthSyncKey)
        UIDevice.current.isBatteryMonitoringEnabled = true
        refreshBattery()

        let center = NotificationCenter.default
        for name in [
            UIDevice.batteryLevelDidChangeNotification,
            UIDevice.batteryStateDidChangeNotification,
            Notification.Name.NSProcessInfoPowerStateDidChange
        ] {
            observers.append(
                center.addObserver(
                    forName: name,
                    object: nil,
                    queue: .main
                ) { [weak self] _ in
                    Task { @MainActor in
                        self?.refreshBattery()
                    }
                }
            )
        }

        if healthSyncEnabled {
            healthStatusText = "已开启，等待刷新"
        }
    }

    deinit {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    var batteryDisplayText: String {
        guard let batteryLevelPercent else {
            return "等待系统读数"
        }
        return "\(batteryLevelPercent)% · \(batteryStateText)"
    }

    func setHealthSyncEnabled(_ enabled: Bool) async {
        if !enabled {
            healthSyncEnabled = false
            healthSnapshot = nil
            healthStatusText = "未开启"
            UserDefaults.standard.set(false, forKey: healthSyncKey)
            return
        }

        guard HKHealthStore.isHealthDataAvailable() else {
            healthSyncEnabled = false
            healthSnapshot = nil
            healthStatusText = "本机不支持健康数据"
            UserDefaults.standard.set(false, forKey: healthSyncKey)
            return
        }

        do {
            healthStatusText = "正在请求健康读取权限"
            try await healthStore.requestAuthorization(
                toShare: [],
                read: healthReadTypes()
            )
            healthSyncEnabled = true
            UserDefaults.standard.set(true, forKey: healthSyncKey)
            await refreshHealth(force: true)
        } catch {
            healthSyncEnabled = false
            healthSnapshot = nil
            healthStatusText = "健康权限失败：\(error.localizedDescription)"
            UserDefaults.standard.set(false, forKey: healthSyncKey)
        }
    }

    func refresh() async {
        refreshBattery()
        if healthSyncEnabled {
            await refreshHealth(force: false)
        }
    }

    func deviceSnapshot() -> [String: Any] {
        var payload: [String: Any] = [
            "schema": 1,
            "batteryState": batteryStateText,
            "lowPowerMode": lowPowerModeEnabled,
            "generatedAt": Self.iso8601(Date())
        ]
        if let batteryLevelPercent {
            payload["batteryLevel"] = Double(batteryLevelPercent) / 100.0
        }
        return payload
    }

    private func refreshBattery() {
        let device = UIDevice.current
        let level = device.batteryLevel
        batteryLevelPercent = level >= 0
            ? min(100, max(0, Int((level * 100).rounded())))
            : nil
        lowPowerModeEnabled = ProcessInfo.processInfo.isLowPowerModeEnabled

        switch device.batteryState {
        case .charging:
            batteryStateText = "充电中"
        case .full:
            batteryStateText = "已充满"
        case .unplugged:
            batteryStateText = "使用电池"
        case .unknown:
            batteryStateText = "未知"
        @unknown default:
            batteryStateText = "未知"
        }
    }

    private func healthReadTypes() -> Set<HKObjectType> {
        guard let stepCount = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            return []
        }
        return [stepCount]
    }

    private func refreshHealth(force: Bool) async {
        guard HKHealthStore.isHealthDataAvailable() else {
            healthSnapshot = nil
            healthStatusText = "本机不支持健康数据"
            return
        }
        if !force,
           Date().timeIntervalSince(lastHealthRefreshDate ?? .distantPast) < 60 {
            return
        }
        lastHealthRefreshDate = Date()

        healthStatusText = "正在读取今日步数"
        let calendar = Calendar.current
        let now = Date()
        let today = calendar.startOfDay(for: now)

        let stepValue = await cumulativeQuantity(
            identifier: .stepCount,
            unit: .count(),
            start: today,
            end: now
        )

        let payload: [String: Any] = [
            "schema": 1,
            "generatedAt": Self.iso8601(now),
            "source": "HealthKit 步数",
            "steps": max(0, stepValue ?? 0)
        ]

        healthSnapshot = payload
        healthStatusText = (stepValue ?? 0) > 0
            ? "今日步数已读取 · \(Int((stepValue ?? 0).rounded())) 步"
            : "已开启；今日步数暂未返回数据"
    }

    private func cumulativeQuantity(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        start: Date,
        end: Date
    ) async -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
            return nil
        }
        let predicate = HKQuery.predicateForSamples(
            withStart: start,
            end: end,
            options: .strictStartDate
        )
        return await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, _ in
                continuation.resume(
                    returning: result?.sumQuantity()?.doubleValue(for: unit)
                )
            }
            healthStore.execute(query)
        }
    }

    nonisolated private static func iso8601(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }
}
