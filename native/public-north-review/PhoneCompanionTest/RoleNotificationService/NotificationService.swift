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

        let roleName = (rolePush["roleName"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = roleName.flatMap { $0.isEmpty ? nil : $0 }
            ?? content.title
        content.threadIdentifier = "role-\(roleID)"

        guard let value = rolePush["avatarURL"] as? String,
              let avatarURL = URL(string: value),
              avatarURL.scheme == "https" else {
            deliverCommunication(
                content: content,
                roleID: roleID,
                roleName: displayName,
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
            conversationIdentifier: "role-\(roleID)",
            serviceName: "小手机",
            sender: sender,
            attachments: nil
        )
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)

        do {
            finish(with: try content.updating(from: intent))
        } catch {
            finish(with: content)
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

