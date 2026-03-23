package com.kko004.chitieumoingay;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

public class MainActivity extends Activity {
  private static final int REQUEST_CODE_POST_NOTIFICATIONS = 1301;
  private static final String WEBVIEW_TAG = "ExpenseTrackerWebView";

  private WebView webView;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    ReminderScheduler.createNotificationChannel(this);

    webView = new WebView(this);
    setContentView(webView);
    webView.setBackgroundColor(Color.parseColor("#0e1210"));
    // Keep the WebView on hardware rendering for smoother scrolling.
    // The web UI now disables blur-heavy effects on Android during page load.
    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    final boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      WebView.setWebContentsDebuggingEnabled(isDebuggable);
    }

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(false);
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setTextZoom(100);
    settings.setNeedInitialFocus(false);

    webView.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request == null || request.getUrl() == null) {
          return false;
        }
        if (!request.isForMainFrame()) {
          return false;
        }
        return handleNavigation(view, request.getUrl());
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url == null || url.trim().isEmpty()) {
          return false;
        }
        return handleNavigation(view, Uri.parse(url));
      }

      private boolean handleNavigation(WebView view, Uri uri) {
        if (view == null || uri == null) {
          return false;
        }
        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
        String url = uri.toString();
        if ("file".equals(scheme)) {
          view.loadUrl(url);
          return true;
        }
        if ("http".equals(scheme) || "https".equals(scheme)) {
          if (shouldOpenExternally(uri)) {
            return openExternalUri(uri);
          }
          view.loadUrl(url);
          return true;
        }
        return openExternalUri(uri);
      }

      private boolean shouldOpenExternally(Uri uri) {
        String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
        String path = uri.getPath() != null ? uri.getPath().toLowerCase() : "";
        String url = uri.toString().toLowerCase();
        return path.endsWith(".apk") ||
          url.contains("export=download") ||
          "drive.google.com".equals(host) ||
          "docs.google.com".equals(host);
      }

      private boolean openExternalUri(Uri uri) {
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, uri));
          return true;
        } catch (Exception error) {
          Log.w(WEBVIEW_TAG, "Cannot open external uri=" + uri + " error=" + error.getMessage());
          return false;
        }
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (isDebuggable) {
          Log.i(WEBVIEW_TAG, "onPageFinished url=" + url);
        }
      }

      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        CharSequence description = error != null ? error.getDescription() : "unknown";
        int code = error != null ? error.getErrorCode() : -1;
        String url = request != null && request.getUrl() != null ? request.getUrl().toString() : "unknown";
        boolean mainFrame = request != null && request.isForMainFrame();
        Log.e(
          WEBVIEW_TAG,
          "Resource load error mainFrame=" + mainFrame + " code=" + code + " description=" + description + " url=" + url
        );
      }
    });
    webView.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
        if (!isDebuggable || consoleMessage == null) {
          return false;
        }
        String message =
          "JS " + consoleMessage.messageLevel() +
          " @" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() +
          " -> " + consoleMessage.message();
        if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
          Log.e(WEBVIEW_TAG, message);
        } else if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.WARNING) {
          Log.w(WEBVIEW_TAG, message);
        } else {
          Log.i(WEBVIEW_TAG, message);
        }
        return false;
      }
    });
    webView.addJavascriptInterface(new AndroidReminderBridge(), "AndroidReminderBridge");
    webView.setHorizontalScrollBarEnabled(false);
    webView.setVerticalScrollBarEnabled(true);
    webView.setOverScrollMode(WebView.OVER_SCROLL_IF_CONTENT_SCROLLS);

    webView.loadUrl("file:///android_asset/www/index.html");
  }

  private String getNotificationPermissionState() {
    if (!ReminderScheduler.areNotificationsEnabled(this)) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
          return "denied";
        }
        return ReminderScheduler.wasNotificationPermissionRequested(this) ? "denied" : "default";
      }
      return "denied";
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
        return "granted";
      }
      return ReminderScheduler.wasNotificationPermissionRequested(this) ? "denied" : "default";
    }

    return "granted";
  }

  private String requestNotificationPermissionFromJavascript() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return getNotificationPermissionState();
    }

    if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
      return "granted";
    }

    ReminderScheduler.markNotificationPermissionRequested(this);
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_CODE_POST_NOTIFICATIONS);
      }
    });

    return "pending";
  }

  private void notifyWebPermissionResult(String state) {
    if (webView == null) {
      return;
    }

    final String script =
      "window.__onAndroidNotificationPermissionResult && " +
      "window.__onAndroidNotificationPermissionResult(" + JSONObject.quote(state) + ");";
    webView.post(new Runnable() {
      @Override
      public void run() {
        if (webView != null) {
          webView.evaluateJavascript(script, null);
        }
      }
    });
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);

    if (requestCode == REQUEST_CODE_POST_NOTIFICATIONS) {
      String state = getNotificationPermissionState();
      notifyWebPermissionResult(state);
      if ("granted".equals(state)) {
        ReminderScheduler.scheduleStoredReminder(this);
      }
    }
  }

  private final class AndroidReminderBridge {
    @JavascriptInterface
    public String getNotificationPermissionState() {
      return MainActivity.this.getNotificationPermissionState();
    }

    @JavascriptInterface
    public String requestNotificationPermission() {
      return MainActivity.this.requestNotificationPermissionFromJavascript();
    }

    @JavascriptInterface
    public void scheduleDailyReminder(int hour, int minute, String title, String message) {
      ReminderScheduler.scheduleDailyReminder(MainActivity.this, hour, minute, title, message);
    }

    @JavascriptInterface
    public void cancelDailyReminder() {
      ReminderScheduler.cancelDailyReminder(MainActivity.this);
    }

    @JavascriptInterface
    public void updateTodayRecordState(String dateKey, boolean hasRecordToday) {
      ReminderScheduler.updateTodayRecordState(MainActivity.this, dateKey, hasRecordToday);
    }

    @JavascriptInterface
    public void maybeSendReminderNow() {
      ReminderScheduler.maybeSendReminderNow(MainActivity.this);
    }

  }

  @Override
  public void onBackPressed() {
    if (webView != null && webView.canGoBack()) {
      webView.goBack();
      return;
    }
    super.onBackPressed();
  }

  @Override
  protected void onDestroy() {
    if (webView != null) {
      webView.destroy();
      webView = null;
    }
    super.onDestroy();
  }
}
