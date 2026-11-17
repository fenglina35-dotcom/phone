// PRIVATE_MAC_CLIENT_V1: standalone Mac window; shared PhoneWeb resources and per-device credentials.
import SwiftUI
import WebKit

@main
struct MacPhoneApp: App {
    @StateObject private var model = MacPhoneModel()

    var body: some Scene {
        Window("小手机 Mac", id: "main") {
            Group {
                if !model.accountLoaded {
                    ProgressView("正在检查本机账号…")
                } else if let userID = model.userID {
                    if model.hasSyncedData {
                        MacPhoneWebView(model: model, userID: userID).id(userID)
                    } else {
                        VStack(spacing: 18) {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 42)).foregroundStyle(.blue)
                            Text("账号已连接").font(.title2.bold())
                            Text(model.accountLabel).foregroundStyle(.secondary)
                            Text("设备同步尚未启用，手机上的聊天和设置已保留。")
                                .font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)
                            Button("更换账号") { model.showsAccount = true }
                            Button("退出本机账号") { Task { await model.signOut() } }.disabled(model.accountBusy)
                        }.padding(32).frame(maxWidth: 350)
                    }
                } else {
                    MacAccountSheet(model: model, embedded: true)
                }
            }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .frame(minWidth: 390, minHeight: 650)
                .background(Color.black)
                .preferredColorScheme(.dark)
                .toolbar {
                    ToolbarItem {
                        if model.userID != nil {
                            Button(model.accountLabel, systemImage: "person.crop.circle") {
                                model.showsAccount = true
                            }
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
    @Published var accountLoaded = false
    @Published var userID: String?
    @Published var hasSyncedData = false
    let account = MacPhoneAccount()
    var bridge: MacPhoneBridge?

    init() {
        Task {
            if let result = try? await account.handle("account.status", [:]) { applyStatus(result) }
            accountLoaded = true
        }
    }

    private func applyStatus(_ result: [String: Any]) {
        if result["loggedIn"] as? Bool == true, let id = result["userId"] as? String, UUID(uuidString: id) != nil {
            if userID != id { hasSyncedData = false }
            userID = id
            accountLabel = result["maskedPhone"] as? String ?? "账号已连接"
        } else {
            hasSyncedData = false
            userID = nil
            accountLabel = "连接小手机账号"
        }
    }

    func signOut() async {
        guard !accountBusy else { return }
        accountBusy = true
        defer { accountBusy = false }
        do { applyStatus(try await account.handle("account.signout", [:])) }
        catch { accountError = error.localizedDescription }
    }

    func signIn(phone: String, password: String) async {
        guard !accountBusy else { return }
        accountBusy = true
        accountError = ""
        defer { accountBusy = false }
        do {
            let result = try await account.handle("account.password.signin", ["phone": phone, "password": password])
            applyStatus(result)
            showsAccount = false
            bridge?.refreshAccount()
        } catch {
            accountError = error.localizedDescription
        }
    }
}

private struct MacAccountSheet: View {
    @ObservedObject var model: MacPhoneModel
    var embedded = false
    @State private var phone = ""
    @State private var password = ""
    @State private var reveal = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "iphone.gen3").font(.system(size: 36)).foregroundStyle(.blue)
            Text("登录小手机").font(.title2.bold())
            Text("输入手机上已经创建的私人账号。")
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
                Button(embedded ? "退出" : "稍后") {
                    if embedded { NSApplication.shared.terminate(nil) }
                    else { model.showsAccount = false }
                }
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
    let userID: String

    func makeNSView(context: Context) -> WKWebView {
        let bridge = MacPhoneBridge(account: model.account, userID: userID)
        let view = bridge.makeWebView()
        model.bridge = bridge
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {}
}
