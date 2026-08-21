import Foundation
import ReplayKit
import UIKit
import WebKit

@MainActor
final class ScreenShareCoordinator {
    static let shared = ScreenShareCoordinator()
    static let appGroup = "group.com.qianyi.PhoneCompanionTest"
    static let broadcastBundleID = "com.qianyi.PhoneCompanionTest.ScreenBroadcast"

    private weak var webView: WKWebView?
    private var timer: Timer?
    private var lastActive = false
    private var lastFrameSequence = 0
    private var lastRealtimeNotifyAt: TimeInterval = 0
    private var picker: RPSystemBroadcastPickerView?

    func setHostForeground(_ foreground: Bool) {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        defaults?.set(foreground, forKey: "screenShare.hostForeground.v1")
        if !foreground {
            // Start a fresh external-App handoff window. The broadcast
            // extension will keep a separate last frame while the host App is
            // in the background, so returning to the call screen cannot
            // overwrite the frame the role needs to inspect.
            defaults?.set(false, forKey: "screenShare.backgroundFrameReady.v1")
            if let base = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: Self.appGroup
            ) {
                try? FileManager.default.removeItem(
                    at: base.appendingPathComponent(
                        "screen-share-background-latest.jpg"
                    )
                )
            }
        }
        defaults?.synchronize()
    }

    func attach(to webView: WKWebView?) {
        self.webView = webView
        guard webView != nil else {
            timer?.invalidate()
            timer = nil
            return
        }
        poll(force: true)
    }

    private func schedulePoll(after delay: TimeInterval) {
        timer?.invalidate()
        timer = Timer.scheduledTimer(
            withTimeInterval: max(0.5, delay),
            repeats: false
        ) { [weak self] _ in
            Task { @MainActor in self?.poll() }
        }
    }

    func status() -> [String: Any] {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        return [
            "active": defaults?.bool(forKey: "screenShare.active.v1") ?? false,
            "frameAt": defaults?.double(forKey: "screenShare.frameAt.v1") ?? 0,
            "backgroundFrameReady": defaults?.bool(
                forKey: "screenShare.backgroundFrameReady.v1"
            ) ?? false,
            "backgroundFrameAt": defaults?.double(
                forKey: "screenShare.backgroundFrameAt.v1"
            ) ?? 0
        ]
    }

    func presentSystemPicker() -> Bool {
        guard let webView else { return false }
        picker?.removeFromSuperview()
        let broadcastPicker = RPSystemBroadcastPickerView(frame: CGRect(x: 1, y: 1, width: 44, height: 44))
        broadcastPicker.preferredExtension = Self.broadcastBundleID
        broadcastPicker.showsMicrophoneButton = false
        broadcastPicker.alpha = 0.01
        webView.addSubview(broadcastPicker)
        picker = broadcastPicker
        let button = broadcastPicker.subviews.compactMap { $0 as? UIButton }.first
        button?.sendActions(for: .touchUpInside)
        return button != nil
    }

    func requestStop() {
        UserDefaults(suiteName: Self.appGroup)?.set(true, forKey: "screenShare.stopRequested.v1")
    }

    func latestFrameDataURL(frozenToken: String? = nil) -> String? {
        guard let base = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroup
        ) else { return nil }
        let cleanToken = (frozenToken ?? "").trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        let url: URL
        if !cleanToken.isEmpty,
           UUID(uuidString: cleanToken) != nil {
            url = base.appendingPathComponent(
                "screen-share-frozen-\(cleanToken).jpg"
            )
        } else {
            url = base.appendingPathComponent("screen-share-latest.jpg")
        }
        guard let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
        if !cleanToken.isEmpty {
            try? FileManager.default.removeItem(at: url)
        }
        return "data:image/jpeg;base64," + data.base64EncodedString()
    }

    /// Freeze the exact system frame that existed when native speech finished.
    /// WKWebView JavaScript is suspended while another App is foreground, so
    /// asking for "latest" after it resumes would otherwise capture the small
    /// phone call screen instead of the App the user was looking at while they
    /// spoke.
    func freezeLatestFrame() -> [String: Any]? {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        guard defaults?.bool(forKey: "screenShare.active.v1") == true,
              let base = FileManager.default.containerURL(
                  forSecurityApplicationGroupIdentifier: Self.appGroup
              ) else { return nil }
        let backgroundSource = base.appendingPathComponent(
            "screen-share-background-latest.jpg"
        )
        let useBackground = defaults?.bool(
            forKey: "screenShare.backgroundFrameReady.v1"
        ) == true && FileManager.default.fileExists(atPath: backgroundSource.path)
        let source = useBackground
            ? backgroundSource
            : base.appendingPathComponent("screen-share-latest.jpg")
        guard let data = try? Data(contentsOf: source), !data.isEmpty else {
            return nil
        }
        let token = UUID().uuidString
        let target = base.appendingPathComponent(
            "screen-share-frozen-\(token).jpg"
        )
        do {
            try data.write(to: target, options: .atomic)
        } catch {
            return nil
        }
        if useBackground {
            defaults?.set(false, forKey: "screenShare.backgroundFrameReady.v1")
            try? FileManager.default.removeItem(at: backgroundSource)
        }
        cleanupFrozenFrames(in: base, keeping: target)
        return [
            "screenFrameToken": token,
            "screenFrameAt": defaults?.double(forKey: useBackground
                ? "screenShare.backgroundFrameAt.v1"
                : "screenShare.frameAt.v1") ?? 0,
            "screenFrameSource": useBackground ? "externalApp" : "latest",
            "screenFrameSequence": defaults?.integer(
                forKey: "screenShare.sequence.v1"
            ) ?? 0
        ]
    }

    private func cleanupFrozenFrames(in base: URL, keeping target: URL) {
        let files = (try? FileManager.default.contentsOfDirectory(
            at: base,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        )) ?? []
        let frozen = files.filter {
            $0.lastPathComponent.hasPrefix("screen-share-frozen-") &&
                $0.pathExtension == "jpg" && $0 != target
        }.sorted {
            let left = (try? $0.resourceValues(
                forKeys: [.contentModificationDateKey]
            ).contentModificationDate) ?? .distantPast
            let right = (try? $1.resourceValues(
                forKeys: [.contentModificationDateKey]
            ).contentModificationDate) ?? .distantPast
            return left > right
        }
        for file in frozen.dropFirst(5) {
            try? FileManager.default.removeItem(at: file)
        }
    }

    private func poll(force: Bool = false) {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        let active = defaults?.bool(forKey: "screenShare.active.v1") ?? false
        let sequence = defaults?.integer(forKey: "screenShare.sequence.v1") ?? 0
        guard let webView else {
            timer?.invalidate()
            timer = nil
            return
        }
        if force || active != lastActive {
            lastActive = active
            let activeLiteral = active ? "true" : "false"
            let script = "window.__smallPhoneScreenShareEvent && window.__smallPhoneScreenShareEvent({active:\(activeLiteral)});"
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
        if !active {
            lastFrameSequence = sequence
            lastRealtimeNotifyAt = 0
            // Screen sharing is normally off. A permanent 0.5-second
            // MainActor timer kept waking WKWebView even on the home screen;
            // use a low-frequency probe until ReplayKit actually becomes active.
            schedulePoll(after: 4)
            return
        }
        let now = Date().timeIntervalSince1970
        if sequence != lastFrameSequence,
           now - lastRealtimeNotifyAt >= 3.6 {
            lastFrameSequence = sequence
            lastRealtimeNotifyAt = now
            webView.evaluateJavaScript(
                "window.__smallPhoneScreenShareFrameEvent && window.__smallPhoneScreenShareFrameEvent({sequence:\(sequence)});",
                completionHandler: nil
            )
        }
        schedulePoll(after: 0.5)
    }
}
