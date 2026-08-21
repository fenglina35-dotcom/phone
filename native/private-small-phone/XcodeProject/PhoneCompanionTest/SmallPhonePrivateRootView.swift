import DeviceActivity
import SwiftUI

extension Notification.Name {
    static let smallPhoneStatusBarThemeChanged = Notification.Name(
        "SmallPhoneStatusBarThemeChanged"
    )
}

private enum SmallPhoneStatusBarTheme: String {
    case black
    case pink
    case blue
    case gray
    case white

    var color: Color {
        switch self {
        case .black:
            return .black
        case .pink:
            return Color(red: 1, green: 234 / 255, blue: 243 / 255)
        case .blue:
            return Color(red: 234 / 255, green: 244 / 255, blue: 1)
        case .gray:
            return Color(red: 230 / 255, green: 232 / 255, blue: 236 / 255)
        case .white:
            return .white
        }
    }

    var colorScheme: ColorScheme {
        self == .black ? .dark : .light
    }
}

struct SmallPhonePrivateRootView: View {
    @State private var showsDeviceManagement = false
    @State private var reportFilterEnd = Date()
    @State private var reportMounted = false
    @State private var reportRequestGeneration = 0
    @State private var statusBarTheme = SmallPhoneStatusBarTheme.black

    private let reportContext =
        DeviceActivityReport.Context("Total Activity")

    private var todayFilter: DeviceActivityFilter {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = min(
            calendar.date(byAdding: .day, value: 1, to: start) ?? Date(),
            max(start.addingTimeInterval(1), reportFilterEnd)
        )
        return DeviceActivityFilter(
            segment: .daily(during: DateInterval(start: start, end: end)),
            users: .all,
            devices: .init([.iPhone])
        )
    }

    var body: some View {
        ZStack {
            // The system-owned top safe area stays outside the web view, but its
            // background and icon contrast now follow the selected phone theme.
            // This does not push the page under the Dynamic Island.
            statusBarTheme.color
                .ignoresSafeArea(.container, edges: .top)

            // DeviceActivityReport launches a separate report extension. It
            // only needs to exist while a real Screen Time read is pending;
            // leaving it mounted underneath WKWebView all day wastes CPU/GPU
            // and can starve taps on long-running private-App sessions.
            if reportMounted {
                DeviceActivityReport(reportContext, filter: todayFilter)
                    .frame(width: 2, height: 2)
                    .opacity(0.01)
                    .allowsHitTesting(false)
            }

            LocalPhoneWebView {
                showsDeviceManagement = true
            }
        }
        // The private WKWebView must continue beneath the home-indicator area.
        // The top status area remains system-owned while its color follows theme.
        .ignoresSafeArea(.container, edges: .bottom)
        .preferredColorScheme(statusBarTheme.colorScheme)
        // Keep the WKWebView frame fixed when the software keyboard appears.
        // Otherwise SwiftUI first shrinks the representable and WebKit then
        // scrolls the focused field, producing the visible down/up bounce.
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .onReceive(
            NotificationCenter.default.publisher(
                for: .companionUsageReportRefreshRequested
            )
        ) { _ in
            reportFilterEnd = Date()
            reportMounted = true
            reportRequestGeneration += 1
            let generation = reportRequestGeneration
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 12_000_000_000)
                guard generation == reportRequestGeneration else { return }
                reportMounted = false
            }
        }
        .onReceive(
            NotificationCenter.default.publisher(
                for: .smallPhoneStatusBarThemeChanged
            )
        ) { notification in
            guard let raw = notification.userInfo?["theme"] as? String,
                  let theme = SmallPhoneStatusBarTheme(rawValue: raw) else {
                return
            }
            statusBarTheme = theme
        }
        .onAppear {
            guard let raw = UserDefaults.standard.string(
                forKey: "smallPhone.statusBarTheme.v1"
            ), let theme = SmallPhoneStatusBarTheme(rawValue: raw) else {
                return
            }
            statusBarTheme = theme
        }
        .fullScreenCover(isPresented: $showsDeviceManagement) {
            NavigationStack {
                CompanionRootView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("完成") {
                                showsDeviceManagement = false
                            }
                        }
                    }
            }
        }
    }
}
