import Foundation
import SwiftUI
import UIKit
import WebKit

struct LocalPhoneWebView: UIViewRepresentable {
    let onOpenDeviceManagement: () -> Void

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let bridge = PhoneNativeBridge()
        private var showingLoadFailure = false
        private var didLoadPhone = false
        private var openingRolePush = false
        private var syncingRolePush = false

        override init() {
            super.init()
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(deviceOrientationChanged),
                name: UIDevice.orientationDidChangeNotification,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(rolePushTapped),
                name: Notification.Name("SmallPhoneRolePushTapped"),
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(rolePushSyncRequested),
                name: Notification.Name("SmallPhoneRolePushSyncRequested"),
                object: nil
            )
        }

        deinit {
            NotificationCenter.default.removeObserver(self)
        }

        @objc private func deviceOrientationChanged() {
            guard let webView = bridge.webView else { return }
            DispatchQueue.main.async { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.updateSafeArea(in: webView)
            }
        }

        @objc private func rolePushTapped() {
            openPendingRolePushIfReady()
        }

        @objc private func rolePushSyncRequested() {
            syncPendingRolePushIfReady()
        }

        private func syncPendingRolePushIfReady() {
            guard didLoadPhone,
                  !syncingRolePush,
                  UserDefaults.standard.bool(
                    forKey: "smallPhone.pendingRolePushSync.v1"
                  ),
                  let webView = bridge.webView else { return }
            syncingRolePush = true
            let script = "window.__smallPhoneSyncRolePush && window.__smallPhoneSyncRolePush();"
            webView.evaluateJavaScript(script) { [weak self] _, error in
                self?.syncingRolePush = false
                if error == nil {
                    UserDefaults.standard.removeObject(
                        forKey: "smallPhone.pendingRolePushSync.v1"
                    )
                }
            }
        }

        private func openPendingRolePushIfReady() {
            guard didLoadPhone, let webView = bridge.webView,
                  let route = UserDefaults.standard.dictionary(
                    forKey: "smallPhone.pendingRolePushRoute.v1"
                  ) as? [String: String] else { return }
            let now = Int64(Date().timeIntervalSince1970 * 1000)
            guard route["source"] == "notificationTap",
                  let nonce = route["nonce"], !nonce.isEmpty,
                  let tappedAtText = route["tappedAt"],
                  let tappedAt = Int64(tappedAtText),
                  abs(now - tappedAt) <= 120_000 else {
                UserDefaults.standard.removeObject(
                    forKey: "smallPhone.pendingRolePushRoute.v1"
                )
                return
            }
            guard !openingRolePush,
                  JSONSerialization.isValidJSONObject(route),
                  let data = try? JSONSerialization.data(withJSONObject: route),
                  let json = String(data: data, encoding: .utf8) else { return }
            openingRolePush = true
            let script = "window.__smallPhoneOpenRolePush && window.__smallPhoneOpenRolePush(\(json));"
            webView.evaluateJavaScript(script) { [weak self] _, error in
                self?.openingRolePush = false
                if error == nil {
                    UserDefaults.standard.removeObject(
                        forKey: "smallPhone.pendingRolePushRoute.v1"
                    )
                }
            }
        }

        func webView(
            _ webView: WKWebView,
            didFinish navigation: WKNavigation!
        ) {
            if !showingLoadFailure {
                didLoadPhone = true
                updateSafeArea(in: webView)
                bridge.announceReady()
                openPendingRolePushIfReady()
                syncPendingRolePushIfReady()
            }
        }

        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            let bundledPage = webView.url?.isFileURL == true
            let supportedCapture =
                type == .microphone ||
                type == .camera ||
                type == .cameraAndMicrophone
            decisionHandler(
                bundledPage && supportedCapture ? .grant : .deny
            )
        }

        func updateSafeArea(in webView: WKWebView) {
            let viewInsets = webView.safeAreaInsets
            let windowInsets = webView.window?.safeAreaInsets ?? .zero
            let top = max(viewInsets.top, windowInsets.top)
            let bottom = max(viewInsets.bottom, windowInsets.bottom)
            let left = max(viewInsets.left, windowInsets.left)
            let right = max(viewInsets.right, windowInsets.right)
            let script = """
            window.__smallPhoneNativeInsets && window.__smallPhoneNativeInsets({
              top: \(top), bottom: \(bottom), left: \(left), right: \(right)
            });
            """
            webView.evaluateJavaScript(script)
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            showLoadFailure(in: webView, error: error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            showLoadFailure(in: webView, error: error)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.isFileURL || url.scheme == "about" {
                decisionHandler(.allow)
            } else if navigationAction.targetFrame?.isMainFrame == false,
                      url.scheme == "https",
                      Self.allowedEmbeddedPlayer(url) {
                // Keep only the explicitly supported official media players
                // inside the bundled phone. Search pages, account pages and
                // every other remote navigation still leave through iOS.
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }

        private static func allowedEmbeddedPlayer(_ url: URL) -> Bool {
            let host = url.host?.lowercased() ?? ""
            if host == "music.163.com" && url.path == "/outchain/player" {
                return true
            }
            if host == "player.bilibili.com" && url.path == "/player.html" {
                return true
            }
            if host == "www.bilibili.com" &&
                (url.path == "/blackboard/webplayer/mbplayer.html" ||
                 url.path == "/blackboard/html5mobileplayer.html") {
                return true
            }
            return false
        }

        private func showLoadFailure(
            in webView: WKWebView,
            error: Error
        ) {
            guard !showingLoadFailure else { return }
            showingLoadFailure = true
            print("[SmallPhoneWeb] load failed: \(error.localizedDescription)")
            webView.loadHTMLString(
                LocalPhoneWebView.loadFailureHTML,
                baseURL: nil
            )
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(
            context.coordinator.bridge,
            name: PhoneNativeBridge.handlerName
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.bridgeBootstrap,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.bridge.webView = webView
        context.coordinator.bridge.openDeviceManagement =
            onOpenDeviceManagement
        loadBundledPhone(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.bridge.openDeviceManagement =
            onOpenDeviceManagement
        DispatchQueue.main.async {
            context.coordinator.updateSafeArea(in: webView)
        }
    }

    static func dismantleUIView(
        _ webView: WKWebView,
        coordinator: Coordinator
    ) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: PhoneNativeBridge.handlerName
        )
        coordinator.bridge.webView = nil
        coordinator.bridge.openDeviceManagement = nil
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
    }

    private func loadBundledPhone(in webView: WKWebView) {
        guard let bundleURL = Bundle.main.url(
            forResource: "PhoneWeb",
            withExtension: "bundle"
        ) else {
            webView.loadHTMLString(
                Self.missingResourceHTML,
                baseURL: nil
            )
            return
        }

        let fileURL = bundleURL
            .appendingPathComponent("index.html", isDirectory: false)
            .standardizedFileURL
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            webView.loadHTMLString(
                Self.missingResourceHTML,
                baseURL: nil
            )
            return
        }

        // WebKit requires the main file URL to be lexically inside the exact
        // directory granted here. Deriving both from one URL avoids the
        // "outside the sandbox" rejection seen on the real iPhone.
        let readAccessURL = fileURL
            .deletingLastPathComponent()
            .standardizedFileURL
        webView.loadFileURL(
            fileURL,
            allowingReadAccessTo: readAccessURL
        )
    }

    private static let missingResourceHTML = """
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="margin:0;background:#111;color:white;font-family:-apple-system;padding:28px">
      <h2>小手机资源没有安装完整</h2>
      <p>请使用重新生成的完整安装包。</p>
    </body>
    """

    fileprivate static let loadFailureHTML = """
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="margin:0;background:#111;color:white;font-family:-apple-system;padding:28px">
      <h2>小手机本地页面没有加载成功</h2>
      <p>原始数据没有被删除。请保留此页面并把 Xcode 日志发给开发者。</p>
    </body>
    """

    private static let bridgeBootstrap = """
    (() => {
      window.__SMALL_PHONE_PRIVATE__ = true;
      window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.147 (147)';
      const root = document.documentElement;
      root.classList.add('north-native-app');
      root.style.setProperty('--north-native-safe-top', 'env(safe-area-inset-top, 0px)');
      root.style.setProperty('--north-native-safe-bottom', 'env(safe-area-inset-bottom, 0px)');
      root.style.setProperty('--north-native-safe-left', 'env(safe-area-inset-left, 0px)');
      root.style.setProperty('--north-native-safe-right', 'env(safe-area-inset-right, 0px)');
      window.__smallPhoneNativeInsets = payload => {
        const safe = (value, name) => `max(env(${name}, 0px), ${Math.max(0, Number(value) || 0)}px)`;
        root.style.setProperty('--north-native-safe-top', safe(payload && payload.top, 'safe-area-inset-top'));
        root.style.setProperty('--north-native-safe-bottom', safe(payload && payload.bottom, 'safe-area-inset-bottom'));
        root.style.setProperty('--north-native-safe-left', safe(payload && payload.left, 'safe-area-inset-left'));
        root.style.setProperty('--north-native-safe-right', safe(payload && payload.right, 'safe-area-inset-right'));
        if (typeof window.lockPullRefresh === 'function') {
          requestAnimationFrame(() => window.lockPullRefresh());
        }
      };
      let sequence = 0;
      const waiting = new Map();
      const speechClients = new Map();
      window.__smallPhoneNativeReply = payload => {
        const item = waiting.get(payload.requestId);
        if (!item) return;
        waiting.delete(payload.requestId);
        clearTimeout(item.timer);
        payload.error ? item.reject(new Error(payload.error)) : item.resolve(payload.result);
      };
      window.SmallPhoneNative = Object.freeze({
        request(action, payload = {}) {
          return new Promise((resolve, reject) => {
            const requestId = `native-${Date.now()}-${++sequence}`;
            const timeoutMs = action === 'device.snapshot' ? 25000 : 60000;
            const timer = setTimeout(() => {
              if (!waiting.has(requestId)) return;
              waiting.delete(requestId);
              reject(new Error(action === 'device.snapshot'
                ? '真实手机读取超过25秒，已结束本次读取'
                : `原生请求超时：${action}`));
            }, timeoutMs);
            waiting.set(requestId, { resolve, reject, timer });
            window.webkit.messageHandlers.smallPhoneNative.postMessage({
              requestId, action, payload
            });
          });
        }
      });
      let nativeGeoWatch = 0;
      const nativeGeoRead = (success, failure) => {
        window.SmallPhoneNative.request('location.current').then(value => {
          if (typeof success !== 'function') return;
          success({
            coords: {
              latitude: Number(value.latitude),
              longitude: Number(value.longitude),
              accuracy: Number(value.accuracy) || 0,
              altitude: Number(value.altitude) || 0,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Number(value.timestamp) || Date.now()
          });
        }).catch(error => {
          if (typeof failure === 'function') {
            failure({ code: 2, message: (error && error.message) || 'native_location_unavailable' });
          }
        });
      };
      const nativeGeolocation = {
        getCurrentPosition(success, failure) {
          nativeGeoRead(success, failure);
        },
        watchPosition(success, failure) {
          const id = ++nativeGeoWatch;
          nativeGeoRead(success, failure);
          return id;
        },
        clearWatch() {}
      };
      try {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: nativeGeolocation
        });
      } catch (_) {}
      try {
        Object.defineProperty(Navigator.prototype, 'geolocation', {
          configurable: true,
          get() { return nativeGeolocation; }
        });
      } catch (_) {}
      try {
        const originalPermissions = navigator.permissions;
        Object.defineProperty(navigator, 'permissions', {
          configurable: true,
          value: {
            query(descriptor) {
              if (descriptor && descriptor.name === 'geolocation') {
                return Promise.resolve({ state: 'granted', onchange: null });
              }
              return originalPermissions.query.call(
                originalPermissions,
                descriptor
              );
            }
          }
        });
      } catch (_) {}
      const deliveredSpeechEvents = new Set();
      window.__smallPhoneNativeSpeechEvent = payload => {
        const eventId = payload && payload.eventId;
        if (eventId && deliveredSpeechEvents.has(eventId)) return;
        if (eventId) {
          deliveredSpeechEvents.add(eventId);
          if (deliveredSpeechEvents.size > 32) {
            deliveredSpeechEvents.delete(deliveredSpeechEvents.values().next().value);
          }
        }
        const client = payload && speechClients.get(payload.sessionId);
        if (!client) return;
        if (payload.type === 'result') {
          const alternative = { transcript: payload.transcript || '', confidence: 0 };
          const result = [alternative];
          result.isFinal = payload.isFinal === true;
          if (typeof client.onresult === 'function') {
            client.onresult({
              resultIndex: 0,
              results: [result],
              screenFrameToken: payload.screenFrameToken || '',
              screenFrameAt: Number(payload.screenFrameAt || 0),
              screenFrameSequence: Number(payload.screenFrameSequence || 0)
            });
          }
          return;
        }
        if (payload.type === 'error' && typeof client.onerror === 'function') {
          client.onerror({ error: payload.error || 'native-speech-error' });
        }
        if (payload.type === 'end' || payload.type === 'error') {
          speechClients.delete(payload.sessionId);
          client.__active = false;
          client.__paused = false;
          if (typeof client.onend === 'function') client.onend();
        }
      };
      window.SmallPhoneNativeSpeech = Object.freeze({
        flushPending() {
          return window.SmallPhoneNative.request('speech.pending').then(payload => {
            const events = payload && Array.isArray(payload.events) ? payload.events : [];
            events.forEach(event => window.__smallPhoneNativeSpeechEvent(event));
            return events.length;
          });
        },
        create() {
          const client = {
            lang: 'zh-CN',
            interimResults: true,
            continuous: true,
            onresult: null,
            onerror: null,
            onend: null,
            __active: false,
            __paused: false,
            __sessionId: '',
            start() {
              if (client.__active) return;
              client.__active = true;
              client.__paused = false;
              client.__sessionId = `speech-${Date.now()}-${++sequence}`;
              speechClients.set(client.__sessionId, client);
              window.SmallPhoneNative.request('speech.start', {
                sessionId: client.__sessionId,
                lang: client.lang || 'zh-CN'
              }).catch(error => {
                speechClients.delete(client.__sessionId);
                client.__active = false;
                if (typeof client.onerror === 'function') {
                  client.onerror({ error: (error && error.message) || 'native-speech-error' });
                }
                if (typeof client.onend === 'function') client.onend();
              });
            },
            pause() {
              if (!client.__active || client.__paused) return Promise.resolve();
              client.__paused = true;
              return window.SmallPhoneNative.request('speech.pause', {
                sessionId: client.__sessionId
              }).catch(error => {
                client.__paused = false;
                throw error;
              });
            },
            resume() {
              if (!client.__active || !client.__paused) return Promise.resolve();
              return window.SmallPhoneNative.request('speech.resume', {
                sessionId: client.__sessionId
              }).then(result => {
                client.__paused = false;
                return result;
              });
            },
            rebuild() {
              if (!client.__active) return Promise.resolve();
              return window.SmallPhoneNative.request('speech.rebuild', {
                sessionId: client.__sessionId
              }).then(result => {
                client.__paused = false;
                return result;
              });
            },
            stop() {
              if (!client.__active) return;
              const sessionId = client.__sessionId;
              client.__active = false;
              client.__paused = false;
              speechClients.delete(sessionId);
              window.SmallPhoneNative.request('speech.stop', { sessionId }).catch(() => {});
              if (typeof client.onend === 'function') client.onend();
            },
            abort() {
              if (!client.__active) return;
              const sessionId = client.__sessionId;
              client.__active = false;
              client.__paused = false;
              speechClients.delete(sessionId);
              window.SmallPhoneNative.request('speech.abort', { sessionId }).catch(() => {});
              if (typeof client.onend === 'function') client.onend();
            }
          };
          return client;
        }
      });
    })();
    """
}
