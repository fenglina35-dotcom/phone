import CoreImage
import CoreMedia
import Foundation
import ImageIO
import ReplayKit
import UIKit

final class SampleHandler: RPBroadcastSampleHandler {
    private let appGroup = "group.com.qianyi.PhoneCompanionTest"
    private let context = CIContext(options: [.useSoftwareRenderer: false])
    private var lastFrameAt: TimeInterval = 0

    // Watch together with K. While the owner has switched this on, the latest picture also
    // goes to the robot's cloud function so that the role speaking through K can see the
    // screen. This extension keeps running while the host App is suspended; the web side's
    // timers do not, which is why the upload lives here (see docs/areas/屏幕共享.md).
    // The key belongs to one share and is removed when the cloud says the share is over.
    private static let robotURLKey = "screenShare.robotURL.v1"
    private static let robotTokenKey = "screenShare.robotToken.v1"
    private static let robotInterval: TimeInterval = 8
    private let robotLock = NSLock()
    private var robotUploading = false
    private var robotLastAt: TimeInterval = 0
    private lazy var robotSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 15
        configuration.waitsForConnectivity = false
        configuration.httpMaximumConnectionsPerHost = 1
        return URLSession(configuration: configuration)
    }()

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        UserDefaults(suiteName: appGroup)?.set(false, forKey: "screenShare.stopRequested.v1")
        setActive(true)
        clearLatestFrame()
    }

    override func broadcastPaused() {}

    override func broadcastResumed() {}

    override func broadcastFinished() {
        setActive(false)
        clearLatestFrame()
        clearRobotUpload()
    }

    override func processSampleBuffer(
        _ sampleBuffer: CMSampleBuffer,
        with sampleBufferType: RPSampleBufferType
    ) {
        if UserDefaults(suiteName: appGroup)?.bool(forKey: "screenShare.stopRequested.v1") == true {
            UserDefaults(suiteName: appGroup)?.set(false, forKey: "screenShare.stopRequested.v1")
            finishBroadcastWithError(NSError(
                domain: "SmallPhoneScreenShare",
                code: 0,
                userInfo: [NSLocalizedFailureReasonErrorKey: "屏幕共享已停止"]
            ))
            return
        }
        guard sampleBufferType == .video else { return }
        let now = Date().timeIntervalSince1970
        guard now - lastFrameAt >= 0.65,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer),
              let base = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroup
              ) else { return }
        lastFrameAt = now

        var input = CIImage(cvPixelBuffer: pixelBuffer)
        if let value = CMGetAttachment(
            sampleBuffer,
            key: RPVideoSampleOrientationKey as CFString,
            attachmentModeOut: nil
        ) as? NSNumber,
           let orientation = CGImagePropertyOrientation(
               rawValue: value.uint32Value
           ) {
            input = input.oriented(orientation)
        }
        let orientedExtent = input.extent.integral
        if orientedExtent.origin != .zero {
            input = input.transformed(by: CGAffineTransform(
                translationX: -orientedExtent.origin.x,
                y: -orientedExtent.origin.y
            ))
        }
        let longest = max(input.extent.width, input.extent.height)
        let scale = longest > 960 ? 960 / longest : 1
        let output = input.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let image = context.createCGImage(output, from: output.extent),
              let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.72) else { return }
        let url = base.appendingPathComponent("screen-share-latest.jpg")
        try? data.write(to: url, options: .atomic)
        let defaults = UserDefaults(suiteName: appGroup)
        if defaults?.bool(forKey: "screenShare.hostForeground.v1") != true {
            let backgroundURL = base.appendingPathComponent(
                "screen-share-background-latest.jpg"
            )
            do {
                try data.write(to: backgroundURL, options: .atomic)
                defaults?.set(true, forKey: "screenShare.backgroundFrameReady.v1")
                defaults?.set(now * 1000, forKey: "screenShare.backgroundFrameAt.v1")
            } catch {
                // The ordinary latest frame remains available. A failed
                // handoff write must never terminate the user's broadcast.
            }
        }
        uploadForRobot(input, at: now, defaults: defaults)
        defaults?.set(now * 1000, forKey: "screenShare.frameAt.v1")
        defaults?.set((defaults?.integer(forKey: "screenShare.sequence.v1") ?? 0) + 1,
                      forKey: "screenShare.sequence.v1")
        defaults?.synchronize()
    }

    /// Posts a smaller copy (longest side 768) at most every eight seconds, one at a time.
    /// A failed upload never disturbs the broadcast or the local frame files.
    private func uploadForRobot(_ input: CIImage, at now: TimeInterval, defaults: UserDefaults?) {
        guard let token = defaults?.string(forKey: Self.robotTokenKey), token.count == 64,
              let text = defaults?.string(forKey: Self.robotURLKey),
              let url = URL(string: text), url.scheme == "https" else { return }
        robotLock.lock()
        let due = !robotUploading && now - robotLastAt >= Self.robotInterval
        if due { robotUploading = true; robotLastAt = now }
        robotLock.unlock()
        guard due else { return }
        let longest = max(input.extent.width, input.extent.height)
        let scale = longest > 768 ? 768 / longest : 1
        let output = input.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let image = context.createCGImage(output, from: output.extent),
              let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.6),
              data.count <= 480_000 else {
            robotLock.lock(); robotUploading = false; robotLock.unlock()
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        request.setValue(String(Int64(now * 1000)), forHTTPHeaderField: "X-Captured-Ms")
        request.setValue(
            String(defaults?.integer(forKey: "screenShare.sequence.v1") ?? 0),
            forHTTPHeaderField: "X-Sequence"
        )
        let appGroup = self.appGroup
        robotSession.uploadTask(with: request, from: data) { [weak self] _, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let shared = UserDefaults(suiteName: appGroup)
            if status == 410 || status == 401 || status == 403,
               shared?.string(forKey: Self.robotTokenKey) == token {
                // The share was stopped or replaced on the cloud side: stop posting.
                shared?.removeObject(forKey: Self.robotTokenKey)
                shared?.removeObject(forKey: Self.robotURLKey)
            }
            shared?.set(status, forKey: "screenShare.robotLastStatus.v1")
            shared?.set(now * 1000, forKey: "screenShare.robotLastAt.v1")
            self?.robotLock.lock()
            self?.robotUploading = false
            self?.robotLock.unlock()
        }.resume()
    }

    private func clearRobotUpload() {
        let defaults = UserDefaults(suiteName: appGroup)
        defaults?.removeObject(forKey: Self.robotTokenKey)
        defaults?.removeObject(forKey: Self.robotURLKey)
        defaults?.synchronize()
    }

    private func setActive(_ active: Bool) {
        let defaults = UserDefaults(suiteName: appGroup)
        defaults?.set(active, forKey: "screenShare.active.v1")
        defaults?.set(Date().timeIntervalSince1970 * 1000,
                      forKey: active ? "screenShare.startedAt.v1" : "screenShare.endedAt.v1")
        defaults?.synchronize()
    }

    private func clearLatestFrame() {
        guard let base = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroup
        ) else { return }
        try? FileManager.default.removeItem(
            at: base.appendingPathComponent("screen-share-latest.jpg")
        )
        try? FileManager.default.removeItem(
            at: base.appendingPathComponent(
                "screen-share-background-latest.jpg"
            )
        )
        let defaults = UserDefaults(suiteName: appGroup)
        defaults?.set(false, forKey: "screenShare.backgroundFrameReady.v1")
        defaults?.synchronize()
    }
}
