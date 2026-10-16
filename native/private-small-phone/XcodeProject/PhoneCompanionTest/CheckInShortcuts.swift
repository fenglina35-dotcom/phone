import AppIntents
import Foundation
import ImageIO
import UniformTypeIdentifiers

// CHECKIN_SHORTCUTS_V1: only a confirmed, configured owner shortcut can enqueue a screenshot.
// Temporary native files expire; the received chat image follows normal chat retention.
actor CheckInStore {
    static let shared = CheckInStore()
    private let configKey = "smallPhone.checkIn.config.v2"
    private let approvalKey = "smallPhone.checkIn.approval.v2"
    private let previousKey = "smallPhone.checkIn.previousLine.v2"
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
    }
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
            account: value.account, cid: value.cid, scope: value.scope, lines: Array(lines.prefix(40)))
        if old?.scope != stored.scope || old?.account != stored.account || old?.cid != stored.cid || !stored.enabled {
            UserDefaults.standard.removeObject(forKey: approvalKey)
        }
        if let data = try? JSONEncoder().encode(stored) { UserDefaults.standard.set(data, forKey: configKey) }
        return stored.lines.count
    }

    func prepareOpening() throws -> Opening {
        UserDefaults.standard.removeObject(forKey: approvalKey) // A cancelled second prompt must never reuse an earlier approval.
        guard let config = configuration(), config.enabled, !config.lines.isEmpty else {
            throw CheckInError("先在小手机的快捷指令与查岗页面选择角色、生成开场白并开启截屏")
        }
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

    func save(imageData: Data) throws -> String {
        guard let config = configuration(), config.enabled, let permitted = approval(),
              permitted.scope == config.scope, Date().timeIntervalSince(permitted.at) >= 0,
              Date().timeIntervalSince(permitted.at) <= 120 else {
            throw CheckInError("请先运行并确认「小手机·查岗开场」，取消后不会接收截图")
        }
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
        let opening = try await CheckInStore.shared.prepareOpening()
        try await requestConfirmation(actionName: .continue, dialog: IntentDialog(stringLiteral: opening.line))
        try await CheckInStore.shared.approve(scope: opening.scope)
        return .result(value: opening.line)
    }
}

struct CheckInScreenshotIntent: AppIntent {
    static var title: LocalizedStringResource = "交给小手机查岗"
    static var description = IntentDescription("接收上一步截屏并打开小手机。进入指定角色微信后，会通过配置的识图服务理解并回复。")
    static var openAppWhenRun = true
    @Parameter(title: "截图", supportedContentTypes: [.image]) var screenshot: IntentFile
    @MainActor
    func perform() async throws -> some IntentResult {
        _ = try await CheckInStore.shared.save(imageData: screenshot.data)
        return .result()
    }
}
