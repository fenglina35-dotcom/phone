
import MapKit
import SwiftUI
import FamilyControls
import ManagedSettings
import DeviceActivity
import CoreLocation
import CryptoKit

extension DeviceActivityName {
    static let dailyAppLimits = Self("dailyAppLimits")
}

extension ManagedSettingsStore.Name {
    static let dailyLimit = Self("dailyLimit")
}

private struct SavedDailyLimit: Codable {
    let token: ApplicationToken
    let minutes: Int
    let isEnabled: Bool
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase

    @State private var statusText = "正在检查授权状态"
    @State private var isScreenTimeAuthorized = false
    @State private var isPickerPresented = false
    @State private var selection: FamilyActivitySelection
    @State private var selectionNoticeText = ""
    @State private var lockedAppTokens: Set<ApplicationToken>
    @State private var lockStatusText = "尚未执行锁定"

    @State private var dailyLimitMinutes: [ApplicationToken: Int]
    @State private var enabledDailyLimitTokens: Set<ApplicationToken>
    @State private var limitStatusText = "尚未设置每日使用时长"

    @StateObject private var locationManager = LocationManager.shared

    private let manualLockStore = ManagedSettingsStore()
    private let dailyLimitStore = ManagedSettingsStore(named: .dailyLimit)
    private let activityCenter = DeviceActivityCenter()

    private let appGroupID = "group.com.qianyi.PhoneCompanionTest"
    private let selectionKey = "savedFamilyActivitySelection"
    private let lockedAppsKey = "savedLockedApplicationTokens"
    private let dailyLimitsKey = "limit.savedSettings"
    private let tokenKeyPrefix = "limit.token."
    private let lockedLimitTokensKey = "limit.lockedTokens"
    private let shieldRoleActorsKey = "companion.shield.roleActors.v1"
    private let shieldLimitDaysKey = "companion.shield.limitDays.v1"

    private let reportContext =
        DeviceActivityReport.Context("Total Activity")

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    init() {
        let savedSelection: FamilyActivitySelection

        if let data = UserDefaults.standard.data(
            forKey: "savedFamilyActivitySelection"
        ),
        let decodedSelection = try? JSONDecoder().decode(
            FamilyActivitySelection.self,
            from: data
        ) {
            savedSelection = decodedSelection
        } else {
            savedSelection = FamilyActivitySelection()
        }

        let savedLockedTokens: Set<ApplicationToken>

        if let data = UserDefaults.standard.data(
            forKey: "savedLockedApplicationTokens"
        ),
        let decodedTokens = try? JSONDecoder().decode(
            Set<ApplicationToken>.self,
            from: data
        ) {
            savedLockedTokens = decodedTokens
        } else {
            savedLockedTokens = []
        }

        var loadedMinutes: [ApplicationToken: Int] = [:]
        var loadedEnabledTokens: Set<ApplicationToken> = []

        if let defaults = UserDefaults(
            suiteName: "group.com.qianyi.PhoneCompanionTest"
        ),
        let data = defaults.data(forKey: "limit.savedSettings"),
        let savedSettings = try? JSONDecoder().decode(
            [SavedDailyLimit].self,
            from: data
        ) {
            for setting in savedSettings {
                loadedMinutes[setting.token] = setting.minutes

                if setting.isEnabled {
                    loadedEnabledTokens.insert(setting.token)
                }
            }
        }

        let selectedTokens = savedSelection.applicationTokens

        _selection = State(initialValue: savedSelection)
        _lockedAppTokens = State(
            initialValue: savedLockedTokens.intersection(
                selectedTokens
            )
        )
        _dailyLimitMinutes = State(
            initialValue: loadedMinutes.filter {
                selectedTokens.contains($0.key)
            }
        )
        _enabledDailyLimitTokens = State(
            initialValue: loadedEnabledTokens.intersection(
                selectedTokens
            )
        )
    }

    private var selectionSummary: String {
        let appCount = selection.applicationTokens.count
        let categoryCount = selection.categoryTokens.count
        let websiteCount = selection.webDomainTokens.count

        if appCount == 0 &&
            categoryCount == 0 &&
            websiteCount == 0 {
            return "尚未选择任何软件"
        }

        return "已选择 \(appCount) 个 App、\(categoryCount) 个类别、\(websiteCount) 个网站"
    }

    private var canControlSelectedApps: Bool {
        !selection.applicationTokens.isEmpty &&
        selection.categoryTokens.isEmpty &&
        selection.webDomainTokens.isEmpty
    }

    private var todayFilter: DeviceActivityFilter {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())

        let end = calendar.date(
            byAdding: .day,
            value: 1,
            to: start
        ) ?? Date()

        return DeviceActivityFilter(
            segment: .daily(
                during: DateInterval(
                    start: start,
                    end: end
                )
            ),
            users: .all,
            devices: .init([.iPhone])
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 26) {
                screenTimeSection

                Divider()

                appSelectionSection

                Divider()

                individualAppControlSection

                Divider()

                batchLockSection

                Divider()

                dailyLimitSection

                Divider()

                locationSection
            }
            .padding()
        }
        .familyActivityPicker(
            isPresented: $isPickerPresented,
            selection: $selection
        )
        .onChange(of: selection) {
            if sanitizeSelectionToIndividualApps() {
                return
            }

            reconcileSavedDataWithSelection()
            saveSelection()
        }
        .task {
            refreshAuthorizationStatus()
            _ = sanitizeSelectionToIndividualApps()
            applyManualLocks()
        }
        .onChange(of: scenePhase) {
            if scenePhase == .active {
                refreshAuthorizationStatus()
            }
        }
    }

    private var screenTimeSection: some View {
        VStack(spacing: 18) {
            Image(systemName: "hourglass.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.blue)

            Text("屏幕使用时间")
                .font(.largeTitle)
                .bold()

            Text(statusText)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("请求屏幕使用时间权限") {
                requestScreenTimeAuthorization()
            }
            .buttonStyle(.borderedProminent)

            Text("今日屏幕使用时间")
                .font(.title2)
                .bold()
                .padding(.top, 10)

            DeviceActivityReport(
                reportContext,
                filter: todayFilter
            )
            .frame(height: 120)
        }
    }

    private var appSelectionSection: some View {
        VStack(spacing: 18) {
            Text("选择要管理的软件")
                .font(.title2)
                .bold()

            Text(selectionSummary)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if !selectionNoticeText.isEmpty {
                Text(selectionNoticeText)
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
            }

            Button("打开软件选择列表") {
                isPickerPresented = true
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(!isScreenTimeAuthorized)
        }
    }

    private var individualAppControlSection: some View {
        VStack(spacing: 18) {
            Text("逐个 App 控制")
                .font(.title2)
                .bold()

            if selection.applicationTokens.isEmpty {
                Text("请先选择要管理的 App")
                    .foregroundStyle(.secondary)
            } else if !selection.categoryTokens.isEmpty ||
                        !selection.webDomainTokens.isEmpty {
                Text("请取消类别和网站，只保留 App")
                    .foregroundStyle(.red)
            } else {
                ForEach(
                    Array(selection.applicationTokens),
                    id: \.self
                ) { token in
                    HStack(spacing: 12) {
                        Label(token)
                            .labelStyle(.titleAndIcon)
                            .frame(
                                maxWidth: .infinity,
                                alignment: .leading
                            )

                        Button(
                            lockedAppTokens.contains(token)
                                ? "解锁"
                                : "锁定"
                        ) {
                            toggleManualLock(for: token)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(
                            lockedAppTokens.contains(token)
                                ? .blue
                                : .red
                        )
                    }
                    .padding()
                    .background(
                        Color.secondary.opacity(0.12)
                    )
                    .clipShape(
                        RoundedRectangle(cornerRadius: 16)
                    )
                }
            }

            Text("当前手动锁定 \(lockedAppTokens.count) 个 App")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var batchLockSection: some View {
        VStack(spacing: 18) {
            Text("批量锁定与解锁")
                .font(.title2)
                .bold()

            Text(lockStatusText)
                .foregroundStyle(.secondary)

            Button("锁定全部所选 App") {
                lockAllSelectedApps()
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .disabled(!canControlSelectedApps)

            Button("解除全部手动锁定") {
                unlockAllManuallyLockedApps()
            }
            .buttonStyle(.bordered)
            .disabled(lockedAppTokens.isEmpty)

            Text("安全限制：至少选择 1 个 App，并且不能选择类别或网站。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    private var dailyLimitSection: some View {
        VStack(spacing: 18) {
            Text("每日使用时长限制")
                .font(.title2)
                .bold()

            Text("每个 App 可以单独设置，到达时长后自动锁定，第二天自动重新计算。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if selection.applicationTokens.isEmpty {
                Text("请先选择要管理的 App")
                    .foregroundStyle(.secondary)
            } else if !canControlSelectedApps {
                Text("请取消类别和网站，只保留 App")
                    .foregroundStyle(.red)
            } else {
                ForEach(
                    Array(selection.applicationTokens),
                    id: \.self
                ) { token in
                    VStack(spacing: 12) {
                        Label(token)
                            .labelStyle(.titleAndIcon)
                            .frame(
                                maxWidth: .infinity,
                                alignment: .leading
                            )

                        Stepper(
                            value: Binding(
                                get: {
                                    dailyLimitMinutes[token] ?? 30
                                },
                                set: { newValue in
                                    dailyLimitMinutes[token] = newValue
                                }
                            ),
                            in: 5...720,
                            step: 5
                        ) {
                            Text(
                                "每天可使用 \(dailyLimitMinutes[token] ?? 30) 分钟"
                            )
                        }

                        HStack(spacing: 12) {
                            Button(
                                enabledDailyLimitTokens.contains(token)
                                    ? "更新限额"
                                    : "启用限额"
                            ) {
                                enableDailyLimit(for: token)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.orange)

                            if enabledDailyLimitTokens.contains(token) {
                                Button("取消限额") {
                                    disableDailyLimit(for: token)
                                }
                                .buttonStyle(.bordered)
                                .tint(.red)
                            }
                        }

                        Text(
                            enabledDailyLimitTokens.contains(token)
                                ? "此 App 的每日限额已启用"
                                : "此 App 尚未启用每日限额"
                        )
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(
                        Color.secondary.opacity(0.12)
                    )
                    .clipShape(
                        RoundedRectangle(cornerRadius: 16)
                    )
                }
            }

            Text(limitStatusText)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("取消全部每日限额") {
                cancelAllDailyLimits()
            }
            .buttonStyle(.bordered)
            .tint(.red)
            .disabled(enabledDailyLimitTokens.isEmpty)
        }
    }

    private var locationSection: some View {
        VStack(spacing: 18) {
            Image(systemName: "location.circle.fill")
                .font(.system(size: 60))
                .foregroundStyle(.green)

            Text("实时定位与每日足迹")
                .font(.title2)
                .bold()

            Text(locationManager.authorizationText)
                .foregroundStyle(.secondary)

            Text(locationManager.accuracyText)
                .foregroundStyle(.secondary)

            if locationManager.authorizationStatus == .notDetermined {
                Button("允许定位") {
                    locationManager.requestWhenInUseAuthorization()
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
            }

            if locationManager.authorizationStatus == .authorizedWhenInUse {
                Button("允许后台持续定位") {
                    locationManager.requestAlwaysAuthorization()
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
            }

            if locationManager.authorizationStatus == .authorizedAlways ||
                locationManager.authorizationStatus == .authorizedWhenInUse {
                // The 2026-08-11 watchdog log shows VectorKit blocking the
                // main thread while its live map entered the background.
                // Remove the map as soon as the scene becomes inactive; the
                // location recorder remains independent and can keep working.
                if scenePhase == .active,
                   let location = locationManager.currentLocation {
                    Map(
                        initialPosition: .region(
                            MKCoordinateRegion(
                                center: location.coordinate,
                                span: MKCoordinateSpan(
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01
                                )
                            )
                        )
                    ) {
                        Marker(
                            "当前位置",
                            coordinate: location.coordinate
                        )
                    }
                    .frame(height: 300)
                    .clipShape(
                        RoundedRectangle(cornerRadius: 20)
                    )
                }

                Text(locationManager.coordinateText)
                    .font(.headline)
                    .multilineTextAlignment(.center)

                Text(locationManager.locationAccuracyText)
                    .foregroundStyle(.secondary)

                Text("最后更新：" + locationManager.lastUpdateText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if locationManager.isTracking {
                    Button("停止记录足迹") {
                        locationManager.stopTracking()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                } else {
                    Button("开始实时定位") {
                        locationManager.startTracking()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                }

                Text(
                    "今日已记录 \(locationManager.todayPoints.count) 个足迹点"
                )
                .foregroundStyle(.secondary)

                Button("清除今日足迹") {
                    locationManager.clearTodayFootprint()
                }
                .buttonStyle(.bordered)
                .tint(.red)
            }

            if let error = locationManager.lastError {
                Text(error)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func refreshAuthorizationStatus() {
        let authorizationStatus =
            AuthorizationCenter.shared.authorizationStatus

        if #available(iOS 26.0, *),
           authorizationStatus == .approvedWithDataAccess {
            isScreenTimeAuthorized = true
            statusText = "屏幕使用时间权限：已授权（真实数据）"
            return
        }

        switch authorizationStatus {
        case .approvedWithDataAccess:
            isScreenTimeAuthorized = true
            statusText = "屏幕使用时间权限：已授权（真实数据）"
        case .approved:
            isScreenTimeAuthorized = true
            statusText = "屏幕使用时间权限：已授权"
        case .denied:
            isScreenTimeAuthorized = false
            statusText = "屏幕使用时间权限：已拒绝"
        case .notDetermined:
            isScreenTimeAuthorized = false
            statusText = "屏幕使用时间权限：尚未请求"
        @unknown default:
            isScreenTimeAuthorized = false
            statusText = "屏幕使用时间权限：未知状态"
        }
    }

    private func requestScreenTimeAuthorization() {
        Task { @MainActor in
            do {
                try await AuthorizationCenter.shared
                    .requestAuthorization(for: .individual)
                refreshAuthorizationStatus()
            } catch {
                statusText = "授权失败：\(error.localizedDescription)"
            }
        }
    }

    private func saveSelection() {
        if let data = try? JSONEncoder().encode(selection) {
            UserDefaults.standard.set(data, forKey: selectionKey)
        }
    }

    @discardableResult
    private func sanitizeSelectionToIndividualApps() -> Bool {
        let categoryCount = selection.categoryTokens.count
        let websiteCount = selection.webDomainTokens.count

        guard categoryCount > 0 || websiteCount > 0 else {
            return false
        }

        var appOnlySelection = selection
        appOnlySelection.categoryTokens.removeAll()
        appOnlySelection.webDomainTokens.removeAll()
        selection = appOnlySelection

        selectionNoticeText =
            "已自动忽略 \(categoryCount) 个类别和 \(websiteCount) 个网站，只保留单独 App"

        return true
    }

    private func saveLockedApps() {
        if let data = try? JSONEncoder().encode(lockedAppTokens) {
            UserDefaults.standard.set(data, forKey: lockedAppsKey)
        }
    }

    private func saveDailyLimitSettings() {
        let settings = dailyLimitMinutes.map { token, minutes in
            SavedDailyLimit(
                token: token,
                minutes: minutes,
                isEnabled: enabledDailyLimitTokens.contains(token)
            )
        }

        if let data = try? JSONEncoder().encode(settings) {
            sharedDefaults?.set(data, forKey: dailyLimitsKey)
        }
    }

    private func reconcileSavedDataWithSelection() {
        lockedAppTokens.formIntersection(selection.applicationTokens)
        enabledDailyLimitTokens.formIntersection(
            selection.applicationTokens
        )

        dailyLimitMinutes = dailyLimitMinutes.filter {
            selection.applicationTokens.contains($0.key)
        }

        applyManualLocks()
        saveDailyLimitSettings()
        rebuildDailyLimitMonitoring()
    }

    private func toggleManualLock(for token: ApplicationToken) {
        clearRoleLockSources(for: [token])
        if lockedAppTokens.contains(token) {
            CompanionSyncService.shared.recordExplicitManualUnlock([token])
            lockedAppTokens.remove(token)
            lockStatusText = "已单独解除 1 个 App 的锁定"
        } else {
            lockedAppTokens.insert(token)
            lockStatusText = "已单独锁定 1 个 App"
        }

        applyManualLocks()
        if !lockedAppTokens.contains(token) {
            synchronizeManualUnlockEvent()
        }
    }

    private func lockAllSelectedApps() {
        guard canControlSelectedApps else {
            lockStatusText = "请至少选择 1 个 App，不能选择类别或网站"
            return
        }

        clearRoleLockSources(for: selection.applicationTokens)
        lockedAppTokens = selection.applicationTokens
        lockStatusText =
            "已锁定全部所选的 \(lockedAppTokens.count) 个 App"
        applyManualLocks()
    }

    private func unlockAllManuallyLockedApps() {
        clearRoleLockSources(for: lockedAppTokens)
        CompanionSyncService.shared.recordExplicitManualUnlock(
            lockedAppTokens
        )
        lockedAppTokens.removeAll()
        lockStatusText = "已经解除全部手动锁定"
        applyManualLocks()
        synchronizeManualUnlockEvent()
    }

    private func synchronizeManualUnlockEvent() {
        Task { @MainActor in
            _ = await CompanionSyncService.shared.synchronize(
                locationManager: locationManager,
                wellnessService: CompanionWellnessService.shared,
                quiet: true
            )
        }
    }

    private func applyManualLocks() {
        manualLockStore.shield.applications =
            lockedAppTokens.isEmpty ? nil : lockedAppTokens
        saveLockedApps()
    }

    private func clearRoleLockSources(
        for tokens: Set<ApplicationToken>
    ) {
        guard !tokens.isEmpty,
              let defaults = sharedDefaults else { return }
        var actors = defaults.dictionary(forKey: shieldRoleActorsKey)
            as? [String: String] ?? [:]
        for token in tokens {
            if let externalID = stableExternalID(for: token) {
                actors.removeValue(forKey: externalID)
            }
        }
        if actors.isEmpty {
            defaults.removeObject(forKey: shieldRoleActorsKey)
        } else {
            defaults.set(actors, forKey: shieldRoleActorsKey)
        }
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

    private func enableDailyLimit(for token: ApplicationToken) {
        guard canControlSelectedApps else {
            limitStatusText = "请取消类别和网站，只保留 App"
            return
        }

        if dailyLimitMinutes[token] == nil {
            dailyLimitMinutes[token] = 30
        }

        enabledDailyLimitTokens.insert(token)
        saveDailyLimitSettings()
        rebuildDailyLimitMonitoring()
        limitStatusText =
            "已启用每日 \(dailyLimitMinutes[token] ?? 30) 分钟限额"
    }

    private func disableDailyLimit(for token: ApplicationToken) {
        enabledDailyLimitTokens.remove(token)
        saveDailyLimitSettings()
        rebuildDailyLimitMonitoring()
        limitStatusText = "已取消这个 App 的每日限额"
    }

    private func cancelAllDailyLimits() {
        enabledDailyLimitTokens.removeAll()
        activityCenter.stopMonitoring([.dailyAppLimits])
        dailyLimitStore.shield.applications = nil
        sharedDefaults?.removeObject(forKey: lockedLimitTokensKey)
        sharedDefaults?.removeObject(forKey: shieldLimitDaysKey)
        saveDailyLimitSettings()
        limitStatusText = "已取消全部每日使用时长限制"
    }

    private func rebuildDailyLimitMonitoring() {
        activityCenter.stopMonitoring([.dailyAppLimits])
        dailyLimitStore.shield.applications = nil
        sharedDefaults?.removeObject(forKey: lockedLimitTokensKey)
        sharedDefaults?.removeObject(forKey: shieldLimitDaysKey)

        guard !enabledDailyLimitTokens.isEmpty else {
            return
        }

        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )

        var events: [
            DeviceActivityEvent.Name: DeviceActivityEvent
        ] = [:]

        for (index, token) in
            Array(enabledDailyLimitTokens).enumerated() {
            let eventName = DeviceActivityEvent.Name(
                "dailyLimit_\(index)"
            )
            let minutes = dailyLimitMinutes[token] ?? 30

            events[eventName] = DeviceActivityEvent(
                applications: [token],
                categories: [],
                webDomains: [],
                threshold: DateComponents(minute: minutes),
                includesPastActivity: true
            )

            if let tokenData = try? JSONEncoder().encode(token) {
                sharedDefaults?.set(
                    tokenData,
                    forKey: tokenKeyPrefix + eventName.rawValue
                )
            }
        }

        do {
            try activityCenter.startMonitoring(
                .dailyAppLimits,
                during: schedule,
                events: events
            )
        } catch {
            limitStatusText =
                "启动每日限额失败：\(error.localizedDescription)"
        }
    }
}

#Preview {
    ContentView()
}
