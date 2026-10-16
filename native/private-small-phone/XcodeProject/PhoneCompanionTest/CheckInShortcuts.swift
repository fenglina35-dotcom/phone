import AppIntents
import Foundation
import ImageIO
import UniformTypeIdentifiers
import UserNotifications

// CHECKIN_SHORTCUTS_V1: only a confirmed, configured owner shortcut can enqueue a screenshot.
// Temporary native files expire; the received chat image follows normal chat retention.
actor CheckInStore {
    static let shared = CheckInStore()
    private let configKey = "smallPhone.checkIn.config.v2"
    private let approvalKey = "smallPhone.checkIn.approval.v2"
    private let previousKey = "smallPhone.checkIn.previousLine.v2"
    private let firedKey = "smallPhone.checkIn.fired.v1"
    private struct Approval: Codable { let scope: String; let at: Date }
    private func approval() -> Approval? {
        guard let data = UserDefaults.standard.data(forKey: approvalKey) else { return nil }
        return try? JSONDecoder().decode(Approval.self, from: data)
    }
    private let maximumAge: TimeInterval = 24 * 3_600

    struct Configuration: Codable, Sendable {
        var enabled: Bool
        var account: String
        var cid: String
        var scope: String
        var lines: [String]
        // Optional so a configuration saved by an older build still decodes.
        var mode: String? = nil
        var want: Int? = nil
        var wantAt: Double? = nil
        var planAt: Double? = nil
    }
    private struct Fired: Codable { var day: String; var count: Int; var last: Date }
    struct Metadata: Codable, Sendable {
        let id: String
        let at: Double
        let account: String
        let cid: String
        let scope: String
    }
    struct Pending: Sendable {
        let metadata: Metadata
        let data: Data
    }
    struct Opening: Sendable {
        let scope: String
        let line: String
    }

    private func configuration() -> Configuration? {
        guard let data = UserDefaults.standard.data(forKey: configKey) else { return nil }
        return try? JSONDecoder().decode(Configuration.self, from: data)
    }

    func configure(_ value: Configuration) -> Int {
        let old = configuration()
        var seen = Set<String>()
        let lines = value.lines.compactMap { line -> String? in
            let clean = line.replacingOccurrences(of: "\n", with: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !clean.isEmpty, clean.count <= 60, seen.insert(clean).inserted else { return nil }
            return clean
        }
        let valid = !value.account.isEmpty && value.account.count <= 120 &&
            !value.cid.isEmpty && value.cid.count <= 120 && !value.scope.isEmpty && value.scope.count <= 120
        let stored = Configuration(enabled: value.enabled && valid && !lines.isEmpty,
            account: value.account, cid: value.cid, scope: value.scope, lines: Array(lines.prefix(40)),
            mode: value.mode == "always" ? "always" : "role", want: min(3, max(0, value.want ?? 1)), wantAt: value.wantAt, planAt: value.planAt)
        if old?.scope != stored.scope || old?.account != stored.account || old?.cid != stored.cid || !stored.enabled {
            UserDefaults.standard.removeObject(forKey: approvalKey)
        }
        if let data = try? JSONEncoder().encode(stored) { UserDefaults.standard.set(data, forKey: configKey) }
        return stored.lines.count
    }

    // The role's own wish, the hour and the time since the last check decide; most triggers pass quietly.
    private func roleWantsNow(_ config: Configuration, now: Date = Date()) -> Bool {
        if config.mode == "always" { return true }
        var want = config.want ?? 1
        if let at = config.wantAt, now.timeIntervalSince1970 * 1_000 - at > 12 * 3_600_000 { want = min(want, 1) }
        var chance = [0.0, 0.1, 0.3, 0.65][min(3, max(0, want))]
        let hour = Calendar.current.component(.hour, from: now)
        if hour >= 23 || hour < 5 { chance = min(0.9, chance * 1.5) }
        let day = Self.dayText(now)
        let fired = (UserDefaults.standard.data(forKey: firedKey)).flatMap { try? JSONDecoder().decode(Fired.self, from: $0) }
        let last = fired?.last ?? .distantPast // kept across midnight so a used plan never fires twice
        let count = fired?.day == day ? fired?.count ?? 0 : 0
        if now.timeIntervalSince(last) < 45 * 60 { return false }
        if count >= 5 { return false }
        // The role's own hidden time: nothing before it, the first trigger within two hours after it.
        if let ms = config.planAt, ms > 0 {
            let plan = Date(timeIntervalSince1970: ms / 1_000)
            if now < plan { return false }
            if now.timeIntervalSince(plan) < 2 * 3_600, last < plan { chance = 1 }
        }
        guard Double.random(in: 0..<1) < chance else { return false }
        let next = Fired(day: day, count: count + 1, last: now)
        if let data = try? JSONEncoder().encode(next) { UserDefaults.standard.set(data, forKey: firedKey) }
        return true
    }
    private static func dayText(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return "\(parts.year ?? 0)-\(parts.month ?? 0)-\(parts.day ?? 0)"
    }

    /// nil means this trigger passes quietly: no prompt, and the screenshot that follows is discarded.
    func prepareOpening() throws -> Opening? {
        UserDefaults.standard.removeObject(forKey: approvalKey) // A cancelled second prompt must never reuse an earlier approval.
        guard let config = configuration() else {
            throw CheckInError("先在小手机的快捷指令与查岗页面选择角色、生成开场白并开启截屏")
        }
        guard config.enabled, !config.lines.isEmpty, roleWantsNow(config) else { return nil }
        let previousLine = UserDefaults.standard.string(forKey: previousKey) ?? ""
        let choices = config.lines.filter { $0 != previousLine }
        guard let line = (choices.isEmpty ? config.lines : choices).randomElement() else {
            throw CheckInError("还没有角色写的开场白，请先在小手机生成")
        }
        UserDefaults.standard.set(line, forKey: previousKey)
        return Opening(scope: config.scope, line: line)
    }

    func approve(scope: String) throws {
        guard let config = configuration(), config.enabled, config.scope == scope else {
            throw CheckInError("查岗设置已改变，请重新运行快捷指令")
        }
        let data = try JSONEncoder().encode(Approval(scope: scope, at: Date()))
        UserDefaults.standard.set(data, forKey: approvalKey)
    }

    private func directory() throws -> URL {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw CheckInError("截图暂存目录不可用")
        }
        var folder = base.appendingPathComponent("CheckIn", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        return folder
    }

    /// nil when nothing was confirmed for this run: the image is dropped without being written anywhere.
    func save(imageData: Data) throws -> String? {
        guard let config = configuration(), config.enabled, let permitted = approval(),
              permitted.scope == config.scope, Date().timeIntervalSince(permitted.at) >= 0,
              Date().timeIntervalSince(permitted.at) <= 120 else { return nil }
        UserDefaults.standard.removeObject(forKey: approvalKey) // One confirmation authorizes exactly one screenshot, never an ongoing feed.
        guard !imageData.isEmpty, imageData.count <= 20 * 1_024 * 1_024,
              let source = CGImageSourceCreateWithData(imageData as CFData, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 1_440,
                kCGImageSourceShouldCacheImmediately: true
              ] as CFDictionary) else { throw CheckInError("截图读取失败，请确认上一步是「截屏」且图片不超过20MB") }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw CheckInError("截图转换失败")
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw CheckInError("截图保存失败") }
        let at = Date().timeIntervalSince1970 * 1_000
        let id = "\(Int64(at))-\(UUID().uuidString.prefix(8))"
        let metadata = Metadata(id: id, at: at, account: config.account, cid: config.cid, scope: config.scope)
        let folder = try directory()
        let metaURL = folder.appendingPathComponent(id + ".json")
        try JSONEncoder().encode(metadata).write(to: metaURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        do { try (output as Data).write(to: folder.appendingPathComponent(id + ".jpg"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]) }
        catch { try? FileManager.default.removeItem(at: metaURL); throw error }
        prune(folder)
        return id
    }

    private func validID(_ id: String) -> Bool {
        id.range(of: "^[0-9]{10,16}-[0-9A-Fa-f]{8}$", options: .regularExpression) != nil
    }
    private func metadata(_ id: String, in folder: URL) -> Metadata? {
        guard validID(id), let data = try? Data(contentsOf: folder.appendingPathComponent(id + ".json")),
              let value = try? JSONDecoder().decode(Metadata.self, from: data), value.id == id else { return nil }
        return value
    }
    private func imageFiles(_ folder: URL) -> [URL] {
        ((try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.pathExtension == "jpg" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    }
    private func erase(_ id: String, in folder: URL) -> Bool {
        guard validID(id) else { return false }
        do {
            for ext in ["jpg", "json"] {
                let file = folder.appendingPathComponent(id + "." + ext)
                if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
            }
            return true
        } catch { return false }
    }
    private func prune(_ folder: URL) {
        let files = imageFiles(folder), now = Date().timeIntervalSince1970 * 1_000
        for (index, file) in files.enumerated() {
            let id = file.deletingPathExtension().lastPathComponent
            guard let item = metadata(id, in: folder) else { _ = erase(id, in: folder); continue }
            if now - item.at > maximumAge * 1_000 || item.at > now + 60_000 || index < files.count - 6 { _ = erase(id, in: folder) }
        }
    }
    func oldest(scope: String) -> Pending? {
        guard let config = configuration(), config.enabled, config.scope == scope,
              let folder = try? directory() else { return nil }
        prune(folder)
        for file in imageFiles(folder) {
            let id = file.deletingPathExtension().lastPathComponent
            guard let item = metadata(id, in: folder), item.scope == scope,
                  item.account == config.account, item.cid == config.cid,
                  let data = try? Data(contentsOf: file) else { continue }
            return Pending(metadata: item, data: data)
        }
        return nil
    }
    func remove(id: String, scope: String) -> Bool {
        guard validID(id), let folder = try? directory() else { return false }
        if !FileManager.default.fileExists(atPath: folder.appendingPathComponent(id + ".jpg").path) { return true }
        guard let item = metadata(id, in: folder), item.scope == scope else { return false }
        return erase(id, in: folder)
    }
}

struct CheckInError: Error, CustomLocalizedStringResourceConvertible {
    let message: String
    init(_ message: String) { self.message = message }
    var localizedStringResource: LocalizedStringResource { LocalizedStringResource(stringLiteral: message) }
}

struct CheckInOpenerIntent: AppIntent {
    static var title: LocalizedStringResource = "小手机·查岗开场"
    static var description = IntentDescription("弹出角色写的开场白。取消会停止快捷指令；确认仅允许本次截屏。")
    static var openAppWhenRun = false
    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let opening = try await CheckInStore.shared.prepareOpening() else { return .result(value: "") }
        try await requestConfirmation(actionName: .continue, dialog: IntentDialog(stringLiteral: opening.line))
        try await CheckInStore.shared.approve(scope: opening.scope)
        return .result(value: opening.line)
    }
}

struct CheckInScreenshotIntent: AppIntent {
    static var title: LocalizedStringResource = "交给小手机查岗"
    static var description = IntentDescription("接收上一步截屏。本次确认过才保存并打开小手机，交给指定角色；没确认的截屏直接丢弃。")
    // Runs in the background; only a confirmed screenshot brings the app forward.
    static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    @Parameter(title: "截图", supportedContentTypes: [.image]) var screenshot: IntentFile
    @MainActor
    func perform() async throws -> some IntentResult {
        guard try await CheckInStore.shared.save(imageData: screenshot.data) != nil else { return .result() }
        do { try await continueInForeground(nil, alwaysConfirm: false) }
        catch {
            // The image is already queued; a tap on this opens the app, which picks it up.
            let content = UNMutableNotificationContent()
            content.title = "查岗截图已交出"
            content.body = "点开小手机，看看TA怎么说。"
            try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "checkin-handoff", content: content, trigger: nil))
        }
        return .result()
    }
}
