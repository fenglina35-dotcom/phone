import Combine
import SwiftUI
import UIKit
import UserNotifications

@main
struct PhoneCompanionTestApp: App {
    @UIApplicationDelegateAdaptor(CompanionPushAppDelegate.self)
    private var pushDelegate

    var body: some Scene {
        WindowGroup {
            SmallPhonePrivateRootView()
        }
    }
}

@MainActor
final class CompanionPushCoordinator: ObservableObject {
    static let shared = CompanionPushCoordinator()

    typealias BackgroundWakeHandler =
        @MainActor () async -> UIBackgroundFetchResult

    static let tokenDefaultsKey = "companion.push.token.v1"
    static let environmentDefaultsKey = "companion.push.environment.v1"

    @Published private(set) var deviceToken =
        UserDefaults.standard.string(forKey: tokenDefaultsKey) ?? ""
    @Published private(set) var statusText = "尚未开启后台通知"
    @Published private(set) var wakeSequence = 0

    private var backgroundCompletions:
        [(UIBackgroundFetchResult) -> Void] = []
    private var backgroundWakeHandler: BackgroundWakeHandler?
    private var wakeTask: Task<Void, Never>?
    private var wakeTimeoutTask: Task<Void, Never>?
    private var pendingWakeCount = 0

    var environment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    func refreshAuthorizationStatus() async {
        // Keep APNs registration current, but report visible alert permission
        // honestly because proactive messages and calls require sound + banner.
        UIApplication.shared.registerForRemoteNotifications()
        let settings = await UNUserNotificationCenter.current()
            .notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            statusText = deviceToken.isEmpty
                ? "通知已允许，正在登记设备"
                : "后台通知已开启"
            UIApplication.shared.registerForRemoteNotifications()
        case .denied:
            statusText = "通知被关闭，请到系统设置中允许声音与横幅"
        case .notDetermined:
            statusText = "尚未开启消息与来电通知"
        @unknown default:
            statusText = "通知状态未知"
        }
    }

    func requestAuthorization() async {
        statusText = "正在请求消息与来电通知权限"
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            statusText = granted
                ? "通知已允许，正在登记设备"
                : "通知未允许，请到系统设置中开启"
        } catch {
            statusText = "通知授权失败：\(error.localizedDescription)"
        }
        UIApplication.shared.registerForRemoteNotifications()
        await refreshAuthorizationStatus()
    }

    func updateDeviceToken(_ data: Data) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        guard !token.isEmpty else { return }
        deviceToken = token
        statusText = "后台通知已开启"
        UserDefaults.standard.set(token, forKey: Self.tokenDefaultsKey)
        UserDefaults.standard.set(
            environment,
            forKey: Self.environmentDefaultsKey
        )
    }

    func registrationFailed(_ error: Error) {
        statusText = "设备登记失败：\(error.localizedDescription)"
    }

    func setBackgroundWakeHandler(
        _ handler: @escaping BackgroundWakeHandler
    ) {
        backgroundWakeHandler = handler
    }

    func receiveBackgroundWake(
        completion: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        backgroundCompletions.append(completion)
        pendingWakeCount += 1
        wakeSequence += 1

        guard wakeTask == nil else { return }

        wakeTimeoutTask?.cancel()
        wakeTimeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 25_000_000_000)
            guard let self, !Task.isCancelled else { return }
            self.wakeTask?.cancel()
            self.wakeTask = nil
            self.pendingWakeCount = 0
            self.finishBackgroundWake(.noData)
        }

        wakeTask = Task { [weak self] in
            guard let self else { return }
            var finalResult: UIBackgroundFetchResult = .noData

            // A silent push can arrive before SwiftUI finishes constructing
            // the sync view. Give the view a short window to register the
            // direct handler instead of acknowledging and losing the wake.
            for _ in 0..<30 where self.backgroundWakeHandler == nil {
                do {
                    try await Task.sleep(nanoseconds: 100_000_000)
                } catch {
                    return
                }
            }

            while self.pendingWakeCount > 0, !Task.isCancelled {
                self.pendingWakeCount = 0
                if let handler = self.backgroundWakeHandler {
                    let result = await handler()
                    switch result {
                    case .newData:
                        finalResult = .newData
                    case .failed:
                        switch finalResult {
                        case .newData:
                            break
                        default:
                            finalResult = .failed
                        }
                    case .noData:
                        break
                    @unknown default:
                        break
                    }
                }
            }

            guard !Task.isCancelled else { return }
            self.wakeTimeoutTask?.cancel()
            self.wakeTimeoutTask = nil
            self.wakeTask = nil
            self.finishBackgroundWake(finalResult)
        }
    }

    func finishBackgroundWake(_ result: UIBackgroundFetchResult) {
        let callbacks = backgroundCompletions
        backgroundCompletions.removeAll()
        callbacks.forEach { $0(result) }
    }
}

final class CompanionPushAppDelegate: NSObject,
    UIApplicationDelegate,
    UNUserNotificationCenterDelegate {

    private var urgentBatteryObserver: NSObjectProtocol?
    private var urgentBatterySyncTask: Task<Void, Never>?
    private var foregroundSyncInFlight = false
    private var lastForegroundSyncAt = Date.distantPast
    private var diagnosticLifecycleObservers: [NSObjectProtocol] = []
    private static let diagnosticSessionKey =
        "smallPhone.diagnostics.previousSession.v1"
    private static let diagnosticPhaseKey =
        "smallPhone.diagnostics.previousPhase.v1"
    private static let diagnosticPhaseAtKey =
        "smallPhone.diagnostics.previousPhaseAt.v1"
    private static let diagnosticPIDKey =
        "smallPhone.diagnostics.previousPID.v1"

    private func diagnosticLaunchKind(
        _ launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> String {
        guard let launchOptions, !launchOptions.isEmpty else { return "none" }
        if launchOptions[.remoteNotification] != nil {
            return "remote-notification"
        }
        if launchOptions[.location] != nil { return "location" }
        if launchOptions[.url] != nil { return "url" }
        if launchOptions[.shortcutItem] != nil { return "shortcut" }
        return "other"
    }

    private func recordDiagnosticLifecycle(_ phase: String) {
        let defaults = UserDefaults.standard
        let at = Int64(Date().timeIntervalSince1970 * 1_000)
        let pid = ProcessInfo.processInfo.processIdentifier
        defaults.set(
            SmallPhoneDiagnosticsStore.processSessionID,
            forKey: Self.diagnosticSessionKey
        )
        defaults.set(phase, forKey: Self.diagnosticPhaseKey)
        defaults.set(at, forKey: Self.diagnosticPhaseAtKey)
        defaults.set(pid, forKey: Self.diagnosticPIDKey)
        SmallPhoneDiagnosticsStore.append(
            "native.app.phase",
            fields: [
                "phase": phase,
                "pid": pid,
                "processSessionID": SmallPhoneDiagnosticsStore.processSessionID
            ]
        )
    }

    private func installDiagnosticLifecycleObservers() {
        guard diagnosticLifecycleObservers.isEmpty else { return }
        let center = NotificationCenter.default
        let phases: [(Notification.Name, String)] = [
            (UIApplication.didBecomeActiveNotification, "active"),
            (UIApplication.willResignActiveNotification, "resign-active"),
            (UIApplication.didEnterBackgroundNotification, "background"),
            (UIApplication.willEnterForegroundNotification, "foreground"),
            (UIApplication.willTerminateNotification, "terminated")
        ]
        diagnosticLifecycleObservers = phases.map { name, phase in
            center.addObserver(
                forName: name,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.recordDiagnosticLifecycle(phase)
            }
        }
    }

    private func recordDiagnosticLaunch(
        _ launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) {
        let defaults = UserDefaults.standard
        let previousSession = defaults.string(
            forKey: Self.diagnosticSessionKey
        ) ?? ""
        let previousPhase = defaults.string(
            forKey: Self.diagnosticPhaseKey
        ) ?? ""
        let previousAt = Int64(
            defaults.double(forKey: Self.diagnosticPhaseAtKey)
        )
        let previousPID = defaults.integer(forKey: Self.diagnosticPIDKey)
        let now = Int64(Date().timeIntervalSince1970 * 1_000)
        let previousAgeMs = previousAt > 0
            ? max(0, min(86_400_000, now - previousAt)) : 0
        let previousExit: String
        switch previousPhase {
        case "": previousExit = "none"
        case "terminated": previousExit = "clean"
        case "background": previousExit = "prior-background"
        default: previousExit = "unclean-or-force-close"
        }
        SmallPhoneDiagnosticsStore.append(
            "native.app.launch",
            fields: [
                "launchKind": diagnosticLaunchKind(launchOptions),
                "previousExit": previousExit,
                "previousPhase": previousPhase,
                "previousAgeMs": previousAgeMs,
                "previousPID": previousPID,
                "previousSessionID": previousSession,
                "pid": ProcessInfo.processInfo.processIdentifier
            ]
        )
        recordDiagnosticLifecycle("launching")
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions:
            [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        recordDiagnosticLaunch(launchOptions)
        // A terminated process cannot still own a live web call. Clear a stale
        // marker before foreground notification presentation is enabled.
        UserDefaults.standard.set(
            false,
            forKey: PhoneNativeBridge.roleCallActiveDefaultsKey
        )
        // This SwiftUI app owns a generated scene manifest. UIApplication's
        // legacy delegate phase callbacks are not guaranteed for scene-based
        // lifecycle, while these application notifications remain available.
        installDiagnosticLifecycleObservers()
        UNUserNotificationCenter.current().delegate = self
        Task { @MainActor in
            urgentBatteryObserver = NotificationCenter.default.addObserver(
                forName: .companionUrgentBatterySnapshotRequested,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.synchronizeUrgentBatterySnapshot()
                }
            }
            // Construct the observer-backed reader only after the global
            // upload listener is ready, including when the management sheet
            // has never been opened.
            _ = CompanionWellnessService.shared
            ScreenShareCoordinator.shared.clearOrphanedBroadcastState()
            ScreenShareCoordinator.shared.setHostForeground(true)
            await clearAppBadge()
            CompanionPushCoordinator.shared.setBackgroundWakeHandler {
                let service = CompanionSyncService.shared
                guard service.isPaired else {
                    return .noData
                }

                await CompanionWellnessService.shared.refresh()
                let didSynchronize = await service.synchronize(
                    locationManager: LocationManager.shared,
                    wellnessService: CompanionWellnessService.shared,
                    quiet: true,
                    refreshUsage: true
                )
                return didSynchronize ? .newData : .failed
            }
            await CompanionPushCoordinator.shared
                .refreshAuthorizationStatus()
        }
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        requestRolePushSync()
        Task { @MainActor [weak self] in
            await self?.synchronizeForegroundIfNeeded()
        }
    }

    @MainActor
    private func synchronizeForegroundIfNeeded() async {
        ScreenShareCoordinator.shared.clearOrphanedBroadcastState()
        ScreenShareCoordinator.shared.setHostForeground(true)
        guard !foregroundSyncInFlight,
              Date().timeIntervalSince(lastForegroundSyncAt) >= 30 else {
            return
        }
        foregroundSyncInFlight = true
        lastForegroundSyncAt = Date()
        defer { foregroundSyncInFlight = false }
        await clearAppBadge()
        await synchronizeCurrentSnapshotIfPaired()
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        Task { @MainActor in
            ScreenShareCoordinator.shared.setHostForeground(false)
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        Task { @MainActor in
            // Preserve the external frame until the web call consumes it;
            // only the foreground flag changes here.
            UserDefaults(suiteName: ScreenShareCoordinator.appGroup)?.set(
                true,
                forKey: "screenShare.hostForeground.v1"
            )
        }
    }

    @MainActor
    private func synchronizeUrgentBatterySnapshot() {
        urgentBatterySyncTask?.cancel()
        urgentBatterySyncTask = Task { [weak self] in
            guard let self else { return }
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self.synchronizeCurrentSnapshotIfPaired()
        }
    }

    @MainActor
    private func synchronizeCurrentSnapshotIfPaired() async {
        let service = CompanionSyncService.shared
        guard service.isPaired else { return }
        await CompanionWellnessService.shared.refresh()
        _ = await service.synchronize(
            locationManager: LocationManager.shared,
            wellnessService: CompanionWellnessService.shared,
            quiet: true,
            refreshUsage: false
        )
    }

    @MainActor
    private func clearAppBadge() async {
        do {
            try await UNUserNotificationCenter.current().setBadgeCount(0)
        } catch {
            // setBadgeCount is the supported iOS 17+ API. A failure is
            // nonfatal and must not fall back to the deprecated property.
        }
    }

    private func requestRolePushSync() {
        DispatchQueue.main.async {
            UserDefaults.standard.set(
                true,
                forKey: "smallPhone.pendingRolePushSync.v1"
            )
            NotificationCenter.default.post(
                name: Notification.Name("SmallPhoneRolePushSyncRequested"),
                object: nil
            )
        }
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            CompanionPushCoordinator.shared.updateDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            CompanionPushCoordinator.shared.registrationFailed(error)
        }
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler:
            @escaping (UIBackgroundFetchResult) -> Void
    ) {
        if userInfo["rolePush"] != nil {
            requestRolePushSync()
        }
        Task { @MainActor in
            CompanionPushCoordinator.shared.receiveBackgroundWake(
                completion: completionHandler
            )
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        await clearAppBadge()
        if notification.request.content.userInfo["rolePush"] != nil {
            requestRolePushSync()
            if UserDefaults.standard.bool(
                forKey: PhoneNativeBridge.roleCallActiveDefaultsKey
            ) {
                // Ask the web layer to consume a raced ordinary scheduled row,
                // but never interrupt an active role call with banner or sound.
                // Explicit durable feature events keep their own delivery rules.
                return []
            }
        }
        return [.banner, .list, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        await clearAppBadge()
        if #available(iOS 26.0, *),
           let alarm = response.notification.request.content
            .userInfo["smallPhoneAlarm"] as? [String: Any] {
            await MainActor.run {
                NativeAlarmService.shared.recordInteractedRoleAlarm(
                    alarm,
                    deliveredAt: response.notification.date
                )
            }
        }
        guard let rolePush = response.notification.request.content
            .userInfo["rolePush"] as? [String: Any],
              let roleID = rolePush["roleId"] as? String,
              !roleID.isEmpty else { return }
        let route: [String: String] = [
            "roleId": roleID,
            "kind": rolePush["kind"] as? String ?? "message",
            "callKind": rolePush["callKind"] as? String ?? "",
            "source": "notificationTap",
            "nonce": UUID().uuidString,
            "tappedAt": String(Int64(Date().timeIntervalSince1970 * 1000))
        ]
        await MainActor.run {
            UserDefaults.standard.set(
                route,
                forKey: "smallPhone.pendingRolePushRoute.v1"
            )
            NotificationCenter.default.post(
                name: Notification.Name("SmallPhoneRolePushTapped"),
                object: nil
            )
        }
    }
}
