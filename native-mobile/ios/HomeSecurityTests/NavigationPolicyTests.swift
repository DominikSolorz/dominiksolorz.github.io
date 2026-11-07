import XCTest
@testable import HomeSecurity
final class NavigationPolicyTests: XCTestCase {
    func testOwnerRoutesPreservePhoneMode() throws {
        for route in PanelRoute.allCases {
            XCTAssertTrue(NavigationPolicy.isPanel(route.url))
            let items = URLComponents(url: route.url, resolvingAgainstBaseURL: false)!.queryItems!
            XCTAssertEqual(items.first { $0.name == "auth" }?.value, "login")
            XCTAssertEqual(items.first { $0.name == "panel" }?.value, "owner")
            XCTAssertEqual(items.first { $0.name == "ui" }?.value, "phone")
        }
    }
    func testRejectsForeignHostsAndUnsafeSchemes() throws {
        for text in ["http://dominiksolorz.github.io/kamera/", "https://dominiksolorz.github.io.evil.example/kamera/", "https://evil.example@dominiksolorz.github.io/kamera/", "https://dominiksolorz.github.io:444/kamera/", "https://dominiksolorz.github.io/kamera/../outside", "https://dominiksolorz.github.io/kamera/%2e%2e/outside", "file:///kamera/", "https://dominiksolorz.github.io/kameraevil/"] {
            XCTAssertFalse(NavigationPolicy.isPanel(try XCTUnwrap(URL(string: text))), text)
        }
    }
}
