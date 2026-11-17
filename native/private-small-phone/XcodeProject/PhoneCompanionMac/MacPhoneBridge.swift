import AppKit
import Security
import WebKit

@MainActor
final class MacPhoneBridge: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private let account: MacPhoneAccount
    private let transport = MacMCPTransport()
    private weak var webView: WKWebView?
    private var entry: URL?

    init(account: MacPhoneAccount) { self.account = account }

    func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "smallPhoneNative")
        configuration.userContentController.addUserScript(WKUserScript(source: Self.bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.setValue(false, forKey: "drawsBackground")
        webView = view
        if let root = Bundle.main.url(forResource: "PhoneWeb", withExtension: "bundle") {
            let page = root.appendingPathComponent("index.html")
            entry = page.standardizedFileURL
            view.loadFileURL(page, allowingReadAccessTo: root)
        }
        return view
    }

    func refreshAccount() {
        webView?.evaluateJavaScript("if(typeof privatePhoneAccountRefresh==='function')privatePhoneAccountRefresh(false)")
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.webView === webView,
              mainDocument(message.frameInfo.request.url),
              let body = message.body as? [String: Any],
              let id = body["requestId"] as? String, id.count <= 160,
              let action = body["action"] as? String,
              let payload = body["payload"] as? [String: Any] else { return }
        if action == "mcp.http.cancel" {
            transport.cancel(payload["id"] as? String ?? "")
            reply(id, result: ["ok": true])
        } else if action == "mcp.http.request" {
            do {
                try transport.request(payload) { [weak self] result, error in
                    self?.reply(id, result: result, error: error)
                }
            } catch { reply(id, error: "mcp_invalid_destination_or_payload") }
        } else if action.hasPrefix("account.") {
            Task {
                do { reply(id, result: try await account.handle(action, payload)) }
                catch { reply(id, error: error.localizedDescription) }
            }
        } else if action == "native.info" {
            reply(id, result: ["ok": true, "platform": "macOS", "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""])
        } else {
            reply(id, error: "此手机系统功能未在Mac设备授权")
        }
    }

    private func reply(_ id: String, result: [String: Any]? = nil, error: String? = nil) {
        var payload: [String: Any] = ["requestId": id]
        if let error { payload["error"] = error } else { payload["result"] = result ?? [:] }
        webView?.callAsyncJavaScript("window.__smallPhoneNativeReply(payload)", arguments: ["payload": payload], in: nil, in: .page, completionHandler: { _ in })
    }

    private func mainDocument(_ url: URL?) -> Bool {
        guard let url, url.isFileURL, let entry else { return false }
        return url.standardizedFileURL.path == entry.path
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.sourceFrame.isMainFrame, mainDocument(action.sourceFrame.request.url),
           let url = action.request.url, url.scheme == "https", url.user == nil, url.password == nil {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.targetFrame?.isMainFrame != false {
            if mainDocument(url) { decisionHandler(.allow); return }
            if action.navigationType == .linkActivated, url.scheme == "https", url.user == nil, url.password == nil {
                NSWorkspace.shared.open(url)
            }
            decisionHandler(.cancel)
        } else {
            decisionHandler(["https", "data", "about", "file"].contains(url.scheme ?? "") ? .allow : .cancel)
        }
    }

    private static let bootstrap = """
    (()=>{
      window.__SMALL_PHONE_PRIVATE__=true;
      window.__SMALL_PHONE_MAC__=true;
      window.__SMALL_PHONE_MCP_HTTP__=true;
      let serial=0;const waiting=new Map();
      window.__smallPhoneNativeReply=p=>{const item=waiting.get(p.requestId);if(!item)return;waiting.delete(p.requestId);clearTimeout(item.timer);p.error?item.reject(new Error(p.error)):item.resolve(p.result);};
      window.SmallPhoneNative=Object.freeze({request(action,payload={}){return new Promise((resolve,reject)=>{const requestId='mac-'+Date.now()+'-'+(++serial),timer=setTimeout(()=>{waiting.delete(requestId);reject(new Error('Mac设备请求超时'));},60000);waiting.set(requestId,{resolve,reject,timer});window.webkit.messageHandlers.smallPhoneNative.postMessage({requestId,action,payload});});}});
    })();
    """
}

private final class MacAccountRedirectPolicy: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

actor MacPhoneAccount {
    private struct Session: Codable {
        let access: String
        let refresh: String
        let expires: TimeInterval
        let userID: String
        let phone: String
    }

    private static let base = "https://qvuahlqimcfgeoetosnl.supabase.co"
    private static let publishable = "sb_publishable_Q2j6uyn2_cFA3RdHHnG7sw_b7vqXaz0"
    private static let keychainService = "com.qianyi.smallphone.mac.account.v1"
    private var renewal: Task<Session, Error>?
    private var generation = 0
    private let network: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.urlCache = nil
        config.timeoutIntervalForRequest = 45
        return URLSession(configuration: config, delegate: MacAccountRedirectPolicy(), delegateQueue: nil)
    }()

    func handle(_ action: String, _ payload: [String: Any]) async throws -> [String: Any] {
        switch action {
        case "account.status": return status(try load())
        case "account.password.signin":
            let digits = String((payload["phone"] as? String ?? "").filter(\.isNumber).suffix(11))
            let password = payload["password"] as? String ?? ""
            guard digits.range(of: "^1[3-9][0-9]{9}$", options: .regularExpression) != nil, (8...72).contains(password.count) else {
                throw failure("请输入正确手机号和至少8位账号密码")
            }
            generation += 1
            renewal?.cancel()
            renewal = nil
            let current = generation
            let body = try await request("/auth/v1/token?grant_type=password", method: "POST", body: ["email": "smallphone.86" + digits + "@example.com", "password": password])
            let session = try decode(body, phone: "+86" + digits)
            guard current == generation else { throw failure("本次登录已停止") }
            try save(session)
            return status(session)
        case "account.signout":
            let session = try load()
            generation += 1
            renewal?.cancel()
            renewal = nil
            let deletion = SecItemDelete(keychainQuery() as CFDictionary)
            guard deletion == errSecSuccess || deletion == errSecItemNotFound else { throw failure("无法清除本机账号登录") }
            if let session { _ = try? await request("/auth/v1/logout?scope=local", method: "POST", bearer: session.access) }
            return status(try load())
        case "account.backup.info":
            let session = try await validSession()
            for table in ["private_phone_backup_files", "private_phone_backups"] {
                let result = try await request("/rest/v1/" + table + "?select=revision,captured_at,uploaded_at,source_build,checksum,byte_count&order=captured_at.desc&limit=1", bearer: session.access)
                if let first = (result as? [[String: Any]])?.first { return ["ok": true, "found": true, "backup": first] }
            }
            return ["ok": true, "found": false]
        default:
            throw failure("Mac设备同步正在接入，现有手机备份已保留")
        }
    }

    private func validSession() async throws -> Session {
        guard let session = try load() else { throw failure("请先连接小手机账号") }
        if session.expires > Date().timeIntervalSince1970 + 60 { return session }
        if let renewal { return try await renewal.value }
        let current = generation
        let task = Task { () throws -> Session in
            let result = try await request("/auth/v1/token?grant_type=refresh_token", method: "POST", body: ["refresh_token": session.refresh])
            let next = try decode(result, phone: session.phone)
            guard current == generation, try load()?.refresh == session.refresh else { throw failure("当前账号已变化") }
            try save(next)
            return next
        }
        renewal = task
        defer { if current == generation { renewal = nil } }
        return try await task.value
    }

    private func decode(_ body: Any, phone: String) throws -> Session {
        guard let json = body as? [String: Any], let access = json["access_token"] as? String,
              let refresh = json["refresh_token"] as? String, let user = json["user"] as? [String: Any], let id = user["id"] as? String else {
            throw failure("账号登录没有完成，请核对手机号和密码")
        }
        return Session(access: access, refresh: refresh, expires: (json["expires_at"] as? Double) ?? Date().timeIntervalSince1970 + ((json["expires_in"] as? Double) ?? 3600), userID: id, phone: phone)
    }

    private func status(_ session: Session?) -> [String: Any] {
        guard let session else { return ["ok": true, "loggedIn": false] }
        let phone = String(session.phone.suffix(11))
        return ["ok": true, "loggedIn": true, "userId": session.userID, "maskedPhone": String(phone.prefix(3)) + "****" + String(phone.suffix(4))]
    }

    private func request(_ path: String, method: String = "GET", body: [String: Any]? = nil, bearer: String? = nil) async throws -> Any {
        var request = URLRequest(url: URL(string: Self.base + path)!)
        request.httpMethod = method
        request.setValue(Self.publishable, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearer { request.setValue("Bearer " + bearer, forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (bytes, response) = try await network.data(for: request)
        guard let response = response as? HTTPURLResponse, (200...299).contains(response.statusCode), bytes.count < 2_000_000 else {
            throw failure(path.hasPrefix("/auth/") ? "账号验证没有完成，请核对登录信息" : "账号服务暂时无法读取，请稍后重试")
        }
        return bytes.isEmpty ? [:] : try JSONSerialization.jsonObject(with: bytes)
    }

    private func keychainQuery() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: Self.keychainService, kSecAttrAccount as String: "session"]
    }

    private func load() throws -> Session? {
        var query = keychainQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let result = SecItemCopyMatching(query as CFDictionary, &item)
        if result == errSecItemNotFound { return nil }
        guard result == errSecSuccess, let data = item as? Data else { throw failure("无法读取本机账号凭据") }
        return try JSONDecoder().decode(Session.self, from: data)
    }

    private func save(_ session: Session) throws {
        let bytes = try JSONEncoder().encode(session)
        let query = keychainQuery()
        let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: bytes] as CFDictionary)
        if update == errSecItemNotFound {
            var add = query
            add[kSecValueData as String] = bytes
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw failure("无法保存本机账号登录") }
        } else if update != errSecSuccess { throw failure("无法更新本机账号登录") }
    }

    private func failure(_ message: String) -> NSError {
        NSError(domain: "SmallPhoneMac", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
