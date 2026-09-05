import Foundation
import SwiftUI
import UIKit
import WebKit

struct LocalPhoneWebView: UIViewRepresentable {
    let onOpenDeviceManagement: () -> Void
    let onRecoveryNeeded: (String) -> Void
    let onRecoveryRestartReady: (Bool) -> Void
    let onRecoveryContinued: () -> Void
    static let recoveryRestartRequested = Notification.Name(
        "SmallPhoneNativeRecoveryRestartRequested"
    )
    static let recoveryContinueRequested = Notification.Name(
        "SmallPhoneNativeRecoveryContinueRequested"
    )
    private static let processSessionID =
        String(UUID().uuidString.prefix(8))
    private static let offlineKeyboardScopeHandlerName =
        "smallPhoneOfflineKeyboardScope"

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate,
        WKScriptMessageHandler {
        let bridge = PhoneNativeBridge()
        private weak var keyboardWebView: WKWebView?
        private var offlineFocusRequested = false
        let onRecoveryNeeded: (String) -> Void
        let onRecoveryRestartReady: (Bool) -> Void
        let onRecoveryContinued: () -> Void
        let coordinatorID = String(UUID().uuidString.prefix(8))
        private var webViewID = ""
        private var didLoadPhone = false
        private var recoveryNoticeActive = false
        private var responsivenessProbeToken = 0
        private var openingRolePush = false
        private var syncingRolePush = false
        private var rolePushSyncRetryCount = 0
        private var pendingRolePushSyncRetry: DispatchWorkItem?
        private var pendingWebContentRecovery: DispatchWorkItem?
        private var pendingStableWebContentReset: DispatchWorkItem?
        private var pendingResponsivenessProbe: DispatchWorkItem?
        private var pendingResponsivenessTimeout: DispatchWorkItem?
        private var pendingRecoveryRestartTimeout: DispatchWorkItem?
        private var recoveryRestartInFlight = false
        private var recoveryRestartToken = 0
        private var automaticWebContentRecoveryToken = 0
        private var bundledFileURL: URL?
        private var bundledReadAccessURL: URL?
        private var lastSafeAreaInsets: UIEdgeInsets?
        init(
            onRecoveryNeeded: @escaping (String) -> Void,
            onRecoveryRestartReady: @escaping (Bool) -> Void,
            onRecoveryContinued: @escaping () -> Void
        ) {
            self.onRecoveryNeeded = onRecoveryNeeded
            self.onRecoveryRestartReady = onRecoveryRestartReady
            self.onRecoveryContinued = onRecoveryContinued
            super.init()
            SmallPhoneDiagnosticsStore.append(
                "native.coordinator.init",
                fields: [
                    "coordinatorID": coordinatorID,
                    "processSessionID": LocalPhoneWebView.processSessionID,
                    "pid": ProcessInfo.processInfo.processIdentifier,
                    "thermalState": Self.thermalStateName()
                ]
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(deviceOrientationChanged),
                name: UIDevice.orientationDidChangeNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(rolePushTapped),
                name: Notification.Name("SmallPhoneRolePushTapped"),
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(rolePushSyncRequested),
                name: Notification.Name("SmallPhoneRolePushSyncRequested"),
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(thermalStateChanged),
                name: ProcessInfo.thermalStateDidChangeNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(memoryWarningReceived),
                name: UIApplication.didReceiveMemoryWarningNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(applicationWillResignActive),
                name: UIApplication.willResignActiveNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(applicationDidBecomeActive),
                name: UIApplication.didBecomeActiveNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(recoveryRestartRequested(_:)),
                name: LocalPhoneWebView.recoveryRestartRequested,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(recoveryContinueRequested),
                name: LocalPhoneWebView.recoveryContinueRequested,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(offlineKeyboardWillChangeFrame(_:)),
                name: UIResponder.keyboardWillChangeFrameNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(offlineKeyboardDidHide(_:)),
                name: UIResponder.keyboardDidHideNotification,
                object: nil
            )
        }

        deinit {
            SmallPhoneDiagnosticsStore.append(
                "native.coordinator.deinit",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID
                ]
            )
            pendingWebContentRecovery?.cancel()
            pendingStableWebContentReset?.cancel()
            pendingResponsivenessProbe?.cancel()
            pendingResponsivenessTimeout?.cancel()
            pendingRecoveryRestartTimeout?.cancel()
            pendingRolePushSyncRetry?.cancel()
            NotificationCenter.default.removeObserver(self)
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == LocalPhoneWebView.offlineKeyboardScopeHandlerName,
                  let payload = message.body as? [String: Any],
                  let focused = payload["focused"] as? Bool else {
                return
            }
            setOfflineComposerFocused(
                focused,
                switchToAnotherEditor:
                    payload["switchToAnotherEditor"] as? Bool ?? false
            )
        }

        func bindOfflineKeyboardScope(to webView: WKWebView) {
            keyboardWebView = webView
        }

        func unbindOfflineKeyboardScope() {
            restoreOuterWebViewScrolling()
            offlineFocusRequested = false
            keyboardWebView = nil
        }

        private func setOfflineComposerFocused(
            _ focused: Bool,
            switchToAnotherEditor: Bool
        ) {
            offlineFocusRequested = focused
            if focused {
                suspendOuterWebViewScrolling()
            } else if switchToAnotherEditor {
                restoreOuterWebViewScrolling()
            }
        }

        @objc private func offlineKeyboardWillChangeFrame(
            _ notification: Notification
        ) {
            guard offlineFocusRequested else { return }
            suspendOuterWebViewScrolling()
        }

        @objc private func offlineKeyboardDidHide(
            _ notification: Notification
        ) {
            restoreOuterWebViewScrolling()
        }

        private func suspendOuterWebViewScrolling() {
            guard let scrollView = keyboardWebView?.scrollView,
                  scrollView.isScrollEnabled else { return }
            // The full-screen offline scene owns its inner message scroller.
            // Disabling only WKWebView's outer scroll prevents WebKit from
            // adding a second automatic focus scroll while SwiftUI moves the
            // whole web surface with the keyboard. Do not rewrite contentOffset.
            scrollView.isScrollEnabled = false
        }

        private func restoreOuterWebViewScrolling() {
            guard let scrollView = keyboardWebView?.scrollView,
                  !scrollView.isScrollEnabled else { return }
            scrollView.isScrollEnabled = true
        }

        func configureBundledPage(
            fileURL: URL,
            readAccessURL: URL
        ) {
            bundledFileURL = fileURL
            bundledReadAccessURL = readAccessURL
        }

        @objc private func deviceOrientationChanged() {
            guard let webView = bridge.webView else { return }
            DispatchQueue.main.async { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.updateSafeArea(in: webView)
            }
        }

        @objc private func rolePushTapped() {
            openPendingRolePushIfReady()
        }

        @objc private func rolePushSyncRequested() {
            rolePushSyncRetryCount = 0
            pendingRolePushSyncRetry?.cancel()
            pendingRolePushSyncRetry = nil
            syncPendingRolePushIfReady()
        }

        @objc private func recoveryContinueRequested() {
            guard recoveryNoticeActive, !recoveryRestartInFlight else { return }
            cancelAutomaticWebContentRecovery()
            recoveryNoticeActive = false
            if bridge.webView != nil {
                didLoadPhone = true
                scheduleResponsivenessProbe(after: 4)
            }
            SmallPhoneDiagnosticsStore.append(
                "native.recovery.continueWaiting",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID
                ]
            )
            DispatchQueue.main.async { [onRecoveryContinued] in
                onRecoveryContinued()
            }
        }

        @objc private func recoveryRestartRequested(_ notification: Notification) {
            guard recoveryNoticeActive, !recoveryRestartInFlight else { return }
            let inspectArchive = notification.userInfo?["inspectArchive"] as? Bool == true
            let thermalState = Self.thermalStateName()
            guard thermalState != "serious", thermalState != "critical" else {
                DispatchQueue.main.async { [onRecoveryNeeded] in
                    onRecoveryNeeded(
                        "系统仍处于严重发热状态，已阻止反复重开。请先继续等待手机降温；聊天、图片和密钥都不会被清除。"
                    )
                }
                return
            }
            prepareRecoveryRestart(inspectArchive: inspectArchive)
        }

        private func prepareRecoveryRestart(inspectArchive: Bool) {
            cancelAutomaticWebContentRecovery()
            guard let webView = bridge.webView else {
                onRecoveryRestartReady(inspectArchive)
                return
            }
            recoveryRestartInFlight = true
            recoveryRestartToken += 1
            let token = recoveryRestartToken
            SmallPhoneDiagnosticsStore.append(
                "native.recovery.flush.begin",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "inspectArchive": inspectArchive
                ]
            )
            let finish: () -> Void = { [weak self] in
                DispatchQueue.main.async {
                    guard let self,
                          self.recoveryRestartInFlight,
                          self.recoveryRestartToken == token else { return }
                    self.recoveryRestartInFlight = false
                    self.pendingRecoveryRestartTimeout?.cancel()
                    self.pendingRecoveryRestartTimeout = nil
                    let thermalState = Self.thermalStateName()
                    let appIsActive =
                        UIApplication.shared.applicationState == .active
                    guard appIsActive,
                          thermalState == "nominal" ||
                            thermalState == "fair" else {
                        SmallPhoneDiagnosticsStore.append(
                            "native.recovery.restartDeferred",
                            fields: [
                                "coordinatorID": self.coordinatorID,
                                "webViewID": self.webViewID,
                                "inspectArchive": inspectArchive,
                                "thermalState": thermalState,
                                "appIsActive": appIsActive
                            ]
                        )
                        let reason = appIsActive
                            ? "保存等待期间系统温度再次升高，已取消本次重开，避免继续发热。请继续等待降温后再试。"
                            : "保存等待期间 App 已离开前台，已取消本次重开。回到小手机后再决定是否安全重开。"
                        self.onRecoveryNeeded(reason)
                        return
                    }
                    SmallPhoneDiagnosticsStore.append(
                        "native.recovery.flush.end",
                        fields: [
                            "coordinatorID": self.coordinatorID,
                            "webViewID": self.webViewID,
                            "inspectArchive": inspectArchive
                        ]
                    )
                    self.onRecoveryRestartReady(inspectArchive)
                }
            }
            let timeout = DispatchWorkItem(block: finish)
            pendingRecoveryRestartTimeout = timeout
            DispatchQueue.main.asyncAfter(
                deadline: .now() + 8,
                execute: timeout
            )
            webView.callAsyncJavaScript(
                """
                try {
                  if (typeof window.saveNowAsync === 'function') {
                    return await window.saveNowAsync();
                  }
                  if (typeof window.saveNow === 'function') {
                    return !!window.saveNow();
                  }
                  return true;
                } catch (_) {
                  return false;
                }
                """,
                arguments: [:],
                in: nil,
                in: .page,
                completionHandler: { _ in
                    finish()
                }
            )
        }

        @objc private func thermalStateChanged() {
            sendNativePressure(memoryWarning: false)
        }

        @objc private func memoryWarningReceived() {
            sendNativePressure(memoryWarning: true)
        }

        @objc private func applicationWillResignActive() {
            responsivenessProbeToken += 1
            pendingResponsivenessProbe?.cancel()
            pendingResponsivenessProbe = nil
            pendingResponsivenessTimeout?.cancel()
            pendingResponsivenessTimeout = nil
        }

        @objc private func applicationDidBecomeActive() {
            guard didLoadPhone, !recoveryNoticeActive else { return }
            scheduleResponsivenessProbe(after: 4)
        }

        private func sendNativePressure(memoryWarning: Bool) {
            guard didLoadPhone, let webView = bridge.webView else { return }
            let state = Self.thermalStateName()
            SmallPhoneDiagnosticsStore.append(
                memoryWarning ? "native.memory.warning" : "native.thermal.sample",
                fields: [
                    "thermalState": state,
                    "memoryWarning": memoryWarning ? 1 : 0
                ]
            )
            let script = "window.__smallPhoneNativePressure && window.__smallPhoneNativePressure({thermalState:'\(state)',memoryWarning:\(memoryWarning ? "true" : "false")});"
            DispatchQueue.main.async { [weak webView] in
                webView?.evaluateJavaScript(script)
            }
        }

        func recordWebViewMade() {
            // A diagnostic token is safer than exposing or depending on a
            // process address, and remains enough to detect duplicate views.
            webViewID = String(UUID().uuidString.prefix(8))
            SmallPhoneDiagnosticsStore.append(
                "native.webview.make",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID
                ]
            )
        }

        func recordWebViewDismantled() {
            didLoadPhone = false
            pendingWebContentRecovery?.cancel()
            pendingStableWebContentReset?.cancel()
            pendingResponsivenessProbe?.cancel()
            pendingResponsivenessTimeout?.cancel()
            pendingRecoveryRestartTimeout?.cancel()
            recoveryRestartInFlight = false
            SmallPhoneDiagnosticsStore.append(
                "native.webview.dismantle",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID
                ]
            )
        }

        private static func thermalStateName() -> String {
            switch ProcessInfo.processInfo.thermalState {
            case .nominal: return "nominal"
            case .fair: return "fair"
            case .serious: return "serious"
            case .critical: return "critical"
            @unknown default: return "unknown"
            }
        }

        private func offerNativeRecovery(
            reason: String,
            event: String
        ) {
            guard !recoveryNoticeActive else { return }
            recoveryNoticeActive = true
            pendingWebContentRecovery?.cancel()
            pendingWebContentRecovery = nil
            pendingStableWebContentReset?.cancel()
            pendingStableWebContentReset = nil
            pendingResponsivenessProbe?.cancel()
            pendingResponsivenessProbe = nil
            pendingResponsivenessTimeout?.cancel()
            pendingResponsivenessTimeout = nil
            SmallPhoneDiagnosticsStore.append(
                event,
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID,
                    "thermalState": Self.thermalStateName()
                ]
            )
            DispatchQueue.main.async { [onRecoveryNeeded] in
                onRecoveryNeeded(reason)
            }
        }

        private func scheduleResponsivenessProbe(
            after delay: TimeInterval = 8
        ) {
            guard didLoadPhone, !recoveryNoticeActive else { return }
            pendingResponsivenessProbe?.cancel()
            let work = DispatchWorkItem { [weak self] in
                self?.runResponsivenessProbe()
            }
            pendingResponsivenessProbe = work
            DispatchQueue.main.asyncAfter(
                deadline: .now() + delay,
                execute: work
            )
        }

        private func runResponsivenessProbe() {
            pendingResponsivenessProbe = nil
            guard didLoadPhone, !recoveryNoticeActive else { return }
            guard UIApplication.shared.applicationState == .active,
                  let webView = bridge.webView else { return }
            responsivenessProbeToken += 1
            let token = responsivenessProbeToken
            pendingResponsivenessTimeout?.cancel()
            let timeout = DispatchWorkItem { [weak self] in
                guard let self,
                      self.didLoadPhone,
                      !self.recoveryNoticeActive,
                      self.responsivenessProbeToken == token,
                      UIApplication.shared.applicationState == .active else {
                    return
                }
                self.offerNativeRecovery(
                    reason: "小手机页面已连续 6 秒没有响应。私人 App 已停止自动重载；你可以继续等待它自行恢复，或在手机降温后安全重开。",
                    event: "native.responsiveness.timeout"
                )
            }
            pendingResponsivenessTimeout = timeout
            DispatchQueue.main.asyncAfter(
                deadline: .now() + 6,
                execute: timeout
            )
            webView.evaluateJavaScript("void 0") { [weak self] _, error in
                DispatchQueue.main.async {
                    guard let self,
                          self.responsivenessProbeToken == token,
                          UIApplication.shared.applicationState == .active else {
                        return
                    }
                    self.pendingResponsivenessTimeout?.cancel()
                    self.pendingResponsivenessTimeout = nil
                    if error != nil {
                        self.didLoadPhone = false
                        self.offerNativeRecovery(
                            reason: "小手机页面进程当前不可用。原始数据没有清除；可以继续等待，或在手机降温后安全重开。",
                            event: "native.responsiveness.unavailable"
                        )
                        return
                    }
                    if self.didLoadPhone && !self.recoveryNoticeActive {
                        self.scheduleResponsivenessProbe()
                    }
                }
            }
        }

        private func syncPendingRolePushIfReady() {
            guard didLoadPhone,
                  !syncingRolePush,
                  UserDefaults.standard.bool(
                    forKey: "smallPhone.pendingRolePushSync.v1"
                  ),
                  let webView = bridge.webView else { return }
            syncingRolePush = true
            let script = "return await (window.__smallPhoneSyncRolePush ? window.__smallPhoneSyncRolePush() : false);"
            webView.callAsyncJavaScript(
                script,
                arguments: [:],
                in: nil,
                in: .page,
                completionHandler: { [weak self] result in
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.syncingRolePush = false
                    if case .success(let value) = result,
                       (value as? Bool) == true {
                        self.rolePushSyncRetryCount = 0
                        self.pendingRolePushSyncRetry?.cancel()
                        self.pendingRolePushSyncRetry = nil
                        UserDefaults.standard.removeObject(
                            forKey: "smallPhone.pendingRolePushSync.v1"
                        )
                    } else {
                        self.scheduleRolePushSyncRetry()
                    }
                }
                }
            )
        }

        private func scheduleRolePushSyncRetry() {
            guard UserDefaults.standard.bool(
                forKey: "smallPhone.pendingRolePushSync.v1"
            ) else { return }
            let delays: [TimeInterval] = [1, 3, 7, 15]
            guard rolePushSyncRetryCount < delays.count else { return }
            let delay = delays[rolePushSyncRetryCount]
            rolePushSyncRetryCount += 1
            pendingRolePushSyncRetry?.cancel()
            let work = DispatchWorkItem { [weak self] in
                self?.pendingRolePushSyncRetry = nil
                self?.syncPendingRolePushIfReady()
            }
            pendingRolePushSyncRetry = work
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
        }

        private func openPendingRolePushIfReady() {
            guard didLoadPhone, let webView = bridge.webView,
                  let route = UserDefaults.standard.dictionary(
                    forKey: "smallPhone.pendingRolePushRoute.v1"
                  ) as? [String: String] else { return }
            let now = Int64(Date().timeIntervalSince1970 * 1000)
            guard route["source"] == "notificationTap",
                  let nonce = route["nonce"], !nonce.isEmpty,
                  let tappedAtText = route["tappedAt"],
                  let tappedAt = Int64(tappedAtText),
                  abs(now - tappedAt) <= 120_000 else {
                UserDefaults.standard.removeObject(
                    forKey: "smallPhone.pendingRolePushRoute.v1"
                )
                return
            }
            guard !openingRolePush,
                  JSONSerialization.isValidJSONObject(route),
                  let data = try? JSONSerialization.data(withJSONObject: route),
                  let json = String(data: data, encoding: .utf8) else { return }
            openingRolePush = true
            let script = "window.__smallPhoneOpenRolePush && window.__smallPhoneOpenRolePush(\(json));"
            webView.evaluateJavaScript(script) { [weak self] _, error in
                self?.openingRolePush = false
                if error == nil {
                    UserDefaults.standard.removeObject(
                        forKey: "smallPhone.pendingRolePushRoute.v1"
                    )
                }
            }
        }

        func webView(
            _ webView: WKWebView,
            didFinish navigation: WKNavigation!
        ) {
            pendingWebContentRecovery?.cancel()
            pendingWebContentRecovery = nil
            didLoadPhone = true
            SmallPhoneDiagnosticsStore.append(
                "native.page.didFinish",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID,
                    "source": webView.url?.isFileURL == true
                        ? "bundled-file" : "other",
                    "thermalState": Self.thermalStateName()
                ]
            )
            updateSafeArea(in: webView)
            sendNativePressure(memoryWarning: false)
            bridge.announceReady()
            openPendingRolePushIfReady()
            syncPendingRolePushIfReady()
            scheduleResponsivenessProbe()
            // A successful navigation is not enough to call a WebContent
            // process healthy: a pressure loop can finish loading and die
            // again a few seconds later. Clear the cross-Coordinator crash
            // budget only after the same page has stayed alive for 90s.
            pendingStableWebContentReset?.cancel()
            let stableReset = DispatchWorkItem { [weak self] in
                guard let self, self.didLoadPhone else { return }
                UserDefaults.standard.removeObject(
                    forKey: Self.webContentTerminationDefaultsKey
                )
                self.pendingStableWebContentReset = nil
                print("[SmallPhoneWeb] WebContent stable for 90s; recovery budget reset")
            }
            pendingStableWebContentReset = stableReset
            DispatchQueue.main.asyncAfter(
                deadline: .now() + 90,
                execute: stableReset
            )
        }

        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            let bundledPage = webView.url?.isFileURL == true
            let supportedCapture =
                type == .microphone ||
                type == .camera ||
                type == .cameraAndMicrophone
            decisionHandler(
                bundledPage && supportedCapture ? .grant : .deny
            )
        }

        func updateSafeArea(in webView: WKWebView) {
            let viewInsets = webView.safeAreaInsets
            let windowInsets = webView.window?.safeAreaInsets ?? .zero
            let top = max(viewInsets.top, windowInsets.top)
            let bottom = max(viewInsets.bottom, windowInsets.bottom)
            let left = max(viewInsets.left, windowInsets.left)
            let right = max(viewInsets.right, windowInsets.right)
            let next = UIEdgeInsets(
                top: top,
                left: left,
                bottom: bottom,
                right: right
            )
            if let last = lastSafeAreaInsets,
               abs(last.top - next.top) < 0.5,
               abs(last.bottom - next.bottom) < 0.5,
               abs(last.left - next.left) < 0.5,
               abs(last.right - next.right) < 0.5 {
                return
            }
            lastSafeAreaInsets = next
            let script = """
            window.__smallPhoneNativeInsets && window.__smallPhoneNativeInsets({
              top: \(top), bottom: \(bottom), left: \(left), right: \(right)
            });
            """
            webView.evaluateJavaScript(script)
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            reportLoadFailure(error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            reportLoadFailure(error)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.isFileURL || url.scheme == "about" {
                decisionHandler(.allow)
            } else if navigationAction.targetFrame?.isMainFrame == false,
                      url.scheme == "https",
                      Self.allowedEmbeddedPlayer(url) {
                // Keep only the explicitly supported official media players
                // inside the bundled phone. Search pages, account pages and
                // every other remote navigation still leave through iOS.
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            didLoadPhone = false
            openingRolePush = false
            syncingRolePush = false
            // A late responsiveness-probe callback from the terminated
            // process must not cancel the fresh-view recovery scheduled below.
            responsivenessProbeToken += 1
            pendingStableWebContentReset?.cancel()
            pendingStableWebContentReset = nil
            pendingResponsivenessProbe?.cancel()
            pendingResponsivenessProbe = nil
            pendingResponsivenessTimeout?.cancel()
            pendingResponsivenessTimeout = nil

            let now = Date().timeIntervalSince1970
            let defaults = UserDefaults.standard
            var terminationTimes = (defaults.array(
                forKey: Self.webContentTerminationDefaultsKey
            ) as? [Double] ?? []).filter {
                now - $0 < 120
            }
            terminationTimes.append(now)
            defaults.set(
                terminationTimes,
                forKey: Self.webContentTerminationDefaultsKey
            )
            let attempt = terminationTimes.count
            let thermalState = Self.thermalStateName()
            SmallPhoneDiagnosticsStore.append(
                "native.webcontent.terminated",
                fields: [
                    "attempt": attempt,
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID,
                    "thermalState": thermalState
                ]
            )
            print(
                "[SmallPhoneWeb] WebContent terminated; " +
                "bounded recovery attempt \(attempt)/1"
            )

            cancelAutomaticWebContentRecovery()

            let appIsActive = UIApplication.shared.applicationState == .active
            guard attempt == 1,
                  appIsActive,
                  thermalState == "nominal" || thermalState == "fair" else {
                let reason: String
                if thermalState == "serious" || thermalState == "critical" {
                    reason = "系统已处于严重发热状态，私人 App 已停止自动重载，避免继续升温。聊天、图片和密钥都没有被清除。"
                } else if !appIsActive {
                    reason = "小手机页面在后台被系统终止。私人 App 已停止后台自动重载；回到前台后可安全重开。"
                } else {
                    reason = "小手机页面在两分钟内再次被系统终止，已停止自动重载，避免白屏和屏保反复跳转。原始数据没有清除。"
                }
                offerNativeRecovery(
                    reason: reason,
                    event: "native.webcontent.recoveryOffered"
                )
                return
            }

            // The terminated WKWebView is no longer a reliable reload target.
            // Wait for pressure to settle, then ask SwiftUI to mount a fresh
            // WKWebView while leaving the shared website data store intact.
            let recoveryToken = automaticWebContentRecoveryToken
            SmallPhoneDiagnosticsStore.append(
                "native.webcontent.remountScheduled",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID,
                    "delayMs": 10_000
                ]
            )
            let work = DispatchWorkItem { [weak self] in
                guard let self,
                      self.automaticWebContentRecoveryToken == recoveryToken else {
                    return
                }
                self.pendingWebContentRecovery = nil
                let state = Self.thermalStateName()
                guard UIApplication.shared.applicationState == .active,
                      state == "nominal" || state == "fair" else {
                    SmallPhoneDiagnosticsStore.append(
                        "native.webcontent.remountDeferred",
                        fields: [
                            "coordinatorID": self.coordinatorID,
                            "webViewID": self.webViewID,
                            "processSessionID": LocalPhoneWebView.processSessionID,
                            "thermalState": state,
                            "appIsActive": UIApplication.shared.applicationState == .active
                        ]
                    )
                    self.offerNativeRecovery(
                        reason: "自动重建前检测到系统仍在发热或 App 已离开前台，已停止重建。原始数据没有清除。",
                        event: "native.webcontent.recoveryOffered"
                    )
                    return
                }
                SmallPhoneDiagnosticsStore.append(
                    "native.webcontent.remountStarted",
                    fields: [
                        "coordinatorID": self.coordinatorID,
                        "webViewID": self.webViewID,
                        "processSessionID": LocalPhoneWebView.processSessionID,
                        "thermalState": state
                    ]
                )
                self.onRecoveryRestartReady(false)
            }
            pendingWebContentRecovery = work
            DispatchQueue.main.asyncAfter(
                deadline: .now() + 10,
                execute: work
            )
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard navigationAction.targetFrame == nil,
                  let url = navigationAction.request.url else {
                return nil
            }
            UIApplication.shared.open(url)
            return nil
        }

        private static func allowedEmbeddedPlayer(_ url: URL) -> Bool {
            let host = url.host?.lowercased() ?? ""
            if host == "music.163.com" && url.path == "/outchain/player" {
                return true
            }
            if host == "player.bilibili.com" && url.path == "/player.html" {
                return true
            }
            if host == "www.bilibili.com" &&
                (url.path == "/blackboard/webplayer/mbplayer.html" ||
                 url.path == "/blackboard/html5mobileplayer.html") {
                return true
            }
            return false
        }

        private static let webContentTerminationDefaultsKey =
            "smallPhone.webContentTerminationTimes.v21.build312"
        // WebKit exposes this legacy NSError code inconsistently across Xcode SDKs.
        // Keep the stable numeric value so older SDKs do not need the missing
        // Swift enum member for this legacy policy-change error.
        private static let frameLoadInterruptedByPolicyChangeCode = 102

        private func reportLoadFailure(_ error: Error) {
            let nativeError = error as NSError
            if nativeError.domain == NSURLErrorDomain &&
                nativeError.code == NSURLErrorCancelled {
                return
            }
            if nativeError.domain == WKError.errorDomain &&
                nativeError.code == Self.frameLoadInterruptedByPolicyChangeCode {
                return
            }
            SmallPhoneDiagnosticsStore.append(
                "native.page.loadFailure",
                fields: [
                    "coordinatorID": coordinatorID,
                    "webViewID": webViewID,
                    "processSessionID": LocalPhoneWebView.processSessionID,
                    "domain": String(nativeError.domain.prefix(80)),
                    "code": nativeError.code,
                    "thermalState": Self.thermalStateName()
                ]
            )
            print("[SmallPhoneWeb] load failed: \(error.localizedDescription)")
            offerNativeRecovery(
                reason: "小手机本地页面加载失败。原始数据没有清除；请从原生恢复面板安全重开。",
                event: "native.page.recoveryOffered"
            )
        }

        private func cancelAutomaticWebContentRecovery() {
            automaticWebContentRecoveryToken += 1
            pendingWebContentRecovery?.cancel()
            pendingWebContentRecovery = nil
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onRecoveryNeeded: onRecoveryNeeded,
            onRecoveryRestartReady: onRecoveryRestartReady,
            onRecoveryContinued: onRecoveryContinued
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(
            context.coordinator.bridge,
            name: PhoneNativeBridge.handlerName
        )
        configuration.userContentController.add(
            context.coordinator,
            name: Self.offlineKeyboardScopeHandlerName
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.nativeEnvironmentBootstrap(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.bridgeBootstrap,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.offlineKeyboardScopeBootstrap,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.recordWebViewMade()
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.bridge.webView = webView
        context.coordinator.bridge.openDeviceManagement =
            onOpenDeviceManagement
        context.coordinator.bindOfflineKeyboardScope(to: webView)
        loadBundledPhone(
            in: webView,
            coordinator: context.coordinator
        )
        return webView
    }

    func updateUIView(
        _ webView: WKWebView,
        context: Context
    ) {
        context.coordinator.bridge.openDeviceManagement =
            onOpenDeviceManagement
        DispatchQueue.main.async {
            context.coordinator.updateSafeArea(in: webView)
        }
    }

    static func dismantleUIView(
        _ webView: WKWebView,
        coordinator: Coordinator
    ) {
        coordinator.recordWebViewDismantled()
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: PhoneNativeBridge.handlerName
        )
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: Self.offlineKeyboardScopeHandlerName
        )
        coordinator.unbindOfflineKeyboardScope()
        coordinator.bridge.webView = nil
        coordinator.bridge.openDeviceManagement = nil
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
    }

    private func loadBundledPhone(
        in webView: WKWebView,
        coordinator: Coordinator
    ) {
        guard let bundleURL = Bundle.main.url(
            forResource: "PhoneWeb",
            withExtension: "bundle"
        ) else {
            webView.loadHTMLString(
                Self.missingResourceHTML,
                baseURL: nil
            )
            return
        }

        let fileURL = bundleURL
            .appendingPathComponent("index.html", isDirectory: false)
            .standardizedFileURL
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            webView.loadHTMLString(
                Self.missingResourceHTML,
                baseURL: nil
            )
            return
        }

        // WebKit requires the main file URL to be lexically inside the exact
        // directory granted here. Deriving both from one URL avoids the
        // "outside the sandbox" rejection seen on the real iPhone.
        let readAccessURL = fileURL
            .deletingLastPathComponent()
            .standardizedFileURL
        coordinator.configureBundledPage(
            fileURL: fileURL,
            readAccessURL: readAccessURL
        )
        webView.loadFileURL(
            fileURL,
            allowingReadAccessTo: readAccessURL
        )
    }

    private static let missingResourceHTML = """
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="margin:0;background:#111;color:white;font-family:-apple-system;padding:28px">
      <h2>小手机资源没有安装完整</h2>
      <p>请使用重新生成的完整安装包。</p>
    </body>
    """

    private static func nativeEnvironmentBootstrap() -> String {
        let now = Date()
        let local = TimeZone.autoupdatingCurrent
        var offsets: [String: Int] = [:]
        offsets.reserveCapacity(TimeZone.knownTimeZoneIdentifiers.count)
        for identifier in TimeZone.knownTimeZoneIdentifiers {
            guard let zone = TimeZone(identifier: identifier) else { continue }
            offsets[identifier] = zone.secondsFromGMT(for: now) / 60
        }
        offsets[local.identifier] = local.secondsFromGMT(for: now) / 60
        let environment: [String: Any] = [
            "timeZone": local.identifier,
            "timeZoneOffsetMinutes": local.secondsFromGMT(for: now) / 60,
            "timeZoneOffsets": offsets,
            "generatedAt": Int64(now.timeIntervalSince1970 * 1000)
        ]
        guard JSONSerialization.isValidJSONObject(environment),
              let data = try? JSONSerialization.data(withJSONObject: environment),
              let json = String(data: data, encoding: .utf8) else {
            return "window.__SMALL_PHONE_NATIVE_ENV__ = {};"
        }
        return "window.__SMALL_PHONE_NATIVE_ENV__ = \(json);"
    }

    private static let bridgeBootstrap = """
    (() => {
      window.__SMALL_PHONE_PRIVATE__ = true;
      window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.312 (312)';
      window.__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__ = true;
      const privateDiagLast = new Map();
      window.__smallPhoneNativeDiag = (event, fields = {}, minGap = 10000) => {
        const name = String(event || 'runtime.event').slice(0, 80);
        const now = Date.now();
        const gap = Math.max(0, Number(minGap) || 0);
        if (gap && now - (privateDiagLast.get(name) || 0) < gap) return false;
        privateDiagLast.set(name, now);
        const safe = {};
        Object.keys(fields && typeof fields === 'object' ? fields : {})
          .slice(0, 8)
          .forEach(key => {
            const value = fields[key];
            if (typeof value === 'boolean' || typeof value === 'number') {
              safe[String(key).slice(0, 40)] = value;
            } else if (typeof value === 'string') {
              safe[String(key).slice(0, 40)] = value.slice(0, 120);
            }
          });
        try {
          window.webkit.messageHandlers.smallPhoneNative.postMessage({
            action: 'diagnostics.append',
            payload: { event: name, at: now, fields: safe }
          });
          return true;
        } catch (_) {
          return false;
        }
      };
      window.__smallPhoneNativeDiag(
        'native.bootstrap.ready',
        { build: '1.0.312 (312)', autoBackupPaused: true },
        0
      );
      // Keep private-App background maintenance away from the WebContent main
      // thread while the page is hidden, starting, thermally constrained, or
      // already showing measured event-loop pressure. This does not touch the
      // role inbox, message delivery, calls, alarms, user actions, companion
      // reads, or any image. It only defers optional periodic housekeeping.
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeSetInterval = window.setInterval.bind(window);
      const optionalMaintenance = new Set([
        'scanAutoPost',
        'checkFoodDelivery',
        'checkGiftDelivery',
        'checkCalendar',
        'cleanupOld',
        'checkInitiative',
        'checkSpyTime'
      ]);
      const privateMaintenancePaused = () => {
        const root = document.documentElement;
        return document.hidden ||
          root.classList.contains('north-native-startup-quiet') ||
          root.classList.contains('north-native-performance-guard');
      };
      const guardedMaintenanceCallback = callback => function(...args) {
        if (privateMaintenancePaused()) return;
        return callback.apply(window, args);
      };
      window.setTimeout = (callback, delay, ...args) => {
        if (typeof callback === 'function' &&
            callback.name === 'suspicionTick') {
          return 0;
        }
        if (Number(delay) === 60000 &&
            typeof callback === 'function' &&
            callback.name === 'imgGC') {
          try {
            localStorage.setItem(
              'north_private_auto_image_gc_suppressed_v1',
              String(Date.now())
            );
          } catch (_) {}
          return nativeSetTimeout(() => {}, 0);
        }
        if (typeof callback === 'function' &&
            optionalMaintenance.has(callback.name)) {
          return nativeSetTimeout(
            guardedMaintenanceCallback(callback),
            delay,
            ...args
          );
        }
        return nativeSetTimeout(callback, delay, ...args);
      };
      window.setInterval = (callback, delay, ...args) => {
        if (typeof callback === 'function' &&
            callback.name === 'suspicionTick') {
          // suspicionTick is intentionally a no-op in the current core. Do
          // not wake WebContent every second forever to call `return false`.
          return 0;
        }
        if (typeof callback === 'function' &&
            optionalMaintenance.has(callback.name)) {
          return nativeSetInterval(
            guardedMaintenanceCallback(callback),
            delay,
            ...args
          );
        }
        return nativeSetInterval(callback, delay, ...args);
      };
      const root = document.documentElement;
      root.classList.add('north-native-app');
      root.style.setProperty('--north-native-safe-top', 'env(safe-area-inset-top, 0px)');
      root.style.setProperty('--north-native-safe-bottom', 'env(safe-area-inset-bottom, 0px)');
      root.style.setProperty('--north-native-safe-left', 'env(safe-area-inset-left, 0px)');
      root.style.setProperty('--north-native-safe-right', 'env(safe-area-inset-right, 0px)');
      window.__smallPhoneNativeInsets = payload => {
        const safe = (value, name) => `max(env(${name}, 0px), ${Math.max(0, Number(value) || 0)}px)`;
        root.style.setProperty('--north-native-safe-top', safe(payload && payload.top, 'safe-area-inset-top'));
        root.style.setProperty('--north-native-safe-bottom', safe(payload && payload.bottom, 'safe-area-inset-bottom'));
        root.style.setProperty('--north-native-safe-left', safe(payload && payload.left, 'safe-area-inset-left'));
        root.style.setProperty('--north-native-safe-right', safe(payload && payload.right, 'safe-area-inset-right'));
        if (typeof window.lockPullRefresh === 'function') {
          requestAnimationFrame(() => window.lockPullRefresh());
        }
      };
      let sequence = 0;
      const waiting = new Map();
      const speechClients = new Map();
      window.__smallPhoneNativeReply = payload => {
        const item = waiting.get(payload.requestId);
        if (!item) return;
        waiting.delete(payload.requestId);
        clearTimeout(item.timer);
        payload.error ? item.reject(new Error(payload.error)) : item.resolve(payload.result);
      };
      window.SmallPhoneNative = Object.freeze({
        request(action, payload = {}) {
          return new Promise((resolve, reject) => {
            const requestId = `native-${Date.now()}-${++sequence}`;
            const timeoutMs = action === 'device.snapshot' ? 25000 : 60000;
            const timer = setTimeout(() => {
              if (!waiting.has(requestId)) return;
              waiting.delete(requestId);
              reject(new Error(action === 'device.snapshot'
                ? '真实手机读取超过25秒，已结束本次读取'
                : `原生请求超时：${action}`));
            }, timeoutMs);
            waiting.set(requestId, { resolve, reject, timer });
            window.webkit.messageHandlers.smallPhoneNative.postMessage({
              requestId, action, payload
            });
          });
        }
      });
      let nativeGeoWatch = 0;
      const nativeGeoRead = (success, failure) => {
        window.SmallPhoneNative.request('location.current').then(value => {
          if (typeof success !== 'function') return;
          success({
            coords: {
              latitude: Number(value.latitude),
              longitude: Number(value.longitude),
              accuracy: Number(value.accuracy) || 0,
              altitude: Number(value.altitude) || 0,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Number(value.timestamp) || Date.now()
          });
        }).catch(error => {
          if (typeof failure === 'function') {
            failure({ code: 2, message: (error && error.message) || 'native_location_unavailable' });
          }
        });
      };
      const nativeGeolocation = {
        getCurrentPosition(success, failure) {
          nativeGeoRead(success, failure);
        },
        watchPosition(success, failure) {
          const id = ++nativeGeoWatch;
          nativeGeoRead(success, failure);
          return id;
        },
        clearWatch() {}
      };
      try {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: nativeGeolocation
        });
      } catch (_) {}
      try {
        Object.defineProperty(Navigator.prototype, 'geolocation', {
          configurable: true,
          get() { return nativeGeolocation; }
        });
      } catch (_) {}
      try {
        const originalPermissions = navigator.permissions;
        Object.defineProperty(navigator, 'permissions', {
          configurable: true,
          value: {
            query(descriptor) {
              if (descriptor && descriptor.name === 'geolocation') {
                return Promise.resolve({ state: 'granted', onchange: null });
              }
              return originalPermissions.query.call(
                originalPermissions,
                descriptor
              );
            }
          }
        });
      } catch (_) {}
      const deliveredSpeechEvents = new Set();
      window.__smallPhoneNativeSpeechEvent = payload => {
        const eventId = payload && payload.eventId;
        if (eventId && deliveredSpeechEvents.has(eventId)) return;
        if (eventId) {
          deliveredSpeechEvents.add(eventId);
          if (deliveredSpeechEvents.size > 32) {
            deliveredSpeechEvents.delete(deliveredSpeechEvents.values().next().value);
          }
        }
        const client = payload && speechClients.get(payload.sessionId);
        if (!client) return;
        if (payload.type === 'result') {
          const alternative = { transcript: payload.transcript || '', confidence: 0 };
          const result = [alternative];
          result.isFinal = payload.isFinal === true;
          if (typeof client.onresult === 'function') {
            client.onresult({
              resultIndex: 0,
              results: [result],
              screenFrameToken: payload.screenFrameToken || '',
              screenFrameAt: Number(payload.screenFrameAt || 0),
              screenFrameSequence: Number(payload.screenFrameSequence || 0)
            });
          }
          return;
        }
        if (payload.type === 'error' && typeof client.onerror === 'function') {
          client.onerror({ error: payload.error || 'native-speech-error' });
        }
        if (payload.type === 'end' || payload.type === 'error') {
          speechClients.delete(payload.sessionId);
          client.__active = false;
          client.__paused = false;
          if (typeof client.onend === 'function') client.onend();
        }
      };
      window.SmallPhoneNativeSpeech = Object.freeze({
        flushPending() {
          return window.SmallPhoneNative.request('speech.pending').then(payload => {
            const events = payload && Array.isArray(payload.events) ? payload.events : [];
            events.forEach(event => window.__smallPhoneNativeSpeechEvent(event));
            return events.length;
          });
        },
        create() {
          const client = {
            lang: 'zh-CN',
            interimResults: true,
            continuous: true,
            onresult: null,
            onerror: null,
            onend: null,
            __active: false,
            __paused: false,
            __sessionId: '',
            start() {
              if (client.__active) return;
              client.__active = true;
              client.__paused = false;
              client.__sessionId = `speech-${Date.now()}-${++sequence}`;
              speechClients.set(client.__sessionId, client);
              window.SmallPhoneNative.request('speech.start', {
                sessionId: client.__sessionId,
                lang: client.lang || 'zh-CN'
              }).catch(error => {
                speechClients.delete(client.__sessionId);
                client.__active = false;
                if (typeof client.onerror === 'function') {
                  client.onerror({ error: (error && error.message) || 'native-speech-error' });
                }
                if (typeof client.onend === 'function') client.onend();
              });
            },
            pause() {
              if (!client.__active || client.__paused) return Promise.resolve();
              client.__paused = true;
              return window.SmallPhoneNative.request('speech.pause', {
                sessionId: client.__sessionId
              }).catch(error => {
                client.__paused = false;
                throw error;
              });
            },
            resume() {
              if (!client.__active || !client.__paused) return Promise.resolve();
              return window.SmallPhoneNative.request('speech.resume', {
                sessionId: client.__sessionId
              }).then(result => {
                client.__paused = false;
                return result;
              });
            },
            rebuild() {
              if (!client.__active) return Promise.resolve();
              return window.SmallPhoneNative.request('speech.rebuild', {
                sessionId: client.__sessionId
              }).then(result => {
                client.__paused = false;
                return result;
              });
            },
            stop() {
              if (!client.__active) return;
              const sessionId = client.__sessionId;
              client.__active = false;
              client.__paused = false;
              speechClients.delete(sessionId);
              window.SmallPhoneNative.request('speech.stop', { sessionId }).catch(() => {});
              if (typeof client.onend === 'function') client.onend();
            },
            abort() {
              if (!client.__active) return;
              const sessionId = client.__sessionId;
              client.__active = false;
              client.__paused = false;
              speechClients.delete(sessionId);
              window.SmallPhoneNative.request('speech.abort', { sessionId }).catch(() => {});
              if (typeof client.onend === 'function') client.onend();
            }
          };
          return client;
        }
      });
    })();
    """

    private static let offlineKeyboardScopeBootstrap = """
    (() => {
      const report = (focused, switchToAnotherEditor = false) => {
        try {
          window.webkit.messageHandlers.smallPhoneOfflineKeyboardScope
            .postMessage({
              focused: focused === true,
              switchToAnotherEditor: switchToAnotherEditor === true
            });
        } catch (_) {}
      };
      document.addEventListener('focusin', event => {
        const target = event && event.target;
        report(!!(target && target.id === 'off_in'));
      }, true);
      document.addEventListener('focusout', event => {
        const target = event && event.target;
        if (!target || target.id !== 'off_in') return;
        setTimeout(() => {
          const active = document.activeElement;
          const stillOffline = !!(active && active.id === 'off_in');
          const anotherEditor = !!(active && !stillOffline &&
            /^(INPUT|TEXTAREA)$/.test(active.tagName || ''));
          report(stillOffline, anotherEditor);
        }, 0);
      }, true);
    })();
    """
}
