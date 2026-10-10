import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

/**
 * Accurately determines if the current runtime environment is an Android device.
 * True for Capacitor native Android app AND mobile Android devices/browsers/PWAs.
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    if (Capacitor.getPlatform() === 'android') return true;
    return /android/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

/**
 * Backward compatibility alias for isAndroidDevice.
 */
export const isAndroidApp = isAndroidDevice;

/**
 * Strictly checks if running inside the compiled Capacitor native Android app.
 */
export function isNativeAndroidApp(): boolean {
  try {
    return (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') ||
      Boolean((window as any).AndroidNativeApp?.isAvailable?.());
  } catch {
    return false;
  }
}

/**
 * Checks if the application is running in installed PWA standalone mode.
 */
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as any).standalone) ||
      document.referrer.includes('android-app://');
  } catch {
    return false;
  }
}

/**
 * Retrieves descriptive runtime platform details for hybrid debugging & UI badges.
 */
export function getPlatformDetails() {
  const isNative = isNativeAndroidApp();
  const isPWA = isPWAStandalone();
  const isAndroid = isAndroidDevice();

  let mode: 'native_android' | 'pwa_standalone' | 'mobile_browser' | 'desktop_browser';
  let label: string;

  if (isNative) {
    mode = 'native_android';
    label = 'Native Android App';
  } else if (isPWA) {
    mode = 'pwa_standalone';
    label = 'Installed Progressive Web App (PWA)';
  } else if (isAndroid) {
    mode = 'mobile_browser';
    label = 'Mobile Android Web';
  } else {
    mode = 'desktop_browser';
    label = 'Web Browser';
  }

  return {
    isNative,
    isPWA,
    isAndroid,
    mode,
    label
  };
}

/**
 * Converts a Blob to a Base64 string for Android filesystem operations.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl ? dataUrl.split(',')[1] : '';
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sanitizes phone numbers to standard 12-digit Indian format (adds '91' prefix if 10 digits).
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Opens WhatsApp directly with prefilled text without popup blocker interference.
 */
export function openWhatsAppDirect(phone: string = '', text: string = '') {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(text);

  // 1. Native Android JavascriptInterface
  if ((window as any).AndroidNativeApp?.openWhatsApp) {
    (window as any).AndroidNativeApp.openWhatsApp(cleanPhone, text);
    return;
  }

  // 2. Direct browser navigation
  const url = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  // Use location assignment or anchor click to avoid popup blocker
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try { document.body.removeChild(link); } catch {}
  }, 1000);
}

/**
 * Android device native share handler.
 * Streamlines sharing across:
 * 1. Native Android bridge interface (window.AndroidNativeApp.shareFile) with ClipData & read permissions
 * 2. Capacitor native Share plugin with resolved cache file URI
 * 3. Mobile browser Web Share API Level 2 (navigator.canShare with files)
 * 4. Graceful text/URL share fallback
 */
export async function shareFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Document',
  text: string = ''
): Promise<'shared' | 'downloaded' | 'failed' | 'cancelled'> {
  try {
    const mimeType = blob.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png');

    // 1. Direct native Android interface hook with ClipData
    if ((window as any).AndroidNativeApp?.shareFile) {
      try {
        const base64Data = await blobToBase64(blob);
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });

        const fileUriResult = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName
        });

        const targetUri = fileUriResult.uri || writeResult.uri;
        (window as any).AndroidNativeApp.shareFile(
          targetUri,
          mimeType,
          title,
          text || `Pigmy Pro: ${title}`
        );
        return 'shared';
      } catch (nativeErr) {
        console.warn('Native interface share error, falling back to Capacitor Share:', nativeErr);
      }
    }

    // 2. Capacitor native platform
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        const base64Data = await blobToBase64(blob);
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });

        const fileUriResult = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName
        });

        await Share.share({
          title: title,
          text: text || `${title} from Pigmy Pro.`,
          dialogTitle: `Share ${title}`,
          files: [fileUriResult.uri || writeResult.uri]
        });

        return 'shared';
      } catch (capShareErr: any) {
        if (capShareErr?.message?.includes('canceled') || capShareErr?.message?.includes('cancelled')) {
          return 'cancelled';
        }
        console.warn('Capacitor Share failed, attempting Web Share fallback:', capShareErr);
      }
    }

    // 3. Android device in mobile browser / PWA (Web Share API Level 2)
    const file = new File([blob], fileName, { type: mimeType });

    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: text || `${title} from Pigmy Pro.`
        });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
          return 'cancelled';
        }
        console.warn('Web Share with files failed, attempting link share:', err);
      }
    }

    // 4. Text/URL Web Share fallback if files cannot be sent
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text || `Pigmy Pro: ${title}`,
          url: window.location.href
        });
        return 'shared';
      } catch (textShareErr: any) {
        if (textShareErr?.name === 'AbortError') return 'cancelled';
      }
    }

    // 5. Final fallback: Download file cleanly
    await downloadFileForAndroid(blob, fileName, title);
    return 'downloaded';
  } catch (err: any) {
    if (err?.message?.includes('cancelled') || err?.name === 'AbortError' || err?.message?.includes('canceled')) {
      return 'cancelled';
    }
    console.error('[Android Share Error]:', err);
    toast.error(`Share could not complete: ${err?.message || 'Error opening sharesheet'}`);
    return 'failed';
  }
}

/**
 * Shares a file directly to WhatsApp on Android or opens WhatsApp with document share.
 */
export async function shareFileToWhatsApp(
  blob: Blob,
  fileName: string,
  phone: string = '',
  text: string = ''
): Promise<'shared' | 'redirected' | 'failed'> {
  const mimeType = blob.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png');

  try {
    // 1. Direct native Android WhatsApp dispatch
    if ((window as any).AndroidNativeApp?.shareToWhatsApp) {
      const base64Data = await blobToBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });
      const fileUriResult = await Filesystem.getUri({
        directory: Directory.Cache,
        path: fileName
      });

      (window as any).AndroidNativeApp.shareToWhatsApp(
        fileUriResult.uri || writeResult.uri,
        mimeType,
        phone,
        text
      );
      return 'shared';
    }

    // 2. Web Share API with files on mobile browser
    const file = new File([blob], fileName, { type: mimeType });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Pigmy Pro Document',
          text: text || 'Pigmy Pro Document'
        });
        return 'shared';
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') return 'shared';
      }
    }

    // 3. Direct WhatsApp Web / App intent redirect
    openWhatsAppDirect(phone, text);
    return 'redirected';
  } catch (err) {
    console.error('WhatsApp share error:', err);
    openWhatsAppDirect(phone, text);
    return 'redirected';
  }
}

/**
 * Android device download and save handler.
 */
export async function downloadFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Document'
): Promise<boolean> {
  const toastId = toast.loading(`Saving ${fileName}...`);
  try {
    if (isNativeAndroidApp()) {
      const base64Data = await blobToBase64(blob);
      let writeResult;

      try {
        writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (docErr) {
        console.warn('Documents write failed, falling back to Cache:', docErr);
        writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });
      }

      toast.success(`Saved: ${fileName}`, {
        id: toastId,
        duration: 3000,
        action: {
          label: 'Open',
          onClick: () => {
            Share.share({
              dialogTitle: `Open ${title}`,
              files: [writeResult.uri]
            }).catch(() => {});
          }
        }
      });

      return true;
    }

    // Android Device in mobile browser / PWA
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 2000);

    toast.success(`Saved: ${fileName}`, { id: toastId, duration: 2500 });
    return true;
  } catch (err: any) {
    console.error('[Android Download Error]:', err);
    toast.error(`Could not save file: ${err?.message || 'Error'}`, { id: toastId });
    return false;
  }
}

/**
 * Universal Android & PWA Print Handler:
 * 1. Checks for native Android PrintManager file adapter (window.AndroidNativeApp.printFile)
 * 2. In Android mobile browsers / PWAs / Desktop: prints cleanly via a hidden iframe
 *    without being blocked by popup blockers or opening blank tabs!
 */
export async function printFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Print Document'
): Promise<boolean> {
  try {
    // 1. Direct native Android PrintManager file hook
    if ((window as any).AndroidNativeApp?.printFile) {
      toast.info('Opening Android Print Spooler...');
      try {
        const base64Data = await blobToBase64(blob);
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });
        const fileUriResult = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName
        });

        (window as any).AndroidNativeApp.printFile(
          fileUriResult.uri || writeResult.uri,
          title
        );
        return true;
      } catch (nativePrintErr) {
        console.warn('Native file print error, trying current page print:', nativePrintErr);
        if ((window as any).AndroidNativeApp?.printCurrentPage) {
          (window as any).AndroidNativeApp.printCurrentPage(title);
          return true;
        }
      }
    }

    if ((window as any).AndroidNativeApp?.printCurrentPage) {
      toast.info('Opening Android Print Spooler...');
      (window as any).AndroidNativeApp.printCurrentPage(title);
      return true;
    }

    // 2. Native Capacitor Android app: Send to printer or share sheet
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      toast.info('Sending to Android Printer...');
      const base64Data = await blobToBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });
      const fileUriResult = await Filesystem.getUri({
        directory: Directory.Cache,
        path: fileName
      });

      await Share.share({
        title: `Print: ${title}`,
        text: `Send to printer spooler or print service.`,
        dialogTitle: `Print with...`,
        files: [fileUriResult.uri || writeResult.uri]
      });
      return true;
    }

    // 3. Android Mobile Browser / PWA / Desktop: Hidden iframe print
    // Avoids popup blockers completely!
    toast.info('Opening Print Spooler...');
    const blobUrl = URL.createObjectURL(blob);
    const mimeType = blob.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png');

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    if (mimeType.includes('pdf')) {
      iframe.src = blobUrl;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          // If browser restricts iframe printing of PDF blob, open print tab
          window.open(blobUrl, '_blank')?.print();
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          } catch {}
        }, 60000);
      };
      return true;
    } else {
      // Image: Render into iframe HTML
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title}</title>
              <style>
                @page { size: auto; margin: 0; }
                body { margin: 0; padding: 12px; display: flex; justify-content: center; background: white; }
                img { max-width: 100%; height: auto; display: block; }
              </style>
            </head>
            <body>
              <img src="${blobUrl}" onload="window.print();" />
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          } catch {}
        }, 30000);
        return true;
      }
    }

    // Fallback: direct window.print()
    window.print();
    return true;
  } catch (err: any) {
    console.error('[Android Print Error]:', err);
    toast.error(`Print spooler unavailable: ${err?.message || 'Error'}`);
    return false;
  }
}
