export type Config = {
    /**
     * 'websiteId' is a unique identifier for your website. You can find it in the Peasy dashboard.
     * 
     * required
     */
    websiteId: string;

    /**
     * 'ingestHost' is the Peasy ingest host.
     * 
     * optional
     */
    ingestHost?: string;

    /**
     * 'maskPatterns' is an array of patterns that you want to mask tracking.
     * 
     * example
     * ```javascript
     * ['/customer/*', '/user/*']
     * ```
     * optional
     */
    maskPatterns?: string[];
    /**
    * 'autoPageView' is a boolean value that determines whether to automatically track page views.
    * 
    * optional
    */
    autoPageView?: boolean;
}


let config: Config = {
    websiteId: "",
    ingestHost: "https://ingest.peasy.so",
    maskPatterns: [],
    autoPageView: true
}
const isBrowser = typeof window !== "undefined";
let initialized = false;
let beforeInitializationQueue: { name: string, metadata?: Record<string, any> }[] = [];

/**
 * 'init' initializes Peasy.
 * 
 * note: must be called before any other function. 
 */
export const init = (params: Config) => {
    if (!isBrowser || initialized) return;

    config.websiteId = params.websiteId;
    config.ingestHost = params.ingestHost ?? "https://ingest.peasy.so";
    config.maskPatterns = params.maskPatterns ?? [];
    config.autoPageView = params.autoPageView ?? true;

    initialized = true;

    for (const { name, metadata } of beforeInitializationQueue) {
        track(name, metadata);
    }

    if (config.autoPageView) {
        registerPageChangeListeners();
    }
}

/**
 * 'track' is for tracking custom events.
 * 
 * example usage:
 * 
 * ```javascript
 * peasy.track("order_created", { order_id: 123, total: 100 });
 * ```
 */
export const track = (name: string, metadata?: Record<string, any>) => {
    const url = `${config.ingestHost}/v1/e`;

    if (!initialized) {
        beforeInitializationQueue.push({ name, metadata });
        return;
    }

    const payload = {
        name: name,
        website_id: config.websiteId,
        page_url: getPageUrl(),
        host_name: window.location.hostname,
        referrer: !window.document.referrer.includes(location.hostname) ? window.document.referrer : null,
        lang: window.navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        metadata: metadata ?? {}
    }

    if (!navigator?.sendBeacon(url, JSON.stringify(payload))) {
        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
        });
    }
}

let lastPage: string | null = null;
/**
 * 'page' is for manually tracking page views when 'config.autoPageView' is set to false.
 */
export const page = () => {
    if (lastPage === window.location.pathname) return;
    lastPage = window.location.pathname;

    track("$page_view", {
        "page_title": document.title,
    })
}

const getPageUrl = () => {
    let url = new URL(location.href);

    if (config.maskPatterns && config.maskPatterns.length > 0) {
        for (const mask of config.maskPatterns) {
            const maskedPathname = maskPathname(mask, url.pathname);

            if (maskedPathname !== url.pathname) {
                url.pathname = maskedPathname;
                break;
            }
        }
    }

    return url.href;
}

const maskPathname = (maskPattern: string, pathname: string) => {
    const maskSegments = maskPattern.split('/');
    const pathSegments = pathname.split('/');

    if (pathSegments.length > maskSegments.length) {
        return pathname;
    }

    const maskedSegments = [];

    for (let i = 0; i < maskSegments.length; i++) {
        const maskSegment = maskSegments[i];

        if (maskSegment === '*') {
            maskedSegments.push('*');
        } else {
            if (pathSegments[i] !== undefined) {
                maskedSegments.push(pathSegments[i]);
            } else {
                maskedSegments.push('');
            }
        }
    }

    const maskedPath = maskedSegments.join('/');
    return maskedPath;
}

const registerPageChangeListeners = () => {
    if (!isBrowser) return;

    const hook = (_this: History, method: "pushState" | "replaceState", callback: (state: History["state"], title: string, url: string) => void) => {
        const orig = _this[method];

        return (...args: any) => {
            callback.apply(null, args);
            return orig.apply(_this, args);
        };
    };

    const handlePush = (state: any, title: string, url: string) => {
        if (!url) return;

        const urlBeforePush = getPageUrl();
        const urlAfterPush = url.toString();

        if (urlBeforePush !== urlAfterPush) {
            const t = setTimeout(() => {
                track("$page_view", {
                    title: title,
                    url: urlAfterPush
                })
                clearTimeout(t)
            }, 100)
        }
    };

    window.history.pushState = hook(window.history, 'pushState', handlePush);
    window.history.replaceState = hook(window.history, 'replaceState', handlePush);
};




