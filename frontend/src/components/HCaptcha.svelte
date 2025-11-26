<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let sitekey: string;
  export let onVerify: (token: string) => void;
  export let onError: ((error: string) => void) | undefined = undefined;
  export let onExpire: (() => void) | undefined = undefined;

  let widgetId: string | null = null;
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
      script.onerror = () => reject(new Error('Failed to load hCaptcha script'));
      
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

  export function reset() {
    if (widgetId !== null && window.hcaptcha) {
      window.hcaptcha.reset(widgetId);
    }
  }

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
      if (onError) onError('Failed to load hCaptcha');
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
