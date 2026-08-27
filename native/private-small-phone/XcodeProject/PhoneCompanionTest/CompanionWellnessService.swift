import Combine
import Foundation
import HealthKit
import UIKit

extension Notification.Name {
    static let companionUrgentBatterySnapshotRequested =
        Notification.Name("phone.companion.urgent-battery-snapshot-requested.v1")
}

@MainActor
final class CompanionWellnessService: ObservableObject {
    static let shared = CompanionWellnessService()

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

    func refresh(forceHealth: Bool = false) async {
        refreshBattery()
        if healthSyncEnabled {
            await refreshHealth(force: forceHealth)
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
        let previousLevel = batteryLevelPercent
        let previousState = batteryStateText
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

        let enteredCritical = batteryLevelPercent.map { current in
            current <= 5 && (previousLevel.map { $0 > 5 } ?? true)
        } ?? false
        let recoveredFromCritical = batteryLevelPercent.map { current in
            current >= 10 && (previousLevel ?? 101) <= 5
        } ?? false
        let chargingChanged = previousState != batteryStateText &&
            (batteryStateText == "充电中" || batteryStateText == "已充满")
        if enteredCritical || recoveredFromCritical || chargingChanged {
            NotificationCenter.default.post(
                name: .companionUrgentBatterySnapshotRequested,
                object: self
            )
        }
    }

    private func healthReadTypes() -> Set<HKObjectType> {
        var types: Set<HKObjectType> = []
        for identifier in [
            HKQuantityTypeIdentifier.stepCount,
            .activeEnergyBurned,
            .heartRate,
            .heartRateVariabilitySDNN
        ] {
            if let type = HKQuantityType.quantityType(forIdentifier: identifier) {
                types.insert(type)
            }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleep)
        }
        if #available(iOS 14.0, *) {
            types.insert(HKObjectType.electrocardiogramType())
        }
        if #available(iOS 18.0, *) {
            types.insert(HKObjectType.stateOfMindType())
        }
        return types
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

        healthStatusText = "正在读取健康摘要"
        let calendar = Calendar.current
        let now = Date()
        let today = calendar.startOfDay(for: now)
        // Search far enough back to find the latest real sleep session, then
        // select only that session below. The previous "yesterday 06:00 until
        // now" window could add two nights, naps and duplicate sources into
        // one misleading total.
        let sleepStart = calendar.date(
            byAdding: .day,
            value: -7,
            to: now
        ) ?? now.addingTimeInterval(-7 * 86_400)

        async let steps = cumulativeQuantity(
            identifier: .stepCount,
            unit: .count(),
            start: today,
            end: now
        )
        async let energy = cumulativeQuantity(
            identifier: .activeEnergyBurned,
            unit: .kilocalorie(),
            start: today,
            end: now
        )
        async let heartRate = latestQuantity(
            identifier: .heartRate,
            unit: HKUnit.count().unitDivided(by: .minute())
        )
        async let hrv = latestQuantity(
            identifier: .heartRateVariabilitySDNN,
            unit: .secondUnit(with: .milli)
        )
        async let sleep = recentSleep(start: sleepStart, end: now)
        async let electrocardiogram = latestElectrocardiogram()

        let stepValue = await steps
        let energyValue = await energy
        let heartRateValue = await heartRate
        let hrvValue = await hrv
        let sleepValue = await sleep
        let electrocardiogramValue = await electrocardiogram

        var payload: [String: Any] = [
            "schema": 1,
            "generatedAt": Self.iso8601(now),
            "source": "HealthKit（包含已同步到 iPhone 的 Apple Watch 数据）",
            "steps": max(0, stepValue ?? 0),
            "activeEnergyKcal": max(0, energyValue ?? 0),
            "sleepSeconds": max(0, sleepValue.seconds),
            "sleepWindowStart": Self.iso8601(sleepStart),
            "sleepSources": sleepValue.sources
        ]

        if let heartRateValue {
            payload["heartRateBpm"] = max(0, heartRateValue.value)
            payload["heartRateAt"] = Self.iso8601(heartRateValue.date)
            payload["heartRateSource"] = heartRateValue.source
        }
        if let hrvValue {
            payload["hrvMs"] = max(0, hrvValue.value)
            payload["hrvAt"] = Self.iso8601(hrvValue.date)
            payload["hrvSource"] = hrvValue.source
        }
        if let electrocardiogramValue {
            payload["electrocardiogramAt"] = Self.iso8601(
                electrocardiogramValue.date
            )
            payload["electrocardiogramClassification"] =
                electrocardiogramValue.classification
            payload["electrocardiogramAverageHeartRateBpm"] =
                electrocardiogramValue.averageHeartRateBpm
            payload["electrocardiogramSymptomsStatus"] =
                electrocardiogramValue.symptomsStatus
            payload["electrocardiogramMeasurements"] =
                electrocardiogramValue.measurementCount
            payload["electrocardiogramSource"] =
                electrocardiogramValue.source
        }
        if #available(iOS 18.0, *),
           let mind = await latestStateOfMind() {
            payload["stateOfMind"] = mind
        }

        healthSnapshot = payload
        let populated = [
            (stepValue ?? 0) > 0,
            (energyValue ?? 0) > 0,
            heartRateValue != nil,
            hrvValue != nil,
            electrocardiogramValue != nil,
            sleepValue.seconds > 0
        ].filter { $0 }.count
        healthStatusText = populated > 0
            ? "健康摘要已读取 · \(populated) 类有数据"
            : "已开启；当前授权项目暂未返回数据"
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

    private struct LatestQuantityResult {
        let value: Double
        let date: Date
        let source: String
    }

    private struct LatestElectrocardiogramResult {
        let date: Date
        let classification: String
        let averageHeartRateBpm: Double
        let symptomsStatus: String
        let measurementCount: Int
        let source: String
    }

    private func latestElectrocardiogram() async
        -> LatestElectrocardiogramResult? {
        guard #available(iOS 14.0, *) else { return nil }
        let type = HKObjectType.electrocardiogramType()
        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: nil,
                limit: 1,
                sortDescriptors: [
                    NSSortDescriptor(
                        key: HKSampleSortIdentifierEndDate,
                        ascending: false
                    )
                ]
            ) { _, samples, _ in
                guard let sample = samples?.first as? HKElectrocardiogram else {
                    continuation.resume(returning: nil)
                    return
                }
                let bpm = sample.averageHeartRate?.doubleValue(
                    for: HKUnit.count().unitDivided(by: .minute())
                ) ?? 0
                continuation.resume(
                    returning: LatestElectrocardiogramResult(
                        date: sample.endDate,
                        classification: String(describing: sample.classification),
                        averageHeartRateBpm: max(0, bpm),
                        symptomsStatus: String(describing: sample.symptomsStatus),
                        measurementCount: max(0, sample.numberOfVoltageMeasurements),
                        source: sample.sourceRevision.source.name
                    )
                )
            }
            healthStore.execute(query)
        }
    }

    private func latestQuantity(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit
    ) async -> LatestQuantityResult? {
        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
            return nil
        }
        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: nil,
                limit: 1,
                sortDescriptors: [
                    NSSortDescriptor(
                        key: HKSampleSortIdentifierEndDate,
                        ascending: false
                    )
                ]
            ) { _, samples, _ in
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(
                    returning: LatestQuantityResult(
                        value: sample.quantity.doubleValue(for: unit),
                        date: sample.endDate,
                        source: sample.sourceRevision.source.name
                    )
                )
            }
            healthStore.execute(query)
        }
    }

    private func recentSleep(
        start: Date,
        end: Date
    ) async -> (seconds: Double, sources: [String]) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            return (0, [])
        }
        let predicate = HKQuery.predicateForSamples(
            withStart: start,
            end: end,
            options: []
        )
        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
            ) { _, samples, _ in
                let asleepValues: Set<Int> = [
                    HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                    HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                    HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                    HKCategoryValueSleepAnalysis.asleepREM.rawValue
                ]
                let rows = (samples as? [HKCategorySample] ?? [])
                    .filter { asleepValues.contains($0.value) }
                    .compactMap { sample -> SleepInterval? in
                        let clippedStart = max(start, sample.startDate)
                        let clippedEnd = min(end, sample.endDate)
                        guard clippedEnd > clippedStart else { return nil }
                        return SleepInterval(
                            start: clippedStart,
                            end: clippedEnd,
                            sources: [sample.sourceRevision.source.name]
                        )
                    }

                let latest = Self.latestSleepSession(rows)
                continuation.resume(
                    returning: (
                        min(86_400, latest.seconds),
                        latest.sources.sorted()
                    )
                )
            }
            healthStore.execute(query)
        }
    }

    private struct SleepInterval {
        var start: Date
        var end: Date
        var sources: Set<String>
    }

    private static func latestSleepSession(
        _ rawIntervals: [SleepInterval]
    ) -> (seconds: Double, sources: Set<String>) {
        let sorted = rawIntervals.sorted {
            if $0.start == $1.start { return $0.end < $1.end }
            return $0.start < $1.start
        }
        guard !sorted.isEmpty else { return (0, []) }

        // First union overlaps from Apple Watch, iPhone and third-party apps so
        // the same minute can never be counted twice.
        var merged: [SleepInterval] = []
        for interval in sorted {
            if var last = merged.last, interval.start <= last.end {
                last.end = max(last.end, interval.end)
                last.sources.formUnion(interval.sources)
                merged[merged.count - 1] = last
            } else {
                merged.append(interval)
            }
        }

        // Sleep stages can contain short awake gaps. Treat gaps up to 30
        // minutes as one session, but never add those awake minutes themselves.
        let maximumSessionGap: TimeInterval = 30 * 60
        var sessions: [[SleepInterval]] = []
        for interval in merged {
            if let lastEnd = sessions.last?.last?.end,
               interval.start.timeIntervalSince(lastEnd) <= maximumSessionGap {
                sessions[sessions.count - 1].append(interval)
            } else {
                sessions.append([interval])
            }
        }

        guard let latest = sessions.max(by: {
            ($0.last?.end ?? .distantPast) < ($1.last?.end ?? .distantPast)
        }) else {
            return (0, [])
        }
        let seconds = latest.reduce(0) {
            $0 + max(0, $1.end.timeIntervalSince($1.start))
        }
        let sources = latest.reduce(into: Set<String>()) {
            $0.formUnion($1.sources)
        }
        return (seconds, sources)
    }

    @available(iOS 18.0, *)
    private func latestStateOfMind() async -> [String: Any]? {
        let type = HKObjectType.stateOfMindType()
        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: nil,
                limit: 1,
                sortDescriptors: [
                    NSSortDescriptor(
                        key: HKSampleSortIdentifierEndDate,
                        ascending: false
                    )
                ]
            ) { _, samples, _ in
                guard let sample = samples?.first as? HKStateOfMind else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: [
                    "valence": sample.valence,
                    "kind": String(describing: sample.kind),
                    "labels": sample.labels.map { String(describing: $0) },
                    "associations": sample.associations.map { String(describing: $0) },
                    "recordedAt": Self.iso8601(sample.endDate),
                    "source": sample.sourceRevision.source.name,
                    "userRecorded": true
                ])
            }
            healthStore.execute(query)
        }
    }

    nonisolated private static func iso8601(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }
}
