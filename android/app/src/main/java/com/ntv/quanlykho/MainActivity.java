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
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
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
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "if (window.ngatTatCaCamera) { window.ngatTatCaCamera(); }",
                null
            );
        }
    }

    @Override
    public void onDestroy() {
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
}

