@preconcurrency import AVFoundation
import AVKit
import UIKit
import WebKit

@MainActor
final class CallPictureInPictureController: NSObject, AVPictureInPictureControllerDelegate, AVAudioPlayerDelegate {
    static let shared = CallPictureInPictureController()

    private weak var webView: WKWebView?
    private var sourceView: UIView?
    private var pictureController: AVPictureInPictureController?
    private var contentController: AVPictureInPictureVideoCallViewController?
    private let nameLabel = UILabel()
    private let stateLabel = UILabel()
    private let subtitleLabel = UILabel()
    private var subtitleMinimumHeight: NSLayoutConstraint?
    private var subtitleAnimator: UIViewPropertyAnimator?
    private var audioPlayer: AVAudioPlayer?
    private var enhancedAudioEngine: AVAudioEngine?
    private var enhancedPlayerNode: AVAudioPlayerNode?
    private var enhancedAudioFile: AVAudioFile?
    private var enhancedAudioURL: URL?
    private var enhancedFinishTimer: Timer?
    private var audioCompletion: ((Bool) -> Void)?

    func attach(to webView: WKWebView?) {
        self.webView = webView
    }

    func start(
        name: String,
        kind: String,
        subtitle: String,
        subtitleWho: String,
        subtitleMotion: [String: Any]
    ) -> Bool {
        guard AVPictureInPictureController.isPictureInPictureSupported(), let webView else {
            return false
        }
        if pictureController == nil {
            let source = UIView(frame: CGRect(x: 1, y: 1, width: 2, height: 2))
            source.isUserInteractionEnabled = false
            source.backgroundColor = UIColor.black.withAlphaComponent(0.01)
            webView.addSubview(source)
            sourceView = source

            let videoCall = AVPictureInPictureVideoCallViewController()
            videoCall.preferredContentSize = CGSize(width: 360, height: 144)
            configureContent(in: videoCall.view)
            contentController = videoCall

            let contentSource = AVPictureInPictureController.ContentSource(
                activeVideoCallSourceView: source,
                contentViewController: videoCall
            )
            let controller = AVPictureInPictureController(contentSource: contentSource)
            controller.delegate = self
            controller.canStartPictureInPictureAutomaticallyFromInline = true
            pictureController = controller
        }
        update(
            name: name,
            kind: kind,
            subtitle: subtitle,
            subtitleWho: subtitleWho,
            subtitleMotion: subtitleMotion,
            screenSharing: false
        )
        activateCallAudio()
        return true
    }

    func update(
        name: String,
        kind: String,
        subtitle: String,
        subtitleWho: String,
        subtitleMotion: [String: Any],
        screenSharing: Bool
    ) {
        nameLabel.text = name.isEmpty ? "角色" : name
        stateLabel.text = screenSharing ? "屏幕共享中" : (kind == "video" ? "视频通话" : "语音通话")
        updateSubtitle(subtitle, who: subtitleWho, motion: subtitleMotion)
    }

    private func updateSubtitle(
        _ subtitle: String,
        who: String,
        motion: [String: Any]
    ) {
        guard subtitleLabel.text != subtitle else { return }
        subtitleAnimator?.stopAnimation(true)
        subtitleLabel.layer.removeAllAnimations()
        subtitleLabel.text = subtitle
        let hasSubtitle = !subtitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        subtitleLabel.isHidden = !hasSubtitle
        subtitleMinimumHeight?.isActive = hasSubtitle
        subtitleLabel.textColor = who == "me"
            ? UIColor(red: 1, green: 0.84, blue: 0.91, alpha: 1)
            : .white
        guard hasSubtitle else {
            subtitleLabel.alpha = 0
            subtitleLabel.transform = .identity
            return
        }
        let length = subtitle.count
        subtitleLabel.font = .systemFont(
            ofSize: length > 130 ? 9.5 : (length > 80 ? 11 : 14),
            weight: .medium
        )
        subtitleLabel.alpha = 0
        subtitleLabel.transform = CGAffineTransform(translationX: 0, y: 8)
            .scaledBy(x: 0.98, y: 0.98)
        let animator = UIViewPropertyAnimator(
            duration: 0.3,
            controlPoint1: CGPoint(x: 0.25, y: 0.1),
            controlPoint2: CGPoint(x: 0.25, y: 1)
        ) {
            self.subtitleLabel.alpha = 1
            self.subtitleLabel.transform = .identity
        }
        subtitleAnimator = animator
        animator.startAnimation()
    }

    func end() {
        if pictureController?.isPictureInPictureActive == true {
            pictureController?.stopPictureInPicture()
        }
        pictureController = nil
        contentController = nil
        sourceView?.removeFromSuperview()
        sourceView = nil
        stopAudio()
    }

    func playAudio(
        data: Data,
        mime: String = "audio/mpeg",
        volume: Float,
        mixWithMedia: Bool = false,
        preserveCurrentSession: Bool = false,
        completion: @escaping (Bool) -> Void
    ) {
        stopAudio()
        // Bilibili and hands-free recognition already share the App's active
        // audio session. Reapplying its category here interrupts WKWebView
        // playback even when mixWithOthers is present.
        if !preserveCurrentSession {
            activateCallAudio(mixWithMedia: mixWithMedia)
        }
        // AVAudioPlayer clamps volume to 1.0, so the former 100–300% setting
        // was identical while a loud video was playing. Shared-media speech
        // gets a public AVAudioUnitEQ gain stage without touching the active media
        // session; ordinary calls keep the proven AVAudioPlayer path below.
        if mixWithMedia, playEnhancedAudio(data: data, mime: mime, volume: volume, completion: completion) {
            return
        }
        do {
            let player = try AVAudioPlayer(data: data)
            player.delegate = self
            player.volume = max(0, min(1, volume))
            player.prepareToPlay()
            audioPlayer = player
            audioCompletion = completion
            guard player.play() else {
                stopAudio(result: false)
                return
            }
        } catch {
            completion(false)
        }
    }

    func stopAudio(result: Bool = false) {
        audioPlayer?.stop()
        audioPlayer = nil
        enhancedPlayerNode?.stop()
        enhancedAudioEngine?.stop()
        enhancedFinishTimer?.invalidate()
        enhancedFinishTimer = nil
        enhancedPlayerNode = nil
        enhancedAudioEngine = nil
        enhancedAudioFile = nil
        if let url = enhancedAudioURL {
            try? FileManager.default.removeItem(at: url)
        }
        enhancedAudioURL = nil
        let completion = audioCompletion
        audioCompletion = nil
        completion?(result)
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            guard self.audioPlayer === player else { return }
            self.audioPlayer = nil
            let completion = self.audioCompletion
            self.audioCompletion = nil
            completion?(flag)
        }
    }

    private func playEnhancedAudio(
        data: Data,
        mime: String,
        volume: Float,
        completion: @escaping (Bool) -> Void
    ) -> Bool {
        let lowerMime = mime.lowercased()
        let fileExtension: String
        if lowerMime.contains("wav") {
            fileExtension = "wav"
        } else if lowerMime.contains("mp4") || lowerMime.contains("m4a") || lowerMime.contains("aac") {
            fileExtension = "m4a"
        } else {
            fileExtension = "mp3"
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("small-phone-role-\(UUID().uuidString)")
            .appendingPathExtension(fileExtension)
        do {
            try data.write(to: url, options: .atomic)
            let file = try AVAudioFile(forReading: url)
            let engine = AVAudioEngine()
            let player = AVAudioPlayerNode()
            let gainUnit = AVAudioUnitEQ(numberOfBands: 0)
            let requested = max(1, min(3, volume))
            let extraGain = Float(20 * log10(Double(requested)))
            gainUnit.globalGain = min(12, 5 + extraGain)
            player.volume = max(0, min(1, volume))

            engine.attach(player)
            engine.attach(gainUnit)
            engine.connect(player, to: gainUnit, format: file.processingFormat)
            engine.connect(gainUnit, to: engine.mainMixerNode, format: file.processingFormat)
            engine.prepare()
            try engine.start()

            enhancedAudioURL = url
            enhancedAudioFile = file
            enhancedAudioEngine = engine
            enhancedPlayerNode = player
            audioCompletion = completion
            // Do not use AVAudioPlayerNode's @Sendable completion closure here:
            // capturing AVFoundation reference types creates Swift 6 build errors.
            player.scheduleFile(file, at: nil, completionHandler: nil)
            player.play()
            if player.isPlaying {
                let sampleRate = file.processingFormat.sampleRate
                let duration = sampleRate > 0
                    ? Double(file.length) / sampleRate
                    : 60
                enhancedFinishTimer = Timer.scheduledTimer(
                    timeInterval: max(0.1, duration + 0.05),
                    target: self,
                    selector: #selector(enhancedAudioDidFinish),
                    userInfo: nil,
                    repeats: false
                )
                return true
            }
            player.stop()
            engine.stop()
            enhancedPlayerNode = nil
            enhancedAudioEngine = nil
            enhancedAudioFile = nil
            enhancedAudioURL = nil
            enhancedFinishTimer?.invalidate()
            enhancedFinishTimer = nil
            audioCompletion = nil
            try? FileManager.default.removeItem(at: url)
            return false
        } catch {
            try? FileManager.default.removeItem(at: url)
            enhancedAudioURL = nil
            enhancedAudioFile = nil
            enhancedAudioEngine = nil
            enhancedPlayerNode = nil
            enhancedFinishTimer?.invalidate()
            enhancedFinishTimer = nil
            audioCompletion = nil
            return false
        }
    }

    @objc private func enhancedAudioDidFinish() {
        stopAudio(result: true)
    }

    private func activateCallAudio(mixWithMedia: Bool = false) {
        let session = AVAudioSession.sharedInstance()
        if mixWithMedia {
            try? session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.defaultToSpeaker, .allowBluetoothHFP, .mixWithOthers]
            )
        } else {
            try? session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.defaultToSpeaker, .allowBluetoothHFP, .mixWithOthers]
            )
        }
        try? session.setActive(true)
    }

    private func configureContent(in root: UIView) {
        root.isOpaque = false
        // The system owns the outer PiP surface. Keep our content fully clear;
        // iOS may still provide its own black backing, but the App must not add
        // a second opaque panel that hides the screen underneath.
        root.backgroundColor = .clear
        root.layer.borderWidth = 0
        nameLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        nameLabel.textColor = .white
        nameLabel.textAlignment = .center
        stateLabel.font = .systemFont(ofSize: 11, weight: .medium)
        stateLabel.textColor = UIColor.white.withAlphaComponent(0.62)
        stateLabel.textAlignment = .center
        subtitleLabel.font = .systemFont(ofSize: 14, weight: .medium)
        subtitleLabel.textColor = .white
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 0
        subtitleLabel.lineBreakMode = .byCharWrapping
        subtitleLabel.adjustsFontSizeToFitWidth = true
        subtitleLabel.minimumScaleFactor = 0.58
        subtitleLabel.isHidden = true

        [nameLabel, stateLabel, subtitleLabel].forEach { label in
            label.layer.shadowColor = UIColor.black.cgColor
            label.layer.shadowOpacity = 0.72
            label.layer.shadowRadius = 2.5
            label.layer.shadowOffset = CGSize(width: 0, height: 1)
        }

        let stack = UIStackView(arrangedSubviews: [nameLabel, stateLabel, subtitleLabel])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 3
        stack.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(stack)
        nameLabel.setContentHuggingPriority(.required, for: .vertical)
        stateLabel.setContentHuggingPriority(.required, for: .vertical)
        let subtitleHeight = subtitleLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 56)
        subtitleMinimumHeight = subtitleHeight
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: root.topAnchor, constant: 10),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: root.bottomAnchor, constant: -8)
        ])
    }
}
