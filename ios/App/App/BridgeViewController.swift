import UIKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        webView?.backgroundColor = .white
        webView?.isOpaque = true
        webView?.scrollView.backgroundColor = .white
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        webView?.backgroundColor = .white
        webView?.scrollView.backgroundColor = .white
    }
}
