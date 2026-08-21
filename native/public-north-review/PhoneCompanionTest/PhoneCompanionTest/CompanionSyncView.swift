import Combine
import CoreLocation
import CryptoKit
import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import Security
import SwiftUI
import UIKit
import UserNotifications

struct CompanionRootView: View {
    var body: some View {
        TabView {
            ContentView()
                .tabItem {
                    Label("本机管理", systemImage: "hourglass")
                }

            CompanionSyncView()
                .tabItem {
                    Label("角色远程管理", systemImage: "person.2.badge.gearshape")
                }
        }
    }
}

struct CompanionSyncView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var service = CompanionSyncService()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var wellnessService = CompanionWellnessService()
    @StateObject private var pushCoordinator =
        CompanionPushCoordinator.shared
    @State private var smallPhoneID = ""
    @State private var pairCode = ""
    @State private var reportFilterEnd = Date()

    private let reportContext =
        DeviceActivityReport.Context("Total Activity")
    private let roleControllerURL = URL(
        string: "https://fenglina35-dotcom.github.io/phone/north-support.html?role-controller=1"
    )!

    private var todayFilter: DeviceActivityFilter {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let endOfDay = calendar.date(
            byAdding: .day,
            value: 1,
            to: start
        ) ?? Date()
        let end = min(
            endOfDay,
            max(
                start.addingTimeInterval(1),
                reportFilterEnd
            )
        )

        return DeviceActivityFilter(
            segment: .daily(
                during: DateInterval(start: start, end: end)
            ),
            users: .all,
            devices: .init([.iPhone])
        )
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("今日真实屏幕使用时间")
                            .font(.headline)
                        Spacer()
                        Text(service.reportGenerationText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    DeviceActivityReport(
                        reportContext,
                        filter: todayFilter
                    )
                    .frame(height: 72)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .frame(height: 118)
                .background(Color(uiColor: .secondarySystemGroupedBackground))

                Form {
                Section("角色远程管理") {
                    Text(
                        "完成系统授权和短时配对后，用户允许的角色控制端可以查看同步状态，并向这台 iPhone 发送查看、锁定、解锁和每日限额命令。North 只执行已选择 App 的命令，并以设备回执作为成功依据。"
                    )
                    .font(.footnote)

                    Label(
                        "可用命令：查看、锁定、解锁、每日限额",
                        systemImage: "checkmark.shield"
                    )
                    .font(.footnote)

                    Link(destination: roleControllerURL) {
                        Label("打开角色控制台", systemImage: "safari")
                    }

                    Text(
                        "App Review：请使用 Review Notes 中提供的永久演示账号。测试角色已预先创建；审核员无需注册或创建角色，只需登录并生成新的 8 位配对码。"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Section("连接状态") {
                    HStack {
                        Text("真实 iPhone")
                        Spacer()
                        Text(service.isPaired ? "已连接" : "未连接")
                            .foregroundStyle(
                                service.isPaired ? .green : .secondary
                            )
                    }

                    if service.isPaired {
                        LabeledContent(
                            "角色控制端 ID",
                            value: service.pairedTarget
                        )
                        LabeledContent(
                            "最近上传",
                            value: service.lastSyncText
                        )
                    }

                    Text(service.statusText)
                        .font(.footnote)
                        .foregroundStyle(
                            service.hasError ? .red : .secondary
                        )
                }

                Section("后台通知") {
                    LabeledContent(
                        "通知状态",
                        value: pushCoordinator.statusText
                    )

                    LabeledContent(
                        "设备登记",
                        value: service.pushStatusText
                    )

                    Button("开启后台通知") {
                        Task {
                            await pushCoordinator.requestAuthorization()
                            await service.registerPushTokenIfAvailable(
                                token: pushCoordinator.deviceToken,
                                environment: pushCoordinator.environment
                            )
                        }
                    }

                    Text(
                        "收到已配对角色控制端的锁定、解锁、限额或同步命令时，系统会尽量唤醒本 App 立即处理。若你在多任务界面强制划掉本 App，iOS 仍可能停止后台唤醒。"
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }

                if !service.isPaired {
                    Section("连接角色控制端") {
                        TextField("粘贴角色控制端 ID", text: $smallPhoneID)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        TextField("输入 8 位配对码", text: $pairCode)
                            .keyboardType(.numberPad)

                        Button("连接角色控制端") {
                            Task {
                                let paired = await service.pair(
                                    target: smallPhoneID,
                                    code: pairCode
                                )
                                if paired {
                                    await requestLiveUsageAndSynchronize()
                                }
                            }
                        }
                        .disabled(
                            service.isWorking ||
                            smallPhoneID.trimmingCharacters(
                                in: .whitespacesAndNewlines
                            ).isEmpty ||
                            pairCode.count != 8
                        )
                    }
                } else {
                    Section("真实数据同步") {
                        Button("立即上传真实数据") {
                            Task {
                                await requestLiveUsageAndSynchronize()
                            }
                        }
                        .disabled(service.isWorking)

                        HStack {
                            Text("当前任务")
                            Spacer()
                            if service.isWorking {
                                ProgressView()
                                    .controlSize(.small)
                            }
                            Text(service.isWorking ? "同步中" : "空闲")
                                .foregroundStyle(.secondary)
                        }

                        LabeledContent(
                            "已选 App",
                            value: "\(service.lastAppCount) 个"
                        )
                        LabeledContent(
                            "同步模式",
                            value: service.dataAccessModeText
                        )
                        LabeledContent(
                            "逐 App 数据",
                            value: service.reportStatusText
                        )
                        LabeledContent(
                            "快照上传",
                            value: service.uploadStatusText
                        )
                        LabeledContent(
                            "命令执行",
                            value: service.commandStatusText
                        )
                        LabeledContent(
                            "今日足迹",
                            value: "\(service.lastFootprintCount) 个"
                        )
                        LabeledContent(
                            "最近位置",
                            value: service.lastPlaceName
                        )
                    }
                }

                Section("电量与 Apple Watch 健康") {
                    LabeledContent(
                        "iPhone 电量",
                        value: wellnessService.batteryDisplayText
                    )
                    LabeledContent(
                        "低电量模式",
                        value: wellnessService.lowPowerModeEnabled ? "已开启" : "未开启"
                    )

                    Toggle(
                        "同步健康摘要给小手机",
                        isOn: Binding(
                            get: { wellnessService.healthSyncEnabled },
                            set: { enabled in
                                Task {
                                    await wellnessService.setHealthSyncEnabled(enabled)
                                    if service.isPaired {
                                        await service.synchronize(
                                            locationManager: locationManager,
                                            wellnessService: wellnessService
                                        )
                                    }
                                }
                            }
                        )
                    )

                    Text(wellnessService.healthStatusText)
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    Text("Apple Watch 的步数、活动能量、心率、HRV 和睡眠会先同步到 iPhone 健康 App，再由本页读取摘要。心境只读取你主动记录的内容，不会根据心率猜测情绪。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !service.selectedAppsForNaming().isEmpty {
                    Section("App 名称与外置编号") {
                        ForEach(service.selectedAppsForNaming()) { app in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 10) {
                                    Text("外置 \(app.bindingCode)")
                                        .font(.caption.bold())
                                        .foregroundStyle(.blue)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(
                                            Color.blue.opacity(0.12),
                                            in: Capsule()
                                        )

                                    Label(app.token)
                                }

                                Text(service.usageText(for: app.id))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                TextField(
                                    "可选：给角色控制端显示的名称",
                                    text: Binding(
                                        get: {
                                            service.alias(for: app.id)
                                        },
                                        set: {
                                            service.setAlias($0, for: app.id)
                                        }
                                    )
                                )
                            }
                        }

                        Text("角色控制端会显示相同的外置编号。未填写名称仍可按编号锁定、解锁和设置限额；只有想让角色按名称识别时才需要填写。")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("说明") {
                    Text(
                        "个人直读模式会上传 iPhone 的真实总时长和逐 App 时长；分享兼容模式只同步已选 App、限额、锁定状态、位置和足迹，不会把缺失时长伪装成 0。"
                    )
                    .font(.footnote)

                    Text(
                        "打开本页会读取一次真实使用数据；前台每 5 秒处理基础同步和角色发来的设备命令，不会让报告扩展反复转圈。"
                    )
                    .font(.footnote)
                }
            }
            }
            .navigationTitle("角色远程管理")
        }
        .task {
            pushCoordinator.setBackgroundWakeHandler {
                guard service.isPaired else {
                    return .noData
                }

                let didSynchronize = await service.synchronizeCommandsOnly(
                    locationManager: locationManager,
                    wellnessService: wellnessService
                )
                return didSynchronize ? .newData : .failed
            }

            locationManager.resumeTrackingIfAuthorized()
            await service.prepareDataAccess()
            await wellnessService.refresh()
            await pushCoordinator.refreshAuthorizationStatus()

            if service.isPaired {
                await service.registerPushTokenIfAvailable(
                    token: pushCoordinator.deviceToken,
                    environment: pushCoordinator.environment,
                    quiet: true
                )
                await requestLiveUsageAndSynchronize()
            }
        }
        .task(id: service.isPaired) {
            guard service.isPaired else {
                return
            }

            while !Task.isCancelled {
                if service.isPaired {
                    await wellnessService.refresh()
                    await service.synchronize(
                        locationManager: locationManager,
                        wellnessService: wellnessService,
                        quiet: true
                    )
                }

                try? await Task.sleep(
                    nanoseconds: 5_000_000_000
                )
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, service.isPaired else {
                return
            }

            Task {
                await wellnessService.refresh()
                await service.synchronize(
                    locationManager: locationManager,
                    wellnessService: wellnessService,
                    quiet: true
                )
            }
        }
        .onChange(of: pushCoordinator.deviceToken) { _, token in
            guard service.isPaired, !token.isEmpty else {
                return
            }

            Task {
                await service.registerPushTokenIfAvailable(
                    token: token,
                    environment: pushCoordinator.environment
                )
            }
        }
    }

    @MainActor
    private func requestLiveUsageAndSynchronize() async {
        let now = Date()
        reportFilterEnd = now > reportFilterEnd
            ? now
            : reportFilterEnd.addingTimeInterval(1)
        await wellnessService.refresh()
        await service.synchronize(
            locationManager: locationManager,
            wellnessService: wellnessService,
            refreshUsage: true
        )
    }
}

fileprivate struct CompanionSelectedApp: Identifiable {
    let id: String
    let token: ApplicationToken
    let bindingCode: String
}

private struct DeviceReportAppUsage: Codable {
    let externalAppID: String
    let usedSeconds: Double
}

private struct DeviceReportSnapshot: Codable {
    let schema: Int
    let requestID: String
    let requestedAt: Date
    let totalSeconds: Double
    let generatedAt: Date
    let apps: [DeviceReportAppUsage]

    var hasPositiveAppUsage: Bool {
        apps.contains { $0.usedSeconds > 0 }
    }
}

private struct SavedDailyLimitMirror: Codable {
    let token: ApplicationToken
    let minutes: Int
    let isEnabled: Bool
}

private struct RemoteCommandEnvelope: Decodable {
    let id: String
    let command: RemoteCommand
}

private struct RemoteCommand: Decodable {
    let action: String
    let externalAppId: String?
    let minutes: Int?
    let scope: String?
    let actor: String?
}

@MainActor
final class CompanionSyncService: ObservableObject {
    @Published private(set) var isPaired = false
    @Published private(set) var pairedTarget = ""
    @Published private(set) var statusText = "等待连接小手机"
    @Published private(set) var hasError = false
    @Published private(set) var isWorking = false
    @Published private(set) var lastSyncDate: Date?
    @Published private(set) var lastAppCount = 0
    @Published private(set) var lastFootprintCount = 0
    @Published private(set) var lastPlaceName = "尚未获取"
    @Published private(set) var appAliases: [String: String] = [:]
    @Published private(set) var usageByExternalID: [String: Double] = [:]
    @Published private(set) var reportStatusText = "等待读取真实使用数据"
    @Published private(set) var reportGenerationText = "等待读取"
    @Published private(set) var dataAccessModeText = "正在检查"
    @Published private(set) var uploadStatusText = "等待上传"
    @Published private(set) var commandStatusText = "暂无命令"
    @Published private(set) var pushStatusText = "等待设备登记"
    private var syncInFlight = false
    private var commandSyncInFlight = false
    private var latestDirectUsageSnapshot: DeviceReportSnapshot?
    private var lastUsageRefreshDate: Date?
    private var locationRefreshRequested = false
    private var lastPushRegistrationSignature = ""

    private let serverURL = URL(
        string: "https://lkhlyfpssmrjkkzhuzag.supabase.co"
    )!
    private let publishableKey =
        "sb_publishable_uKytf2Tc_FmLv15SkkJyCQ_VU8IRSt2"

    private let appGroupID = "group.com.qianyi.PhoneCompanionTest"
    private let selectionKey = "savedFamilyActivitySelection"
    private let lockedAppsKey = "savedLockedApplicationTokens"
    private let dailyLimitsKey = "limit.savedSettings"
    private let tokenKeyPrefix = "limit.token."
    private let lockedLimitTokensKey = "limit.lockedTokens"
    private let savedTargetKey = "companion.sync.target.v1"
    private let savedDeviceIDKey = "companion.sync.device-id.v1"
    private let geocodeCacheKey = "companion.sync.geocode-cache.v1"
    private let appAliasesKey = "companion.sync.app-aliases.v1"
    private let tokenRegistryKey = "companion.sync.token-registry.v1"
    private let footprintStorageKey = "PhoneCompanionTodayFootprint"
    private let shieldActorKey = "companion.shield.actor.v1"
    private let snapshotSequenceKey = "companion.snapshot.sequence.v1"

    private let manualLockStore = ManagedSettingsStore()
    private let dailyLimitStore = ManagedSettingsStore(named: .dailyLimit)
    private let activityCenter = DeviceActivityCenter()

    init() {
        appAliases = UserDefaults.standard.dictionary(
            forKey: appAliasesKey
        ) as? [String: String] ?? [:]

        let target = UserDefaults.standard.string(
            forKey: savedTargetKey
        ) ?? ""

        if !target.isEmpty,
           CompanionSecretStore.load(account: target) != nil {
            pairedTarget = target
            isPaired = true
            statusText = "已连接，等待上传真实数据"
        }

        let savedLockedTokens = loadLockedTokens()
        if manualLockStore.shield.applications == nil,
           !savedLockedTokens.isEmpty {
            manualLockStore.shield.applications = savedLockedTokens
        }
    }

    var lastSyncText: String {
        guard let lastSyncDate else {
            return "尚未上传"
        }

        return DateFormatter.localizedString(
            from: lastSyncDate,
            dateStyle: .none,
            timeStyle: .medium
        )
    }

    fileprivate func selectedAppsForNaming() -> [CompanionSelectedApp] {
        var selected: [(id: String, token: ApplicationToken)] = []
        for token in loadSelection().applicationTokens {
            guard let id = stableExternalID(for: token) else {
                continue
            }
            selected.append((id: id, token: token))
        }
        selected.sort { lhs, rhs in
            lhs.id < rhs.id
        }

        var result: [CompanionSelectedApp] = []
        for (index, app) in selected.enumerated() {
            result.append(CompanionSelectedApp(
                id: app.id,
                token: app.token,
                bindingCode: String(format: "%02d", index + 1)
            ))
        }
        return result
    }

    func alias(for externalID: String) -> String {
        appAliases[externalID] ?? ""
    }

    func usageText(for externalID: String) -> String {
        guard let rawSeconds = usageByExternalID[externalID] else {
            return "今天暂无使用记录"
        }

        let totalSeconds = max(0, Int(rawSeconds.rounded()))
        let hours = totalSeconds / 3_600
        let minutes = totalSeconds % 3_600 / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return "今日已用 \(hours) 小时 \(minutes) 分钟"
        }
        if minutes > 0 {
            return "今日已用 \(minutes) 分钟 \(seconds) 秒"
        }
        return "今日已用 \(seconds) 秒"
    }

    func setAlias(_ value: String, for externalID: String) {
        let cleanValue = value.trimmingCharacters(
            in: .whitespacesAndNewlines
        )

        if cleanValue.isEmpty {
            appAliases.removeValue(forKey: externalID)
        } else {
            appAliases[externalID] = cleanValue
        }

        UserDefaults.standard.set(
            appAliases,
            forKey: appAliasesKey
        )
    }

    func pair(target: String, code: String) async -> Bool {
        let cleanTarget = target.trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        let cleanCode = code.filter(\.isNumber)

        guard cleanTarget.hasPrefix("yb_"),
              cleanTarget.count >= 23 else {
            setError("小手机 ID 格式不正确")
            return false
        }

        guard cleanCode.count == 8 else {
            setError("配对码必须是 8 位数字")
            return false
        }

        isWorking = true
        hasError = false
        statusText = "正在连接真实小手机……"
        defer { isWorking = false }

        do {
            let secret = randomSecret()
            let ok: Bool = try await rpc(
                "phone_companion_bind_device",
                body: [
                    "p_target": cleanTarget,
                    "p_pair_code": cleanCode,
                    "p_device_id": deviceID(),
                    "p_device_name": UIDevice.current.name,
                    "p_device_secret": secret
                ]
            )

            guard ok else {
                setError("配对失败：配对码可能已经过期")
                return false
            }

            try CompanionSecretStore.save(
                secret,
                account: cleanTarget
            )
            UserDefaults.standard.set(
                cleanTarget,
                forKey: savedTargetKey
            )

            pairedTarget = cleanTarget
            isPaired = true
            statusText = "真实 iPhone 已连接"
            await registerPushTokenIfAvailable(
                token: CompanionPushCoordinator.shared.deviceToken,
                environment: CompanionPushCoordinator.shared.environment,
                quiet: true
            )
            return true
        } catch {
            setError("连接失败：\(error.localizedDescription)")
            return false
        }
    }

    fileprivate func registerPushTokenIfAvailable(
        token: String,
        environment: String,
        quiet: Bool = false
    ) async {
        let cleanToken = token
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard isPaired, !cleanToken.isEmpty else {
            if !quiet {
                pushStatusText = "等待 APNs 设备令牌"
            }
            return
        }
        guard let secret = CompanionSecretStore.load(
            account: pairedTarget
        ) else {
            if !quiet {
                pushStatusText = "缺少设备凭据"
            }
            return
        }

        let cleanEnvironment = environment == "production"
            ? "production"
            : "sandbox"
        let signature = [
            pairedTarget,
            cleanEnvironment,
            cleanToken
        ].joined(separator: "|")
        guard signature != lastPushRegistrationSignature else {
            pushStatusText = "后台通知已登记"
            return
        }

        do {
            let ok: Bool = try await rpc(
                "phone_companion_register_push_token",
                body: [
                    "p_target": pairedTarget,
                    "p_device_secret": secret,
                    "p_device_token": cleanToken,
                    "p_environment": cleanEnvironment
                ]
            )
            guard ok else {
                if !quiet {
                    pushStatusText = "后台通知登记未完成"
                }
                return
            }
            lastPushRegistrationSignature = signature
            pushStatusText = "后台通知已登记"
        } catch {
            if !quiet {
                pushStatusText = "登记失败：\(error.localizedDescription)"
            }
        }
    }

    fileprivate func prepareDataAccess() async {
        guard #available(iOS 26.0, *) else {
            dataAccessModeText = "分享兼容模式"
            reportGenerationText = "兼容模式"
            reportStatusText = "当前系统不支持主 App 直读逐 App 时长"
            return
        }

        do {
            try await AuthorizationCenter.shared.requestAuthorization(
                for: .individual
            )
        } catch {
            // 原有 Family Controls 授权仍可继续用于选择、限额和锁定。
        }

        updateDataAccessMode()
    }

    @available(iOS 26.0, *)
    private func updateDataAccessMode() {
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approvedWithDataAccess:
            dataAccessModeText = "个人直读模式"
            reportGenerationText = "等待读取"
            reportStatusText = "已获真实使用数据权限"
        case .approved:
            dataAccessModeText = "分享兼容模式"
            reportGenerationText = "兼容模式"
            reportStatusText = "控制权限可用；真实逐 App 时长未授权"
        case .notDetermined:
            dataAccessModeText = "等待数据权限"
            reportGenerationText = "等待授权"
            reportStatusText = "尚未决定真实使用数据权限"
        case .denied:
            dataAccessModeText = "分享兼容模式"
            reportGenerationText = "兼容模式"
            reportStatusText = "真实逐 App 时长未授权；控制功能仍可用"
        @unknown default:
            dataAccessModeText = "分享兼容模式"
            reportGenerationText = "兼容模式"
            reportStatusText = "当前构建不支持真实逐 App 时长"
        }
    }

    @discardableResult
    fileprivate func synchronize(
        locationManager: LocationManager,
        wellnessService: CompanionWellnessService,
        quiet: Bool = false,
        refreshUsage: Bool = false
    ) async -> Bool {
        guard isPaired else {
            if !quiet {
                uploadStatusText = "尚未连接小手机"
            }
            return false
        }
        guard let secret = CompanionSecretStore.load(
            account: pairedTarget
        ) else {
            if !quiet {
                uploadStatusText = "缺少设备凭据，无法上传"
            }
            return false
        }

        if !quiet {
            guard !isWorking else {
                return false
            }
            isWorking = true
        }
        defer {
            if !quiet {
                isWorking = false
            }
        }

        for _ in 0..<80 where syncInFlight {
            do {
                try await Task.sleep(nanoseconds: 100_000_000)
            } catch {
                return false
            }
        }
        guard !syncInFlight else {
            commandStatusText = "后台唤醒等待上一轮同步结束超时"
            return false
        }
        syncInFlight = true
        defer { syncInFlight = false }

        do {
            let appliedCount = try await processPendingCommandsSerialized(
                secret: secret,
                locationManager: locationManager,
                wellnessService: wellnessService
            )
            if locationRefreshRequested {
                locationRefreshRequested = false
                try? await Task.sleep(nanoseconds: 1_500_000_000)
            }
            if appliedCount > 0 {
                commandStatusText = "已执行、验证并回执 \(appliedCount) 条命令"
            } else if !quiet {
                commandStatusText = "已检查，没有待执行命令"
            }
        } catch {
            commandStatusText =
                "命令处理失败：\(error.localizedDescription)"
            return false
        }

        var report = latestDirectUsageSnapshot
        let automaticUsageRefreshDue =
            dataAccessModeText == "个人直读模式" &&
            Date().timeIntervalSince(lastUsageRefreshDate ?? .distantPast) >= 60
        if refreshUsage || automaticUsageRefreshDue {
            lastUsageRefreshDate = Date()
            if !quiet {
                reportStatusText = "正在从主 App 读取真实使用数据"
                reportGenerationText = "读取中"
            }
            if #available(iOS 26.0, *) {
                report = await fetchTodayDirectUsage()
            } else {
                report = nil
            }
        }

        do {
            let snapshot = await makeSnapshot(
                locationManager: locationManager,
                report: report,
                wellnessService: wellnessService
            )
            let accepted: Bool = try await rpc(
                "phone_companion_push_snapshot",
                body: [
                    "p_target": pairedTarget,
                    "p_device_secret": secret,
                    "p_snapshot": snapshot
                ]
            )

            guard accepted else {
                throw CompanionSyncError.message(
                    "服务器拒绝了设备凭据，请重新配对"
                )
            }

            lastSyncDate = Date()
            if !quiet {
                if let report, report.hasPositiveAppUsage {
                    uploadStatusText = "真实逐 App 数据已上传"
                } else if report != nil {
                    uploadStatusText = "真实总时长已上传；逐 App 暂未匹配"
                } else {
                    uploadStatusText = "已上传兼容数据；逐 App 时长不可用"
                }
            }
        } catch {
            if !quiet {
                uploadStatusText = "上传失败：\(error.localizedDescription)"
            }
            return false
        }
        return true
    }

    // APNs 后台唤醒只走命令快车道：不等 DeviceActivity 报告、不刷新
    // HealthKit，也不做反向地理编码。ManagedSettings 落地和服务器回执优先。
    @discardableResult
    fileprivate func synchronizeCommandsOnly(
        locationManager: LocationManager,
        wellnessService: CompanionWellnessService
    ) async -> Bool {
        guard isPaired,
              let secret = CompanionSecretStore.load(account: pairedTarget)
        else {
            return false
        }

        do {
            let appliedCount = try await processPendingCommandsSerialized(
                secret: secret,
                locationManager: locationManager,
                wellnessService: wellnessService
            )
            if appliedCount > 0 {
                commandStatusText = "后台已执行并回执 \(appliedCount) 条命令"
            }

            if appliedCount == 0 {
                let snapshot = await makeSnapshot(
                    locationManager: locationManager,
                    report: latestDirectUsageSnapshot,
                    wellnessService: wellnessService,
                    resolvePlaceNames: false,
                    controlOnly: true
                )
                let accepted: Bool = try await rpc(
                    "phone_companion_push_snapshot",
                    body: [
                        "p_target": pairedTarget,
                        "p_device_secret": secret,
                        "p_snapshot": snapshot
                    ]
                )
                guard accepted else { return false }
            }
            lastSyncDate = Date()
            return true
        } catch {
            commandStatusText = "后台命令处理失败：\(error.localizedDescription)"
            return false
        }
    }

    @available(iOS 26.0, *)
    private func fetchTodayDirectUsage() async -> DeviceReportSnapshot? {
        guard AuthorizationCenter.shared.authorizationStatus ==
                .approvedWithDataAccess else {
            updateDataAccessMode()
            latestDirectUsageSnapshot = nil
            return nil
        }

        let requestedAt = Date()
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: requestedAt)
        let endOfDay = calendar.date(
            byAdding: .day,
            value: 1,
            to: start
        ) ?? requestedAt
        let end = min(
            endOfDay,
            max(start.addingTimeInterval(1), requestedAt)
        )
        let filter = DeviceActivityFilter(
            segment: .daily(
                during: DateInterval(start: start, end: end)
            ),
            users: .all,
            devices: .init([.iPhone])
        )
        let selectedTokens = loadSelection().applicationTokens
        var totalSeconds: TimeInterval = 0
        var usageByToken: [ApplicationToken: TimeInterval] = [:]

        do {
            let installedApplications =
                try await FamilyActivityData.shared.installedApplications
            var selectedTokenByBundleID: [String: ApplicationToken] = [:]

            for application in installedApplications {
                guard let token = application.token,
                      let bundleID = application.bundleIdentifier,
                      selectedTokens.contains(token) else {
                    continue
                }
                selectedTokenByBundleID[bundleID] = token
            }

            let dataSequence = DeviceActivityData.activityData(
                filteredBy: filter,
                using: .live
            )

            for try await deviceData in dataSequence {
                for try await segment in deviceData.activitySegments {
                    totalSeconds += segment.totalActivityDuration

                    for try await category in segment.categories {
                        for try await activity in category.applications {
                            let directToken = activity.application.token
                                .flatMap {
                                    selectedTokens.contains($0) ? $0 : nil
                                }
                            let bundleToken = activity.application
                                .bundleIdentifier
                                .flatMap { selectedTokenByBundleID[$0] }
                            guard let token = directToken ?? bundleToken else {
                                continue
                            }
                            usageByToken[token, default: 0] +=
                                activity.totalActivityDuration
                        }
                    }
                }
            }

            let apps: [DeviceReportAppUsage] = usageByToken.compactMap {
                entry -> DeviceReportAppUsage? in
                let (token, seconds) = entry
                guard let externalID = stableExternalID(for: token) else {
                    return nil
                }
                return DeviceReportAppUsage(
                    externalAppID: externalID,
                    usedSeconds: max(0, seconds)
                )
            }
            let generatedAt = Date()
            let snapshot = DeviceReportSnapshot(
                schema: 4,
                requestID: UUID().uuidString,
                requestedAt: requestedAt,
                totalSeconds: max(0, totalSeconds),
                generatedAt: generatedAt,
                apps: apps
            )

            latestDirectUsageSnapshot = snapshot
            usageByExternalID = Dictionary(
                uniqueKeysWithValues: apps.map {
                    ($0.externalAppID, $0.usedSeconds)
                }
            )
            dataAccessModeText = "个人直读模式"
            reportGenerationText = DateFormatter.localizedString(
                from: generatedAt,
                dateStyle: .none,
                timeStyle: .medium
            )
            let positiveCount = apps.filter { $0.usedSeconds > 0 }.count
            reportStatusText = positiveCount > 0
                ? "真实逐 App 数据已读取 · \(positiveCount) 个有时长"
                : "真实总时长已读取；暂未匹配到所选 App 时长"
            return snapshot
        } catch {
            latestDirectUsageSnapshot = nil
            reportGenerationText = "读取失败"
            reportStatusText =
                "直读失败：\(error.localizedDescription)；控制功能仍可用"
            return nil
        }
    }

    private func makeSnapshot(
        locationManager: LocationManager,
        report: DeviceReportSnapshot?,
        wellnessService: CompanionWellnessService,
        resolvePlaceNames: Bool = true,
        controlOnly: Bool = false
    ) async -> [String: Any] {
        let selection = loadSelection()
        let lockedTokens = manualLockStore.shield.applications ?? []
        let limitSettings = loadLimitSettings()

        let usageByID = Dictionary(
            uniqueKeysWithValues: (report?.apps ?? []).map {
                ($0.externalAppID, $0.usedSeconds)
            }
        )
        let limitByToken = Dictionary(
            uniqueKeysWithValues: limitSettings.map {
                ($0.token, $0)
            }
        )

        var allExternalIDSet = Set<String>()
        for token in selection.applicationTokens {
            if let externalID = stableExternalID(for: token) {
                allExternalIDSet.insert(externalID)
            }
        }
        if let reportApps = report?.apps {
            for usage in reportApps {
                allExternalIDSet.insert(usage.externalAppID)
            }
        }

        let allExternalIDs: [String] = allExternalIDSet.sorted { lhs, rhs in
            lhs < rhs
        }
        var bindingCodeByID: [String: String] = [:]
        for (index, externalID) in allExternalIDs.enumerated() {
            bindingCodeByID[externalID] = String(
                format: "%02d",
                index + 1
            )
        }

        var appRows: [[String: Any]] = []
        var includedIDs: Set<String> = []

        for token in selection.applicationTokens {
            guard let externalID = stableExternalID(for: token) else {
                continue
            }

            rememberToken(token, forExternalID: externalID)

            let setting = limitByToken[token]
            appRows.append([
                "id": externalID,
                "bindingCode": bindingCodeByID[externalID] ?? "",
                "name": appAliases[externalID] ?? "",
                "usedSeconds": usageByID[externalID] ?? 0,
                "limitMinutes": setting?.isEnabled == true
                    ? (setting?.minutes ?? 0)
                    : 0,
                "locked": lockedTokens.contains(token)
            ])
            includedIDs.insert(externalID)
        }

        for usage in report?.apps ?? []
            where !includedIDs.contains(usage.externalAppID) {
            appRows.append([
                "id": usage.externalAppID,
                "bindingCode": bindingCodeByID[usage.externalAppID] ?? "",
                "name": appAliases[usage.externalAppID] ?? "",
                "usedSeconds": usage.usedSeconds,
                "limitMinutes": 0,
                "locked": false
            ])
        }

        appRows.sort {
            (($0["id"] as? String) ?? "") <
            (($1["id"] as? String) ?? "")
        }

        let recentPoints = Array(
            loadFreshTodayPoints().suffix(8)
        )
        var footprintRows: [[String: Any]] = []

        for point in recentPoints {
            let place: String
            if resolvePlaceNames {
                place = await concretePlaceName(
                    latitude: point.latitude,
                    longitude: point.longitude,
                    preferred: point.placeName
                )
            } else {
                place = (point.placeName ?? "").isEmpty ? "最近位置" : (point.placeName ?? "")
            }
            footprintRows.append([
                "lat": point.latitude,
                "lng": point.longitude,
                "accuracy": point.horizontalAccuracy,
                "place": place,
                "ts": iso8601(point.timestamp)
            ])
        }

        let screenTime: [String: Any]
        if let report {
            let reportAge = max(
                0,
                Date().timeIntervalSince(report.generatedAt)
            )
            screenTime = [
                "reportAvailable": true,
                "reportFresh": reportAge < 180,
                "schema": report.schema,
                "requestID": report.requestID,
                "requestedAt": iso8601(report.requestedAt),
                "totalSeconds": report.totalSeconds,
                "generatedAt": iso8601(report.generatedAt),
                "reportAppCount": report.apps.count,
                "hasPositiveAppUsage": report.hasPositiveAppUsage,
                "apps": appRows
            ]
        } else {
            screenTime = [
                "reportAvailable": false,
                "reportFresh": false,
                "schema": 4,
                "requestID": "",
                "requestedAt": "",
                "totalSeconds": 0,
                "generatedAt": "",
                "reportAppCount": 0,
                "hasPositiveAppUsage": false,
                "apps": appRows
            ]
        }

        var snapshot: [String: Any] = [
            "schema": 2,
            "snapshotSequence": nextSnapshotSequence(),
            "controlOnly": controlOnly,
            "deviceId": deviceID(),
            "deviceName": UIDevice.current.name,
            "generatedAt": iso8601(Date()),
            "screenTime": screenTime,
            "footprints": footprintRows,
            "deviceTelemetry": wellnessService.deviceSnapshot()
        ]

        if wellnessService.healthSyncEnabled,
           let healthSnapshot = wellnessService.healthSnapshot {
            snapshot["health"] = healthSnapshot
        }

        if let location = locationManager.currentLocation {
            let place: String
            if resolvePlaceNames {
                place = await concretePlaceName(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude,
                    preferred: locationManager.currentPlaceName
                )
            } else {
                place = locationManager.currentPlaceName.isEmpty
                    ? "最近位置"
                    : locationManager.currentPlaceName
            }
            snapshot["location"] = [
                "lat": location.coordinate.latitude,
                "lng": location.coordinate.longitude,
                "accuracy": location.horizontalAccuracy,
                "place": place,
                "ts": iso8601(location.timestamp)
            ]
            lastPlaceName = place
        } else if let point = recentPoints.last {
            let place: String
            if resolvePlaceNames {
                place = await concretePlaceName(
                    latitude: point.latitude,
                    longitude: point.longitude,
                    preferred: point.placeName
                )
            } else {
                place = (point.placeName ?? "").isEmpty ? "最近位置" : (point.placeName ?? "")
            }
            snapshot["location"] = [
                "lat": point.latitude,
                "lng": point.longitude,
                "accuracy": point.horizontalAccuracy,
                "place": place,
                "ts": iso8601(point.timestamp)
            ]
            lastPlaceName = place
        } else {
            lastPlaceName = "尚未获取"
        }

        lastAppCount = appRows.count
        lastFootprintCount = footprintRows.count
        return snapshot
    }

    private func loadFreshTodayPoints() -> [FootprintPoint] {
        guard let data = UserDefaults.standard.data(
            forKey: footprintStorageKey
        ),
        let points = try? JSONDecoder().decode(
            [FootprintPoint].self,
            from: data
        ) else {
            return []
        }

        return points.filter {
            Calendar.current.isDateInToday($0.timestamp)
        }
    }

    private func processPendingCommandsSerialized(
        secret: String,
        locationManager: LocationManager,
        wellnessService: CompanionWellnessService
    ) async throws -> Int {
        // 同一个 App 进程里最多保留一个拉取/执行/回执流程，避免前台同步和
        // APNs 唤醒同时拿到同一条 pending 命令并重复执行。
        for _ in 0..<100 where commandSyncInFlight {
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        guard !commandSyncInFlight else {
            throw CompanionSyncError.message("上一轮命令仍在执行，请稍后重试")
        }
        commandSyncInFlight = true
        defer { commandSyncInFlight = false }
        return try await processPendingCommands(
            secret: secret,
            locationManager: locationManager,
            wellnessService: wellnessService
        )
    }

    private func processPendingCommands(
        secret: String,
        locationManager: LocationManager,
        wellnessService: CompanionWellnessService
    ) async throws -> Int {
        let rows: [RemoteCommandEnvelope] = try await rpc(
            "phone_companion_pull_commands",
            body: [
                "p_target": pairedTarget,
                "p_device_secret": secret
            ]
        )

        var appliedCount = 0

        for row in rows {
            let result: String
            do {
                result = try await applyRemoteCommand(
                    row.command,
                    locationManager: locationManager
                )
            } catch {
                let _: Bool = try await rpc(
                    "phone_companion_ack_command",
                    body: [
                        "p_target": pairedTarget,
                        "p_device_secret": secret,
                        "p_command_id": row.id,
                        "p_ok": false,
                        "p_result": [
                            "message": error.localizedDescription
                        ]
                    ]
                )
                commandStatusText = "失败：\(error.localizedDescription)"
                continue
            }

            let snapshot = await makeSnapshot(
                locationManager: locationManager,
                report: latestDirectUsageSnapshot,
                wellnessService: wellnessService,
                resolvePlaceNames: false,
                controlOnly: true
            )
            let completed: Bool = try await rpc(
                "phone_companion_complete_command",
                body: [
                    "p_target": pairedTarget,
                    "p_device_secret": secret,
                    "p_command_id": row.id,
                    "p_snapshot": snapshot,
                    "p_result": ["message": result]
                ]
            )
            guard completed else {
                throw CompanionSyncError.message(
                    "服务器未能原子保存命令回执与设备快照"
                )
            }
            appliedCount += 1
            commandStatusText = result
        }

        return appliedCount
    }

    private func applyRemoteCommand(
        _ command: RemoteCommand,
        locationManager: LocationManager
    ) async throws -> String {
        if command.action == "location" {
            locationManager.refreshCurrentLocation()
            locationRefreshRequested = true
            return "已请求刷新真实定位"
        }

        if command.action == "view" {
            return "已读取真实设备状态"
        }

        guard let externalID = command.externalAppId,
              let token = token(forExternalID: externalID) else {
            throw CompanionSyncError.message(
                "找不到外置稳定 ID 对应的 App"
            )
        }

        switch command.action {
        case "lock":
            guard screenTimeControlIsAuthorized() else {
                throw CompanionSyncError.message(
                    "屏幕使用时间控制权限不可用，未执行锁定"
                )
            }
            rememberShieldActor(command.actor)
            let previousTokens = manualLockStore.shield.applications ?? []
            var tokens = previousTokens
            tokens.insert(token)
            manualLockStore.shield.applications = tokens
            try await Task.sleep(nanoseconds: 120_000_000)
            guard (manualLockStore.shield.applications ?? []).contains(token) else {
                manualLockStore.shield.applications = previousTokens.isEmpty
                    ? nil
                    : previousTokens
                throw CompanionSyncError.message("系统未确认锁定，未发送成功回执")
            }
            saveLockedTokens(tokens)
            return "真实 App 已锁定并由系统设置读回确认"

        case "unlock":
            guard screenTimeControlIsAuthorized() else {
                throw CompanionSyncError.message(
                    "屏幕使用时间控制权限不可用，未执行解锁"
                )
            }
            let previousTokens = manualLockStore.shield.applications ?? []
            var tokens = previousTokens
            tokens.remove(token)
            manualLockStore.shield.applications =
                tokens.isEmpty ? nil : tokens
            try await Task.sleep(nanoseconds: 120_000_000)
            guard !(manualLockStore.shield.applications ?? []).contains(token) else {
                manualLockStore.shield.applications = previousTokens
                throw CompanionSyncError.message("系统未确认解锁，未发送成功回执")
            }
            saveLockedTokens(tokens)
            return "真实 App 已解锁并由系统设置读回确认"

        case "limit":
            rememberShieldActor(command.actor)
            let minutes = min(
                720,
                max(1, command.minutes ?? 1)
            )
            var settings = loadLimitSettings()
            settings.removeAll {
                stableExternalID(for: $0.token) == externalID
            }
            settings.append(
                SavedDailyLimitMirror(
                    token: token,
                    minutes: minutes,
                    isEnabled: true
                )
            )
            saveLimitSettings(settings)
            let persistedSettings = loadLimitSettings()
            guard let persisted = persistedSettings.first(where: {
                stableExternalID(for: $0.token) == externalID
            }),
            persisted.minutes == minutes,
            persisted.isEnabled else {
                throw CompanionSyncError.message(
                    "本机未能保存新的每日限额"
                )
            }
            try rebuildDailyLimitMonitoring(persistedSettings)
            NotificationCenter.default.post(
                name: .companionDailyLimitSettingsDidChange,
                object: nil
            )
            return "真实 App 每日限额已改为 \(minutes) 分钟并由本机存储读回确认"

        default:
            throw CompanionSyncError.message("不支持的角色指令")
        }
    }

    private func rememberShieldActor(_ rawActor: String?) {
        let trimmed = rawActor?.trimmingCharacters(
            in: .whitespacesAndNewlines
        ) ?? ""
        let actor = trimmed.isEmpty
            ? "绑定角色"
            : String(trimmed.prefix(24))
        sharedDefaults?.set(actor, forKey: shieldActorKey)
    }

    private func screenTimeControlIsAuthorized() -> Bool {
        if #available(iOS 26.0, *) {
            switch AuthorizationCenter.shared.authorizationStatus {
            case .approved, .approvedWithDataAccess:
                return true
            case .notDetermined, .denied:
                return false
            @unknown default:
                return false
            }
        }
        return AuthorizationCenter.shared.authorizationStatus == .approved
    }

    private func nextSnapshotSequence() -> Int64 {
        let previous = Int64(
            UserDefaults.standard.integer(forKey: snapshotSequenceKey)
        )
        let clock = Int64(Date().timeIntervalSince1970 * 1_000)
        let next = max(clock, previous + 1)
        UserDefaults.standard.set(
            NSNumber(value: next),
            forKey: snapshotSequenceKey
        )
        return next
    }

    private func rebuildDailyLimitMonitoring(
        _ settings: [SavedDailyLimitMirror]
    ) throws {
        activityCenter.stopMonitoring([.dailyAppLimits])
        dailyLimitStore.shield.applications = nil
        sharedDefaults?.removeObject(forKey: lockedLimitTokensKey)

        let enabled = settings.filter(\.isEnabled)
        guard !enabled.isEmpty else { return }

        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )

        var events: [
            DeviceActivityEvent.Name: DeviceActivityEvent
        ] = [:]

        for (index, setting) in enabled.enumerated() {
            let eventName = DeviceActivityEvent.Name(
                "dailyLimit_\(index)"
            )
            events[eventName] = DeviceActivityEvent(
                applications: [setting.token],
                categories: [],
                webDomains: [],
                threshold: DateComponents(
                    minute: setting.minutes
                )
            )

            if let tokenData = try? JSONEncoder().encode(
                setting.token
            ) {
                sharedDefaults?.set(
                    tokenData,
                    forKey: tokenKeyPrefix + eventName.rawValue
                )
            }
        }

        try activityCenter.startMonitoring(
            .dailyAppLimits,
            during: schedule,
            events: events
        )
    }

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    private func loadSelection() -> FamilyActivitySelection {
        guard let data = UserDefaults.standard.data(
            forKey: selectionKey
        ),
        let selection = try? JSONDecoder().decode(
            FamilyActivitySelection.self,
            from: data
        ) else {
            return FamilyActivitySelection()
        }
        return selection
    }

    private func loadLockedTokens() -> Set<ApplicationToken> {
        guard let data = UserDefaults.standard.data(
            forKey: lockedAppsKey
        ),
        let tokens = try? JSONDecoder().decode(
            Set<ApplicationToken>.self,
            from: data
        ) else {
            return []
        }
        return tokens
    }

    private func saveLockedTokens(
        _ tokens: Set<ApplicationToken>
    ) {
        if let data = try? JSONEncoder().encode(tokens) {
            UserDefaults.standard.set(data, forKey: lockedAppsKey)
        }
    }

    private func loadLimitSettings() -> [SavedDailyLimitMirror] {
        guard let data = sharedDefaults?.data(
            forKey: dailyLimitsKey
        ),
        let settings = try? JSONDecoder().decode(
            [SavedDailyLimitMirror].self,
            from: data
        ) else {
            return []
        }
        return settings
    }

    private func saveLimitSettings(
        _ settings: [SavedDailyLimitMirror]
    ) {
        if let data = try? JSONEncoder().encode(settings) {
            sharedDefaults?.set(data, forKey: dailyLimitsKey)
        }
    }

    private func token(
        forExternalID externalID: String
    ) -> ApplicationToken? {
        let selectedToken = loadSelection().applicationTokens.first {
            stableExternalID(for: $0) == externalID
        }
        if let selectedToken {
            rememberToken(selectedToken, forExternalID: externalID)
            return selectedToken
        }

        if let data = tokenRegistry()[externalID],
           let token = try? JSONDecoder().decode(
               ApplicationToken.self,
               from: data
           ) {
            return token
        }
        return nil
    }

    private func tokenRegistry() -> [String: Data] {
        UserDefaults.standard.dictionary(
            forKey: tokenRegistryKey
        ) as? [String: Data] ?? [:]
    }

    private func rememberToken(
        _ token: ApplicationToken,
        forExternalID externalID: String
    ) {
        guard let data = try? JSONEncoder().encode(token) else {
            return
        }
        var registry = tokenRegistry()
        registry[externalID] = data
        UserDefaults.standard.set(registry, forKey: tokenRegistryKey)
    }

    private func stableExternalID(
        for token: ApplicationToken
    ) -> String? {
        guard let tokenData = try? JSONEncoder().encode(token) else {
            return nil
        }

        let digest = SHA256.hash(data: tokenData)
        let hex = digest.map {
            String(format: "%02x", $0)
        }.joined()
        return "ios." + hex
    }

    private func concretePlaceName(
        latitude: Double,
        longitude: Double,
        preferred: String?
    ) async -> String {
        if let preferred,
           !preferred.isEmpty,
           preferred != "尚未解析具体位置",
           preferred != "已获取位置，暂未解析地址" {
            return preferred
        }

        let cacheKey = String(
            format: "%.4f,%.4f",
            latitude,
            longitude
        )
        var cache = UserDefaults.standard.dictionary(
            forKey: geocodeCacheKey
        ) as? [String: String] ?? [:]

        if let cached = cache[cacheKey] {
            return cached
        }

        let location = CLLocation(
            latitude: latitude,
            longitude: longitude
        )
        let geocoder = CLGeocoder()

        let resolved: String = await withCheckedContinuation {
            continuation in
            geocoder.reverseGeocodeLocation(
                location,
                preferredLocale: Locale(identifier: "zh_CN")
            ) { placemarks, _ in
                let name = Self.placeName(
                    from: placemarks?.first
                )
                continuation.resume(returning: name)
            }
        }

        cache[cacheKey] = resolved
        if cache.count > 200,
           let firstKey = cache.keys.first {
            cache.removeValue(forKey: firstKey)
        }
        UserDefaults.standard.set(cache, forKey: geocodeCacheKey)
        return resolved
    }

    private static func placeName(
        from placemark: CLPlacemark?
    ) -> String {
        guard let placemark else {
            return "地点解析暂不可用"
        }

        let parts = [
            placemark.administrativeArea,
            placemark.locality,
            placemark.subLocality,
            placemark.thoroughfare,
            placemark.subThoroughfare,
            placemark.name
        ]

        var result = ""
        for value in parts.compactMap({ $0 }) {
            let part = value.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            guard !part.isEmpty, !result.contains(part) else {
                continue
            }
            result += part
        }

        return result.isEmpty ? "地点解析暂不可用" : result
    }

    private func rpc<T: Decodable>(
        _ functionName: String,
        body: [String: Any]
    ) async throws -> T {
        let url = serverURL
            .appendingPathComponent("rest/v1/rpc")
            .appendingPathComponent(functionName)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue(
            publishableKey,
            forHTTPHeaderField: "apikey"
        )
        request.setValue(
            "Bearer \(publishableKey)",
            forHTTPHeaderField: "Authorization"
        )
        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )
        request.httpBody = try JSONSerialization.data(
            withJSONObject: body
        )

        let (data, response) = try await URLSession.shared.data(
            for: request
        )
        guard let http = response as? HTTPURLResponse else {
            throw CompanionSyncError.message("服务器没有返回 HTTP 状态")
        }

        guard 200..<300 ~= http.statusCode else {
            let object = try? JSONSerialization.jsonObject(
                with: data
            ) as? [String: Any]
            let message = object?["message"] as? String
                ?? String(data: data, encoding: .utf8)
                ?? "HTTP \(http.statusCode)"
            throw CompanionSyncError.message(message)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func deviceID() -> String {
        if let saved = UserDefaults.standard.string(
            forKey: savedDeviceIDKey
        ), !saved.isEmpty {
            return saved
        }

        let id = UIDevice.current.identifierForVendor?.uuidString
            ?? UUID().uuidString
        UserDefaults.standard.set(id, forKey: savedDeviceIDKey)
        return id
    }

    private func randomSecret() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = bytes.withUnsafeMutableBufferPointer { buffer in
            guard let address = buffer.baseAddress else {
                return errSecParam
            }
            return SecRandomCopyBytes(
                kSecRandomDefault,
                buffer.count,
                address
            )
        }
        if status != errSecSuccess {
            return UUID().uuidString + UUID().uuidString
        }

        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func iso8601(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    private func setError(_ message: String) {
        hasError = true
        statusText = message
    }
}

private enum CompanionSecretStore {
    private static let service =
        "com.qianyi.PhoneCompanionTest.secure-sync"

    static func load(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(
            query as CFDictionary,
            &item
        )
        guard status == errSecSuccess,
              let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func save(
        _ secret: String,
        account: String
    ) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)

        var item = query
        item[kSecValueData as String] = Data(secret.utf8)
        item[kSecAttrAccessible as String] =
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw CompanionSyncError.message(
                "无法安全保存设备凭据（\(status)）"
            )
        }
    }
}

private enum CompanionSyncError: LocalizedError {
    case message(String)

    var errorDescription: String? {
        switch self {
        case .message(let message):
            return message
        }
    }
}
