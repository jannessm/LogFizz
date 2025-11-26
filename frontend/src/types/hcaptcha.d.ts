interface HCaptchaRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: (error: string) => void;
  'expired-callback'?: () => void;
  'chalexpired-callback'?: () => void;
  'open-callback'?: () => void;
  'close-callback'?: () => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact' | 'invisible';
  tabindex?: number;
  hl?: string;
}

interface HCaptcha {
  render(container: HTMLElement, options: HCaptchaRenderOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
  execute(widgetId: string): void;
  getResponse(widgetId: string): string;
  getRespKey(widgetId: string): string;
}

interface Window {
  hcaptcha: HCaptcha;
}
