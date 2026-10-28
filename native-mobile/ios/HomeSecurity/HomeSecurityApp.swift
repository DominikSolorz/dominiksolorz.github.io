import SwiftUI
import WebKit
import LocalAuthentication

@main struct HomeSecurityApp: App { var body: some Scene { WindowGroup { OwnerPanel() } } }

@MainActor final class PanelModel: ObservableObject {
    @Published var route: PanelRoute = .home
    @Published var status = "Łączenie z panelem…"
    @Published var reloadID = 0
    @Published var notice: String?
}
struct OwnerPanel: View {
    @StateObject private var model = PanelModel()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("requireDeviceUnlock") private var requireUnlock = false
    @State private var locked = false
    @State private var privacyCover = false
    @State private var unlocking = false
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading) { Text("HOME SECURITY").font(.headline); Text("Preview 0.1 · konto i PIN w panelu").font(.caption) }
                Spacer()
                Button { model.reloadID += 1 } label: { Image(systemName: "arrow.clockwise") }.accessibilityLabel("Odśwież panel")
                Menu {
                    Button(requireUnlock ? "Wyłącz blokadę urządzeniem" : "Włącz Face ID / kod urządzenia") { configureUnlock() }
                } label: { Image(systemName: requireUnlock ? "lock.shield.fill" : "lock.shield") }.accessibilityLabel("Ochrona dostępu")
            }.padding()
            Text(model.status).font(.caption).foregroundStyle(.secondary).padding(.horizontal).accessibilityAddTraits(.updatesFrequently)
            PanelWebView(model: model).accessibilityHidden(locked || privacyCover).allowsHitTesting(!locked && !privacyCover).overlay {
                if locked || privacyCover {
                    ZStack { Color(red: 0.035, green: 0.043, blue: 0.067); VStack(spacing: 18) {
                        Image(systemName: "lock.shield").font(.largeTitle)
                        Text("Twój panel pozostaje prywatny")
                        if locked && !privacyCover { Button("Odblokuj") { unlock() }.buttonStyle(.borderedProminent).disabled(unlocking) }
                    }.foregroundStyle(.white) }.accessibilityElement(children: .contain)
                }
            }
            HStack { ForEach(PanelRoute.allCases, id: \.self) { route in
                Button { model.route = route } label: { Label(route.title, systemImage: route.icon).font(.caption).frame(maxWidth: .infinity).padding(.vertical, 12) }
                    .disabled(locked).tint(model.route == route ? .pink : .secondary)
            } }.padding(.horizontal)
        }.preferredColorScheme(.dark)
        .alert("HOME SECURITY", isPresented: Binding(get: { model.notice != nil }, set: { if !$0 { model.notice = nil } })) { Button("Rozumiem") { model.notice = nil } } message: { Text(model.notice ?? "") }
        .onAppear { locked = requireUnlock; if locked { unlock() } }
        .onChange(of: scenePhase) { _, phase in
            privacyCover = phase != .active
            if phase == .background && requireUnlock { locked = true }
        }
    }
    private func configureUnlock() {
        let context = LAContext(); var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { model.notice = "Najpierw skonfiguruj kod urządzenia lub Face ID w ustawieniach iPhone’a."; return }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Zmień ochronę prywatnego panelu HOME SECURITY") { success, _ in
            DispatchQueue.main.async { if success { requireUnlock.toggle() } }
        }
    }
    private func unlock() {
        guard !unlocking else { return }; unlocking = true
        LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Odblokuj prywatny panel HOME SECURITY") { success, _ in
            DispatchQueue.main.async { unlocking = false; if success { locked = false } }
        }
    }
}
struct PanelWebView: UIViewRepresentable {
    @ObservedObject var model: PanelModel
    func makeCoordinator() -> Coordinator { Coordinator(model) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.applicationNameForUserAgent = "HomeSecurityNative/0.1 iOS"
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false; view.backgroundColor = .black
        view.navigationDelegate = context.coordinator
        view.load(URLRequest(url: model.route.url))
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {
        if context.coordinator.route != model.route { context.coordinator.route = model.route; view.load(URLRequest(url: model.route.url)) }
        if context.coordinator.reloadID != model.reloadID { context.coordinator.reloadID = model.reloadID; view.reload() }
    }
    @MainActor final class Coordinator: NSObject, WKNavigationDelegate {
        let model: PanelModel; var route: PanelRoute = .home; var reloadID = 0
        init(_ model: PanelModel) { self.model = model }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard action.targetFrame?.isMainFrame != false, let url = action.request.url else { decisionHandler(.allow); return }
            if NavigationPolicy.isPanel(url) { decisionHandler(.allow); return }
            decisionHandler(.cancel)
            if url.path.contains("/auth/") { model.notice = "W tej wersji testowej użyj e-maila i hasła. Logowanie Google wymaga bezpiecznego powrotu sesji do aplikacji."; return }
            if action.navigationType == .linkActivated && NavigationPolicy.external(url) { UIApplication.shared.open(url) }
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { model.status = "Panel połączony · stan kamery sprawdzisz w panelu" }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { model.status = "Nie udało się połączyć. Sprawdź internet i wybierz Odśwież." }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { model.status = "Przerwano połączenie. Wybierz Odśwież." }
    }
}
