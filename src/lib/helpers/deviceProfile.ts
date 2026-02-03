export type DeviceProfile = {
  playerType: 'youtube';
  deviceClass: 'mobile' | 'desktop';
  browser?: string;
};

export function detectDeviceProfile(): DeviceProfile {
  const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceClass = isMobile ? 'mobile' : 'desktop';

  let browser: string | undefined;
  if (typeof navigator !== 'undefined') {
    if (ua.includes('Chrome')) browser = 'chrome';
    else if (ua.includes('Safari')) browser = 'safari';
    else if (ua.includes('Firefox')) browser = 'firefox';
    else if (ua.includes('Edge')) browser = 'edge';
  }

  return {
    playerType: 'youtube',
    deviceClass,
    browser
  };
}
