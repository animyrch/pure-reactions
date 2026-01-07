<script>
    import { browser, dev } from "$app/environment";
    import { page } from "$app/stores";
    import { onMount } from "svelte";

    // Replace with your actual Measurement ID if not using env vars
    const GA_MEASUREMENT_ID =
        import.meta.env.PUBLIC_GA_MEASUREMENT_ID || "G-PLACEHOLDER";

    /**
     * Track a page view to Google Analytics
     * @param {string} path
     */
    function trackPageView(path) {
        if (!browser || dev || GA_MEASUREMENT_ID === "G-PLACEHOLDER") return;

        // @ts-ignore
        window.gtag("config", GA_MEASUREMENT_ID, {
            page_path: path,
        });
    }

    // Watch for page changes
    $: if ($page.url.pathname) {
        trackPageView($page.url.pathname);
    }

    onMount(() => {
        if (dev || GA_MEASUREMENT_ID === "G-PLACEHOLDER") {
            console.info(
                "Google Analytics is disabled in development mode or missing Measurement ID.",
            );
            return;
        }

        // Initialize GA script
        const script = document.createElement("script");
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        script.async = true;
        document.head.appendChild(script);

        // @ts-ignore
        window.dataLayer = window.dataLayer || [];
        // @ts-ignore
        function gtag() {
            // @ts-ignore
            window.dataLayer.push(arguments);
        }
        // @ts-ignore
        window.gtag = gtag;
        gtag("js", new Date());
        gtag("config", GA_MEASUREMENT_ID);
    });
</script>
