import CryptoKit
@preconcurrency import DeviceActivity
import ExtensionKit
import FamilyControls
import Foundation
import ManagedSettings
import SwiftUI

extension DeviceActivityReport.Context {
    static let totalActivity = Self("Total Activity")
}
private let reportAppGroupID =
    "group.com.qianyi.PhoneCompanionTest"
private let reportRequestKey =
    "report.today.request.v3"
private let reportSnapshotKey =
    "report.today.snapshot.v3"

private struct SharedReportRequest: Codable {
    let schema: Int
    let requestID: String
    let requestedAt: Date
}

private struct SharedAppUsage: Codable {
    let externalAppID: String
    let usedSeconds: Double
}

private struct SharedScreenTimeSnapshot: Codable {
    let schema: Int
    let requestID: String
    let requestedAt: Date
    let totalSeconds: Double
    let generatedAt: Date
    let apps: [SharedAppUsage]
}

struct TotalActivityReport: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .totalActivity
    let content: (String) -> TotalActivityView

    func makeConfiguration(
        representing data: DeviceActivityResults<DeviceActivityData>
    ) async -> String {
        let defaults = UserDefaults(suiteName: reportAppGroupID)
        defaults?.synchronize()
        let request = defaults
            .flatMap { $0.data(forKey: reportRequestKey) }
            .flatMap {
                try? JSONDecoder().decode(
                    SharedReportRequest.self,
                    from: $0
                )
            }

        var totalSeconds: TimeInterval = 0
        var usageByExternalID: [String: TimeInterval] = [:]

        for await deviceData in data {
            for await segment in deviceData.activitySegments {
                totalSeconds += segment.totalActivityDuration

                for await category in segment.categories {
                    for await appActivity in category.applications {
                        guard
                            let token = appActivity.application.token,
                            let externalID = stableExternalID(for: token)
                        else {
                            continue
                        }

                        usageByExternalID[externalID, default: 0] +=
                            appActivity.totalActivityDuration
                    }
                }
            }
        }

        let appRows = usageByExternalID.map {
            SharedAppUsage(
                externalAppID: $0.key,
                usedSeconds: $0.value
            )
        }
        .sorted { $0.usedSeconds > $1.usedSeconds }

        let generatedAt = Date()
        let currentRequest = request?.schema == 3
            ? request
            : nil
        let snapshot = SharedScreenTimeSnapshot(
            schema: 3,
            requestID: currentRequest?.requestID ?? "",
            requestedAt: currentRequest?.requestedAt ?? generatedAt,
            totalSeconds: totalSeconds,
            generatedAt: generatedAt,
            apps: appRows
        )

        if let encoded = try? JSONEncoder().encode(snapshot) {
            defaults?.synchronize()
            let existing = defaults
                .flatMap { $0.data(forKey: reportSnapshotKey) }
                .flatMap {
                    try? JSONDecoder().decode(
                        SharedScreenTimeSnapshot.self,
                        from: $0
                    )
                }

            if (existing?.generatedAt ?? .distantPast) <= generatedAt {
                defaults?.set(encoded, forKey: reportSnapshotKey)
                defaults?.synchronize()
            }
        }

        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.day, .hour, .minute, .second]
        formatter.unitsStyle = .abbreviated
        formatter.zeroFormattingBehavior = .dropAll
        return formatter.string(from: totalSeconds)
            ?? "No activity data"
    }

    private func stableExternalID(
        for token: ApplicationToken
    ) -> String? {
        guard let tokenData = try? JSONEncoder().encode(token) else {
            return nil
        }
        let digest = SHA256.hash(data: tokenData)
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return "ios." + hex
    }
}
