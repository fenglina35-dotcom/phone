import Foundation
import Intents
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttemptContent: UNMutableNotificationContent?
    private var avatarTask: URLSessionDataTask?
    private var didFinish = false

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        self.bestAttemptContent = request.content.mutableCopy()
            as? UNMutableNotificationContent

        guard let content = bestAttemptContent,
              let rolePush = request.content.userInfo["rolePush"]
                as? [String: Any],
              let roleID = rolePush["roleId"] as? String,
              !roleID.isEmpty else {
            finish(with: request.content)
            return
        }

        // The shared role-push service still sends the public North badge
        // placeholder "1". The private app has no unread-count ledger yet,
        // so carrying that value forward creates a permanent false badge.
        content.badge = nil

        let roleName = (rolePush["roleName"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = roleName.flatMap { $0.isEmpty ? nil : $0 }
            ?? content.title
        let outboxID = (rolePush["outboxId"] as? String) ?? UUID().uuidString
        let messageIndex = (rolePush["messageIndex"] as? NSNumber)?.intValue ?? 0
        let notificationID = "role-\(roleID)-\(outboxID)-\(messageIndex)"
        content.threadIdentifier = notificationID
        content.title = displayName

        guard let value = rolePush["avatarURL"] as? String,
              let avatarURL = URL(string: value),
              avatarURL.scheme == "https" else {
            deliverCommunication(
                content: content,
                roleID: roleID,
                roleName: displayName,
                notificationID: notificationID,
                avatarData: nil
            )
            return
        }

        var avatarRequest = URLRequest(url: avatarURL)
        avatarRequest.timeoutInterval = 8
        avatarRequest.cachePolicy = .returnCacheDataElseLoad
        avatarTask = URLSession.shared.dataTask(with: avatarRequest) {
            [weak self] data, response, _ in
            guard let self else { return }
            let http = response as? HTTPURLResponse
            let type = http?.value(forHTTPHeaderField: "Content-Type") ?? ""
            let valid = http?.statusCode == 200
                && type.lowercased().hasPrefix("image/")
                && (data?.isEmpty == false)
                && (data?.count ?? 0) <= 64_000
            self.deliverCommunication(
                content: content,
                roleID: roleID,
                roleName: displayName,
                notificationID: notificationID,
                avatarData: valid ? data : nil
            )
        }
        avatarTask?.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        avatarTask?.cancel()
        if let content = bestAttemptContent {
            finish(with: content)
        }
    }

    private func deliverCommunication(
        content: UNMutableNotificationContent,
        roleID: String,
        roleName: String,
        notificationID: String,
        avatarData: Data?
    ) {
        let handle = INPersonHandle(value: roleID, type: .unknown)
        let image: INImage?
        if let avatarData {
            image = INImage(imageData: avatarData)
        } else {
            image = nil
        }
        let sender = INPerson(
            personHandle: handle,
            nameComponents: nil,
            displayName: roleName,
            image: image,
            contactIdentifier: nil,
            customIdentifier: roleID
        )
        let intent = INSendMessageIntent(
            recipients: nil,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: nil,
            conversationIdentifier: notificationID,
            serviceName: "小手机",
            sender: sender,
            attachments: nil
        )
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate { [weak self] _ in
            guard let self else { return }
            do {
                self.finish(with: try content.updating(from: intent))
            } catch {
                self.finish(with: content)
            }
        }
    }

    private func finish(with content: UNNotificationContent) {
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.didFinish,
                  let handler = self.contentHandler else { return }
            self.didFinish = true
            self.avatarTask?.cancel()
            self.contentHandler = nil
            handler(content)
        }
    }
}
