import DeviceActivity
import SwiftUI
import UIKit

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

    static var persisted: SmallPhoneStatusBarTheme {
        guard let raw = UserDefaults.standard.string(
            forKey: "smallPhone.statusBarTheme.v1"
        ) else { return .black }
        return SmallPhoneStatusBarTheme(rawValue: raw) ?? .black
    }
}

private struct SmallPhoneUsageReportSurface: View {
    let filterEnd: Date

    private let reportContext =
        DeviceActivityReport.Context("Total Activity")

    private var todayFilter: DeviceActivityFilter {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = min(
            calendar.date(byAdding: .day, value: 1, to: start) ?? Date(),
            max(start.addingTimeInterval(1), filterEnd)
        )
        return DeviceActivityFilter(
            segment: .daily(during: DateInterval(start: start, end: end)),
            users: .all,
            devices: .init([.iPhone])
        )
    }

    var body: some View {
        DeviceActivityReport(reportContext, filter: todayFilter)
            .frame(width: 2, height: 2)
            .opacity(0.01)
            .allowsHitTesting(false)
    }
}

@MainActor
private final class SmallPhoneUsageReportMountController: UIViewController {
    private let hostID = String(UUID().uuidString.prefix(8))
    private var observer: NSObjectProtocol?
    private var reportController:
        UIHostingController<SmallPhoneUsageReportSurface>?
    private var unmountTask: Task<Void, Never>?
    private var generation = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = false
        SmallPhoneDiagnosticsStore.append(
            "native.usageReport.host.init",
            fields: ["hostID": hostID]
        )
        observer = NotificationCenter.default.addObserver(
            forName: .companionUsageReportRefreshRequested,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.mountFreshReport()
            }
        }
    }

    deinit {
        SmallPhoneDiagnosticsStore.append(
            "native.usageReport.host.deinit",
            fields: ["hostID": hostID]
        )
        unmountTask?.cancel()
        if let observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func mountFreshReport() {
        generation += 1
        let currentGeneration = generation
        unmountTask?.cancel()
        removeReport()

        let controller = UIHostingController(
            rootView: SmallPhoneUsageReportSurface(filterEnd: Date())
        )
        controller.view.backgroundColor = .clear
        controller.view.isUserInteractionEnabled = false
        addChild(controller)
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(controller.view)
        NSLayoutConstraint.activate([
            controller.view.widthAnchor.constraint(equalToConstant: 2),
            controller.view.heightAnchor.constraint(equalToConstant: 2),
            controller.view.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            controller.view.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        controller.didMove(toParent: self)
        reportController = controller
        SmallPhoneDiagnosticsStore.append(
            "native.usageReport.mount",
            fields: [
                "generation": currentGeneration,
                "hostID": hostID
            ]
        )

        unmountTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 12_000_000_000)
            guard !Task.isCancelled,
                  let self,
                  self.generation == currentGeneration else { return }
            self.removeReport()
            SmallPhoneDiagnosticsStore.append(
                "native.usageReport.unmount",
                fields: [
                    "generation": currentGeneration,
                    "hostID": self.hostID
                ]
            )
        }
    }

    private func removeReport() {
        guard let controller = reportController else { return }
        reportController = nil
        controller.willMove(toParent: nil)
        controller.view.removeFromSuperview()
        controller.removeFromParent()
    }
}

private struct SmallPhoneUsageReportMountView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context)
        -> SmallPhoneUsageReportMountController {
        SmallPhoneUsageReportMountController()
    }

    func updateUIViewController(
        _ controller: SmallPhoneUsageReportMountController,
        context: Context
    ) {}
}

struct SmallPhonePrivateRootView: View {
    @State private var showsDeviceManagement = false
    // Start with the persisted theme so first-page rendering does not need an
    // immediate root-state transition that can disturb the WKWebView host.
    @State private var statusBarTheme = SmallPhoneStatusBarTheme.persisted

    var body: some View {
        ZStack {
            // The system-owned top safe area stays outside the web view, but its
            // background and icon contrast now follow the selected phone theme.
            // This does not push the page under the Dynamic Island.
            statusBarTheme.color
                .ignoresSafeArea(.container, edges: .top)

            LocalPhoneWebView {
                showsDeviceManagement = true
            }

            // Keep the report host structurally stable and let its UIKit child
            // mount the system report only for a real read. The former 12-second
            // root-state toggle is the strongest time-correlated remount suspect;
            // isolating it here lets diagnostics confirm the lifecycle without
            // changing Screen Time, the bridge or stored user data.
            SmallPhoneUsageReportMountView()
                .frame(width: 2, height: 2)
                .allowsHitTesting(false)
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
                for: .smallPhoneStatusBarThemeChanged
            )
        ) { notification in
            guard let raw = notification.userInfo?["theme"] as? String,
                  let theme = SmallPhoneStatusBarTheme(rawValue: raw) else {
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
