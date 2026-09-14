package com.ntv.quanlykho;

import android.Manifest;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.media.Image;
import android.util.DisplayMetrics;
import android.util.Size;
import android.widget.FrameLayout;
import android.graphics.Canvas;
import android.graphics.Outline;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.ViewOutlineProvider;
import androidx.annotation.OptIn;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.MeteringPointFactory;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private FrameLayout nativeBox;
    private PreviewView nativePreviewView;
    private ViewfinderOverlay nativeViewfinder;
    private ProcessCameraProvider cameraProvider;
    private ExecutorService cameraExecutor;
    private BarcodeScanner barcodeScanner;
    private Camera activeCamera;
    private long lastScannedTimestamp = 0;
    private String lastScannedCode = "";
    private volatile boolean isScanningPaused = false;
    private long lastAnalysisTimestamp = 0;
    private static final long ANALYSIS_INTERVAL_MS = 110; // ~9 FPS: cực kỳ mượt & nhạy cho quét mã, giảm tải CPU >75%

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        cameraExecutor = Executors.newSingleThreadExecutor();
        BarcodeScannerOptions options = new BarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_QR_CODE,
                Barcode.FORMAT_CODE_128,
                Barcode.FORMAT_EAN_13
            )
            .build();
        barcodeScanner = BarcodeScanning.getClient(options);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setNavigationBarColor(Color.parseColor("#141b17"));
            getWindow().setStatusBarColor(Color.parseColor("#141b17"));
        }

        WebView.setWebContentsDebuggingEnabled(true);
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void exitApp() {
                    runOnUiThread(() -> {
                        finishAffinity();
                    });
                }

                @JavascriptInterface
                public String saveFileToDownload(String fileName, String base64Data, String mimeType) {
                    try {
                        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            // Xóa bản ghi cũ cùng tên trong MediaStore để ép ghi đè sạch sẽ, không sinh file (1), (2)
                            try {
                                Uri queryUri = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                                String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=?";
                                String[] selectionArgs = new String[]{fileName};
                                getContentResolver().delete(queryUri, selection, selectionArgs);
                            } catch (Exception ignore) {}

                            ContentValues values = new ContentValues();
                            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType != null ? mimeType : "application/octet-stream");
                            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                            if (uri != null) {
                                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                                    if (os != null) {
                                        os.write(bytes);
                                        os.flush();
                                        return "OK:Download/" + fileName;
                                    }
                                }
                            }
                        }

                        File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!downloadDir.exists()) {
                            downloadDir.mkdirs();
                        }
                        File destFile = new File(downloadDir, fileName);
                        if (destFile.exists()) {
                            destFile.delete();
                        }
                        try (FileOutputStream fos = new FileOutputStream(destFile)) {
                            fos.write(bytes);
                            fos.flush();
                        }
                        MediaScannerConnection.scanFile(MainActivity.this, new String[]{destFile.getAbsolutePath()}, new String[]{mimeType}, null);
                        return "OK:" + destFile.getAbsolutePath();
                    } catch (Exception e) {
                        return "ERR:" + e.getMessage();
                    }
                }

                @JavascriptInterface
                public boolean shareFile(String fileName, String base64Data, String mimeType) {
                    try {
                        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                        File cacheDir = new File(getCacheDir(), "shared_files");
                        if (!cacheDir.exists()) {
                            cacheDir.mkdirs();
                        }
                        File destFile = new File(cacheDir, fileName);
                        try (FileOutputStream fos = new FileOutputStream(destFile)) {
                            fos.write(bytes);
                            fos.flush();
                        }

                        Uri contentUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            destFile
                        );

                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType(mimeType != null ? mimeType : "*/*");
                        shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(shareIntent, "Chia sẻ hoặc lưu file");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(chooser);
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                }

                @JavascriptInterface
                public void setKeepScreenOn(boolean keepOn) {
                    runOnUiThread(() -> {
                        if (keepOn) {
                            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                        } else {
                            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                        }
                    });
                }

                @JavascriptInterface
                public void vibrate(long ms) {
                    try {
                        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                        if (v != null && v.hasVibrator()) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                v.vibrate(VibrationEffect.createOneShot(ms > 0 ? ms : 70, VibrationEffect.DEFAULT_AMPLITUDE));
                            } else {
                                v.vibrate(ms > 0 ? ms : 70);
                            }
                        }
                    } catch (Exception ignore) {}
                }

                @JavascriptInterface
                public boolean isNativeScannerSupported() {
                    return true;
                }

                @JavascriptInterface
                public void startNativeScanner(final float x, final float y, final float width, final float height) {
                    runOnUiThread(() -> {
                        startCameraXScanner(x, y, width, height);
                    });
                }

                @JavascriptInterface
                public void updateNativeScannerBounds(final float x, final float y, final float width, final float height) {
                    runOnUiThread(() -> {
                        updateBounds(x, y, width, height);
                    });
                }

                @JavascriptInterface
                public void stopNativeScanner() {
                    runOnUiThread(() -> {
                        stopCameraXScanner();
                    });
                }

                @JavascriptInterface
                public void setNativeCameraVisible(final boolean visible) {
                    runOnUiThread(() -> {
                        isScanningPaused = !visible;
                        if (nativeBox != null) {
                            nativeBox.setVisibility(visible ? View.VISIBLE : View.GONE);
                        }
                    });
                }
            }, "AndroidNative");
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, 1001);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        isScanningPaused = true;
        stopCameraXScanner();
        runOnUiThread(() -> {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "if (window.ngatTatCaCamera) { window.ngatTatCaCamera(); }",
                null
            );
        }
    }

    @Override
    public void onDestroy() {
        stopCameraXScanner();
        if (cameraExecutor != null) {
            cameraExecutor.shutdown();
        }
        if (barcodeScanner != null) {
            barcodeScanner.close();
        }
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "if (window.ngatTatCaCamera) { window.ngatTatCaCamera(); }",
                null
            );
        }
        super.onDestroy();
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

    private void startCameraXScanner(float x, float y, float width, float height) {
        try {
            isScanningPaused = false;
            DisplayMetrics dm = getResources().getDisplayMetrics();
            WebView webView = getBridge().getWebView();
            int offX = 0, offY = 0;
            if (webView != null) {
                int[] webLoc = new int[2];
                webView.getLocationInWindow(webLoc);
                FrameLayout rootLayout = findViewById(android.R.id.content);
                int[] rootLoc = new int[2];
                rootLayout.getLocationInWindow(rootLoc);
                offX = webLoc[0] - rootLoc[0];
                offY = webLoc[1] - rootLoc[1];
            }

            int pxX = offX + Math.round(x * dm.density);
            int pxY = offY + Math.round(y * dm.density);
            int pxW = Math.round(width * dm.density);
            int pxH = Math.round(height * dm.density);

            FrameLayout rootLayout = findViewById(android.R.id.content);
            if (nativeBox == null) {
                nativeBox = new FrameLayout(this);
                final float cornerRadius = 14f * dm.density;
                nativeBox.setOutlineProvider(new ViewOutlineProvider() {
                    @Override
                    public void getOutline(View view, Outline outline) {
                        outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), cornerRadius);
                    }
                });
                nativeBox.setClipToOutline(true);

                nativePreviewView = new PreviewView(this);
                nativePreviewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
                nativeBox.addView(nativePreviewView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

                nativeViewfinder = new ViewfinderOverlay(this);
                nativeBox.addView(nativeViewfinder, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(pxW, pxH);
                lp.leftMargin = pxX;
                lp.topMargin = pxY;
                rootLayout.addView(nativeBox, lp);
            } else {
                updateBounds(x, y, width, height);
                nativeBox.setVisibility(View.VISIBLE);
            }

            ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(this);
            cameraProviderFuture.addListener(() -> {
                try {
                    cameraProvider = cameraProviderFuture.get();
                    cameraProvider.unbindAll();

                    // BẮT BUỘC: Luôn khóa chặt Camera Sau (Sony 48MP AF), TUYỆT ĐỐI không mở camera trước trên Redmi K20 Pro
                    CameraSelector cameraSelector = new CameraSelector.Builder()
                        .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                        .build();

                    Preview preview = new Preview.Builder().build();
                    if (nativePreviewView != null) {
                        preview.setSurfaceProvider(nativePreviewView.getSurfaceProvider());
                    }

                    ImageAnalysis imageAnalysis = new ImageAnalysis.Builder()
                        .setTargetResolution(new Size(960, 540))
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();

                    imageAnalysis.setAnalyzer(cameraExecutor, this::processImageProxy);

                    activeCamera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalysis);

                    // Chạm vào khung quét để lấy nét (Tap to focus) phần cứng
                    nativePreviewView.setOnTouchListener((v, event) -> {
                        if (event.getAction() == android.view.MotionEvent.ACTION_UP && activeCamera != null) {
                            try {
                                MeteringPointFactory factory = nativePreviewView.getMeteringPointFactory();
                                MeteringPoint point = factory.createPoint(event.getX(), event.getY());
                                FocusMeteringAction action = new FocusMeteringAction.Builder(point).build();
                                activeCamera.getCameraControl().startFocusAndMetering(action);
                            } catch (Exception ignore) {}
                        }
                        return true;
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }, ContextCompat.getMainExecutor(this));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @OptIn(markerClass = ExperimentalGetImage.class)
    private void processImageProxy(ImageProxy imageProxy) {
        long now = System.currentTimeMillis();
        // 1. Tự động ngắt xử lý khi: khung quét bị ẩn, chuyển trang khác, hoặc chưa đủ nhịp điều tiết 110ms (~9 FPS)
        // -> Giảm hơn 75% chu kỳ CPU, triệt tiêu nóng máy và tiết kiệm pin tối đa
        if (isScanningPaused || nativeBox == null || nativeBox.getVisibility() != View.VISIBLE || (now - lastAnalysisTimestamp < ANALYSIS_INTERVAL_MS)) {
            imageProxy.close();
            return;
        }

        Image mediaImage = imageProxy.getImage();
        if (mediaImage != null && barcodeScanner != null) {
            lastAnalysisTimestamp = now;
            InputImage image = InputImage.fromMediaImage(mediaImage, imageProxy.getImageInfo().getRotationDegrees());
            barcodeScanner.process(image)
                .addOnSuccessListener(barcodes -> {
                    for (Barcode barcode : barcodes) {
                        String rawValue = barcode.getRawValue();
                        if (rawValue != null && !rawValue.trim().isEmpty()) {
                            long scanNow = System.currentTimeMillis();
                            // Chống quét dồn dập cùng 1 mã trong 600ms
                            if (!rawValue.equals(lastScannedCode) || (scanNow - lastScannedTimestamp > 600)) {
                                lastScannedCode = rawValue;
                                lastScannedTimestamp = scanNow;
                                notifyWebBarcodeScanned(rawValue);
                                break;
                            }
                        }
                    }
                })
                .addOnFailureListener(e -> {})
                .addOnCompleteListener(task -> {
                    imageProxy.close();
                });
        } else {
            imageProxy.close();
        }
    }

    private void notifyWebBarcodeScanned(String rawValue) {
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                JSONObject obj = new JSONObject();
                try {
                    obj.put("text", rawValue);
                } catch (Exception ignore) {}
                String script = "if (typeof window.onNativeBarcodeDecoded === 'function') { " +
                                "  window.onNativeBarcodeDecoded(" + obj.toString() + ".text); " +
                                "}";
                getBridge().getWebView().evaluateJavascript(script, null);
            }
        });
    }

    private void updateBounds(float x, float y, float width, float height) {
        if (nativeBox == null) return;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        WebView webView = getBridge().getWebView();
        int offX = 0, offY = 0;
        if (webView != null) {
            int[] webLoc = new int[2];
            webView.getLocationInWindow(webLoc);
            FrameLayout rootLayout = findViewById(android.R.id.content);
            int[] rootLoc = new int[2];
            rootLayout.getLocationInWindow(rootLoc);
            offX = webLoc[0] - rootLoc[0];
            offY = webLoc[1] - rootLoc[1];
        }
        int pxX = offX + Math.round(x * dm.density);
        int pxY = offY + Math.round(y * dm.density);
        int pxW = Math.round(width * dm.density);
        int pxH = Math.round(height * dm.density);

        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) nativeBox.getLayoutParams();
        if (lp != null) {
            lp.width = pxW;
            lp.height = pxH;
            lp.leftMargin = pxX;
            lp.topMargin = pxY;
            nativeBox.setLayoutParams(lp);
            nativeBox.invalidateOutline();
        }
    }

    private void stopCameraXScanner() {
        isScanningPaused = true;
        if (cameraProvider != null) {
            try {
                cameraProvider.unbindAll();
            } catch (Exception ignore) {}
        }
        if (nativeBox != null) {
            nativeBox.setVisibility(View.GONE);
        }
    }

    private static class ViewfinderOverlay extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        public ViewfinderOverlay(android.content.Context context) {
            super(context);
            paint.setColor(Color.parseColor("#f59e0b"));
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeCap(Paint.Cap.ROUND);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float d = getResources().getDisplayMetrics().density;
            paint.setStrokeWidth(3.5f * d);
            float len = 22f * d;
            float inset = 14f * d;
            float r = 8f * d;
            float w = getWidth();
            float h = getHeight();

            if (w <= 0 || h <= 0) return;

            // Góc trên-trái
            Path tl = new Path();
            tl.moveTo(inset, inset + len);
            tl.lineTo(inset, inset + r);
            tl.quadTo(inset, inset, inset + r, inset);
            tl.lineTo(inset + len, inset);
            canvas.drawPath(tl, paint);

            // Góc trên-phải
            Path tr = new Path();
            tr.moveTo(w - inset - len, inset);
            tr.lineTo(w - inset - r, inset);
            tr.quadTo(w - inset, inset, w - inset, inset + r);
            tr.lineTo(w - inset, inset + len);
            canvas.drawPath(tr, paint);

            // Góc dưới-trái
            Path bl = new Path();
            bl.moveTo(inset, h - inset - len);
            bl.lineTo(inset, h - inset - r);
            bl.quadTo(inset, h - inset, inset + r, h - inset);
            bl.lineTo(inset + len, h - inset);
            canvas.drawPath(bl, paint);

            // Góc dưới-phải
            Path br = new Path();
            br.moveTo(w - inset - len, h - inset);
            br.lineTo(w - inset - r, h - inset);
            br.quadTo(w - inset, h - inset, w - inset, h - inset - r);
            br.lineTo(w - inset, h - inset - len);
            canvas.drawPath(br, paint);
        }
    }
}

