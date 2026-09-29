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
                userInfo: [NSLocalizedFailureReasonErrorKey: "通话已结束，屏幕共享已停止"]
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
        defaults?.set(now * 1000, forKey: "screenShare.frameAt.v1")
        defaults?.set((defaults?.integer(forKey: "screenShare.sequence.v1") ?? 0) + 1,
                      forKey: "screenShare.sequence.v1")
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
