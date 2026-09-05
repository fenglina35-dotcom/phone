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

private struct SmallPhoneNativeRecoveryOverlay: View {
    let reason: String
    let isPreparing: Bool
    let onReopen: () -> Void
    let onInspectArchive: () -> Void
    let onContinueWaiting: () -> Void
    @State private var copied = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.96)
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {
                    Image(systemName: "wrench.and.screwdriver.fill")
                        .font(.system(size: 42, weight: .semibold))
                        .foregroundStyle(Color(red: 1, green: 0.52, blue: 0.68))

                    Text("小手机页面已停止响应")
                        .font(.title2.weight(.bold))
                        .multilineTextAlignment(.center)

                    Text(reason)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("重开不会主动删除已经落盘的聊天、角色、图片、登录信息或密钥。重开前会先等待存档写入；若页面彻底卡死，最后尚未落盘的变化无法绝对保证。")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color(red: 0.48, green: 0.88, blue: 0.65))
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    Button(action: onReopen) {
                        Text(isPreparing ? "正在保存并准备重开…" : "安全重新打开小手机")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 1, green: 0.52, blue: 0.68))
                    .controlSize(.large)
                    .disabled(isPreparing)

                    Button(action: onInspectArchive) {
                        Text("重开后检查本机存档")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(isPreparing)

                    Button(action: onContinueWaiting) {
                        Text("继续等待，不重开")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(isPreparing)

                    Button {
                        UIPasteboard.general.string =
                            SmallPhoneDiagnosticsStore.recentText(limit: 80)
                        copied = true
                    } label: {
                        Text(copied ? "诊断已复制" : "复制诊断给开发者")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                }
                .foregroundStyle(.white)
                .padding(24)
                .frame(maxWidth: 520)
                .background(Color(red: 0.10, green: 0.10, blue: 0.11))
                .overlay {
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(Color.white.opacity(0.14), lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .padding(.horizontal, 22)
                .padding(.vertical, 48)
            }
        }
    }
}

struct SmallPhonePrivateRootView: View {
    @State private var showsDeviceManagement = false
    @State private var webViewGeneration = 0
    @State private var recoveryReason: String?
    @State private var recoveryRestartPending = false
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

            LocalPhoneWebView(
                onOpenDeviceManagement: {
                    showsDeviceManagement = true
                },
                onRecoveryNeeded: { reason in
                    recoveryRestartPending = false
                    recoveryReason = reason
                },
                onRecoveryRestartReady: { inspectArchive in
                    if inspectArchive {
                        SmallPhoneRecoveryLaunchStore.request()
                    }
                    SmallPhoneDiagnosticsStore.append(
                        "native.recovery.manualReopen",
                        fields: ["inspectArchive": inspectArchive]
                    )
                    recoveryRestartPending = false
                    recoveryReason = nil
                    webViewGeneration += 1
                },
                onRecoveryContinued: {
                    recoveryRestartPending = false
                    recoveryReason = nil
                }
            )
            .id(webViewGeneration)

            // Keep the report host structurally stable and let its UIKit child
            // mount the system report only for a real read. The former 12-second
            // root-state toggle is the strongest time-correlated remount suspect;
            // isolating it here lets diagnostics confirm the lifecycle without
            // changing Screen Time, the bridge or stored user data.
            SmallPhoneUsageReportMountView()
                .frame(width: 2, height: 2)
                .allowsHitTesting(false)

            if let recoveryReason {
                SmallPhoneNativeRecoveryOverlay(
                    reason: recoveryReason,
                    isPreparing: recoveryRestartPending,
                    onReopen: {
                        requestRecoveryRestart(inspectArchive: false)
                    },
                    onInspectArchive: {
                        requestRecoveryRestart(inspectArchive: true)
                    },
                    onContinueWaiting: {
                        NotificationCenter.default.post(
                            name: LocalPhoneWebView.recoveryContinueRequested,
                            object: nil
                        )
                    }
                )
                .zIndex(10_000)
            }
        }
        // The private WKWebView must continue beneath the home-indicator area.
        // The top status area remains system-owned while its color follows theme.
        .ignoresSafeArea(.container, edges: .bottom)
        .preferredColorScheme(statusBarTheme.colorScheme)
        // Keep the WKWebView frame stable while the native keyboard animates.
        // WebKit moves the focused composer inside this fixed frame; letting
        // SwiftUI shrink it at the same time causes a second jump and a black
        // frame during dismissal.
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

    private func requestRecoveryRestart(inspectArchive: Bool) {
        let thermalState = ProcessInfo.processInfo.thermalState
        guard thermalState != .serious, thermalState != .critical else {
            recoveryRestartPending = false
            recoveryReason =
                "系统仍处于严重发热状态，已阻止反复重开。请先点“继续等待，不重开”，等手机降温后再尝试。"
            return
        }
        recoveryRestartPending = true
        NotificationCenter.default.post(
            name: LocalPhoneWebView.recoveryRestartRequested,
            object: nil,
            userInfo: ["inspectArchive": inspectArchive]
        )
    }
}
