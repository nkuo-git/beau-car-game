package com.nkuo.beaucargame;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 大便龍的改車遊戲：很薄的一層殼，整個畫面就是 WebView，載入 GitHub Pages 上的遊戲。
 * 改遊戲只要重新部署網頁，App 不用重編。這裡只處理：
 *   1. 全螢幕（網頁叫 BeauCarApp.setFullscreen：開車、比賽的時候把狀態列、導覽列藏起來）
 *   2. 返回鍵（先問網頁的 window.caridExitFullscreen：關掉自訂角色、離開這一趟的全螢幕；網頁說沒事才離開）
 *   3. 從萬能軟體搬進度：beaucargame://import?save=… → 網頁的 window.beauImport(save)（網頁會先問「要搬過來嗎？」）
 *   4. User-Agent 帶 BeauCarApp/<版號>：網頁拿它跟 GitHub Release 的 apk-<版號> 比，有新的就跳「App 有新版本」
 *   5. 用 Google 帳號登入（雲端存檔）：網頁叫 BeauCarApp.googleSignIn() → 手機跳出「選 Google 帳號」→
 *      把 Google 給的 ID token 交給網頁的 window.beauGoogleSignIn(idToken, 錯誤)，網頁再拿去登入 Firebase
 *   6. App 新版本自己下載、跳出安裝（Nick 2026-10-10「不要再經過 github」）：網頁按「下載安裝」叫 BeauCarApp.installApk(網址)
 *      → 下載到 App 的暫存資料夾（進度交給 window.beauApkProgress(百分比, 狀態)）→ 檢查是這個 App、比較新 → 手機的「安裝」畫面
 *      （一定要人按「安裝」：Android 不讓 App 自己偷偷裝）。第一次要在設定裡允許「安裝不明應用程式」。
 */
public class MainActivity extends Activity {

  /** 遊戲的網址（GitHub Pages）。 */
  private static final String START_URL = "https://nkuo-git.github.io/beau-car-game/";

  /** Firebase 專案 beau-car-game 的「網頁用戶端 ID」（公開的，不是密碼）：Google 發的 ID token 是給它的，Firebase 才收。 */
  private static final String WEB_CLIENT_ID = "793707590323-fv2r1c0gu48qr3qulsrmr5f0dms22njk.apps.googleusercontent.com";

  private WebView web;

  /** 收到的搬家資料（save=…），先收著，等網頁準備好（BeauCarApp.ready()）再交給它。 */
  private volatile String pendingSave;

  /** 新版 APK 只從這裡下載（GitHub Release 的檔案；GitHub 會轉到它自己的下載伺服器，一樣是 https）。 */
  private static final String APK_PREFIX = "https://github.com/nkuo-git/beau-car-game/releases/download/";

  /** 正在下載新版 APK（一次只下載一個）。 */
  private volatile boolean apkDownloading;

  /** 下載好了、在等人去設定裡允許「安裝不明應用程式」，回來（onResume）再接著安裝。 */
  private File apkWaiting;

  /** 網頁要全螢幕（開車、比賽的時候 setFullscreen(true)）：狀態列、導覽列藏起來。 */
  private volatile boolean fullscreen;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    web = new WebView(this);
    setContentView(web);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);          // 存檔在 localStorage，沒有這個就存不住
    s.setUseWideViewPort(true);
    s.setLoadWithOverviewMode(true);
    s.setTextZoom(100); // 字固定用遊戲自己的大小：手機「字型大小」調大的時候按鈕上的字（手煞車）不會擠成兩行（2026-10-10）
    s.setMediaPlaybackRequiresUserGesture(false); // 引擎聲
    // 外殼版號寫進 User-Agent：網頁才知道自己跑在 App 裡、是哪一版（標題旁的 0.<這個>.<內容>、查有沒有新的 APK）
    s.setUserAgentString(s.getUserAgentString() + " BeauCarApp/" + versionCode());
    web.addJavascriptInterface(new Bridge(), "BeauCarApp");

    web.setWebViewClient(new WebViewClient() {
      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        // 換頁、重新整理：新的頁面還沒說要全螢幕，狀態列、導覽列先放回來
        if (fullscreen) {
          fullscreen = false;
          applyFullscreen();
        }
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        // 網頁通常會自己說 ready()，這裡是保險
        deliverSave();
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        Uri start = Uri.parse(START_URL);
        String path = url.getPath() == null ? "" : url.getPath();
        // 遊戲自己的網頁留在 App 裡；其他的（例如 GitHub 上下載新版 APK）丟給瀏覽器
        if (start.getHost().equals(url.getHost()) && path.startsWith(start.getPath())) return false;
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (Exception e) {
          return false;
        }
        return true;
      }
    });

    keepSave(getIntent());
    web.loadUrl(START_URL);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // App 本來就開著（singleTask），從萬能軟體跳過來會走這裡
    if (keepSave(intent)) deliverSave();
  }

  /** 是 beaucargame://import?save=… 就把 save 收起來，回傳有沒有收到。 */
  private boolean keepSave(Intent intent) {
    Uri data = intent != null ? intent.getData() : null;
    if (data == null || !"beaucargame".equals(data.getScheme()) || !"import".equals(data.getHost())) return false;
    String save = data.getQueryParameter("save");
    if (save == null || save.isEmpty()) return false;
    pendingSave = save;
    return true;
  }

  /**
   * 把收著的搬家資料交給網頁的 window.beauImport()（網頁自己檢查、先問再寫）。
   * 網頁還沒準備好（還沒有 beauImport）就先留著，等它說 ready() 再送。
   */
  private void deliverSave() {
    final String save = pendingSave;
    if (save == null || web == null) return;
    pendingSave = null;
    web.evaluateJavascript(
        "window.beauImport?(window.beauImport(" + JSONObject.quote(save) + "),'ok'):''",
        result -> {
          if (!"\"ok\"".equals(result) && pendingSave == null) pendingSave = save;
        });
  }

  /** 網頁可以呼叫的小功能，在網頁裡叫 window.BeauCarApp。 */
  private class Bridge {
    /** 網頁準備好接搬家資料了。 */
    @JavascriptInterface
    public void ready() {
      runOnUiThread(MainActivity.this::deliverSave);
    }

    /** 網頁按「用 Google 帳號登入」：跳出選帳號，結果送回 window.beauGoogleSignIn。 */
    @JavascriptInterface
    public void googleSignIn() {
      runOnUiThread(MainActivity.this::startGoogleSignIn);
    }

    /** 網頁按「下載安裝」：在 App 裡下載新版 APK，下載好跳出安裝（不打開 GitHub）。 */
    @JavascriptInterface
    public void installApk(String url) {
      if (url == null || !url.startsWith(APK_PREFIX) || !url.endsWith(".apk")) { apkProgress(0, "fail"); return; }
      if (apkDownloading) return;
      apkDownloading = true;
      new Thread(() -> downloadApk(url), "apk").start();
    }

    /** 開車、比賽的時候 true（全螢幕）、回到車庫頁 false。 */
    @JavascriptInterface
    public void setFullscreen(boolean on) {
      runOnUiThread(() -> {
        fullscreen = on;
        applyFullscreen();
      });
    }
  }

  /** 手機的「用 Google 帳號登入」（Credential Manager）：每次都讓人選帳號（也可以加一個新的）。 */
  private void startGoogleSignIn() {
    GetSignInWithGoogleOption google = new GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID).build();
    GetCredentialRequest req = new GetCredentialRequest.Builder().addCredentialOption(google).build();
    try {
      CredentialManager.create(this).getCredentialAsync(this, req, null, ContextCompat.getMainExecutor(this),
          new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
            @Override
            public void onResult(GetCredentialResponse res) {
              Credential c = res.getCredential();
              if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                try {
                  sendSignIn(GoogleIdTokenCredential.createFrom(c.getData()).getIdToken(), null);
                  return;
                } catch (Exception e) {
                  // 看不懂的回覆：當作失敗
                }
              }
              sendSignIn(null, "fail");
            }

            @Override
            public void onError(GetCredentialException e) {
              // 按了取消：不用說什麼；手機上沒有 Google 帳號：叫他先加一個；其他：再試一次
              String code = e instanceof GetCredentialCancellationException ? "cancel"
                  : e instanceof NoCredentialException ? "noacct" : "fail";
              sendSignIn(null, code);
            }
          });
    } catch (Exception e) {
      sendSignIn(null, "fail");
    }
  }

  /** 把登入的結果交給網頁：window.beauGoogleSignIn(idToken, 錯誤)。 */
  private void sendSignIn(String idToken, String error) {
    if (web == null) return;
    web.evaluateJavascript("window.beauGoogleSignIn&&window.beauGoogleSignIn("
        + (idToken == null ? "null" : JSONObject.quote(idToken)) + ","
        + (error == null ? "null" : JSONObject.quote(error)) + ")", null);
  }

  /** 下載新版 APK 到 cache/apk/update.apk（背景執行緒），每多 2% 告訴網頁一次；好了就檢查、安裝。 */
  private void downloadApk(String url) {
    File dir = new File(getCacheDir(), "apk"), out = new File(dir, "update.apk");
    try {
      dir.mkdirs();
      HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
      c.setInstanceFollowRedirects(true); // GitHub → 它的下載伺服器（都是 https）
      c.setConnectTimeout(15000);
      c.setReadTimeout(30000);
      if (c.getResponseCode() != 200) throw new Exception("http " + c.getResponseCode());
      long total = c.getContentLengthLong(), got = 0;
      int last = -1;
      try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(out)) {
        byte[] buf = new byte[64 * 1024];
        for (int n; (n = in.read(buf)) > 0; ) {
          o.write(buf, 0, n);
          got += n;
          int pct = total > 0 ? (int) (got * 100 / total) : 0;
          if (pct >= last + 2) { last = pct; apkProgress(pct, "dl"); }
        }
      } finally {
        c.disconnect();
      }
      if (total > 0 && got != total) throw new Exception("short");
      // 一定要是這個 App（同一個 package）、而且比現在的新，才拿去安裝
      android.content.pm.PackageInfo info = getPackageManager().getPackageArchiveInfo(out.getPath(), 0);
      if (info == null || !getPackageName().equals(info.packageName) || info.versionCode <= versionCode()) throw new Exception("bad apk");
      apkProgress(100, "dl");
      runOnUiThread(() -> installNow(out));
    } catch (Exception e) {
      out.delete();
      apkProgress(0, "fail");
    } finally {
      apkDownloading = false;
    }
  }

  /** 跳出手機的「安裝」畫面；還沒允許這個 App 安裝應用程式的話，先打開那個設定（回來 onResume 再接著）。 */
  private void installNow(File apk) {
    if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
      apkWaiting = apk;
      apkProgress(100, "perm");
      try {
        startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
      } catch (Exception e) {
        apkWaiting = null;
        apkProgress(0, "fail");
      }
      return;
    }
    try {
      Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", apk);
      Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(i);
      apkProgress(100, "install");
    } catch (Exception e) {
      apkProgress(0, "fail");
    }
  }

  /** 把下載、安裝的進度交給網頁：window.beauApkProgress(百分比, 狀態)。 */
  private void apkProgress(int pct, String state) {
    runOnUiThread(() -> {
      if (web != null) web.evaluateJavascript("window.beauApkProgress&&window.beauApkProgress(" + pct + "," + JSONObject.quote(state) + ")", null);
    });
  }

  /** 照 fullscreen 藏起／放回狀態列和導覽列。藏起來的時候從螢幕邊邊滑一下會暫時跑出來，過一下又自己收回去。 */
  private void applyFullscreen() {
    WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (fullscreen) {
      bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      bars.hide(WindowInsetsCompat.Type.systemBars());
    } else {
      bars.show(WindowInsetsCompat.Type.systemBars());
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (fullscreen) applyFullscreen(); // 切到別的 App 再回來：還在全螢幕就再藏一次
    if (apkWaiting != null) { // 從「允許安裝不明應用程式」的設定回來
      File apk = apkWaiting;
      apkWaiting = null;
      if (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls()) installNow(apk);
      else apkProgress(0, "denied");
    }
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus && fullscreen) applyFullscreen(); // 拉下通知欄再回來也一樣
  }

  /** 這個 APK 的版號，對應 GitHub Release 的 apk-N。 */
  private int versionCode() {
    try {
      return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
    } catch (PackageManager.NameNotFoundException e) {
      return 0;
    }
  }

  @Override
  public void onBackPressed() {
    if (web == null) {
      super.onBackPressed();
      return;
    }
    // 先問網頁：自訂角色開著就關掉、全螢幕玩的時候只離開這一趟的全螢幕（網頁回 true）；網頁說沒事才真的返回／離開
    web.evaluateJavascript(
        "(function(){try{return !!(window.caridExitFullscreen&&window.caridExitFullscreen());}catch(e){return false;}})()",
        result -> {
          if ("true".equals(result)) return;
          if (web.canGoBack()) web.goBack();
          else finish();
        });
  }
}
