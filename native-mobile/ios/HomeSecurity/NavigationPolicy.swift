import Foundation

enum PanelRoute: String, CaseIterable { case home, recordings, settings
    var title: String { switch self { case .home: return "Podgląd"; case .recordings: return "Nagrania"; case .settings: return "Ustawienia" } }
    var icon: String { switch self { case .home: return "video"; case .recordings: return "play.rectangle"; case .settings: return "gearshape" } }
    var url: URL { var c = URLComponents(string: "https://dominiksolorz.github.io/kamera/panel.html")!; c.queryItems = [URLQueryItem(name: "auth", value: "login"), URLQueryItem(name: "panel", value: "owner"), URLQueryItem(name: "ui", value: "phone"), URLQueryItem(name: "mobileView", value: rawValue)]; return c.url! }
}
enum NavigationPolicy {
    static func isPanel(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.host?.lowercased() == "dominiksolorz.github.io"
            && url.user == nil && url.password == nil && (url.port == nil || url.port == 443)
            && (url.path as NSString).standardizingPath.hasPrefix("/kamera/")
    }
    static func external(_ url: URL) -> Bool { url.scheme?.lowercased() == "https" && url.host != nil && url.user == nil && url.password == nil }
}
