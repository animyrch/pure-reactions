<script>
    import { browser, dev } from "$app/environment";
    import { page } from "$app/stores";
    import { env } from "$env/dynamic/public";
    import { analyticsConsent } from "$lib/helpers/analyticsConsent";

    // Use dynamic public env to ensure it's picked up on Netlify
    const GA_MEASUREMENT_ID = env.PUBLIC_GA_MEASUREMENT_ID;

    /**
     * Track a page view to Google Analytics
     * @param {string} path
     */
    function trackPageView(path) {
        if (
            !browser ||
            dev ||
            !GA_MEASUREMENT_ID ||
            GA_MEASUREMENT_ID === "G-PLACEHOLDER"
        ) {
            return;
        }

        if (typeof window.gtag === "function") {
            console.log(`[GA] Tracking page view: ${path}`);
            window.gtag("config", GA_MEASUREMENT_ID, {
                page_path: path,
            });
        } else {
            console.warn("[GA] gtag not found during navigation");
        }
    }

    let started = false;

    function startAnalytics() {
        if (started || !browser) return;
        if ($analyticsConsent !== "accept") return;

        if (dev) {
            console.info("[GA] Disabled in development mode.");
            return;
        }

        if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === "G-PLACEHOLDER") {
            console.error(
                "[GA] Missing or placeholder Measurement ID. Analytics will not load.",
            );
            return;
        }

        started = true;

        // Initialize GA script
        const script = document.createElement("script");
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        script.async = true;

        script.onload = () => {
            console.log("[GA] External script loaded successfully");
        };

        script.onerror = () => {
            console.error("[GA] Failed to load the external script");
        };

        document.head.appendChild(script);

        // Initial setup
        window.dataLayer = window.dataLayer || [];
        function gtag() {
            window.dataLayer.push(arguments);
        }
        window.gtag = gtag;

        gtag("js", new Date());
        gtag("config", GA_MEASUREMENT_ID);

        console.log("[GA] gtag initialized");
    }

    $: if ($analyticsConsent === "accept") {
        startAnalytics();
    }

    $: if ($page.url.pathname && started) {
        trackPageView($page.url.pathname);
    }
</script>
