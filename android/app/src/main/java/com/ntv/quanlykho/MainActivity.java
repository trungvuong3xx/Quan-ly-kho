package com.ntv.quanlykho;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "if (window.handleNativeBackButton) { window.handleNativeBackButton(); } else { history.back(); }",
                null
            );
        } else {
            super.onBackPressed();
        }
    }
}
