import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

/**
 * Accurately determines if the current runtime environment is strictly the Android native application.
 * Returns false for web applications (browsers on desktop and mobile).
 */
export function isAndroidApp(): boolean {
  try {
    return Capacitor.getPlatform() === 'android' || (Capacitor.isNativePlatform() && /android/i.test(navigator.userAgent));
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
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Android-only native download and save handler.
 * Saves the file to the native Documents directory and provides immediate access/sharing.
 */
export async function downloadFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Document'
): Promise<boolean> {
  const toastId = toast.loading(`Saving ${fileName} to Android device...`);
  try {
    const base64Data = await blobToBase64(blob);

    // Save file into native Documents directory
    const writeResult = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true
    });

    toast.success(`Saved to Documents: ${fileName}`, {
      id: toastId,
      duration: 5000,
    });

    // Prompt user to view or open with Android Sharesheet
    try {
      await Share.share({
        title: `Open ${title}`,
        text: `Exported: ${fileName}`,
        url: writeResult.uri
      });
    } catch {
      // Cancellation or dismissal is expected
    }

    return true;
  } catch (err: any) {
    console.error('[Android Native Download Error]:', err);
    toast.error(`Could not save file: ${err?.message || 'Permission denied'}`, { id: toastId });
    return false;
  }
}

/**
 * Android-only native share handler using Capacitor native Share plugin.
 */
export async function shareFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Document',
  text: string = ''
): Promise<'shared' | 'downloaded' | 'failed' | 'cancelled'> {
  try {
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
      url: writeResult.uri
    });

    return 'shared';
  } catch (err: any) {
    if (err?.message?.includes('cancelled') || err?.name === 'AbortError' || err?.message?.includes('Share canceled')) {
      return 'cancelled';
    }
    console.error('[Android Native Share Error]:', err);
    toast.error(`Android share failed: ${err?.message || 'Error opening sharesheet'}`);
    return 'failed';
  }
}

/**
 * Android-only native print handler.
 * Writes the document to cache and routes it to the Android system print spooler/share intent.
 */
export async function printFileForAndroid(
  blob: Blob,
  fileName: string,
  title: string = 'Print Document'
): Promise<boolean> {
  try {
    toast.info('Opening Android Print Spooler...');
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
      url: writeResult.uri
    });

    return true;
  } catch (err: any) {
    console.error('[Android Native Print Error]:', err);
    toast.error(`Print spooler unavailable: ${err?.message || 'Error'}`);
    return false;
  }
}
