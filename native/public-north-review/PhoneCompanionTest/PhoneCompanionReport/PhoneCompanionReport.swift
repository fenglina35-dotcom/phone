import DeviceActivity
import ExtensionKit
import SwiftUI

@main
struct PhoneCompanionReport: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        TotalActivityReport { totalActivity in
            TotalActivityView(totalActivity: totalActivity)
        }
    }
}
