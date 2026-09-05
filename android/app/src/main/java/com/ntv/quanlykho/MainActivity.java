package com.ntv.quanlykho;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.os.Build;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);

        // Bảo vệ ứng dụng chống sập do lỗi VideoCaptureFactory.getNumberOfCameras NullPointerException khi Camera HAL khởi động lại
        Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            if (throwable != null) {
                String str = throwable.toString();
                if (throwable.getCause() != null) str += " " + throwable.getCause().toString();
                if (str.contains("VideoCaptureFactory") || str.contains("getNumberOfCameras") || str.contains("getCameraIdList")) {
                    android.util.Log.e("QuanLyKho", "Bảo vệ an toàn: Ngăn chặn crash VideoCaptureFactory: " + str);
                    return;
                }
            }
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, 1001);
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
            getBridge().getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public boolean isCameraAvailable() {
                    try {
                        android.hardware.camera2.CameraManager cm = (android.hardware.camera2.CameraManager) getSystemService(CAMERA_SERVICE);
                        return cm != null && cm.getCameraIdList() != null && cm.getCameraIdList().length > 0;
                    } catch (Exception e) {
                        return false;
                    }
                }

                @JavascriptInterface
                public void vibrate(long milliseconds) {
                    try {
                        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                        if (v != null && v.hasVibrator()) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                                    .setFlags(android.media.AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                                    .build();
                                v.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE), audioAttributes);
                            } else {
                                v.vibrate(milliseconds);
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }, "AndroidBridge");
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        }
    }

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

