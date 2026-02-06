<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '../lib/i18n';

  interface Props {
    sitekey: string;
    onVerify: (token: string) => void;
    onError?: (error: string) => void;
    onExpire?: () => void;
  }

  let { sitekey, onVerify, onError, onExpire }: Props = $props();

  let widgetId: string | null = $state(null);
  let containerRef: HTMLDivElement;

  const HCAPTCHA_SCRIPT_ID = 'hcaptcha-script';
  const HCAPTCHA_API_URL = 'https://js.hcaptcha.com/1/api.js';

  function loadHCaptchaScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      if (document.getElementById(HCAPTCHA_SCRIPT_ID)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = HCAPTCHA_SCRIPT_ID;
      script.src = HCAPTCHA_API_URL;
      script.async = true;
      script.defer = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error($_('hcaptcha.loadError')));
      
      document.head.appendChild(script);
    });
  }

  function renderHCaptcha() {
    if (!containerRef || !window.hcaptcha) return;

    widgetId = window.hcaptcha.render(containerRef, {
      sitekey,
      callback: (token: string) => {
        onVerify(token);
      },
      'error-callback': (error: string) => {
        if (onError) onError(error);
      },
      'expired-callback': () => {
        if (onExpire) onExpire();
      }
    });
  }

  function reset() {
    if (widgetId !== null && window.hcaptcha) {
      window.hcaptcha.reset(widgetId);
    }
  }

  // Expose reset method
  export { reset };

  onMount(async () => {
    try {
      await loadHCaptchaScript();
      
      // Wait for hcaptcha to be available
      const checkHCaptcha = setInterval(() => {
        if (window.hcaptcha) {
          clearInterval(checkHCaptcha);
          renderHCaptcha();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkHCaptcha), 5000);
    } catch (error) {
      console.error('Error loading hCaptcha:', error);
      if (onError) onError($_('hcaptcha.loadError'));
    }
  });

  onDestroy(() => {
    if (widgetId !== null && window.hcaptcha) {
      try {
        window.hcaptcha.remove(widgetId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });
</script>

<div bind:this={containerRef} class="h-captcha-container"></div>

<style>
  .h-captcha-container {
    display: flex;
    justify-content: center;
    margin: 1rem 0;
  }
</style>
