import { describe, expect, it } from 'vitest';
import { bandeauEnPause, plateforme } from './plateforme';

const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; SM-A165F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36';
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const WHATSAPP_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.1';

describe('installation (§60)', () => {
  it('reconnaît chaque cas', () => {
    expect(plateforme(CHROME_ANDROID)).toBe('android');
    expect(plateforme(WEBVIEW)).toBe('integre');
    expect(plateforme(SAFARI_IOS)).toBe('ios');
    expect(plateforme(WHATSAPP_IOS)).toBe('integre');
    expect(plateforme(SAFARI_IOS, { standaloneIos: true })).toBe('installee');
    expect(plateforme(CHROME_ANDROID, { standalone: true })).toBe('installee');
    expect(plateforme('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', { touchMac: true })).toBe('ios');
  });
  it('ne remontre pas le bandeau pendant 14 jours', () => {
    const now = Date.parse('2026-11-18T12:00:00Z');
    expect(bandeauEnPause(null, now)).toBe(false);
    expect(bandeauEnPause(now - 3 * 864e5, now)).toBe(true);
    expect(bandeauEnPause(now - 15 * 864e5, now)).toBe(false);
  });
});
