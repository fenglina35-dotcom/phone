import Foundation
import HomeKit

/// A narrow HomeKit bridge for the manually controlled bedside light.
/// It never stores pairing codes or credentials and never reports a write as
/// successful until the affected characteristics have been read back.
@MainActor
final class HomeKitLightBridge: NSObject, HMHomeManagerDelegate {
    static let shared = HomeKitLightBridge()

    typealias BridgeReply = ([String: Any]) -> Void
    private let manager: HMHomeManager
    private var didReceiveHomes = false
    private var readyWaiters: [UUID: BridgeReply] = [:]
    private let operationTimeout: TimeInterval = 8
    private let readbackRetryDelays: [TimeInterval] = [0.25, 0.55, 1.0]

    private override init() {
        manager = HMHomeManager()
        super.init()
        manager.delegate = self
    }

    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        didReceiveHomes = true
        let callbacks = readyWaiters.values
        readyWaiters.removeAll()
        callbacks.forEach { $0(["ok": true]) }
    }

    func snapshot(completion: @escaping BridgeReply) {
        withReadyManager { [weak self] readiness in
            guard let self else { return }
            guard readiness["ok"] as? Bool == true else {
                completion(readiness)
                return
            }
            self.readAllLights(completion: completion)
        }
    }

    func command(arguments: [String: Any], completion: @escaping BridgeReply) {
        guard let accessoryID = cleanIdentifier(arguments["accessoryId"]),
              let serviceID = cleanIdentifier(arguments["serviceId"]),
              let action = arguments["action"] as? String else {
            completion(failure("homekit_invalid_command", "控制目标或动作不完整。"))
            return
        }

        withReadyManager { [weak self] readiness in
            guard let self else { return }
            guard readiness["ok"] as? Bool == true else {
                completion(readiness)
                return
            }
            guard let target = self.findLight(
                accessoryID: accessoryID,
                serviceID: serviceID
            ) else {
                completion(self.failure(
                    "homekit_light_not_found",
                    "苹果家庭中找不到先前选择的小灯，请重新读取设备。"
                ))
                return
            }
            guard target.accessory.isReachable else {
                completion(self.failure(
                    "homekit_unreachable",
                    "小灯当前离线，未发送成功结果。"
                ))
                return
            }
            self.performCommand(
                action: action,
                arguments: arguments,
                target: target,
                completion: completion
            )
        }
    }

    private func withReadyManager(completion: @escaping BridgeReply) {
        if didReceiveHomes {
            guard manager.authorizationStatus.contains(.authorized) else {
                completion(authorizationFailure())
                return
            }
            completion(["ok": true])
            return
        }

        let waiterID = UUID()
        readyWaiters[waiterID] = { [weak self] readiness in
            guard let self else { return }
            guard readiness["ok"] as? Bool == true else {
                completion(readiness)
                return
            }
            guard self.manager.authorizationStatus.contains(.authorized) else {
                completion(self.authorizationFailure())
                return
            }
            completion(["ok": true])
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in
            guard let self,
                  let callback = self.readyWaiters.removeValue(forKey: waiterID) else {
                return
            }
            callback(self.failure(
                "homekit_not_ready",
                "苹果家庭读取超时，请确认家庭权限后重试。"
            ))
        }
    }

    private func authorizationFailure() -> [String: Any] {
        if manager.authorizationStatus.contains(.restricted) {
            return failure(
                "homekit_restricted",
                "系统限制了小手机访问苹果家庭。"
            )
        }
        return failure(
            "homekit_permission_denied",
            "小手机没有苹果家庭权限，请到系统设置中允许后重试。"
        )
    }

    private struct LightTarget {
        let home: HMHome
        let accessory: HMAccessory
        let service: HMService
    }

    private func allLights() -> [LightTarget] {
        manager.homes.flatMap { home in
            home.accessories.flatMap { accessory in
                accessory.services.compactMap { service in
                    guard service.serviceType == HMServiceTypeLightbulb else {
                        return nil
                    }
                    return LightTarget(
                        home: home,
                        accessory: accessory,
                        service: service
                    )
                }
            }
        }
    }

    private func findLight(
        accessoryID: String,
        serviceID: String
    ) -> LightTarget? {
        allLights().first {
            $0.accessory.uniqueIdentifier.uuidString == accessoryID &&
                $0.service.uniqueIdentifier.uuidString == serviceID
        }
    }

    private func readAllLights(completion: @escaping BridgeReply) {
        let targets = allLights()
        guard !targets.isEmpty else {
            completion(failure(
                "homekit_no_lights",
                "苹果家庭中没有发现可读取的灯具。"
            ))
            return
        }

        var lights: [[String: Any]] = []
        func readNext(_ index: Int) {
            guard index < targets.count else {
                completion([
                    "ok": true,
                    "authorized": true,
                    "readAt": isoTimestamp(),
                    "count": lights.count,
                    "lights": lights
                ])
                return
            }
            readLight(targets[index]) { light in
                lights.append(light)
                readNext(index + 1)
            }
        }
        readNext(0)
    }

    private let readableTypes: [(key: String, type: String)] = [
        ("power", HMCharacteristicTypePowerState),
        ("brightness", HMCharacteristicTypeBrightness),
        ("hue", HMCharacteristicTypeHue),
        ("saturation", HMCharacteristicTypeSaturation),
        ("colorTemperature", HMCharacteristicTypeColorTemperature)
    ]

    private func readLight(
        _ target: LightTarget,
        completion: @escaping ([String: Any]) -> Void
    ) {
        var state: [String: Any] = [
            "homeId": target.home.uniqueIdentifier.uuidString,
            "homeName": target.home.name,
            "roomName": target.accessory.room?.name ?? "未分配房间",
            "accessoryId": target.accessory.uniqueIdentifier.uuidString,
            "accessoryName": target.accessory.name,
            "serviceId": target.service.uniqueIdentifier.uuidString,
            "serviceName": target.service.name,
            "reachable": target.accessory.isReachable
        ]
        var errors: [[String: String]] = []
        let characteristics = readableTypes.compactMap { item -> (String, HMCharacteristic)? in
            guard let characteristic = characteristic(
                type: item.type,
                in: target.service
            ) else { return nil }
            return (item.key, characteristic)
        }

        func readNext(_ index: Int) {
            guard index < characteristics.count else {
                state["readAt"] = isoTimestamp()
                state["readErrors"] = errors
                state["allReadable"] = errors.isEmpty
                state["complete"] = state["power"] != nil
                completion(state)
                return
            }
            let (key, characteristic) = characteristics[index]
            guard characteristic.properties.contains(HMCharacteristicPropertyReadable) else {
                errors.append(["key": key, "code": "not_readable"])
                readNext(index + 1)
                return
            }
            readValue(characteristic) { result in
                switch result {
                case .success(let value):
                    if let normalized = self.normalizedValue(value, key: key) {
                        state[key] = normalized
                    } else {
                        errors.append(["key": key, "code": "invalid_value"])
                    }
                case .failure(let code):
                    errors.append(["key": key, "code": code])
                }
                readNext(index + 1)
            }
        }
        readNext(0)
    }

    private enum CharacteristicReadResult {
        case success(Any?)
        case failure(String)
    }

    private func readValue(
        _ characteristic: HMCharacteristic,
        completion: @escaping (CharacteristicReadResult) -> Void
    ) {
        var finished = false
        func finish(_ result: CharacteristicReadResult) {
            guard !finished else { return }
            finished = true
            completion(result)
        }
        characteristic.readValue { error in
            DispatchQueue.main.async {
                if let error {
                    finish(.failure("read_failed_\((error as NSError).code)"))
                } else {
                    finish(.success(characteristic.value))
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + operationTimeout) {
            finish(.failure("read_timeout"))
        }
    }

    private func performCommand(
        action: String,
        arguments: [String: Any],
        target: LightTarget,
        completion: @escaping BridgeReply
    ) {
        var writes: [(key: String, characteristic: HMCharacteristic, value: NSNumber)] = []
        var expected: [String: Double] = [:]

        switch action {
        case "power":
            guard let value = boolValue(arguments["value"]),
                  let characteristic = characteristic(
                    type: HMCharacteristicTypePowerState,
                    in: target.service
                  ) else {
                completion(failure(
                    "homekit_power_unsupported",
                    "这盏灯不支持当前开关控制。"
                ))
                return
            }
            writes.append(("power", characteristic, NSNumber(value: value)))
            expected["power"] = value ? 1 : 0

        case "brightness":
            guard let value = number(arguments["value"]), value >= 1, value <= 100,
                  let characteristic = characteristic(
                    type: HMCharacteristicTypeBrightness,
                    in: target.service
                  ) else {
                completion(failure(
                    "homekit_brightness_unsupported",
                    "这盏灯不支持当前亮度控制，或亮度超出范围。"
                ))
                return
            }
            writes.append(("brightness", characteristic, NSNumber(value: value)))
            expected["brightness"] = value

        case "color":
            guard let hue = number(arguments["hue"]), hue >= 0, hue <= 360,
                  let saturation = number(arguments["saturation"]),
                  saturation >= 0, saturation <= 100,
                  let hueCharacteristic = characteristic(
                    type: HMCharacteristicTypeHue,
                    in: target.service
                  ),
                  let saturationCharacteristic = characteristic(
                    type: HMCharacteristicTypeSaturation,
                    in: target.service
                  ) else {
                completion(failure(
                    "homekit_color_unsupported",
                    "这盏灯不支持当前 RGB 颜色控制，或颜色值超出范围。"
                ))
                return
            }
            writes.append(("hue", hueCharacteristic, NSNumber(value: hue)))
            writes.append((
                "saturation",
                saturationCharacteristic,
                NSNumber(value: saturation)
            ))
            expected["hue"] = hue
            expected["saturation"] = saturation

        case "temperature":
            guard let warmth = number(arguments["warmth"]),
                  warmth >= 0, warmth <= 100,
                  let characteristic = characteristic(
                    type: HMCharacteristicTypeColorTemperature,
                    in: target.service
                  ) else {
                completion(failure(
                    "homekit_temperature_unsupported",
                    "这盏灯不支持当前色温控制，或色温值超出范围。"
                ))
                return
            }
            let minimum = characteristic.metadata?.minimumValue?.doubleValue ?? 140
            let maximum = characteristic.metadata?.maximumValue?.doubleValue ?? 500
            let raw = round(minimum + (maximum - minimum) * warmth / 100)
            writes.append((
                "colorTemperature",
                characteristic,
                NSNumber(value: raw)
            ))
            expected["colorTemperature"] = raw

        default:
            completion(failure(
                "homekit_action_not_allowed",
                "这个动作不在小灯控制白名单中。"
            ))
            return
        }

        guard writes.allSatisfy({
            $0.characteristic.properties.contains(HMCharacteristicPropertyWritable) &&
                $0.characteristic.properties.contains(HMCharacteristicPropertyReadable)
        }) else {
            completion(failure(
                "homekit_characteristic_not_writable",
                "灯具没有提供可写且可回读的控制项，未执行命令。"
            ))
            return
        }

        writeSequentially(writes, index: 0) { writeError in
            if let writeError {
                completion(self.failure(
                    writeError,
                    writeError == "homekit_write_timeout"
                        ? "小灯写入超时，不能确认已经执行。"
                        : "小灯写入失败，不能确认已经执行。"
                ))
                return
            }
            self.verifyReadback(
                target: target,
                expected: expected,
                action: action,
                attempt: 0,
                latestState: nil,
                completion: completion
            )
        }
    }

    /// HomeKit writes can finish before Wi-Fi accessories publish their new
    /// characteristic values. Retry a small, bounded number of fresh reads so
    /// an eventually consistent lamp is not reported as unavailable, while
    /// still refusing to claim success if the final state does not match.
    private func verifyReadback(
        target: LightTarget,
        expected: [String: Double],
        action: String,
        attempt: Int,
        latestState: [String: Any]?,
        completion: @escaping BridgeReply
    ) {
        readLight(target) { state in
            let complete = state["complete"] as? Bool == true
            if complete && self.matches(expected: expected, state: state) {
                completion([
                    "ok": true,
                    "verified": true,
                    "action": action,
                    "verifiedAt": self.isoTimestamp(),
                    "readbackAttempts": attempt + 1,
                    "expected": expected,
                    "state": state
                ])
                return
            }

            let nextState = complete ? state : (latestState ?? state)
            guard attempt < self.readbackRetryDelays.count else {
                let code = complete
                    ? "homekit_readback_mismatch"
                    : "homekit_readback_failed"
                let message = complete
                    ? "命令后的真实状态与目标仍不一致，不能判定成功。"
                    : "命令已尝试发送，但真实状态回读失败，不能判定成功。"
                var reply = self.failure(code, message)
                reply["verified"] = false
                reply["writeCompleted"] = true
                reply["retryable"] = true
                reply["readbackAttempts"] = attempt + 1
                reply["expected"] = expected
                reply["state"] = nextState
                completion(reply)
                return
            }

            let delay = self.readbackRetryDelays[attempt]
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                self.verifyReadback(
                    target: target,
                    expected: expected,
                    action: action,
                    attempt: attempt + 1,
                    latestState: nextState,
                    completion: completion
                )
            }
        }
    }

    private func writeSequentially(
        _ writes: [(key: String, characteristic: HMCharacteristic, value: NSNumber)],
        index: Int,
        completion: @escaping (String?) -> Void
    ) {
        guard index < writes.count else {
            completion(nil)
            return
        }
        let item = writes[index]
        var finished = false
        func finish(_ error: String?) {
            guard !finished else { return }
            finished = true
            if let error {
                completion(error)
            } else {
                writeSequentially(writes, index: index + 1, completion: completion)
            }
        }
        item.characteristic.writeValue(item.value) { error in
            DispatchQueue.main.async {
                if let error {
                    finish("homekit_write_failed_\((error as NSError).code)")
                } else {
                    finish(nil)
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + operationTimeout) {
            finish("homekit_write_timeout")
        }
    }

    private func matches(
        expected: [String: Double],
        state: [String: Any]
    ) -> Bool {
        expected.allSatisfy { key, target in
            guard let actual = number(state[key]) else { return false }
            if key == "power" { return actual == target }
            if key == "hue" {
                let delta = abs(actual - target).truncatingRemainder(dividingBy: 360)
                return min(delta, 360 - delta) <= 2
            }
            if key == "colorTemperature" { return abs(actual - target) <= 1 }
            return abs(actual - target) <= 2
        }
    }

    private func characteristic(
        type: String,
        in service: HMService
    ) -> HMCharacteristic? {
        service.characteristics.first { $0.characteristicType == type }
    }

    private func normalizedValue(_ value: Any?, key: String) -> Any? {
        guard let number = value as? NSNumber else { return nil }
        if key == "power" { return number.boolValue }
        return number.doubleValue
    }

    private func cleanIdentifier(_ value: Any?) -> String? {
        guard let value = value as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return UUID(uuidString: trimmed)?.uuidString
    }

    private func boolValue(_ value: Any?) -> Bool? {
        if let value = value as? Bool { return value }
        if let value = value as? NSNumber { return value.boolValue }
        return nil
    }

    private func number(_ value: Any?) -> Double? {
        if let value = value as? NSNumber { return value.doubleValue }
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        return nil
    }

    private func failure(_ code: String, _ message: String) -> [String: Any] {
        ["ok": false, "errorCode": code, "message": message]
    }

    private func isoTimestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
