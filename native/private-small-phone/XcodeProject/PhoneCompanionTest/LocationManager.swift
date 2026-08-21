import Combine
import CoreLocation
import Foundation
import MapKit

struct FootprintPoint: Identifiable, Codable, Equatable {
    let id: UUID
    let latitude: Double
    let longitude: Double
    let timestamp: Date
    let horizontalAccuracy: Double
    var placeName: String?

    init(location: CLLocation, placeName: String? = nil) {
        id = UUID()
        latitude = location.coordinate.latitude
        longitude = location.coordinate.longitude
        timestamp = location.timestamp
        horizontalAccuracy = location.horizontalAccuracy
        self.placeName = placeName
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: latitude,
            longitude: longitude
        )
    }
}
final class LocationManager: NSObject, ObservableObject,
                             CLLocationManagerDelegate {

    static let shared = LocationManager()

    @Published private(set) var authorizationStatus:
        CLAuthorizationStatus = .notDetermined

    @Published private(set) var accuracyAuthorization:
        CLAccuracyAuthorization = .reducedAccuracy

    @Published private(set) var currentLocation: CLLocation?
    @Published private(set) var currentPlaceName = "尚未解析具体位置"
    @Published private(set) var isTracking = false
    @Published private(set) var todayPoints: [FootprintPoint] = []
    @Published private(set) var lastError: String?

    private let manager = CLLocationManager()
    private var reverseGeocodingRequest: MKReverseGeocodingRequest?
    private let storageKey = "PhoneCompanionTodayFootprint"
    private let alwaysAuthorizationRequestedKey =
        "PhoneCompanionAlwaysLocationRequested.v1"
    private var shouldStartAfterAuthorization = false
    private var significantChangeMonitoring = false
    private var oneShotLocationPending = false
    private var lastGeocodedLocation: CLLocation?
    private var lastGeocodedAt: Date?

    override init() {
        super.init()

        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 25
        manager.activityType = .other
        manager.pausesLocationUpdatesAutomatically = true

        authorizationStatus = manager.authorizationStatus
        accuracyAuthorization = manager.accuracyAuthorization
        loadTodayPoints()
    }

    var authorizationText: String {
        switch authorizationStatus {
        case .notDetermined:
            return "尚未请求定位权限"
        case .restricted:
            return "定位功能受到系统限制"
        case .denied:
            return "定位权限已被拒绝"
        case .authorizedWhenInUse:
            return "使用 App 时允许定位"
        case .authorizedAlways:
            return "始终允许定位"
        @unknown default:
            return "未知定位权限状态"
        }
    }

    var accuracyText: String {
        switch accuracyAuthorization {
        case .fullAccuracy:
            return "精确位置已开启"
        case .reducedAccuracy:
            return "当前使用大致位置"
        @unknown default:
            return "未知定位精度"
        }
    }

    var coordinateText: String {
        guard let location = currentLocation else {
            return "尚未获取位置"
        }

        return String(
            format: "%.6f, %.6f",
            location.coordinate.latitude,
            location.coordinate.longitude
        )
    }

    var locationAccuracyText: String {
        guard let location = currentLocation else {
            return "暂无精度信息"
        }
        return "误差约 \(Int(location.horizontalAccuracy)) 米"
    }

    var lastUpdateText: String {
        guard let location = currentLocation else {
            return "尚未更新"
        }

        return DateFormatter.localizedString(
            from: location.timestamp,
            dateStyle: .none,
            timeStyle: .medium
        )
    }

    func requestWhenInUseAuthorization() {
        lastError = nil
        manager.requestWhenInUseAuthorization()
    }

    func requestAlwaysAuthorization() {
        lastError = nil
        manager.requestAlwaysAuthorization()
    }

    func resumeTrackingIfAuthorized() {
        switch manager.authorizationStatus {
        case .authorizedAlways:
            startTracking()
        case .authorizedWhenInUse:
            requestOneShotLocation()
            requestAlwaysAuthorizationOnce()
        case .notDetermined:
            shouldStartAfterAuthorization = true
            manager.requestWhenInUseAuthorization()
        default:
            break
        }
    }

    private func configureBackgroundTracking(enabled: Bool) {
        manager.allowsBackgroundLocationUpdates = enabled
        manager.showsBackgroundLocationIndicator = false
    }

    private func requestAlwaysAuthorizationOnce() {
        guard manager.authorizationStatus == .authorizedWhenInUse,
              !UserDefaults.standard.bool(
                forKey: alwaysAuthorizationRequestedKey
              ) else {
            return
        }
        UserDefaults.standard.set(
            true,
            forKey: alwaysAuthorizationRequestedKey
        )
        manager.requestAlwaysAuthorization()
    }

    func startTracking() {
        lastError = nil

        guard CLLocationManager.locationServicesEnabled() else {
            lastError = "手机的定位服务没有开启"
            return
        }

        switch manager.authorizationStatus {
        case .authorizedAlways:
            // Persistent standard GPS updates at best accuracy kept running
            // after one role/location read and continued after the management
            // sheet closed. Use iOS significant-change monitoring for the
            // background footprint; explicit reads still request one precise
            // fix through requestLocation().
            manager.stopUpdatingLocation()
            configureBackgroundTracking(enabled: false)
            if !significantChangeMonitoring {
                manager.startMonitoringSignificantLocationChanges()
                significantChangeMonitoring = true
            }
            isTracking = true
            requestOneShotLocation()
        case .authorizedWhenInUse:
            requestOneShotLocation()
            requestAlwaysAuthorizationOnce()
        case .notDetermined:
            shouldStartAfterAuthorization = true
            manager.requestWhenInUseAuthorization()
        case .denied:
            lastError = "定位权限已被拒绝，请到手机设置中重新开启"
        case .restricted:
            lastError = "定位功能受到系统限制"
        @unknown default:
            lastError = "无法识别当前定位权限"
        }
    }

    func refreshCurrentLocation() {
        lastError = nil

        guard CLLocationManager.locationServicesEnabled() else {
            lastError = "手机的定位服务没有开启"
            return
        }

        switch manager.authorizationStatus {
        case .authorizedAlways:
            manager.stopUpdatingLocation()
            requestOneShotLocation()
        case .authorizedWhenInUse:
            manager.stopUpdatingLocation()
            requestOneShotLocation()
            requestAlwaysAuthorizationOnce()
        case .notDetermined:
            shouldStartAfterAuthorization = true
            manager.requestWhenInUseAuthorization()
        case .denied:
            lastError = "定位权限已被拒绝，请到手机设置中重新开启"
        case .restricted:
            lastError = "定位功能受到系统限制"
        @unknown default:
            lastError = "无法识别当前定位权限"
        }
    }

    func stopTracking() {
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
        configureBackgroundTracking(enabled: false)
        significantChangeMonitoring = false
        oneShotLocationPending = false
        isTracking = false
        shouldStartAfterAuthorization = false
    }

    private func requestOneShotLocation() {
        guard !oneShotLocationPending else { return }
        oneShotLocationPending = true
        isTracking = true
        manager.requestLocation()
    }

    func clearTodayFootprint() {
        todayPoints.removeAll()
        saveTodayPoints()
    }

    func locationManagerDidChangeAuthorization(
        _ manager: CLLocationManager
    ) {
        DispatchQueue.main.async {
            self.authorizationStatus = manager.authorizationStatus
            self.accuracyAuthorization = manager.accuracyAuthorization

            if self.shouldStartAfterAuthorization {
                switch manager.authorizationStatus {
                case .authorizedAlways:
                    self.shouldStartAfterAuthorization = false
                    self.startTracking()
                case .authorizedWhenInUse:
                    self.shouldStartAfterAuthorization = false
                    self.requestOneShotLocation()
                    self.requestAlwaysAuthorizationOnce()
                case .denied, .restricted:
                    self.stopTracking()
                default:
                    break
                }
            }
        }
    }

    func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let newestLocation = locations.last else {
            return
        }

        DispatchQueue.main.async {
            self.oneShotLocationPending = false
            if !self.significantChangeMonitoring {
                self.isTracking = false
            }
            self.currentLocation = newestLocation
            self.accuracyAuthorization = manager.accuracyAuthorization
            let pointID = self.addFootprintPoint(newestLocation)
            self.resolvePlaceName(
                for: newestLocation,
                footprintID: pointID
            )
        }
    }

    func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        DispatchQueue.main.async {
            self.oneShotLocationPending = false
            if !self.significantChangeMonitoring {
                self.isTracking = false
            }
            self.lastError = "定位失败：\(error.localizedDescription)"
        }
    }

    @discardableResult
    private func addFootprintPoint(
        _ location: CLLocation
    ) -> UUID? {
        guard location.horizontalAccuracy >= 0,
              location.horizontalAccuracy <= 100 else {
            return nil
        }

        let locationAge = abs(location.timestamp.timeIntervalSinceNow)
        guard locationAge <= 120,
              Calendar.current.isDateInToday(location.timestamp) else {
            return nil
        }

        if let lastPoint = todayPoints.last {
            let previousLocation = CLLocation(
                latitude: lastPoint.latitude,
                longitude: lastPoint.longitude
            )
            let movedDistance = location.distance(from: previousLocation)
            let meaningfulDistance = max(
                200.0,
                min(
                    350.0,
                    lastPoint.horizontalAccuracy +
                    location.horizontalAccuracy + 100.0
                )
            )

            if movedDistance < meaningfulDistance {
                return lastPoint.id
            }
        }

        let point = FootprintPoint(
            location: location,
            placeName: currentPlaceName == "尚未解析具体位置"
                ? nil
                : currentPlaceName
        )
        todayPoints.append(point)
        saveTodayPoints()
        return point.id
    }

    private func resolvePlaceName(
        for location: CLLocation,
        footprintID: UUID?
    ) {
        if let previous = lastGeocodedLocation,
           let previousDate = lastGeocodedAt,
           location.distance(from: previous) < 50,
           Date().timeIntervalSince(previousDate) < 300,
           currentPlaceName != "尚未解析具体位置" {
            updateFootprintName(
                id: footprintID,
                placeName: currentPlaceName
            )
            return
        }

        guard reverseGeocodingRequest?.isLoading != true else {
            return
        }

        guard let request = MKReverseGeocodingRequest(location: location)
        else {
            lastError = "地点解析请求创建失败"
            return
        }
        request.preferredLocale = Locale(identifier: "zh_CN")
        reverseGeocodingRequest = request

        Task { [weak self] in
            do {
                let mapItems = try await request.mapItems
                guard let self,
                      self.reverseGeocodingRequest === request else {
                    return
                }
                self.reverseGeocodingRequest = nil
                guard let mapItem = mapItems.first else { return }

                let placeName = self.formattedPlaceName(mapItem)
                self.currentPlaceName = placeName
                self.lastGeocodedLocation = location
                self.lastGeocodedAt = Date()
                self.updateFootprintName(
                    id: footprintID,
                    placeName: placeName
                )
            } catch {
                guard let self,
                      self.reverseGeocodingRequest === request else {
                    return
                }
                self.reverseGeocodingRequest = nil
                self.lastError = "地点解析失败：\(error.localizedDescription)"
            }
        }
    }

    private func formattedPlaceName(
        _ mapItem: MKMapItem
    ) -> String {
        let candidates = [
            mapItem.addressRepresentations?.fullAddress(
                includingRegion: true,
                singleLine: true
            ),
            mapItem.name
        ]
        for value in candidates.compactMap({ $0 }) {
            let clean = value.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            if !clean.isEmpty {
                return clean
            }
        }
        return "已获取位置，暂未解析地址"
    }

    private func updateFootprintName(
        id: UUID?,
        placeName: String
    ) {
        guard let id,
              let index = todayPoints.firstIndex(where: { $0.id == id }) else {
            return
        }
        guard todayPoints[index].placeName != placeName else { return }
        todayPoints[index].placeName = placeName
        saveTodayPoints()
    }

    private func saveTodayPoints() {
        do {
            let data = try JSONEncoder().encode(todayPoints)
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            lastError = "保存今日足迹失败：\(error.localizedDescription)"
        }
    }

    private func loadTodayPoints() {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else {
            todayPoints = []
            return
        }

        do {
            let savedPoints = try JSONDecoder().decode(
                [FootprintPoint].self,
                from: data
            )
            let today = savedPoints.filter {
                Calendar.current.isDateInToday($0.timestamp)
            }
            let compacted = compactMeaningfulPoints(today)
            todayPoints = compacted
            if compacted != savedPoints {
                saveTodayPoints()
            }
        } catch {
            todayPoints = []
            UserDefaults.standard.removeObject(forKey: storageKey)
        }
    }

    private func compactMeaningfulPoints(
        _ points: [FootprintPoint]
    ) -> [FootprintPoint] {
        var compacted: [FootprintPoint] = []

        for point in points.sorted(by: { $0.timestamp < $1.timestamp }) {
            guard let lastPoint = compacted.last else {
                compacted.append(point)
                continue
            }

            let lastLocation = CLLocation(
                latitude: lastPoint.latitude,
                longitude: lastPoint.longitude
            )
            let currentLocation = CLLocation(
                latitude: point.latitude,
                longitude: point.longitude
            )
            let meaningfulDistance = max(
                200.0,
                min(
                    350.0,
                    lastPoint.horizontalAccuracy +
                    point.horizontalAccuracy + 100.0
                )
            )

            if currentLocation.distance(from: lastLocation) >=
                meaningfulDistance {
                compacted.append(point)
            }
        }

        return compacted
    }
}
