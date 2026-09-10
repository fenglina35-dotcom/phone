import Foundation
import HomeKit

/// A deliberately narrow HomeKit bridge for air conditioners exposed by the
/// Home app as a thermostat or heater/cooler service. A command is successful
/// only after the affected HomeKit characteristics have been read back.
@MainActor
final class HomeKitClimateBridge: NSObject, HMHomeManagerDelegate {
    static let shared = HomeKitClimateBridge()

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
            self.readAllClimates(completion: completion)
        }
    }

    func command(arguments: [String: Any], completion: @escaping BridgeReply) {
        guard let accessoryID = cleanIdentifier(arguments["accessoryId"]),
              let serviceID = cleanIdentifier(arguments["serviceId"]),
              let action = arguments["action"] as? String else {
            completion(failure("homekit_invalid_climate_command", "空调目标或动作不完整。"))
            return
        }
        withReadyManager { [weak self] readiness in
            guard let self else { return }
            guard readiness["ok"] as? Bool == true else {
                completion(readiness)
                return
            }
            guard let target = self.findClimate(accessoryID: accessoryID, serviceID: serviceID) else {
                completion(self.failure("homekit_climate_not_found", "苹果家庭中找不到先前选择的空调，请重新读取设备。"))
                return
            }
            guard target.accessory.isReachable else {
                completion(self.failure("homekit_climate_unreachable", "空调当前离线，未执行控制。"))
                return
            }
            self.performCommand(action: action, arguments: arguments, target: target, completion: completion)
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
            guard let self, let callback = self.readyWaiters.removeValue(forKey: waiterID) else { return }
            callback(self.failure("homekit_not_ready", "苹果家庭读取超时，请确认家庭权限后重试。"))
        }
    }

    private func authorizationFailure() -> [String: Any] {
        if manager.authorizationStatus.contains(.restricted) {
            return failure("homekit_restricted", "系统限制了小手机访问苹果家庭。")
        }
        return failure("homekit_permission_denied", "小手机没有苹果家庭权限，请到系统设置中允许后重试。")
    }

    private struct ClimateTarget {
        let home: HMHome
        let accessory: HMAccessory
        let service: HMService
        let serviceKind: String
    }

    private func allClimates() -> [ClimateTarget] {
        manager.homes.flatMap { home in
            home.accessories.flatMap { accessory in
                accessory.services.compactMap { service in
                    let kind: String
                    if service.serviceType == HMServiceTypeHeaterCooler {
                        kind = "heaterCooler"
                    } else if service.serviceType == HMServiceTypeThermostat {
                        kind = "thermostat"
                    } else {
                        return nil
                    }
                    return ClimateTarget(home: home, accessory: accessory, service: service, serviceKind: kind)
                }
            }
        }
    }

    private func findClimate(accessoryID: String, serviceID: String) -> ClimateTarget? {
        allClimates().first {
            $0.accessory.uniqueIdentifier.uuidString == accessoryID &&
                $0.service.uniqueIdentifier.uuidString == serviceID
        }
    }

    private func readAllClimates(completion: @escaping BridgeReply) {
        let targets = allClimates()
        guard !targets.isEmpty else {
            completion(failure("homekit_no_climates", "苹果家庭中没有发现可读取的空调。"))
            return
        }
        var climates: [[String: Any]] = []
        func readNext(_ index: Int) {
            guard index < targets.count else {
                completion([
                    "ok": true,
                    "authorized": true,
                    "readAt": isoTimestamp(),
                    "count": climates.count,
                    "climates": climates
                ])
                return
            }
            readClimate(targets[index]) { state in
                climates.append(state)
                readNext(index + 1)
            }
        }
        readNext(0)
    }

    private func readClimate(_ target: ClimateTarget, completion: @escaping ([String: Any]) -> Void) {
        var state = identityState(target)
        var errors: [[String: String]] = []
        let thermostatTargetTemperature = target.serviceKind == "thermostat"
            ? controlCharacteristic(type: HMCharacteristicTypeTargetTemperature, in: target)
            : nil
        let readings: [(String, HMCharacteristic?)] = [
            ("activeRaw", characteristic(type: HMCharacteristicTypeActive, in: target.service)),
            ("currentTemperature", controlCharacteristic(type: HMCharacteristicTypeCurrentTemperature, in: target)),
            ("targetTemperature", thermostatTargetTemperature),
            ("coolingTargetTemperature", controlCharacteristic(type: HMCharacteristicTypeCoolingThreshold, in: target)),
            ("heatingTargetTemperature", controlCharacteristic(type: HMCharacteristicTypeHeatingThreshold, in: target)),
            ("currentLegacyRaw", characteristic(type: HMCharacteristicTypeCurrentHeatingCooling, in: target.service)),
            ("targetLegacyRaw", characteristic(type: HMCharacteristicTypeTargetHeatingCooling, in: target.service)),
            ("currentModernRaw", characteristic(type: HMCharacteristicTypeCurrentHeaterCoolerState, in: target.service)),
            ("targetModernRaw", characteristic(type: HMCharacteristicTypeTargetHeaterCoolerState, in: target.service)),
            ("fanSpeed", controlCharacteristic(type: HMCharacteristicTypeRotationSpeed, in: target))
        ]

        if let targetTemperature = temperatureCharacteristic(in: target) {
            state["minimumTemperature"] = targetTemperature.metadata?.minimumValue?.doubleValue ?? 16
            state["maximumTemperature"] = targetTemperature.metadata?.maximumValue?.doubleValue ?? 30
            state["temperatureStep"] = temperatureStep(for: targetTemperature, target: target)
            state["supportsTemperature"] = targetTemperature.properties.contains(HMCharacteristicPropertyWritable)
        } else {
            state["supportsTemperature"] = false
        }
        if let fanSpeed = controlCharacteristic(type: HMCharacteristicTypeRotationSpeed, in: target) {
            state["minimumFanSpeed"] = fanSpeed.metadata?.minimumValue?.doubleValue ?? 0
            state["maximumFanSpeed"] = fanSpeed.metadata?.maximumValue?.doubleValue ?? 100
            state["fanSpeedStep"] = fanSpeed.metadata?.stepValue?.doubleValue ?? 10
            state["supportsFanSpeed"] = fanSpeed.properties.contains(HMCharacteristicPropertyWritable)
            let values = numericValidValues(fanSpeed)
            if !values.isEmpty { state["fanControlValues"] = values }
        } else {
            state["supportsFanSpeed"] = false
        }

        func readNext(_ index: Int) {
            guard index < readings.count else {
                normalizeClimateState(&state, target: target)
                state["readAt"] = isoTimestamp()
                state["readErrors"] = errors
                let modeRawKey = target.serviceKind == "heaterCooler" ? "targetModernRaw" : "targetLegacyRaw"
                state["complete"] = state["power"] != nil && state[modeRawKey] != nil
                completion(state)
                return
            }
            let (key, candidate) = readings[index]
            guard let candidate else {
                readNext(index + 1)
                return
            }
            guard candidate.properties.contains(HMCharacteristicPropertyReadable) else {
                errors.append(["key": key, "code": "not_readable"])
                readNext(index + 1)
                return
            }
            readValue(candidate) { result in
                switch result {
                case .success(let value):
                    if let number = value as? NSNumber {
                        state[key] = number.doubleValue
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

    private func identityState(_ target: ClimateTarget) -> [String: Any] {
        var state: [String: Any] = [
            "homeId": target.home.uniqueIdentifier.uuidString,
            "homeName": target.home.name,
            "roomName": target.accessory.room?.name ?? "未分配房间",
            "accessoryId": target.accessory.uniqueIdentifier.uuidString,
            "accessoryName": target.accessory.name,
            "serviceId": target.service.uniqueIdentifier.uuidString,
            "serviceName": target.service.name,
            "serviceKind": target.serviceKind,
            "reachable": target.accessory.isReachable
        ]
        if let manufacturer = target.accessory.manufacturer { state["manufacturer"] = manufacturer }
        if let model = target.accessory.model { state["model"] = model }
        if let firmware = target.accessory.firmwareVersion { state["firmware"] = firmware }
        return state
    }

    private func normalizeClimateState(_ state: inout [String: Any], target: ClimateTarget) {
        if target.serviceKind == "heaterCooler" {
            let active = Int(number(state["activeRaw"]) ?? 0)
            let targetRaw = Int(number(state["targetModernRaw"]) ?? 0)
            state["power"] = active == 1
            state["mode"] = active == 0 ? "off" : modernModeName(targetRaw)
            state["currentMode"] = modernCurrentModeName(Int(number(state["currentModernRaw"]) ?? 0))
        } else {
            let targetRaw = Int(number(state["targetLegacyRaw"]) ?? 0)
            state["power"] = targetRaw != 0
            state["mode"] = legacyModeName(targetRaw)
            state["currentMode"] = legacyModeName(Int(number(state["currentLegacyRaw"]) ?? 0))
        }
        if state["targetTemperature"] == nil {
            if state["mode"] as? String == "heat" {
                state["targetTemperature"] = state["heatingTargetTemperature"]
            } else if state["mode"] as? String == "cool" {
                state["targetTemperature"] = state["coolingTargetTemperature"]
            } else {
                state["targetTemperature"] = state["coolingTargetTemperature"] ?? state["heatingTargetTemperature"]
            }
        }
        state["supportedModes"] = supportedModeNames(for: target)
    }

    private enum CharacteristicReadResult {
        case success(Any?)
        case failure(String)
    }

    private func readValue(_ characteristic: HMCharacteristic, completion: @escaping (CharacteristicReadResult) -> Void) {
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

    private func performCommand(action: String, arguments: [String: Any], target: ClimateTarget, completion: @escaping BridgeReply) {
        var writes: [(key: String, characteristic: HMCharacteristic, value: NSNumber)] = []
        var expected: [String: Double] = [:]

        switch action {
        case "power":
            guard let enabled = boolValue(arguments["value"]) else {
                completion(failure("homekit_climate_invalid_power", "空调开关参数不正确。"))
                return
            }
            if target.serviceKind == "heaterCooler",
               let active = characteristic(type: HMCharacteristicTypeActive, in: target.service) {
                writes.append(("activeRaw", active, NSNumber(value: enabled ? 1 : 0)))
                expected["power"] = enabled ? 1 : 0
            } else if let mode = characteristic(type: HMCharacteristicTypeTargetHeatingCooling, in: target.service) {
                let next = enabled ? legacyModeRaw(arguments["mode"] as? String ?? "cool") : 0
                writes.append(("targetLegacyRaw", mode, NSNumber(value: next)))
                expected["power"] = enabled ? 1 : 0
            } else {
                completion(failure("homekit_climate_power_unsupported", "这个空调没有提供可控制的开关。"))
                return
            }

        case "mode":
            guard let modeName = arguments["value"] as? String,
                  ["off", "auto", "heat", "cool"].contains(modeName) else {
                completion(failure("homekit_climate_invalid_mode", "空调模式不在可用范围内。"))
                return
            }
            guard modeName == "off" || supportedModeNames(for: target).contains(modeName) else {
                completion(failure("homekit_climate_mode_unsupported", "这个空调没有提供这个模式。"))
                return
            }
            if target.serviceKind == "heaterCooler" {
                guard let active = characteristic(type: HMCharacteristicTypeActive, in: target.service),
                      let mode = characteristic(type: HMCharacteristicTypeTargetHeaterCoolerState, in: target.service) else {
                    completion(failure("homekit_climate_mode_unsupported", "这个空调没有提供可控制的模式。"))
                    return
                }
                if modeName == "off" {
                    writes.append(("activeRaw", active, NSNumber(value: 0)))
                    expected["power"] = 0
                } else {
                    writes.append(("activeRaw", active, NSNumber(value: 1)))
                    writes.append(("targetModernRaw", mode, NSNumber(value: modernModeRaw(modeName))))
                    expected["power"] = 1
                    expected["modeRaw"] = Double(modernModeRaw(modeName))
                }
            } else if let mode = characteristic(type: HMCharacteristicTypeTargetHeatingCooling, in: target.service) {
                let raw = legacyModeRaw(modeName)
                writes.append(("targetLegacyRaw", mode, NSNumber(value: raw)))
                expected["power"] = raw == 0 ? 0 : 1
                expected["modeRaw"] = Double(raw)
            } else {
                completion(failure("homekit_climate_mode_unsupported", "这个空调没有提供可控制的模式。"))
                return
            }

        case "temperature":
            guard let value = number(arguments["value"]),
                  let temperature = temperatureCharacteristic(in: target, preferredMode: arguments["mode"] as? String) else {
                completion(failure("homekit_climate_temperature_unsupported", "这个空调没有提供可控制的目标温度。"))
                return
            }
            let minimum = temperature.metadata?.minimumValue?.doubleValue ?? 16
            let maximum = temperature.metadata?.maximumValue?.doubleValue ?? 30
            guard value >= minimum, value <= maximum else {
                completion(failure("homekit_climate_temperature_range", "目标温度超出这个空调允许的范围。"))
                return
            }
            let step = temperatureStep(for: temperature, target: target)
            let stepUnits = (value - minimum) / step
            guard abs(stepUnits - stepUnits.rounded()) <= 0.001 else {
                completion(failure("homekit_climate_temperature_step", "这台空调只接受整度温度，请选择相邻的整数温度。"))
                return
            }
            writes.append(("targetTemperature", temperature, NSNumber(value: value)))
            expected["targetTemperature"] = value

        case "fan":
            guard let value = number(arguments["value"]),
                  let fanSpeed = controlCharacteristic(type: HMCharacteristicTypeRotationSpeed, in: target) else {
                completion(failure("homekit_climate_fan_unsupported", "这个空调没有向苹果家庭提供可控制的风速。"))
                return
            }
            let minimum = fanSpeed.metadata?.minimumValue?.doubleValue ?? 0
            let maximum = fanSpeed.metadata?.maximumValue?.doubleValue ?? 100
            guard value >= minimum, value <= maximum else {
                completion(failure("homekit_climate_fan_range", "风速超出这个空调允许的范围。"))
                return
            }
            writes.append(("fanSpeed", fanSpeed, NSNumber(value: value)))
            expected["fanSpeed"] = value

        default:
            completion(failure("homekit_climate_action_not_allowed", "这个动作不在空调控制白名单中。"))
            return
        }

        guard !writes.isEmpty, writes.allSatisfy({
            $0.characteristic.properties.contains(HMCharacteristicPropertyWritable) &&
                $0.characteristic.properties.contains(HMCharacteristicPropertyReadable)
        }) else {
            completion(failure("homekit_climate_not_writable", "空调没有提供可写且可回读的控制项，未执行。"))
            return
        }
        writeSequentially(writes, index: 0) { writeError in
            if let writeError {
                completion(self.failure(writeError, "空调写入失败，不能确认已经执行。"))
                return
            }
            self.verifyReadback(target: target, expected: expected, action: action, attempt: 0, latestState: nil, completion: completion)
        }
    }

    private func verifyReadback(target: ClimateTarget, expected: [String: Double], action: String, attempt: Int, latestState: [String: Any]?, completion: @escaping BridgeReply) {
        readClimate(target) { state in
            let complete = state["complete"] as? Bool == true
            if complete && self.matches(expected: expected, state: state, target: target) {
                completion([
                    "ok": true,
                    "verified": true,
                    "action": action,
                    "verifiedAt": self.isoTimestamp(),
                    "readbackAttempts": attempt + 1,
                    "state": state
                ])
                return
            }
            let nextState = complete ? state : (latestState ?? state)
            guard attempt < self.readbackRetryDelays.count else {
                var reply = self.failure(
                    complete ? "homekit_climate_readback_mismatch" : "homekit_climate_readback_failed",
                    complete ? "空调真实状态与目标不一致，不能判定成功。" : "命令已尝试发送，但空调状态回读失败，不能判定成功。"
                )
                reply["verified"] = false
                reply["writeCompleted"] = true
                reply["retryable"] = true
                reply["readbackAttempts"] = attempt + 1
                reply["state"] = nextState
                completion(reply)
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + self.readbackRetryDelays[attempt]) {
                self.verifyReadback(target: target, expected: expected, action: action, attempt: attempt + 1, latestState: nextState, completion: completion)
            }
        }
    }

    private func writeSequentially(_ writes: [(key: String, characteristic: HMCharacteristic, value: NSNumber)], index: Int, completion: @escaping (String?) -> Void) {
        guard index < writes.count else {
            completion(nil)
            return
        }
        let item = writes[index]
        var finished = false
        func finish(_ error: String?) {
            guard !finished else { return }
            finished = true
            if let error { completion(error) } else { writeSequentially(writes, index: index + 1, completion: completion) }
        }
        item.characteristic.writeValue(item.value) { error in
            DispatchQueue.main.async {
                if let error {
                    finish("homekit_climate_write_failed_\((error as NSError).code)")
                } else {
                    finish(nil)
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + operationTimeout) {
            finish("homekit_climate_write_timeout")
        }
    }

    private func matches(expected: [String: Double], state: [String: Any], target: ClimateTarget) -> Bool {
        expected.allSatisfy { key, value in
            switch key {
            case "power":
                return (state["power"] as? Bool) == (value == 1)
            case "modeRaw":
                let rawKey = target.serviceKind == "heaterCooler" ? "targetModernRaw" : "targetLegacyRaw"
                return abs((number(state[rawKey]) ?? -99) - value) < 0.1
            case "targetTemperature":
                return abs((number(state[key]) ?? -99) - value) <= 0.25
            case "fanSpeed":
                return abs((number(state[key]) ?? -99) - value) < 0.1
            default:
                return false
            }
        }
    }

    private func characteristic(type: String, in service: HMService) -> HMCharacteristic? {
        service.characteristics.first { $0.characteristicType == type }
    }

    private func controlCharacteristic(type: String, in target: ClimateTarget) -> HMCharacteristic? {
        if let direct = characteristic(type: type, in: target.service) { return direct }
        var checked = Set<UUID>([target.service.uniqueIdentifier])
        for linked in target.service.linkedServices ?? [] {
            checked.insert(linked.uniqueIdentifier)
            if let candidate = characteristic(type: type, in: linked) { return candidate }
        }
        for related in target.accessory.services where !checked.contains(related.uniqueIdentifier) {
            if let candidate = characteristic(type: type, in: related) { return candidate }
        }
        return nil
    }

    private func temperatureCharacteristic(in target: ClimateTarget, preferredMode: String? = nil) -> HMCharacteristic? {
        let mode = preferredMode ?? cachedModeName(for: target)
        if target.serviceKind == "heaterCooler" {
            if mode == "heat", let heating = controlCharacteristic(type: HMCharacteristicTypeHeatingThreshold, in: target) {
                return heating
            }
            if mode == "cool", let cooling = controlCharacteristic(type: HMCharacteristicTypeCoolingThreshold, in: target) {
                return cooling
            }
            return controlCharacteristic(type: HMCharacteristicTypeCoolingThreshold, in: target)
                ?? controlCharacteristic(type: HMCharacteristicTypeHeatingThreshold, in: target)
        }
        return controlCharacteristic(type: HMCharacteristicTypeTargetTemperature, in: target)
    }

    private func temperatureStep(for characteristic: HMCharacteristic, target: ClimateTarget) -> Double {
        if target.accessory.model?.uppercased() == "ACN1-AIR" { return 1 }
        let reported = characteristic.metadata?.stepValue?.doubleValue ?? 1
        return reported > 0 ? reported : 1
    }

    private func cachedModeName(for target: ClimateTarget) -> String? {
        if target.serviceKind == "heaterCooler" {
            let characteristic = controlCharacteristic(type: HMCharacteristicTypeTargetHeaterCoolerState, in: target)
            guard let raw = number(characteristic?.value) else { return nil }
            return modernModeName(Int(raw))
        }
        let characteristic = controlCharacteristic(type: HMCharacteristicTypeTargetHeatingCooling, in: target)
        guard let raw = number(characteristic?.value) else { return nil }
        return legacyModeName(Int(raw))
    }

    private func numericValidValues(_ characteristic: HMCharacteristic?) -> [Double] {
        (characteristic?.metadata?.validValues ?? []).map { $0.doubleValue }
    }

    private func supportedModeNames(for target: ClimateTarget) -> [String] {
        let type = target.serviceKind == "heaterCooler"
            ? HMCharacteristicTypeTargetHeaterCoolerState
            : HMCharacteristicTypeTargetHeatingCooling
        let values = numericValidValues(controlCharacteristic(type: type, in: target)).map { Int($0) }
        guard !values.isEmpty else {
            // Some bridges omit valid-values metadata. Heat and cool are the only
            // modes proven by the user's real device; never invent Auto support.
            return ["heat", "cool"]
        }
        let names = values.compactMap { raw -> String? in
            if target.serviceKind == "heaterCooler" {
                return raw == 0 ? "auto" : raw == 1 ? "heat" : raw == 2 ? "cool" : nil
            }
            return raw == 1 ? "heat" : raw == 2 ? "cool" : raw == 3 ? "auto" : nil
        }
        let unique = names.reduce(into: [String]()) { result, name in
            if !result.contains(name) { result.append(name) }
        }
        // The user's LENGCEOI ACN1-AIR exposes an Auto-looking value that does
        // not execute on the real appliance. Keep the private UI/action list
        // aligned with the modes verified on that exact device.
        if target.accessory.model?.uppercased() == "ACN1-AIR" {
            return unique.filter { $0 != "auto" }
        }
        return unique
    }

    private func modernModeName(_ raw: Int) -> String {
        raw == 1 ? "heat" : raw == 2 ? "cool" : "auto"
    }

    private func modernCurrentModeName(_ raw: Int) -> String {
        raw == 2 ? "heat" : raw == 3 ? "cool" : raw == 1 ? "idle" : "off"
    }

    private func legacyModeName(_ raw: Int) -> String {
        raw == 1 ? "heat" : raw == 2 ? "cool" : raw == 3 ? "auto" : "off"
    }

    private func modernModeRaw(_ name: String) -> Int {
        name == "heat" ? 1 : name == "cool" ? 2 : 0
    }

    private func legacyModeRaw(_ name: String) -> Int {
        name == "heat" ? 1 : name == "cool" ? 2 : name == "auto" ? 3 : 0
    }

    private func cleanIdentifier(_ value: Any?) -> String? {
        guard let value = value as? String else { return nil }
        return UUID(uuidString: value.trimmingCharacters(in: .whitespacesAndNewlines))?.uuidString
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
