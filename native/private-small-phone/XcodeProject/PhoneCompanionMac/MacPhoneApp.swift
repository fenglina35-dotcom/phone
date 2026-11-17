// PRIVATE_MAC_CLIENT_V1: standalone Mac window; shared PhoneWeb resources and per-device credentials.
import SwiftUI
import WebKit

@main
struct MacPhoneApp: App {
    @StateObject private var model = MacPhoneModel()

    var body: some Scene {
        Window("小手机 Mac", id: "main") {
            MacPhoneWebView(model: model)
                .frame(minWidth: 390, minHeight: 650)
                .toolbar {
                    ToolbarItem {
                        Button(model.accountLabel, systemImage: "person.crop.circle") {
                            model.showsAccount = true
                        }
                    }
                }
                .sheet(isPresented: $model.showsAccount) {
                    MacAccountSheet(model: model)
                }
        }
        .defaultSize(width: 430, height: 880)
        .commands { CommandGroup(replacing: .newItem) {} }
    }
}

@MainActor
final class MacPhoneModel: ObservableObject {
    @Published var showsAccount = false
    @Published var accountLabel = "连接小手机账号"
    @Published var accountError = ""
    @Published var accountBusy = false
    let account = MacPhoneAccount()
    var bridge: MacPhoneBridge?

    init() {
        Task {
            if let result = try? await account.handle("account.status", [:]),
               let masked = result["maskedPhone"] as? String {
                accountLabel = masked
            }
        }
    }

    func signIn(phone: String, password: String) async {
        guard !accountBusy else { return }
        accountBusy = true
        accountError = ""
        defer { accountBusy = false }
        do {
            let result = try await account.handle("account.password.signin", ["phone": phone, "password": password])
            accountLabel = result["maskedPhone"] as? String ?? "账号已连接"
            showsAccount = false
            bridge?.refreshAccount()
        } catch {
            accountError = error.localizedDescription
        }
    }
}

private struct MacAccountSheet: View {
    @ObservedObject var model: MacPhoneModel
    @State private var phone = ""
    @State private var password = ""
    @State private var reveal = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("连接你的小手机").font(.title2.bold())
            Text("使用手机上已经创建的私人账号。")
                .foregroundStyle(.secondary)
            TextField("手机号", text: $phone)
                .textFieldStyle(.roundedBorder)
            HStack {
                Group {
                    if reveal { TextField("账号密码", text: $password) }
                    else { SecureField("账号密码", text: $password) }
                }.textFieldStyle(.roundedBorder)
                Button { reveal.toggle() } label: {
                    Image(systemName: reveal ? "eye.slash" : "eye")
                }
                .buttonStyle(.plain)
                .accessibilityLabel(reveal ? "隐藏密码" : "显示密码")
            }
            if !model.accountError.isEmpty {
                Text(model.accountError).foregroundStyle(.red).font(.callout)
            }
            Text("设备同步正在接入，登录后保留现有手机备份。")
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                Button("稍后") { model.showsAccount = false }
                Spacer()
                Button(model.accountBusy ? "正在连接…" : "连接账号") {
                    Task { await model.signIn(phone: phone, password: password) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.accountBusy || phone.isEmpty || password.isEmpty)
            }
        }
        .padding(26)
        .frame(width: 360)
        .preferredColorScheme(.dark)
        .tint(Color(red: 10 / 255, green: 132 / 255, blue: 1))
        .onDisappear { password = "" }
    }
}

struct MacPhoneWebView: NSViewRepresentable {
    @ObservedObject var model: MacPhoneModel

    func makeNSView(context: Context) -> WKWebView {
        let bridge = MacPhoneBridge(account: model.account)
        let view = bridge.makeWebView()
        model.bridge = bridge
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {}
}
