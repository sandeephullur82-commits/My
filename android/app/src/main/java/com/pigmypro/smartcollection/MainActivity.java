package com.pigmypro.smartcollection;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidNativeInterface(), "AndroidNativeApp");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Resolves a file from raw path, file:// URI, or relative cache path.
     */
    private File resolveFile(String filePath) {
        if (filePath == null || filePath.trim().isEmpty()) {
            return null;
        }

        try {
            String cleanPath = filePath.trim();
            if (cleanPath.startsWith("file://")) {
                cleanPath = Uri.parse(cleanPath).getPath();
            }

            if (cleanPath != null) {
                cleanPath = URLDecoder.decode(cleanPath, "UTF-8");
                File directFile = new File(cleanPath);
                if (directFile.exists()) {
                    return directFile;
                }
            }

            // Fallback: check inside app cache directory
            File cacheFile = new File(getCacheDir(), cleanPath.startsWith("/") ? cleanPath.substring(1) : cleanPath);
            if (cacheFile.exists()) {
                return cacheFile;
            }

            // Fallback: check inside app files directory
            File appFilesFile = new File(getFilesDir(), cleanPath.startsWith("/") ? cleanPath.substring(1) : cleanPath);
            if (appFilesFile.exists()) {
                return appFilesFile;
            }

            return new File(cleanPath);
        } catch (Exception e) {
            e.printStackTrace();
            return new File(filePath);
        }
    }

    public class AndroidNativeInterface {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void printCurrentPage(final String jobName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            WebView webView = getBridge().getWebView();
                            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName != null ? jobName : "Pigmy_Receipt");
                            printManager.print(jobName != null ? jobName : "Pigmy_Receipt", printAdapter, new PrintAttributes.Builder().build());
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        /**
         * Prints an actual PDF or document file directly to the Android Print Spooler.
         */
        @JavascriptInterface
        public void printFile(final String filePath, final String jobName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        File targetFile = resolveFile(filePath);
                        if (targetFile == null || !targetFile.exists()) {
                            // If file not resolved directly, fall back to current page print
                            printCurrentPage(jobName);
                            return;
                        }

                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            final String printJobName = jobName != null && !jobName.isEmpty() ? jobName : "Pigmy_Pro_Document";
                            PrintDocumentAdapter adapter = new FilePrintDocumentAdapter(targetFile, printJobName);
                            printManager.print(printJobName, adapter, new PrintAttributes.Builder().build());
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                        // Fallback to print current page
                        printCurrentPage(jobName);
                    }
                }
            });
        }

        /**
         * Native Android Share Sheet with FileProvider ClipData and explicit URI permissions.
         */
        @JavascriptInterface
        public void shareFile(final String filePath, final String mimeType, final String title, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        File targetFile = resolveFile(filePath);
                        if (targetFile == null || !targetFile.exists()) {
                            return;
                        }

                        Uri contentUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            targetFile
                        );

                        Intent intent = new Intent(Intent.ACTION_SEND);
                        intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "*/*");
                        intent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        intent.setClipData(ClipData.newRawUri("", contentUri));

                        if (text != null && !text.isEmpty()) {
                            intent.putExtra(Intent.EXTRA_TEXT, text);
                        }
                        if (title != null && !title.isEmpty()) {
                            intent.putExtra(Intent.EXTRA_SUBJECT, title);
                        }

                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(intent, title != null ? title : "Share with");
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        // Explicitly grant read URI permission to all potential matching apps
                        List<ResolveInfo> resInfoList = getPackageManager().queryIntentActivities(chooser, PackageManager.MATCH_DEFAULT_ONLY);
                        for (ResolveInfo resolveInfo : resInfoList) {
                            String packageName = resolveInfo.activityInfo.packageName;
                            grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        }

                        startActivity(chooser);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        /**
         * Shares a file directly to WhatsApp with prefilled message.
         */
        @JavascriptInterface
        public void shareToWhatsApp(final String filePath, final String mimeType, final String phone, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        File targetFile = resolveFile(filePath);
                        if (targetFile != null && targetFile.exists()) {
                            Uri contentUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getPackageName() + ".fileprovider",
                                targetFile
                            );

                            Intent intent = new Intent(Intent.ACTION_SEND);
                            intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "*/*");
                            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
                            intent.setClipData(ClipData.newRawUri("", contentUri));
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                            if (text != null && !text.isEmpty()) {
                                intent.putExtra(Intent.EXTRA_TEXT, text);
                            }

                            // Check WhatsApp regular or Business
                            boolean launched = false;
                            for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                                try {
                                    getPackageManager().getPackageInfo(pkg, 0);
                                    intent.setPackage(pkg);
                                    grantUriPermission(pkg, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                    startActivity(intent);
                                    launched = true;
                                    break;
                                } catch (PackageManager.NameNotFoundException ignored) {}
                            }

                            if (!launched) {
                                // If WhatsApp not directly targetable by package, open standard chooser
                                shareFile(filePath, mimeType, "Share via WhatsApp", text);
                            }
                            return;
                        }

                        // If no file attached, open WhatsApp chat URL
                        openWhatsApp(phone, text);
                    } catch (Exception e) {
                        e.printStackTrace();
                        openWhatsApp(phone, text);
                    }
                }
            });
        }

        @JavascriptInterface
        public void openWhatsApp(final String phone, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        String cleanPhone = phone != null ? phone.replaceAll("[^0-9]", "") : "";
                        if (cleanPhone.length() == 10) {
                            cleanPhone = "91" + cleanPhone;
                        }

                        String url = cleanPhone.isEmpty() 
                            ? "https://wa.me/?text=" + Uri.encode(text != null ? text : "")
                            : "https://wa.me/" + cleanPhone + "?text=" + Uri.encode(text != null ? text : "");

                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }
    }

    /**
     * Custom PrintDocumentAdapter that directly pipes an existing PDF/file to the Android Print Spooler.
     */
    private static class FilePrintDocumentAdapter extends PrintDocumentAdapter {
        private final File file;
        private final String jobName;

        public FilePrintDocumentAdapter(File file, String jobName) {
            this.file = file;
            this.jobName = jobName;
        }

        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                             CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }

            PrintDocumentInfo info = new PrintDocumentInfo.Builder(jobName)
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                    .build();
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                            CancellationSignal cancellationSignal, WriteResultCallback callback) {
            InputStream input = null;
            OutputStream output = null;
            try {
                input = new FileInputStream(file);
                output = new FileOutputStream(destination.getFileDescriptor());

                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = input.read(buffer)) > 0) {
                    if (cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    output.write(buffer, 0, bytesRead);
                }
                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (Exception e) {
                callback.onWriteFailed(e.getMessage());
            } finally {
                try {
                    if (input != null) input.close();
                    if (output != null) output.close();
                } catch (IOException ignored) {}
            }
        }
    }
}
