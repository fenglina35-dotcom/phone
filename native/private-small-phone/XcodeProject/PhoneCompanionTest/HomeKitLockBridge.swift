import Foundation
import HomeKit
import LocalAuthentication

/// A deliberately narrow HomeKit bridge for door locks.
///
/// Locking is allowed only after a fresh state read and is reported as success
/// only after a matching readback. Unlocking additionally requires Face ID;
/// there is intentionally no device-passcode fallback. The bridge never stores
/// HomeKit pairing material, passwords, fingerprints, or access codes.
@MainActor
final class HomeKitLockBridge: NSObject, HMHomeManagerDelegate, HMAccessoryDelegate {
    static let shared = HomeKitLockBridge()

    typealias BridgeReply = ([String: Any]) -> Void
    var eventHandler: (([String: Any]) -> Void)?

    private let manager: HMHomeManager
    private var didReceiveHomes = false
    private var readyWaiters: [UUID: BridgeReply] = [:]
    private var notificationTargets = Set<String>()
    private var localWriteExpected: [String: Int] = [:]
    private let operationTimeout: TimeInterval = 8
    private let readbackRetryDelays: [TimeInterval] = [0.3, 0.65, 1.2]
    private let eventStoreKey = "smallPhone.homeKitLockEvents.v1"
    private let lastStateStoreKey = "smallPhone.homeKitLockLastStates.v1"

    private override init() {
        manager = HMHomeManager()
        super.init()
        manager.delegate = self
    }

    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        didReceiveHomes = true
        configureNotifications()
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
            self.configureNotifications()
            self.readAllLocks(completion: completion)
        }
    }

    func command(arguments: [String: Any], completion: @escaping BridgeReply) {
        guard let accessoryID = cleanIdentifier(arguments["accessoryId"]),
              let serviceID = cleanIdentifier(arguments["serviceId"]),
              let action = arguments["action"] as? String,
              action == "lock" || action == "unlock" else {
            completion(failure("homekit_lock_invalid_command", "门锁目标或动作不完整。"))
            return
        }

        withReadyManager { [weak self] readiness in
            guard let self else { return }
            guard readiness["ok"] as? Bool == true else {
                completion(readiness)
                return
            }
            guard let target = self.findLock(
                accessoryID: accessoryID,
                serviceID: serviceID
            ) else {
                completion(self.failure(
                    "homekit_lock_not_found",
                    "苹果家庭中找不到先前选择的门锁，请重新读取设备。"
                ))
                return
            }
            guard target.accessory.isReachable else {
                completion(self.failure(
                    "homekit_lock_unreachable",
                    "门锁当前离线，未发送控制命令。"
                ))
                return
            }
            self.readLock(target) { state in
                guard state["complete"] as? Bool == true,
                      let currentRaw = state["currentStateRaw"] as? Int else {
                    completion(self.failure(
                        "homekit_lock_state_unknown",
                        "无法读取门锁当前真实状态，出于安全原因未执行。"
                    ))
                    return
                }
                let expected = action == "lock" ? 1 : 0
                if currentRaw == expected {
                    self.persistLastState(currentRaw, for: self.targetKey(target))
                    completion([
                        "ok": true,
                        "verified": true,
                        "action": action,
                        "changed": false,
                        "verifiedAt": self.isoTimestamp(),
                        "state": state
                    ])
                    return
                }
                guard currentRaw == 0 || currentRaw == 1 else {
                    completion(self.failure(
                        "homekit_lock_state_unsafe",
                        "门锁状态为卡住或未知，出于安全原因未执行。"
                    ))
                    return
                }
                if action == "unlock" {
                    self.authenticateFaceID { authentication in
                        guard authentication["ok"] as? Bool == true else {
                            completion(authentication)
                            return
                        }
                        self.writeLock(
                            target: target,
                            action: action,
                            expectedRaw: expected,
                            completion: completion
                        )
                    }
                } else {
                    self.writeLock(
                        target: target,
                        action: action,
                        expectedRaw: expected,
                        completion: completion
                    )
                }
            }
        }
    }

    func events(completion: @escaping BridgeReply) {
        completion([
            "ok": true,
            "events": storedEvents(),
            "readAt": isoTimestamp()
        ])
    }

    func acknowledgeEvents(arguments: [String: Any], completion: @escaping BridgeReply) {
        let ids = Set((arguments["eventIds"] as? [String] ?? []).filter { !$0.isEmpty })
        guard !ids.isEmpty else {
            completion(failure("homekit_lock_event_ids_missing", "没有可确认的门锁事件。"))
            return
        }
        let remaining = storedEvents().filter {
            guard let eventID = $0["eventId"] as? String else { return false }
            return !ids.contains(eventID)
        }
        saveEvents(remaining)
        completion(["ok": true, "acknowledged": ids.count])
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
                "homekit_lock_not_ready",
                "苹果家庭读取超时，请确认家庭权限后重试。"
            ))
        }
    }

    private func authorizationFailure() -> [String: Any] {
        if manager.authorizationStatus.contains(.restricted) {
            return failure("homekit_lock_restricted", "系统限制了小手机访问苹果家庭。")
        }
        return failure(
            "homekit_lock_permission_denied",
            "小手机没有苹果家庭权限，请到系统设置中允许后重试。"
        )
    }

    private struct LockTarget {
        let home: HMHome
        let accessory: HMAccessory
        let service: HMService
    }

    private func allLocks() -> [LockTarget] {
        manager.homes.flatMap { home in
            home.accessories.flatMap { accessory in
                accessory.services.compactMap { service in
                    guard service.serviceType == HMServiceTypeLockMechanism else {
                        return nil
                    }
                    return LockTarget(home: home, accessory: accessory, service: service)
                }
            }
        }
    }

    private func findLock(accessoryID: String, serviceID: String) -> LockTarget? {
        allLocks().first {
            $0.accessory.uniqueIdentifier.uuidString == accessoryID &&
                $0.service.uniqueIdentifier.uuidString == serviceID
        }
    }

    private func readAllLocks(completion: @escaping BridgeReply) {
        let targets = allLocks()
        guard !targets.isEmpty else {
            completion(failure("homekit_no_locks", "苹果家庭中没有发现可读取的门锁。"))
            return
        }

        var locks: [[String: Any]] = []
        func readNext(_ index: Int) {
            guard index < targets.count else {
                completion([
                    "ok": true,
                    "authorized": true,
                    "readAt": isoTimestamp(),
                    "count": locks.count,
                    "locks": locks
                ])
                return
            }
            readLock(targets[index]) { state in
                self.reconcileSnapshot(state: state, target: targets[index])
                locks.append(state)
                readNext(index + 1)
            }
        }
        readNext(0)
    }

    private func readLock(_ target: LockTarget, completion: @escaping ([String: Any]) -> Void) {
        var state: [String: Any] = identityState(target)
        var errors: [[String: String]] = []
        let current = characteristic(
            type: HMCharacteristicTypeCurrentLockMechanismState,
            in: target.service
        )
        let targetState = characteristic(
            type: HMCharacteristicTypeTargetLockMechanismState,
            in: target.service
        )
        let battery = target.accessory.services
            .first(where: { $0.serviceType == HMServiceTypeBattery })
            .flatMap { characteristic(type: HMCharacteristicTypeBatteryLevel, in: $0) }
        let values: [(String, HMCharacteristic?)] = [
            ("currentStateRaw", current),
            ("targetStateRaw", targetState),
            ("battery", battery)
        ]

        func readNext(_ index: Int) {
            guard index < values.count else {
                if let raw = state["currentStateRaw"] as? Int {
                    state["currentState"] = lockStateName(raw)
                }
                if let raw = state["targetStateRaw"] as? Int {
                    state["targetState"] = targetStateName(raw)
                }
                state["readAt"] = isoTimestamp()
                state["readErrors"] = errors
                state["complete"] = state["currentStateRaw"] != nil
                completion(state)
                return
            }
            let (key, candidate) = values[index]
            guard let candidate else {
                if key != "battery" { errors.append(["key": key, "code": "missing"]) }
                readNext(index + 1)
                return
            }
            guard candidate.properties.contains(HMCharacteristicPropertyReadable) else {
                if key != "battery" { errors.append(["key": key, "code": "not_readable"]) }
                readNext(index + 1)
                return
            }
            readValue(candidate) { result in
                switch result {
                case .success(let value):
                    if let number = value as? NSNumber {
                        state[key] = number.intValue
                    } else if key != "battery" {
                        errors.append(["key": key, "code": "invalid_value"])
                    }
                case .failure(let code):
                    if key != "battery" { errors.append(["key": key, "code": code]) }
                }
                readNext(index + 1)
            }
        }
        readNext(0)
    }

    private func identityState(_ target: LockTarget) -> [String: Any] {
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
        if let manufacturer = target.accessory.manufacturer { state["manufacturer"] = manufacturer }
        if let model = target.accessory.model { state["model"] = model }
        if let firmware = target.accessory.firmwareVersion { state["firmware"] = firmware }
        return state
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

    private func authenticateFaceID(completion: @escaping BridgeReply) {
        let context = LAContext()
        context.localizedCancelTitle = "取消"
        var evaluationError: NSError?
        guard context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &evaluationError
        ), context.biometryType == .faceID else {
            completion(failure(
                "homekit_unlock_face_id_unavailable",
                "这次解锁必须使用 Face ID；当前设备没有可用的 Face ID，未执行。"
            ))
            return
        }
        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "验证是你本人后，才允许小手机解锁门锁"
        ) { [weak self] success, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if success {
                    completion(["ok": true, "authenticated": true, "method": "faceID"])
                } else {
                    let code = (error as NSError?)?.code ?? -1
                    completion(self.failure(
                        "homekit_unlock_face_id_failed_\(code)",
                        "Face ID 没有通过，门锁未解锁。"
                    ))
                }
            }
        }
    }

    private func writeLock(
        target: LockTarget,
        action: String,
        expectedRaw: Int,
        completion: @escaping BridgeReply
    ) {
        guard let targetCharacteristic = characteristic(
            type: HMCharacteristicTypeTargetLockMechanismState,
            in: target.service
        ), targetCharacteristic.properties.contains(HMCharacteristicPropertyWritable),
           targetCharacteristic.properties.contains(HMCharacteristicPropertyReadable) else {
            completion(failure(
                "homekit_lock_not_writable",
                "门锁没有提供可写且可回读的锁态控制项，未执行。"
            ))
            return
        }
        let key = targetKey(target)
        localWriteExpected[key] = expectedRaw
        var finished = false
        func finishWrite(_ error: String?) {
            guard !finished else { return }
            finished = true
            if let error {
                self.localWriteExpected.removeValue(forKey: key)
                completion(self.failure(error, "门锁写入失败，不能确认已经执行。"))
                return
            }
            self.verifyReadback(
                target: target,
                action: action,
                expectedRaw: expectedRaw,
                attempt: 0,
                latestState: nil,
                completion: completion
            )
        }
        targetCharacteristic.writeValue(NSNumber(value: expectedRaw)) { error in
            DispatchQueue.main.async {
                if let error {
                    finishWrite("homekit_lock_write_failed_\((error as NSError).code)")
                } else {
                    finishWrite(nil)
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + operationTimeout) {
            finishWrite("homekit_lock_write_timeout")
        }
    }

    private func verifyReadback(
        target: LockTarget,
        action: String,
        expectedRaw: Int,
        attempt: Int,
        latestState: [String: Any]?,
        completion: @escaping BridgeReply
    ) {
        readLock(target) { state in
            let complete = state["complete"] as? Bool == true
            if complete, state["currentStateRaw"] as? Int == expectedRaw {
                let key = self.targetKey(target)
                self.persistLastState(expectedRaw, for: key)
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
                    guard let self, self.localWriteExpected[key] == expectedRaw else { return }
                    self.localWriteExpected.removeValue(forKey: key)
                }
                completion([
                    "ok": true,
                    "verified": true,
                    "changed": true,
                    "action": action,
                    "verifiedAt": self.isoTimestamp(),
                    "readbackAttempts": attempt + 1,
                    "state": state
                ])
                return
            }
            let nextState = complete ? state : (latestState ?? state)
            guard attempt < self.readbackRetryDelays.count else {
                self.localWriteExpected.removeValue(forKey: self.targetKey(target))
                var reply = self.failure(
                    complete ? "homekit_lock_readback_mismatch" : "homekit_lock_readback_failed",
                    complete
                        ? "门锁真实状态与目标不一致，不能判定成功。"
                        : "命令已尝试发送，但门锁真实状态回读失败，不能判定成功。"
                )
                reply["verified"] = false
                reply["writeCompleted"] = true
                reply["retryable"] = true
                reply["readbackAttempts"] = attempt + 1
                reply["state"] = nextState
                completion(reply)
                return
            }
            let delay = self.readbackRetryDelays[attempt]
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                self.verifyReadback(
                    target: target,
                    action: action,
                    expectedRaw: expectedRaw,
                    attempt: attempt + 1,
                    latestState: nextState,
                    completion: completion
                )
            }
        }
    }

    private func configureNotifications() {
        for target in allLocks() {
            target.accessory.delegate = self
            guard let current = characteristic(
                type: HMCharacteristicTypeCurrentLockMechanismState,
                in: target.service
            ), current.properties.contains(HMCharacteristicPropertySupportsEventNotification) else {
                continue
            }
            let key = targetKey(target)
            guard !notificationTargets.contains(key) else { continue }
            notificationTargets.insert(key)
            current.enableNotification(true) { [weak self] error in
                guard error != nil else { return }
                DispatchQueue.main.async { self?.notificationTargets.remove(key) }
            }
        }
    }

    func accessory(
        _ accessory: HMAccessory,
        service: HMService,
        didUpdateValueFor characteristic: HMCharacteristic
    ) {
        guard service.serviceType == HMServiceTypeLockMechanism,
              characteristic.characteristicType == HMCharacteristicTypeCurrentLockMechanismState,
              let raw = (characteristic.value as? NSNumber)?.intValue,
              let target = allLocks().first(where: {
                  $0.accessory.uniqueIdentifier == accessory.uniqueIdentifier &&
                      $0.service.uniqueIdentifier == service.uniqueIdentifier
              }) else { return }
        let key = targetKey(target)
        if localWriteExpected[key] == raw {
            localWriteExpected.removeValue(forKey: key)
            persistLastState(raw, for: key)
            return
        }
        guard lastStates()[key] != raw else { return }
        persistLastState(raw, for: key)
        let now = isoTimestamp()
        var event = identityState(target)
        event.merge([
            "eventId": UUID().uuidString,
            "currentStateRaw": raw,
            "currentState": lockStateName(raw),
            "timing": "known",
            "source": "homekit_notification",
            "eventAt": now,
            "observedAt": now
        ]) { _, new in new }
        appendEvent(event)
        eventHandler?(event)
    }

    private func reconcileSnapshot(state: [String: Any], target: LockTarget) {
        guard state["complete"] as? Bool == true,
              let raw = state["currentStateRaw"] as? Int else { return }
        let key = targetKey(target)
        let previous = lastStates()[key]
        persistLastState(raw, for: key)
        guard let previous, previous != raw else { return }
        let observedAt = isoTimestamp()
        var event = identityState(target)
        event.merge([
            "eventId": UUID().uuidString,
            "currentStateRaw": raw,
            "currentState": lockStateName(raw),
            "previousStateRaw": previous,
            "previousState": lockStateName(previous),
            "timing": "unknown",
            "source": "snapshot_reconciliation",
            "observedAt": observedAt
        ]) { _, new in new }
        appendEvent(event)
        eventHandler?(event)
    }

    private func targetKey(_ target: LockTarget) -> String {
        target.accessory.uniqueIdentifier.uuidString + "|" + target.service.uniqueIdentifier.uuidString
    }

    private func storedEvents() -> [[String: Any]] {
        (UserDefaults.standard.array(forKey: eventStoreKey) as? [[String: Any]] ?? [])
            .suffix(40)
            .map { $0 }
    }

    private func appendEvent(_ event: [String: Any]) {
        var events = storedEvents()
        events.append(event)
        saveEvents(Array(events.suffix(40)))
    }

    private func saveEvents(_ events: [[String: Any]]) {
        UserDefaults.standard.set(events, forKey: eventStoreKey)
    }

    private func lastStates() -> [String: Int] {
        guard let stored = UserDefaults.standard.dictionary(forKey: lastStateStoreKey) else {
            return [:]
        }
        var states: [String: Int] = [:]
        for (key, value) in stored {
            if let number = value as? NSNumber { states[key] = number.intValue }
        }
        return states
    }

    private func persistLastState(_ raw: Int, for key: String) {
        var states = lastStates()
        states[key] = raw
        UserDefaults.standard.set(states, forKey: lastStateStoreKey)
    }

    private func characteristic(type: String, in service: HMService) -> HMCharacteristic? {
        service.characteristics.first { $0.characteristicType == type }
    }

    private func cleanIdentifier(_ value: Any?) -> String? {
        guard let value = value as? String else { return nil }
        return UUID(uuidString: value.trimmingCharacters(in: .whitespacesAndNewlines))?.uuidString
    }

    private func lockStateName(_ raw: Int) -> String {
        switch raw {
        case 0: return "unlocked"
        case 1: return "locked"
        case 2: return "jammed"
        default: return "unknown"
        }
    }

    private func targetStateName(_ raw: Int) -> String {
        raw == 0 ? "unlocked" : raw == 1 ? "locked" : "unknown"
    }

    private func failure(_ code: String, _ message: String) -> [String: Any] {
        ["ok": false, "verified": false, "errorCode": code, "message": message]
    }

    private func isoTimestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
