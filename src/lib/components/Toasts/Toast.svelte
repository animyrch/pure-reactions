<script>
    import { hideToast } from '$lib/stores/toast';
    import { TOASTS } from '$lib/constants/toasts';
  
    export let toast;
    export let key;
  
    const toastTypeClasses = {
      [TOASTS.WARNING]: {
        outerIcon: "text-orange-500 bg-orange-100 dark:bg-orange-700 dark:text-orange-200",
        innerIcon: "text-orange-500 bg-orange-100 dark:bg-orange-700 dark:text-orange-200",
        indicator: "Warning icon",
      },
      [TOASTS.SUCCESS]: {
        outerIcon: "text-gray-500 bg-white dark:text-gray-400 dark:bg-gray-800",
        innerIcon: "text-green-500 bg-green-100 dark:bg-green-800 dark:text-green-200",
        indicator: "Success icon",
      },
    };
  
    const currentType = toastTypeClasses[toast.type];
  
    const closeToast = () => {
      hideToast(key);
    };
  </script>
  
    <div
        class={`flex items-center w-full max-w-xs p-4 mb-4 rounded-lg shadow fixed top-24 sm:top-28 right-5 z-50 ${currentType.outerIcon}`}
        role="alert"
    >
      <div class={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${currentType.innerIcon}`}>
          {#if toast.type === TOASTS.SUCCESS}
              <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>
              </svg>
          {:else if toast.type === TOASTS.WARNING}
              <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z"/>
              </svg>
          {/if}
          <span class="sr-only">{currentType.indicator}</span>
      </div>
      <div class="ms-3 text-sm font-normal">{toast.message}</div>
      <button
          on:click={() => closeToast()}
          type="button"
          class="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700"
          aria-label="Close"
      >
          <span class="sr-only">Close</span>
          <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
          </svg>
      </button>
  </div>
  