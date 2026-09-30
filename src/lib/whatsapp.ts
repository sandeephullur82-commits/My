/**
 * Triggers WhatsApp using the wa.me format and deep links.
 * Follows best practices for opening WhatsApp on both mobile and web
 * without breaking application state or causing 404 / refused-to-connect errors.
 */
export const triggerWhatsApp = (
  phone: string,
  name?: string,
  customMessage?: string,
  customerId?: string
) => {
  if (!phone) return;

  // 1. Remove all non-digit characters (+, spaces, dashes)
  const cleaned = String(phone).replace(/[^\d]/g, '');

  // 2. Ensure country code (91) is added if only 10 digits
  let processedPhone = cleaned;
  if (processedPhone.length === 10) {
    processedPhone = `91${processedPhone}`;
  } else if (processedPhone.length === 11 && processedPhone.startsWith('0')) {
    processedPhone = `91${processedPhone.slice(1)}`;
  }

  // 3. Compose message
  let msg = customMessage || (name ? `Hi ${name}, just a reminder about your Pigmy payment.` : '');

  // Append callback / app reference if origin is available
  try {
    const origin = window.location.origin;
    if (origin && !origin.includes('localhost:0')) {
      const callbackParams = new URLSearchParams();
      if (customerId) callbackParams.set('customerId', customerId);
      if (name) callbackParams.set('name', name);
      callbackParams.set('status', 'sent');
      const callbackUrl = `${origin}/whatsapp/callback?${callbackParams.toString()}`;
      
      // Only append return link if custom message doesn't already contain a link
      if (!msg.includes('http')) {
        msg = `${msg}\n\nPigmy Pro Portal: ${callbackUrl}`;
      }
    }
  } catch (e) {
    // ignore URL error
  }

  const encodedMsg = encodeURIComponent(msg);

  // 4. Create URLs using the exact requested format
  // Format: https://wa.me/<number>?text=<encoded_message>
  const waUrl = `https://wa.me/${processedPhone}?text=${encodedMsg}`;
  const deepLinkUrl = `whatsapp://send?phone=${processedPhone}&text=${encodedMsg}`;

  if ('vibrate' in navigator) navigator.vibrate(20);

  const isInIframe = window.self !== window.top;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // 5. Open WhatsApp safely without replacing the current application page:
  // Replacing window.location.href navigates the active app away to wa.me,
  // which causes "Page Not Found" / "Refused to connect" inside iframes,
  // and breaks the application session on mobile when returning.
  if (isInIframe) {
    // In an iframe (like AI Studio preview), opening wa.me directly in the iframe is blocked
    // by X-Frame-Options. Always open in a separate window/tab.
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  } else if (isMobile) {
    // On mobile devices, try the native WhatsApp application deep link first
    // using a transient hidden anchor so the browser doesn't unload the current app.
    const anchor = document.createElement('a');
    anchor.href = deepLinkUrl;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
    }, 500);

    // Fallback: If WhatsApp native app is not installed or didn't open within 1.2s,
    // open the web link in a new tab without destroying the current ledger session.
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
    }, 1200);
  } else {
    // On desktop, open WhatsApp Web / wa.me in a new tab
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }
};
