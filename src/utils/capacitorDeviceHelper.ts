import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

/**
 * Accurately determines if the current runtime environment is an Android device.
 * True for Capacitor native Android app AND mobile Android devices/browsers/PWAs.
 * False for desktop web applications (Windows, Mac, Linux).
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
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
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
 * Android device download and save handler.
 * On native Android: Saves the file via Filesystem and opens via Android Sharesheet with file attachment.
 * On Android mobile browser: Downloads cleanly via Blob URL anchor element.
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
        // Fallback to Cache if Documents directory has strict Scoped Storage restrictions
        console.warn('Documents write failed, falling back to Cache:', docErr);
        writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });
      }

      toast.success(`Saved to device: ${fileName}`, {
        id: toastId,
        duration: 4000,
      });

      // Prompt user with Android Sharesheet with the actual attached file
      try {
        await Share.share({
          title: `Open ${title}`,
          text: `Saved: ${fileName}`,
          dialogTitle: `Open ${title}`,
          files: [writeResult.uri]
        });
      } catch {
        // Cancellation or dismissal is expected
      }

      return true;
    }

    // Android Device in mobile browser / PWA
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    }, 2000);

    toast.success(`Downloaded: ${fileName}`, { id: toastId });
    return true;
  } catch (err: any) {
    console.error('[Android Download Error]:', err);
    toast.error(`Could not save file: ${err?.message || 'Permission denied'}`, { id: toastId });
    return false;
  }
}

/**
 * Android device native share handler.
 * On native Android: Writes file to cache and opens Sharesheet with files: [uri].
 * On Android mobile browser: Uses Web Share API Level 2 (files support) with automatic download fallback.
 */
export async function shareFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Document',
  text: string = ''
): Promise<'shared' | 'downloaded' | 'failed' | 'cancelled'> {
  try {
    if (isNativeAndroidApp()) {
      const base64Data = await blobToBase64(blob);

      // Save file into Cache directory for clean sharing
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      await Share.share({
        title: title,
        text: text || `Sharing ${title} from Pigmy Pro.`,
        dialogTitle: title || 'Share',
        files: [writeResult.uri]
      });

      return 'shared';
    }

    // Android device in mobile browser / PWA
    const mimeType = blob.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png');
    const file = new File([blob], fileName, { type: mimeType });

    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: text || `Sharing ${title} from Pigmy Pro.`
        });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
          return 'cancelled';
        }
        console.warn('Web Share failed, falling back to download:', err);
      }
    }

    // Fallback to downloading file to device
    await downloadFileForAndroid(blob, fileName, title);
    return 'downloaded';
  } catch (err: any) {
    if (err?.message?.includes('cancelled') || err?.name === 'AbortError' || err?.message?.includes('Share canceled') || err?.message?.includes('canceled')) {
      return 'cancelled';
    }
    console.error('[Android Share Error]:', err);
    toast.error(`Android share failed: ${err?.message || 'Error opening sharesheet'}`);
    return 'failed';
  }
}

/**
 * Android device print handler.
 * On native Android: Writes document to cache and routes it to Android system print spoolers / print plugins via Sharesheet.
 * On Android mobile browser: Uses Web Share API to print services, hidden iframe print, or direct document access.
 */
export async function printFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Print Document'
): Promise<boolean> {
  try {
    toast.info('Opening Android Print...');

    if (isNativeAndroidApp()) {
      const base64Data = await blobToBase64(blob);

      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      await Share.share({
        title: `Print ${title}`,
        text: `Select your printer or print spooler service.`,
        dialogTitle: `Print ${title}`,
        files: [writeResult.uri]
      });

      return true;
    }

    // Android device in mobile browser / PWA
    const mimeType = blob.type || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png');
    const file = new File([blob], fileName, { type: mimeType });

    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Print ${title}`,
          text: `Select Print Service`
        });
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.message?.includes('canceled')) {
          return false;
        }
      }
    }

    // Fallback: Hidden iframe print
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    let printed = false;
    await new Promise<void>((resolve) => {
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          printed = true;
        } catch {
          printed = false;
        }
        resolve();
      };
      setTimeout(resolve, 1500);
    });

    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 5000);

    if (!printed) {
      // Fallback: download document so user can open in their PDF reader and tap Print
      await downloadFileForAndroid(blob, fileName, title);
    }
    return true;
  } catch (err: any) {
    console.error('[Android Print Error]:', err);
    toast.error(`Print spooler unavailable: ${err?.message || 'Error'}`);
    return false;
  }
}
