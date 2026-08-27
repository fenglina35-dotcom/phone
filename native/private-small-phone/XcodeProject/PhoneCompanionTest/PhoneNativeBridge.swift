import AVFoundation
import CoreLocation
import CryptoKit
import Foundation
import Photos
import Security
import Speech
import UIKit
import WebKit

@MainActor
final class PhoneNativeBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "smallPhoneNative"
    static let contractVersion = 25
    static let roleCallActiveDefaultsKey =
        "smallPhone.roleCallActive.v1"

    weak var webView: WKWebView? {
        didSet {
            ScreenShareCoordinator.shared.attach(to: webView)
            CallPictureInPictureController.shared.attach(to: webView)
        }
    }
    var openDeviceManagement: (() -> Void)?
    private let nativeSpeech = NativeSpeechRecognitionController()
    private let storageQueue = DispatchQueue(
        label: "com.smallphone.private-storage",
        qos: .utility
    )
    private struct NativeStorageReadSession {
        let data: Data
        let expiresAt: TimeInterval
    }
    // Access is serialized exclusively by storageQueue. Keeping this outside
    // MainActor prevents a multi-megabyte restored core from bouncing through
    // the UI actor between bounded bridge chunks.
    nonisolated(unsafe) private var storageReadSessions:
        [String: NativeStorageReadSession] = [:]
    private var pendingSpeechEvents: [[String: Any]] = []
    private var visionBackgroundTasks: [String: UIBackgroundTaskIdentifier] = [:]

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName,
              let payload = message.body as? [String: Any],
              let requestID = payload["requestId"] as? String,
              let action = payload["action"] as? String else {
            return
        }

        switch action {
        case "bridge.info":
            reply(
                requestID: requestID,
                result: [
                    "contractVersion": Self.contractVersion,
                    "appKind": "private-small-phone",
                    "isBundledApp": true
                ]
            )
        case "native.management.open":
            openDeviceManagement?()
            reply(requestID: requestID, result: ["opened": true])
        case "appearance.statusBar":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            let requested = arguments["theme"] as? String ?? "black"
            let allowed = Set(["black", "pink", "blue", "gray", "white"])
            let theme = allowed.contains(requested) ? requested : "black"
            UserDefaults.standard.set(
                theme,
                forKey: "smallPhone.statusBarTheme.v1"
            )
            NotificationCenter.default.post(
                name: .smallPhoneStatusBarThemeChanged,
                object: nil,
                userInfo: ["theme": theme]
            )
            reply(requestID: requestID, result: ["theme": theme])
        case "alarm.sync":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performAlarmSync(requestID: requestID, arguments: arguments)
        case "location.current":
            performNativeLocation(requestID: requestID)
        case "media.resolveBilibiliShort":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performBilibiliShortResolve(
                requestID: requestID,
                arguments: arguments
            )
        case "media.photo.save":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performPhotoSave(requestID: requestID, arguments: arguments)
        case "device.snapshot":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performLocalDeviceSnapshot(
                requestID: requestID,
                arguments: arguments
            )
        case "device.command":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performLocalDeviceCommand(
                requestID: requestID,
                arguments: arguments
            )
        case "license.request":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performLicenseRequest(requestID: requestID, arguments: arguments)
        case "account.status", "account.password.signup",
             "account.password.signin",
             "account.signout", "account.backup.info",
             "account.backup.upload", "account.backup.restore",
             "companion.controller.claim":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performPrivateAccountAction(
                requestID: requestID,
                action: action,
                arguments: arguments
            )
        case "speech.start":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performSpeechStart(requestID: requestID, arguments: arguments)
        case "speech.pause":
            nativeSpeech.pause()
            reply(requestID: requestID, result: ["paused": true])
        case "speech.resume":
            do {
                try nativeSpeech.resume()
                reply(requestID: requestID, result: ["resumed": true])
            } catch {
                reply(requestID: requestID, error: "native_speech_resume_failed")
            }
        case "speech.rebuild":
            do {
                try nativeSpeech.rebuild()
                reply(requestID: requestID, result: ["rebuilt": true])
            } catch {
                reply(requestID: requestID, error: "native_speech_rebuild_failed")
            }
        case "speech.stop", "speech.abort":
            nativeSpeech.stop(notify: false)
            reply(requestID: requestID, result: ["stopped": true])
        case "speech.pending":
            let events = pendingSpeechEvents
            pendingSpeechEvents.removeAll(keepingCapacity: true)
            reply(requestID: requestID, result: ["events": events])
        case "screenShare.start", "screenShare.stopPrompt":
            let opened = ScreenShareCoordinator.shared.presentSystemPicker()
            reply(requestID: requestID, result: ["pickerPresented": opened])
        case "screenShare.stop":
            ScreenShareCoordinator.shared.requestStop()
            reply(requestID: requestID, result: ["stopRequested": true])
        case "screenShare.status":
            reply(requestID: requestID, result: ScreenShareCoordinator.shared.status())
        case "screenShare.frame":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            let frozenToken = arguments["token"] as? String
            guard let dataURL = ScreenShareCoordinator.shared.latestFrameDataURL(
                frozenToken: frozenToken
            ) else {
                reply(requestID: requestID, error: "screen_share_frame_unavailable")
                return
            }
            reply(requestID: requestID, result: ["dataURL": dataURL])
        case "screenShare.realtime.frame":
            guard let frozen = ScreenShareCoordinator.shared.freezeLatestFrame(),
                  let token = frozen["screenFrameToken"] as? String,
                  let dataURL = ScreenShareCoordinator.shared.latestFrameDataURL(
                      frozenToken: token
                  ) else {
                reply(requestID: requestID, error: "screen_share_frame_unavailable")
                return
            }
            beginVisionBackgroundTask(token: token)
            reply(
                requestID: requestID,
                result: [
                    "dataURL": dataURL,
                    "token": token,
                    "sequence": frozen["screenFrameSequence"] as? Int ?? 0,
                    "frameAt": frozen["screenFrameAt"] as? Double ?? 0,
                    "source": frozen["screenFrameSource"] as? String ?? "latest"
                ]
            )
        case "screenShare.vision.complete":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            let token = arguments["token"] as? String ?? ""
            finishVisionBackgroundTask(token: token)
            reply(requestID: requestID, result: ["finished": true])
        case "call.pip.start":
            UserDefaults.standard.set(
                true,
                forKey: Self.roleCallActiveDefaultsKey
            )
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            let name = arguments["name"] as? String ?? "角色"
            let kind = arguments["kind"] as? String ?? "video"
            let subtitle = arguments["subtitle"] as? String ?? ""
            let subtitleWho = arguments["subtitleWho"] as? String ?? "them"
            let subtitleMotion = arguments["subtitleMotion"] as? [String: Any] ?? [:]
            let sharing = arguments["screenSharing"] as? Bool ?? false
            let supported = CallPictureInPictureController.shared.start(
                name: name,
                kind: kind,
                subtitle: subtitle,
                subtitleWho: subtitleWho,
                subtitleMotion: subtitleMotion
            )
            CallPictureInPictureController.shared.update(
                name: name,
                kind: kind,
                subtitle: subtitle,
                subtitleWho: subtitleWho,
                subtitleMotion: subtitleMotion,
                screenSharing: sharing
            )
            reply(requestID: requestID, result: ["supported": supported])
        case "call.pip.update":
            UserDefaults.standard.set(
                true,
                forKey: Self.roleCallActiveDefaultsKey
            )
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            CallPictureInPictureController.shared.update(
                name: arguments["name"] as? String ?? "角色",
                kind: arguments["kind"] as? String ?? "video",
                subtitle: arguments["subtitle"] as? String ?? "",
                subtitleWho: arguments["subtitleWho"] as? String ?? "them",
                subtitleMotion: arguments["subtitleMotion"] as? [String: Any] ?? [:],
                screenSharing: arguments["screenSharing"] as? Bool ?? false
            )
            reply(requestID: requestID, result: ["updated": true])
        case "call.pip.end":
            UserDefaults.standard.set(
                false,
                forKey: Self.roleCallActiveDefaultsKey
            )
            CallPictureInPictureController.shared.end()
            reply(requestID: requestID, result: ["ended": true])
        case "call.audio.play":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            guard let base64 = arguments["base64"] as? String,
                  let data = Data(base64Encoded: base64) else {
                reply(requestID: requestID, error: "invalid_call_audio")
                return
            }
            let volume = Float(arguments["volume"] as? Double ?? 1)
            let mime = arguments["mime"] as? String ?? "audio/mpeg"
            let mixMode = arguments["mixMode"] as? String ?? "call"
            let mixWithMedia = mixMode == "cinema" || mixMode == "screenShare" || mixMode == "camera"
            CallPictureInPictureController.shared.playAudio(
                data: data,
                mime: mime,
                volume: volume,
                mixWithMedia: mixWithMedia,
                preserveCurrentSession: mixWithMedia
            ) { [weak self] success in
                self?.reply(requestID: requestID, result: ["played": success])
            }
        case "call.audio.stop":
            CallPictureInPictureController.shared.stopAudio()
            reply(requestID: requestID, result: ["stopped": true])
        case "music.audio.activate":
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(
                    .playback,
                    mode: .default,
                    options: [.mixWithOthers]
                )
                try session.setActive(true)
                reply(requestID: requestID, result: ["activated": true])
            } catch {
                reply(requestID: requestID, error: "music_audio_unavailable")
            }
        case "storage.status":
            performStorageStatus(requestID: requestID)
        case "storage.get", "storage.get.chunk", "storage.get.release",
             "storage.put", "storage.delete":
            let arguments = payload["payload"] as? [String: Any] ?? [:]
            performStorageAction(
                requestID: requestID,
                action: action,
                arguments: arguments
            )
        default:
            reply(requestID: requestID, error: "unsupported_action")
        }
    }

    private func performPhotoSave(
        requestID: String,
        arguments: [String: Any]
    ) {
        guard let dataURL = arguments["dataURL"] as? String,
              let comma = dataURL.firstIndex(of: ","),
              dataURL[..<comma].lowercased().contains(";base64"),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              let image = UIImage(data: data) else {
            reply(requestID: requestID, error: "invalid_photo_data")
            return
        }

        let save = { [weak self] in
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, _ in
                Task { @MainActor [weak self] in
                    if success {
                        self?.reply(
                            requestID: requestID,
                            result: ["saved": true]
                        )
                    } else {
                        self?.reply(
                            requestID: requestID,
                            error: "photo_save_failed"
                        )
                    }
                }
            }
        }

        switch PHPhotoLibrary.authorizationStatus(for: .addOnly) {
        case .authorized, .limited:
            save()
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                Task { @MainActor [weak self] in
                    if status == .authorized || status == .limited {
                        save()
                    } else {
                        self?.reply(
                            requestID: requestID,
                            error: "photo_library_denied"
                        )
                    }
                }
            }
        default:
            reply(requestID: requestID, error: "photo_library_denied")
        }
    }

    private func performNativeLocation(requestID: String) {
        let manager = LocationManager.shared
        manager.resumeTrackingIfAuthorized()
        manager.refreshCurrentLocation()

        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 900_000_000)
            guard let self else { return }
            guard let location = manager.currentLocation else {
                self.reply(
                    requestID: requestID,
                    error: "native_location_unavailable"
                )
                return
            }
            self.reply(
                requestID: requestID,
                result: [
                    "latitude": location.coordinate.latitude,
                    "longitude": location.coordinate.longitude,
                    "accuracy": location.horizontalAccuracy,
                    "altitude": location.altitude,
                    "timestamp": location.timestamp
                        .timeIntervalSince1970 * 1_000,
                    "place": manager.currentPlaceName
                ]
            )
        }
    }

    private func performBilibiliShortResolve(
        requestID: String,
        arguments: [String: Any]
    ) {
        let raw = (arguments["url"] as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let input = URL(string: raw),
              input.scheme?.lowercased() == "https",
              input.host?.lowercased() == "b23.tv",
              input.user == nil,
              input.password == nil,
              input.port == nil else {
            reply(requestID: requestID, error: "invalid_bilibili_short_url")
            return
        }

        var request = URLRequest(url: input)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 15
        request.cachePolicy = .reloadIgnoringLocalCacheData

        Task { [weak self] in
            guard let self else { return }
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                guard let finalURL = response.url,
                      finalURL.scheme?.lowercased() == "https" else {
                    self.reply(requestID: requestID, error: "bilibili_short_resolve_failed")
                    return
                }
                let host = finalURL.host?.lowercased() ?? ""
                let allowedHosts = Set([
                    "bilibili.com", "www.bilibili.com", "m.bilibili.com"
                ])
                let path = finalURL.path.lowercased()
                guard allowedHosts.contains(host),
                      path.contains("/video/bv") ||
                      path.contains("/video/av") ||
                      path.contains("/bangumi/play/ep") ||
                      path.contains("/bangumi/play/ss") else {
                    self.reply(requestID: requestID, error: "invalid_bilibili_redirect")
                    return
                }
                self.reply(
                    requestID: requestID,
                    result: ["url": finalURL.absoluteString]
                )
            } catch {
                self.reply(requestID: requestID, error: "bilibili_short_resolve_failed")
            }
        }
    }

    private func performAlarmSync(
        requestID: String,
        arguments: [String: Any]
    ) {
        guard #available(iOS 26.0, *) else {
            reply(
                requestID: requestID,
                result: ["supported": false, "authorized": false]
            )
            return
        }
        let alarms = arguments["alarms"] as? [[String: Any]] ?? []
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let result = try await NativeAlarmService.shared.synchronize(alarms)
                self.reply(requestID: requestID, result: result)
            } catch {
                self.reply(
                    requestID: requestID,
                    error: "native_alarm_sync_failed:\(error.localizedDescription)"
                )
            }
        }
    }

    private func performLocalDeviceSnapshot(
        requestID: String,
        arguments: [String: Any]
    ) {
        let focus = (arguments["focus"] as? String) ?? "手机概览"
        Task { @MainActor [weak self] in
            guard let self else { return }
            let snapshot = await CompanionSyncService.shared.localSnapshot(
                focus: focus,
                locationManager: LocationManager.shared,
                wellnessService: CompanionWellnessService.shared
            )
            self.reply(requestID: requestID, result: snapshot)
        }
    }

    private func performLocalDeviceCommand(
        requestID: String,
        arguments: [String: Any]
    ) {
        guard let action = arguments["action"] as? String,
              !action.isEmpty else {
            reply(requestID: requestID, error: "native_device_action_missing")
            return
        }
        let rawID = (arguments["externalAppId"] as? String) ?? ""
        let externalAppID = rawID.isEmpty ? nil : rawID
        let minutes = arguments["minutes"] as? Int
        let scope = arguments["scope"] as? String
        let actor = arguments["actor"] as? String

        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let result = try await CompanionSyncService.shared
                    .performLocalCommand(
                        action: action,
                        externalAppID: externalAppID,
                        minutes: minutes,
                        scope: scope,
                        actor: actor,
                        locationManager: LocationManager.shared,
                        wellnessService: CompanionWellnessService.shared
                    )
                self.reply(requestID: requestID, result: result)
            } catch {
                self.reply(
                    requestID: requestID,
                    error: error.localizedDescription
                )
            }
        }
    }

    private func performSpeechStart(
        requestID: String,
        arguments: [String: Any]
    ) {
        let sessionID = arguments["sessionId"] as? String ?? ""
        let language = arguments["lang"] as? String ?? "zh-CN"
        guard !sessionID.isEmpty, sessionID.count <= 100 else {
            reply(requestID: requestID, error: "invalid_speech_session")
            return
        }
        nativeSpeech.start(
            sessionID: sessionID,
            language: language,
            onEvent: { [weak self] event in
                self?.emitSpeechEvent(event)
            },
            completion: { [weak self] error in
                guard let self else { return }
                if let error {
                    self.reply(requestID: requestID, error: error)
                } else {
                    self.reply(
                        requestID: requestID,
                        result: ["started": true, "sessionId": sessionID]
                    )
                }
            }
        )
    }

    private func emitSpeechEvent(_ event: [String: Any]) {
        var enriched = event
        if event["type"] as? String == "result",
           event["isFinal"] as? Bool == true {
            enriched["eventId"] = UUID().uuidString
            if let frozen = ScreenShareCoordinator.shared.freezeLatestFrame() {
                enriched.merge(frozen) { _, new in new }
                if let token = frozen["screenFrameToken"] as? String {
                    beginVisionBackgroundTask(token: token)
                }
            }
            pendingSpeechEvents.append(enriched)
            if pendingSpeechEvents.count > 8 {
                pendingSpeechEvents.removeFirst(pendingSpeechEvents.count - 8)
            }
        }
        guard JSONSerialization.isValidJSONObject(enriched),
              let data = try? JSONSerialization.data(withJSONObject: enriched),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        webView?.evaluateJavaScript(
            "window.__smallPhoneNativeSpeechEvent && window.__smallPhoneNativeSpeechEvent(\(json));"
        )
    }

    private func beginVisionBackgroundTask(token: String) {
        guard !token.isEmpty, visionBackgroundTasks[token] == nil else {
            return
        }
        var taskID = UIBackgroundTaskIdentifier.invalid
        taskID = UIApplication.shared.beginBackgroundTask(
            withName: "ScreenShareVision-\(token.prefix(8))"
        ) { [weak self] in
            Task { @MainActor in
                self?.finishVisionBackgroundTask(token: token)
            }
        }
        guard taskID != .invalid else { return }
        visionBackgroundTasks[token] = taskID
    }

    private func finishVisionBackgroundTask(token: String) {
        guard !token.isEmpty,
              let taskID = visionBackgroundTasks.removeValue(
                  forKey: token
              ) else { return }
        UIApplication.shared.endBackgroundTask(taskID)
    }

    private func performStorageAction(
        requestID: String,
        action: String,
        arguments: [String: Any]
    ) {
        guard let key = arguments["key"] as? String,
              let url = nativeStorageURL(for: key) else {
            reply(requestID: requestID, error: "invalid_storage_key")
            return
        }

        let legacyValue = arguments["value"] as? [String: Any]
        let putVersion = (arguments["ver"] as? NSNumber)?.intValue
            ?? (legacyValue?["ver"] as? NSNumber)?.intValue
            ?? 1
        let putSavedAt = (arguments["savedAt"] as? NSNumber)?.doubleValue
            ?? (legacyValue?["savedAt"] as? NSNumber)?.doubleValue
            ?? 0
        let putStateJSON = (arguments["stateJSON"] as? String)
            ?? (legacyValue?["json"] as? String)
        let putStats = (arguments["stats"] as? [String: Any])
            ?? (legacyValue?["stats"] as? [String: Any])
        let transferToken = arguments["transferToken"] as? String ?? ""
        let chunkOffset = (arguments["offset"] as? NSNumber)?.intValue ?? 0

        storageQueue.async { [weak self] in
            guard let self else { return }
            do {
                let now = Date().timeIntervalSince1970
                self.storageReadSessions = self.storageReadSessions.filter {
                    $0.value.expiresAt > now
                }
                switch action {
                case "storage.get":
                    guard let stored = self.nativeStorageDataWithRecovery(
                        at: url
                    ), let record = self.nativeStorageRecord(
                        from: stored.data
                    ), let stateJSON = record["json"] as? String else {
                        self.replyStorage(
                            requestID: requestID,
                            result: ["found": false]
                        )
                        return
                    }
                    let stateData = Data(stateJSON.utf8)
                    var result: [String: Any] = [
                        "found": true,
                        "ver": (record["ver"] as? NSNumber)?.intValue ?? 1,
                        "savedAt": self.nativeStorageSavedAt(in: record),
                        "recovered": stored.recovered
                    ]
                    if let stats = record["stats"],
                       JSONSerialization.isValidJSONObject(stats) {
                        result["stats"] = stats
                    }
                    if stateData.count > 131_072 {
                        let token = UUID().uuidString
                        self.storageReadSessions[token] =
                            NativeStorageReadSession(
                                data: stateData,
                                expiresAt: now + 90
                            )
                        result["chunked"] = true
                        result["transferToken"] = token
                        result["totalBytes"] = stateData.count
                        result["chunkBytes"] = 196_608
                    } else {
                        result["stateJSON"] = stateJSON
                    }
                    self.replyStorage(requestID: requestID, result: result)
                case "storage.get.chunk":
                    guard !transferToken.isEmpty,
                          let session = self.storageReadSessions[transferToken],
                          chunkOffset >= 0,
                          chunkOffset < session.data.count else {
                        self.replyStorage(
                            requestID: requestID,
                            error: "invalid_storage_transfer"
                        )
                        return
                    }
                    let end = min(session.data.count, chunkOffset + 196_608)
                    let chunk = session.data.subdata(in: chunkOffset..<end)
                    let done = end >= session.data.count
                    if done {
                        self.storageReadSessions.removeValue(
                            forKey: transferToken
                        )
                    } else {
                        self.storageReadSessions[transferToken] =
                            NativeStorageReadSession(
                                data: session.data,
                                expiresAt: now + 90
                            )
                    }
                    self.replyStorage(
                        requestID: requestID,
                        result: [
                            "chunkBase64": chunk.base64EncodedString(),
                            "nextOffset": end,
                            "totalBytes": session.data.count,
                            "done": done
                        ]
                    )
                case "storage.get.release":
                    if !transferToken.isEmpty {
                        self.storageReadSessions.removeValue(
                            forKey: transferToken
                        )
                    }
                    self.replyStorage(
                        requestID: requestID,
                        result: ["released": true]
                    )
                case "storage.put":
                    guard putVersion >= 1,
                          putSavedAt > 0,
                          let stateJSON = putStateJSON,
                          !stateJSON.isEmpty else {
                        self.replyStorage(
                            requestID: requestID,
                            error: "invalid_storage_value"
                        )
                        return
                    }
                    var record: [String: Any] = [
                        "ver": putVersion,
                        "savedAt": putSavedAt,
                        "json": stateJSON
                    ]
                    if let stats = putStats,
                       JSONSerialization.isValidJSONObject(stats) {
                        record["stats"] = stats
                    }
                    let data = try JSONSerialization.data(withJSONObject: record)
                    guard self.nativeStorageRecord(from: data) != nil else {
                        self.replyStorage(
                            requestID: requestID,
                            error: "invalid_storage_record"
                        )
                        return
                    }
                    let currentData = try? Data(contentsOf: url)
                    if let currentData,
                       let current = self.nativeStorageRecord(from: currentData),
                       self.nativeStorageSavedAt(in: current) > putSavedAt {
                        self.replyStorage(
                            requestID: requestID,
                            result: [
                                "saved": true,
                                "skippedOlderWrite": true,
                                "bytes": currentData.count
                            ]
                        )
                        return
                    }
                    if let currentData,
                       let current = self.nativeStorageRecord(from: currentData) {
                        let backupURL = self.nativeStorageBackupURL(for: url)
                        let backupData = try? Data(contentsOf: backupURL)
                        let backupRecord = backupData.flatMap {
                            self.nativeStorageRecord(from: $0)
                        }
                        let currentSavedAt = self.nativeStorageSavedAt(in: current)
                        let backupSavedAt = backupRecord.map {
                            self.nativeStorageSavedAt(in: $0)
                        } ?? 0
                        let shouldRefreshBackup = backupSavedAt <= 0 ||
                            currentSavedAt - backupSavedAt >= 300_000
                        if shouldRefreshBackup {
                            try currentData.write(to: backupURL, options: .atomic)
                            try self.applyNativeStorageProtection(to: backupURL)
                        }
                    }
                    try data.write(to: url, options: .atomic)
                    try self.applyNativeStorageProtection(to: url)
                    self.replyStorage(
                        requestID: requestID,
                        result: ["saved": true, "bytes": data.count]
                    )
                case "storage.delete":
                    if FileManager.default.fileExists(atPath: url.path) {
                        try FileManager.default.removeItem(at: url)
                    }
                    let backupURL = self.nativeStorageBackupURL(for: url)
                    if FileManager.default.fileExists(atPath: backupURL.path) {
                        try FileManager.default.removeItem(at: backupURL)
                    }
                    self.replyStorage(
                        requestID: requestID,
                        result: ["deleted": true]
                    )
                default:
                    self.replyStorage(
                        requestID: requestID,
                        error: "unsupported_storage_action"
                    )
                }
            } catch {
                self.replyStorage(
                    requestID: requestID,
                    error: "native_storage_failed"
                )
            }
        }
    }

    nonisolated private func replyStorage(
        requestID: String,
        result: [String: Any]? = nil,
        error: String? = nil
    ) {
        // Chunk replies remain bounded even when the stored core is huge. Use
        // WebKit arguments so each chunk is data, never JavaScript source.
        if let result,
           let chunkBase64 = result["chunkBase64"] as? String {
            let nextOffset = (result["nextOffset"] as? NSNumber)?.intValue ?? 0
            let totalBytes = (result["totalBytes"] as? NSNumber)?.intValue ?? 0
            let done = (result["done"] as? Bool) ?? false
            Task { @MainActor [weak self] in
                guard let webView = self?.webView else { return }
                webView.callAsyncJavaScript(
                    """
                    if (window.__smallPhoneNativeReply) {
                      window.__smallPhoneNativeReply({
                        requestId: String(requestID),
                        result: {
                          chunkBase64: String(chunkBase64 || ''),
                          nextOffset: Number(nextOffset) || 0,
                          totalBytes: Number(totalBytes) || 0,
                          done: Boolean(done)
                        }
                      });
                    }
                    """,
                    arguments: [
                        "requestID": requestID,
                        "chunkBase64": chunkBase64,
                        "nextOffset": nextOffset,
                        "totalBytes": totalBytes,
                        "done": done
                    ],
                    in: nil,
                    in: .page,
                    completionHandler: { _ in }
                )
            }
            return
        }
        // A restored core can be many megabytes. Embedding that string in an
        // evaluateJavaScript source makes WebKit parse and compile the entire
        // escaped state as code on its main thread. Pass the large value as a
        // WebKit argument instead; the function body stays tiny and constant.
        if let result,
           let stateJSON = result["stateJSON"] as? String {
            let version = (result["ver"] as? NSNumber)?.intValue ?? 1
            let savedAt = (result["savedAt"] as? NSNumber)?.doubleValue ?? 0
            let recovered = (result["recovered"] as? Bool) ?? false
            let statsJSON: String
            if let stats = result["stats"],
               JSONSerialization.isValidJSONObject(stats),
               let data = try? JSONSerialization.data(withJSONObject: stats) {
                statsJSON = String(data: data, encoding: .utf8) ?? ""
            } else {
                statsJSON = ""
            }
            Task { @MainActor [weak self] in
                guard let webView = self?.webView else { return }
                webView.callAsyncJavaScript(
                    """
                    const restored = {
                      found: true,
                      ver: Number(version) || 1,
                      savedAt: Number(savedAt) || 0,
                      stateJSON: String(stateJSON || ''),
                      recovered: Boolean(recovered)
                    };
                    if (statsJSON) {
                      try { restored.stats = JSON.parse(statsJSON); } catch (_) {}
                    }
                    if (window.__smallPhoneNativeReply) {
                      window.__smallPhoneNativeReply({
                        requestId: String(requestID),
                        result: restored
                      });
                    }
                    """,
                    arguments: [
                        "requestID": requestID,
                        "version": version,
                        "savedAt": savedAt,
                        "stateJSON": stateJSON,
                        "recovered": recovered,
                        "statsJSON": statsJSON
                    ],
                    in: nil,
                    in: .page,
                    completionHandler: { _ in }
                )
            }
            return
        }
        var payload: [String: Any] = ["requestId": requestID]
        if let result {
            payload["result"] = result
        }
        if let error {
            payload["error"] = error
        }
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        Task { @MainActor [weak self] in
            self?.webView?.evaluateJavaScript(
                "window.__smallPhoneNativeReply && window.__smallPhoneNativeReply(\(json));"
            )
        }
    }

    private func performStorageStatus(requestID: String) {
        guard let directory = nativeStorageDirectory() else {
            reply(requestID: requestID, error: "native_storage_unavailable")
            return
        }
        let coreURL = directory.appendingPathComponent("__core_state.json")
        let recoveryURL = directory.appendingPathComponent("__recovery_state.json")
        let coreBytes = nativeStorageFileBytes(at: coreURL)
        let coreBackupBytes = nativeStorageFileBytes(
            at: nativeStorageBackupURL(for: coreURL)
        )
        let recoveryBytes = nativeStorageFileBytes(at: recoveryURL)
        let recoveryBackupBytes = nativeStorageFileBytes(
            at: nativeStorageBackupURL(for: recoveryURL)
        )
        let home = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
        let values = try? home.resourceValues(
            forKeys: [
                .volumeAvailableCapacityForImportantUsageKey,
                .volumeTotalCapacityKey
            ]
        )
        let availableBytes = values?.volumeAvailableCapacityForImportantUsage ?? 0
        let totalBytes = Int64(values?.volumeTotalCapacity ?? 0)
        reply(
            requestID: requestID,
            result: [
                "kind": "native-application-support",
                "coreBytes": coreBytes,
                "coreBackupBytes": coreBackupBytes,
                "recoveryBytes": recoveryBytes,
                "recoveryBackupBytes": recoveryBackupBytes,
                "usedBytes": coreBytes + coreBackupBytes
                    + recoveryBytes + recoveryBackupBytes,
                "availableBytes": availableBytes,
                "totalBytes": totalBytes,
                "atomic": true,
                "protected": true
            ]
        )
    }

    nonisolated private func nativeStorageDataWithRecovery(
        at url: URL
    ) -> (data: Data, recovered: Bool)? {
        if let data = try? Data(contentsOf: url),
           nativeStorageRecord(from: data) != nil {
            return (data, false)
        }
        let backupURL = nativeStorageBackupURL(for: url)
        guard let backup = try? Data(contentsOf: backupURL),
              nativeStorageRecord(from: backup) != nil else {
            return nil
        }
        try? backup.write(to: url, options: .atomic)
        try? applyNativeStorageProtection(to: url)
        return (backup, true)
    }

    nonisolated private func nativeStorageRecord(
        from data: Data
    ) -> [String: Any]? {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let record = object as? [String: Any],
              let version = record["ver"] as? NSNumber,
              version.intValue >= 1,
              nativeStorageSavedAt(in: record) > 0,
              let stateJSON = record["json"] as? String,
              let stateData = stateJSON.data(using: .utf8),
              let stateObject = try? JSONSerialization.jsonObject(with: stateData),
              let state = stateObject as? [String: Any],
              state["settings"] != nil else {
            return nil
        }
        return record
    }

    nonisolated private func nativeStorageSavedAt(in value: Any) -> Double {
        guard let record = value as? [String: Any] else { return 0 }
        return (record["savedAt"] as? NSNumber)?.doubleValue ?? 0
    }

    nonisolated private func nativeStorageFileBytes(at url: URL) -> Int64 {
        guard let attributes = try? FileManager.default.attributesOfItem(
            atPath: url.path
        ) else { return 0 }
        return (attributes[.size] as? NSNumber)?.int64Value ?? 0
    }

    nonisolated private func nativeStorageBackupURL(for url: URL) -> URL {
        url.deletingPathExtension()
            .appendingPathExtension("backup.json")
    }

    nonisolated private func applyNativeStorageProtection(to url: URL) throws {
        try FileManager.default.setAttributes(
            [
                .protectionKey:
                    FileProtectionType.completeUntilFirstUserAuthentication
            ],
            ofItemAtPath: url.path
        )
    }

    nonisolated private func nativeStorageDirectory() -> URL? {
        guard let support = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            return nil
        }
        let directory = support.appendingPathComponent(
            "SmallPhonePrivateStore",
            isDirectory: true
        )
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
            return directory
        } catch {
            return nil
        }
    }

    nonisolated private func nativeStorageURL(for key: String) -> URL? {
        let allowed = CharacterSet.alphanumerics.union(
            CharacterSet(charactersIn: "._-")
        )
        guard !key.isEmpty,
              key.count <= 80,
              key.unicodeScalars.allSatisfy({ allowed.contains($0) }),
              let directory = nativeStorageDirectory() else {
            return nil
        }
        return directory.appendingPathComponent(key + ".json")
    }

    private func performLicenseRequest(
        requestID: String,
        arguments: [String: Any]
    ) {
        let baseURL = (arguments["baseUrl"] as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let apiKey = arguments["apiKey"] as? String ?? ""
        let action = arguments["action"] as? String ?? ""
        let body = arguments["body"] as? [String: Any] ?? [:]
        let timeoutMS = arguments["timeoutMs"] as? Double ?? 25_000

        guard var components = URLComponents(string: baseURL),
              components.scheme == "https",
              Set([
                "lkhlyfpssmrjkkzhuzag.supabase.co",
                "lovbzibismsjqvjujilz.supabase.co"
              ]).contains(components.host ?? ""),
              !apiKey.isEmpty,
              !action.isEmpty else {
            reply(requestID: requestID, error: "invalid_license_request")
            return
        }
        components.path = "/functions/v1/phone-license"
        components.query = nil
        components.fragment = nil
        guard let url = components.url else {
            reply(requestID: requestID, error: "invalid_license_url")
            return
        }

        var requestBody = body
        requestBody["action"] = action
        guard JSONSerialization.isValidJSONObject(requestBody),
              let data = try? JSONSerialization.data(withJSONObject: requestBody) else {
            reply(requestID: requestID, error: "invalid_license_body")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = data
        request.timeoutInterval = min(60, max(5, timeoutMS / 1_000))
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        Task { [weak self] in
            guard let self else { return }
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse,
                      let object = try? JSONSerialization.jsonObject(with: data),
                      let responseBody = object as? [String: Any] else {
                    self.reply(requestID: requestID, error: "invalid_license_response")
                    return
                }
                self.reply(
                    requestID: requestID,
                    result: ["status": http.statusCode, "payload": responseBody]
                )
            } catch {
                self.reply(requestID: requestID, error: "license_network_unavailable")
            }
        }
    }

    private struct PrivateAccountSession: Codable {
        let accessToken: String
        let refreshToken: String
        let expiresAt: TimeInterval
        let userID: String
        let phone: String
    }

    private static let privateAccountBaseURL =
        "https://qvuahlqimcfgeoetosnl.supabase.co"
    private static let privateAccountAPIKey =
        "sb_publishable_Q2j6uyn2_cFA3RdHHnG7sw_b7vqXaz0"
    private static let privateAccountKeychainService =
        "com.qianyi.smallphone.private.account.v1"
    private static let privateControllerKeychainService =
        "com.qianyi.smallphone.private.controller.v1"

    private func performPrivateAccountAction(
        requestID: String,
        action: String,
        arguments: [String: Any]
    ) {
        if action == "account.status" {
            let session = loadPrivateAccountSession()
            reply(
                requestID: requestID,
                result: privateAccountStatus(session)
            )
            return
        }

        Task { [weak self] in
            guard let self else { return }
            do {
                switch action {
                case "account.password.signup", "account.password.signin":
                    let phone = self.normalizedPrivatePhone(
                        arguments["phone"] as? String ?? ""
                    )
                    let password = arguments["password"] as? String ?? ""
                    guard let phone else {
                        self.reply(
                            requestID: requestID,
                            result: [
                                "ok": false,
                                "code": "invalid_phone",
                                "message": "请输入正确的中国大陆手机号"
                            ]
                        )
                        return
                    }
                    guard password.count >= 8, password.count <= 72 else {
                        self.reply(
                            requestID: requestID,
                            result: [
                                "ok": false,
                                "code": "invalid_password",
                                "message": "密码需要 8 至 72 位"
                            ]
                        )
                        return
                    }
                    let isSignup = action == "account.password.signup"
                    let response = try await self.privateAccountJSONRequest(
                        path: isSignup
                            ? "/auth/v1/signup"
                            : "/auth/v1/token?grant_type=password",
                        method: "POST",
                        body: [
                            "email": self.privateAccountLoginEmail(phone),
                            "password": password
                        ]
                    )
                    guard response.status >= 200, response.status < 300,
                          let session = self.privateAccountSession(
                            from: response.body,
                            fallbackPhone: phone
                          ) else {
                        var result = self.privateAccountPublicResult(response)
                        if isSignup, response.status >= 200, response.status < 300 {
                            result["ok"] = false
                            result["code"] = "signup_session_missing"
                            result["message"] = "账号已创建，但未能自动登录，请点登录并恢复"
                        }
                        self.reply(requestID: requestID, result: result)
                        return
                    }
                    try self.savePrivateAccountSession(session)
                    var result = self.privateAccountStatus(session)
                    result["ok"] = true
                    self.reply(requestID: requestID, result: result)
                case "account.signout":
                    if let session = self.loadPrivateAccountSession() {
                        _ = try? await self.privateAccountJSONRequest(
                            path: "/auth/v1/logout",
                            method: "POST",
                            bearer: session.accessToken
                        )
                    }
                    self.deletePrivateAccountSession()
                    self.reply(
                        requestID: requestID,
                        result: ["ok": true, "loggedIn": false]
                    )
                case "account.backup.info":
                    let session = try await self.validPrivateAccountSession()
                    let response = try await self.privateAccountJSONRequest(
                        path: "/rest/v1/private_phone_backups" +
                            "?select=revision,captured_at,uploaded_at,source_build,checksum,byte_count" +
                            "&order=captured_at.desc&limit=1",
                        method: "GET",
                        bearer: session.accessToken
                    )
                    self.reply(
                        requestID: requestID,
                        result: self.privateBackupResult(response, includesPayload: false)
                    )
                case "account.backup.upload":
                    let session = try await self.validPrivateAccountSession()
                    guard let snapshot = arguments["snapshot"],
                          JSONSerialization.isValidJSONObject(snapshot) else {
                        self.reply(requestID: requestID, error: "invalid_backup_payload")
                        return
                    }
                    let snapshotData = try JSONSerialization.data(withJSONObject: snapshot)
                    let checksum = SHA256.hash(data: snapshotData)
                        .map { String(format: "%02x", $0) }
                        .joined()
                    let capturedMilliseconds =
                        (arguments["capturedAt"] as? NSNumber)?.doubleValue ??
                        Date().timeIntervalSince1970 * 1_000
                    let capturedDate = Date(
                        timeIntervalSince1970: capturedMilliseconds / 1_000
                    )
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    let body: [String: Any] = [
                        "p_payload": snapshot,
                        "p_captured_at": formatter.string(from: capturedDate),
                        "p_source_build": String(
                            (arguments["sourceBuild"] as? String ?? "").prefix(80)
                        ),
                        "p_checksum": checksum,
                        "p_byte_count": snapshotData.count
                    ]
                    let response = try await self.privateAccountJSONRequest(
                        path: "/rest/v1/rpc/save_private_phone_backup",
                        method: "POST",
                        body: body,
                        bearer: session.accessToken
                    )
                    var result = self.privateAccountPublicResult(response)
                    if response.status >= 200, response.status < 300 {
                        result["ok"] = true
                        result["byteCount"] = snapshotData.count
                        result["checksum"] = checksum
                        if let rows = response.body as? [[String: Any]], let row = rows.first {
                            result["backup"] = row
                        }
                    }
                    self.reply(requestID: requestID, result: result)
                case "account.backup.restore":
                    let session = try await self.validPrivateAccountSession()
                    let response = try await self.privateAccountJSONRequest(
                        path: "/rest/v1/private_phone_backups" +
                            "?select=revision,captured_at,uploaded_at,source_build,checksum,byte_count,payload" +
                            "&order=captured_at.desc&limit=1",
                        method: "GET",
                        bearer: session.accessToken
                    )
                    self.reply(
                        requestID: requestID,
                        result: self.privateBackupResult(response, includesPayload: true)
                    )
                case "companion.controller.claim":
                    let session = try await self.validPrivateAccountSession()
                    let target = (arguments["target"] as? String ?? "")
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    let ownerSecret = arguments["ownerSecret"] as? String ?? ""
                    guard target.range(
                        of: "^yb_[a-z0-9]{20,96}$",
                        options: .regularExpression
                    ) != nil, ownerSecret.count >= 24 else {
                        self.reply(requestID: requestID, error: "invalid_controller_claim")
                        return
                    }
                    let instanceID = try self.privateControllerInstanceID()
                    let identity = CompanionSyncService.shared
                        .privateControllerDeviceIdentity()
                    let seed = Data((instanceID + ":" + target).utf8)
                    let generatedDeviceSecret = Data(
                        SHA256.hash(data: seed)
                    ).base64EncodedString()
                        .replacingOccurrences(of: "+", with: "-")
                        .replacingOccurrences(of: "/", with: "_")
                        .replacingOccurrences(of: "=", with: "")
                    let deviceSecret = CompanionSecretStore.load(
                        account: target
                    ) ?? generatedDeviceSecret
                    let push = CompanionPushCoordinator.shared
                    let response = try await self.privateAccountJSONRequest(
                        path: "/rest/v1/rpc/claim_private_phone_unified_controller",
                        method: "POST",
                        body: [
                            "p_target": target,
                            "p_new_owner_secret": ownerSecret,
                            "p_controller_instance_id": instanceID,
                            "p_device_secret": deviceSecret,
                            "p_device_id": identity["deviceId"] ?? "",
                            "p_device_name": identity["deviceName"] ?? "iPhone",
                            "p_apns_token": push.deviceToken,
                            "p_apns_environment": push.environment
                        ],
                        bearer: session.accessToken
                    )
                    var result = self.privateAccountPublicResult(response)
                    if response.status >= 200, response.status < 300,
                       let claimed = response.body as? [String: Any] {
                        try CompanionSyncService.shared.adoptPrivateController(
                            target: target,
                            deviceSecret: deviceSecret
                        )
                        await CompanionSyncService.shared
                            .registerPushTokenIfAvailable(
                                token: push.deviceToken,
                                environment: push.environment,
                                quiet: true
                            )
                        result = claimed
                        result["ok"] = true
                    }
                    self.reply(requestID: requestID, result: result)
                default:
                    self.reply(requestID: requestID, error: "unsupported_account_action")
                }
            } catch {
                self.reply(
                    requestID: requestID,
                    result: [
                        "ok": false,
                        "code": "account_request_failed",
                        "message": "账号服务暂时不可用，请稍后重试"
                    ]
                )
            }
        }
    }

    private func normalizedPrivatePhone(_ raw: String) -> String? {
        let digits = raw.filter { $0.isNumber }
        let local: String
        if digits.hasPrefix("86"), digits.count == 13 {
            local = String(digits.dropFirst(2))
        } else {
            local = digits
        }
        guard local.range(of: "^1[3-9][0-9]{9}$", options: .regularExpression) != nil else {
            return nil
        }
        return "+86" + local
    }

    private func privateAccountLoginEmail(_ phone: String) -> String {
        let digits = phone.filter { $0.isNumber }
        return "smallphone." + digits + "@example.com"
    }

    private func privateAccountStatus(
        _ session: PrivateAccountSession?
    ) -> [String: Any] {
        guard let session else {
            return ["ok": true, "loggedIn": false]
        }
        let local = String(session.phone.suffix(11))
        let prefix = String(local.prefix(3))
        let suffix = String(local.suffix(4))
        return [
            "ok": true,
            "loggedIn": true,
            "maskedPhone": prefix + "****" + suffix,
            "userId": session.userID
        ]
    }

    private func privateAccountSession(
        from body: Any?,
        fallbackPhone: String? = nil
    ) -> PrivateAccountSession? {
        guard let json = body as? [String: Any],
              let accessToken = json["access_token"] as? String,
              let refreshToken = json["refresh_token"] as? String,
              let user = json["user"] as? [String: Any],
              let userID = user["id"] as? String else {
            return nil
        }
        let absoluteExpiry = (json["expires_at"] as? NSNumber)?.doubleValue
        let lifetime = (json["expires_in"] as? NSNumber)?.doubleValue ?? 3_600
        let expiresAt = absoluteExpiry ?? (Date().timeIntervalSince1970 + lifetime)
        let phone = (user["phone"] as? String).flatMap { $0.isEmpty ? nil : $0 } ??
            fallbackPhone ?? ""
        return PrivateAccountSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            userID: userID,
            phone: phone
        )
    }

    private func validPrivateAccountSession() async throws -> PrivateAccountSession {
        guard let current = loadPrivateAccountSession() else {
            throw NSError(domain: "PrivatePhoneAccount", code: 401)
        }
        if current.expiresAt > Date().timeIntervalSince1970 + 120 {
            return current
        }
        let response = try await privateAccountJSONRequest(
            path: "/auth/v1/token?grant_type=refresh_token",
            method: "POST",
            body: ["refresh_token": current.refreshToken]
        )
        guard response.status >= 200, response.status < 300,
              let refreshed = privateAccountSession(
                from: response.body,
                fallbackPhone: current.phone
              ) else {
            // A gateway outage can return a temporary 401 while the refresh
            // token is still valid. Never destroy the only local recovery
            // credential because a remote refresh attempt failed. Explicit
            // sign-out remains the sole path that removes this Keychain item.
            throw NSError(
                domain: "PrivatePhoneAccount",
                code: response.status,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "云端暂时无法验证，手机号登录已保留，请稍后重试"
                ]
            )
        }
        try savePrivateAccountSession(refreshed)
        return refreshed
    }

    private struct PrivateAccountHTTPResponse {
        let status: Int
        let body: Any?
    }

    private func privateAccountJSONRequest(
        path: String,
        method: String,
        body: [String: Any]? = nil,
        bearer: String? = nil
    ) async throws -> PrivateAccountHTTPResponse {
        guard let url = URL(string: Self.privateAccountBaseURL + path) else {
            throw NSError(domain: "PrivatePhoneAccount", code: 400)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 60
        request.setValue(Self.privateAccountAPIKey, forHTTPHeaderField: "apikey")
        request.setValue(
            "Bearer " + (bearer ?? Self.privateAccountAPIKey),
            forHTTPHeaderField: "Authorization"
        )
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let object = data.isEmpty ? nil : try? JSONSerialization.jsonObject(with: data)
        return PrivateAccountHTTPResponse(status: status, body: object)
    }

    private func privateAccountPublicResult(
        _ response: PrivateAccountHTTPResponse
    ) -> [String: Any] {
        let ok = response.status >= 200 && response.status < 300
        let json = response.body as? [String: Any]
        let rawMessage = (json?["msg"] as? String) ??
            (json?["message"] as? String) ??
            (json?["error_description"] as? String) ?? ""
        let message: String
        if ok {
            message = "操作成功"
        } else if response.status == 429 {
            message = "登录尝试太频繁，请稍后再试"
        } else if rawMessage.localizedCaseInsensitiveContains("invalid login") ||
                    rawMessage.localizedCaseInsensitiveContains("invalid credentials") {
            message = "手机号或密码不正确"
        } else if rawMessage.localizedCaseInsensitiveContains("email not confirmed") {
            message = "私人账号尚未确认，请检查 Supabase 用户状态"
        } else {
            message = rawMessage.isEmpty ? "账号服务请求失败" : rawMessage
        }
        return [
            "ok": ok,
            "status": response.status,
            "code": (json?["error_code"] as? String) ?? "",
            "message": message
        ]
    }

    private func privateBackupResult(
        _ response: PrivateAccountHTTPResponse,
        includesPayload: Bool
    ) -> [String: Any] {
        guard response.status >= 200, response.status < 300 else {
            return privateAccountPublicResult(response)
        }
        guard let rows = response.body as? [[String: Any]], let row = rows.first else {
            return ["ok": true, "found": false]
        }
        var result: [String: Any] = ["ok": true, "found": true, "backup": row]
        if includesPayload, row["payload"] == nil {
            result = ["ok": false, "found": false, "message": "云备份内容不完整"]
        }
        return result
    }

    private func loadPrivateAccountSession() -> PrivateAccountSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.privateAccountKeychainService,
            kSecAttrAccount as String: "primary",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return try? JSONDecoder().decode(PrivateAccountSession.self, from: data)
    }

    private func savePrivateAccountSession(_ session: PrivateAccountSession) throws {
        let data = try JSONEncoder().encode(session)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.privateAccountKeychainService,
            kSecAttrAccount as String: "primary"
        ]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    private func deletePrivateAccountSession() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.privateAccountKeychainService,
            kSecAttrAccount as String: "primary"
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func privateControllerInstanceID() throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.privateControllerKeychainService,
            kSecAttrAccount as String: "instance",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let saved = String(data: data, encoding: .utf8),
           saved.count >= 16 {
            return saved
        }

        let instanceID = "private-ios-" + UUID().uuidString.lowercased()
        var insert = query
        insert.removeValue(forKey: kSecReturnData as String)
        insert.removeValue(forKey: kSecMatchLimit as String)
        insert[kSecValueData as String] = Data(instanceID.utf8)
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.privateControllerKeychainService,
            kSecAttrAccount as String: "instance"
        ]
        SecItemDelete(deleteQuery as CFDictionary)
        let status = SecItemAdd(insert as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
        return instanceID
    }

    func announceReady() {
        let script = """
        window.dispatchEvent(new CustomEvent('small-phone-native-ready', {
          detail: { contractVersion: \(Self.contractVersion), appKind: 'private-small-phone' }
        }));
        """
        webView?.evaluateJavaScript(script)
    }

    private func reply(
        requestID: String,
        result: [String: Any]? = nil,
        error: String? = nil
    ) {
        var payload: [String: Any] = ["requestId": requestID]
        if let result {
            payload["result"] = result
        }
        if let error {
            payload["error"] = error
        }
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        webView?.evaluateJavaScript(
            "window.__smallPhoneNativeReply && window.__smallPhoneNativeReply(\(json));"
        )
    }
}

@MainActor
private final class NativeSpeechRecognitionController {
    private var audioEngine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var sessionID = ""
    private var eventHandler: (([String: Any]) -> Void)?
    private var startToken = UUID()
    private var tapInstalled = false
    private var partialCommitTask: Task<Void, Never>?
    private var restartTask: Task<Void, Never>?
    private var latestTranscript = ""
    private var language = "zh-CN"
    private var recognitionGeneration = UUID()
    private var isActive = false
    private var isPaused = false
    private var restartFailures = 0

    func start(
        sessionID: String,
        language: String,
        onEvent: @escaping ([String: Any]) -> Void,
        completion: @escaping (String?) -> Void
    ) {
        stop(notify: false)
        let token = UUID()
        startToken = token
        self.sessionID = sessionID
        self.language = language
        eventHandler = onEvent
        isActive = true
        isPaused = false

        SFSpeechRecognizer.requestAuthorization { status in
            Task { @MainActor [weak self] in
                guard let self, self.startToken == token else { return }
                guard status == .authorized else {
                    completion("speech_permission_denied")
                    self.stop(notify: false)
                    return
                }
                AVAudioApplication.requestRecordPermission { allowed in
                    Task { @MainActor [weak self] in
                        guard let self, self.startToken == token else { return }
                        guard allowed else {
                            completion("microphone_permission_denied")
                            self.stop(notify: false)
                            return
                        }
                        do {
                            try self.beginRecognition(language: language)
                            completion(nil)
                        } catch {
                            completion("native_speech_start_failed")
                            self.stop(notify: false)
                        }
                    }
                }
            }
        }
    }

    func stop(notify: Bool) {
        startToken = UUID()
        isActive = false
        isPaused = false
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        cleanupCurrentRecognition(deactivateAudioSession: true)
        if notify, !sessionID.isEmpty {
            emit(type: "end")
        }
        reset()
    }

    func pause() {
        guard isActive, !isPaused else { return }
        isPaused = true
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        latestTranscript = ""
        cleanupCurrentRecognition(deactivateAudioSession: true)
    }

    func resume() throws {
        guard isActive, isPaused, !sessionID.isEmpty else { return }
        isPaused = false
        do {
            try beginRecognition(language: language)
            restartFailures = 0
        } catch {
            isPaused = true
            throw error
        }
    }

    func rebuild() throws {
        guard isActive, !sessionID.isEmpty else { return }
        isPaused = true
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        latestTranscript = ""
        cleanupCurrentRecognition(deactivateAudioSession: true)
        isPaused = false
        do {
            try beginRecognition(language: language)
            restartFailures = 0
        } catch {
            isPaused = true
            throw error
        }
    }

    private func beginRecognition(language: String) throws {
        guard isActive, !isPaused, !sessionID.isEmpty else { return }
        guard let recognizer = SFSpeechRecognizer(
            locale: Locale(identifier: language)
        ), recognizer.isAvailable else {
            throw NativeSpeechError.unavailable
        }

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.defaultToSpeaker, .allowBluetoothHFP, .mixWithOthers]
        )
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.request = request

        let engine = AVAudioEngine()
        audioEngine = engine
        let input = engine.inputNode
        if #available(iOS 13.0, *) {
            try input.setVoiceProcessingEnabled(true)
        }
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw NativeSpeechError.noAudioInput
        }
        input.installTap(
            onBus: 0,
            bufferSize: 1_024,
            format: format
        ) { buffer, _ in
            request.append(buffer)
        }
        tapInstalled = true
        engine.prepare()
        try engine.start()

        let generation = UUID()
        recognitionGeneration = generation
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self,
                      self.isActive,
                      !self.sessionID.isEmpty,
                      self.recognitionGeneration == generation else { return }
                if let result {
                    self.restartFailures = 0
                    let transcript = result.bestTranscription.formattedString
                    self.latestTranscript = transcript
                    self.emit(
                        type: "result",
                        transcript: transcript,
                        isFinal: result.isFinal
                    )
                    if result.isFinal {
                        self.partialCommitTask?.cancel()
                        self.partialCommitTask = nil
                        self.rotateRecognition(afterNanoseconds: 220_000_000)
                    } else {
                        self.schedulePartialCommit(transcript)
                    }
                } else if error != nil {
                    self.rotateRecognition(afterNanoseconds: 420_000_000)
                }
            }
        }
    }

    private func schedulePartialCommit(_ transcript: String) {
        partialCommitTask?.cancel()
        guard !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            partialCommitTask = nil
            return
        }
        let session = sessionID
        partialCommitTask = Task { @MainActor [weak self] in
            // Give Apple's partial transcription enough time to revise the
            // last words before they are committed to the conversation.
            try? await Task.sleep(nanoseconds: 1_650_000_000)
            guard !Task.isCancelled else { return }
            guard let self,
                  self.sessionID == session,
                  !self.latestTranscript.isEmpty else { return }
            self.emit(
                type: "result",
                transcript: self.latestTranscript,
                isFinal: true
            )
            self.rotateRecognition(afterNanoseconds: 220_000_000)
        }
    }

    private func rotateRecognition(afterNanoseconds delay: UInt64) {
        guard isActive, !isPaused, !sessionID.isEmpty else { return }
        recognitionGeneration = UUID()
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        latestTranscript = ""
        // Keep the play-and-record session alive between continuous chunks.
        // Deactivating it here lets iOS suspend the microphone as soon as the
        // user switches to another App during a call.
        cleanupCurrentRecognition(deactivateAudioSession: false)

        let session = sessionID
        restartTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: delay)
            guard !Task.isCancelled,
                  let self,
                  self.isActive,
                  !self.isPaused,
                  self.sessionID == session else { return }
            do {
                try self.beginRecognition(language: self.language)
                self.restartFailures = 0
            } catch {
                self.restartFailures += 1
                let retryDelay = UInt64(min(2_000, 300 + self.restartFailures * 250)) * 1_000_000
                self.rotateRecognition(afterNanoseconds: retryDelay)
            }
        }
    }

    private func cleanupCurrentRecognition(deactivateAudioSession: Bool) {
        if let engine = audioEngine {
            if engine.isRunning {
                engine.stop()
            }
            if tapInstalled {
                engine.inputNode.removeTap(onBus: 0)
                tapInstalled = false
            }
            engine.reset()
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        audioEngine = nil
        if deactivateAudioSession {
            try? AVAudioSession.sharedInstance().setActive(
                false,
                options: .notifyOthersOnDeactivation
            )
        }
    }

    private func emit(
        type: String,
        transcript: String = "",
        isFinal: Bool = false,
        error: String = ""
    ) {
        guard !sessionID.isEmpty else { return }
        var event: [String: Any] = [
            "sessionId": sessionID,
            "type": type
        ]
        if !transcript.isEmpty {
            event["transcript"] = transcript
            event["isFinal"] = isFinal
        }
        if !error.isEmpty {
            event["error"] = error
        }
        eventHandler?(event)
    }

    private func reset() {
        partialCommitTask?.cancel()
        partialCommitTask = nil
        restartTask?.cancel()
        restartTask = nil
        request = nil
        task = nil
        sessionID = ""
        eventHandler = nil
        latestTranscript = ""
        language = "zh-CN"
        restartFailures = 0
        isPaused = false
    }

    private enum NativeSpeechError: Error {
        case unavailable
        case noAudioInput
    }
}
