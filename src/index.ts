const POST_EVENT_PATH = 'e';
const isBrowser = typeof window !== 'undefined';

export type Config = {
    /**
     * 'websiteId' is a unique identifier for your website. You can find it in your Peasy dashboard.
     *
     * required
     */
    websiteId: string;

    /**
     * 'ingestUrl' is the Peasy ingest host.
     *
     * optional
     */
    ingestUrl?: string;

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
     * default: true
     */
    autoPageView?: boolean;

    /**
     * 'ignoreQueryParams' is a boolean value that determines whether to ignore query params when tracking page views.
     *
     * optional
     * default: false
     * */
    ignoreQueryParams?: boolean;
};

let config: Config = {
    websiteId: '',
    ingestUrl: '',
    maskPatterns: [],
    autoPageView: true,
    ignoreQueryParams: false,
};
let initialized = false;
let beforeInitializationQueue: {
    name: string;
    metadata?: Record<string, any>;
}[] = [];
let lastPage: string | null = null;

/**
 * 'init' initializes Peasy.
 *
 * note: must be called before any other function.
 */
export const init = (params: Config) => {
    if (!isBrowser || initialized) return;

    config.ingestUrl = params.ingestUrl || 'https://api.peasy.so/v1/ingest/';
    if (!config.ingestUrl.endsWith('/')) {
        config.ingestUrl += '/';
    }
    config.websiteId = params.websiteId;
    config.maskPatterns = params.maskPatterns || [];
    config.autoPageView = params.autoPageView ?? true;
    config.ignoreQueryParams = params.ignoreQueryParams ?? false;

    initialized = true;

    if (config.autoPageView) {
        page();
        _registerPageChangeListeners();
    }

    for (const { name, metadata } of beforeInitializationQueue) {
        track(name, metadata);
    }
};

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
    if (!initialized) {
        beforeInitializationQueue.push({ name, metadata });
        return;
    }
    const payload = {
        name: name,
        website_id: config.websiteId,
        page_url: _processUrl(window.location.href),
        host_name: window.location.hostname,
        referrer: _getReferrer(),
        lang: window.navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        metadata: metadata ?? {},
    };
    _send(POST_EVENT_PATH, payload);
};

/**
 * 'page' is for manually tracking page views when 'config.autoPageView' is set to false.
 */
export const page = () => {
    if (lastPage === window.location.pathname) return;
    lastPage = window.location.pathname;

    track('$page_view', {
        page_title: window.document.title,
    });
};

const _maskPathname = (maskPattern: string, pathname: string): string => {
    const normalizePath = (path: string) =>
        path.endsWith('/') ? path.slice(0, -1).split('/') : path.split('/');

    const maskSegments = normalizePath(maskPattern);
    const pathSegments = normalizePath(pathname);

    if (pathSegments.length > maskSegments.length) {
        return pathname;
    }

    const maskedSegments: string[] = [];

    for (let i = 0; i < maskSegments.length; i++) {
        const maskSegment = maskSegments[i];
        const pathSegment = pathSegments[i];

        if (maskSegment === '*') {
            if (pathSegment === undefined) break;
            maskedSegments.push('*');
        } else if (pathSegment !== undefined && maskSegment === pathSegment) {
            maskedSegments.push(pathSegment);
        } else {
            return pathname;
        }
    }
    return maskedSegments.join('/');
};

const _processUrl = (url: string) => {
    let _url = new URL(url);
    if (config.maskPatterns && config.maskPatterns.length > 0) {
        for (const mask of config.maskPatterns) {
            const maskedPathname = _maskPathname(mask, _url.pathname);
            if (maskedPathname !== _url.pathname) {
                _url.pathname = maskedPathname;
                break;
            }
        }
    }
    if (config.ignoreQueryParams) {
        _url.search = '';
    }
    return _url.href;
};
const _send = (path: string, payload: any) => {
    try {
        const url = new URL(path, config.ingestUrl!).href;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        });
    } catch (e) {
        console.error('[peasy.js]: failed to send event', e);
    }
};
const _registerPageChangeListeners = () => {
    if (!isBrowser) return;
    const hook = (
        _this: History,
        method: 'pushState' | 'replaceState',
        callback: (state: History['state'], title: string, url: string) => void,
    ) => {
        const orig = _this[method];
        return (...args: any) => {
            callback.apply(null, args);
            return orig.apply(_this, args);
        };
    };
    const handlePush = (_: any, title: string, url: string | URL) => {
        if (!url) return;
        const urlBeforePush = window.location.href;
        const urlAfterPush = url.toString();
        if (urlBeforePush !== urlAfterPush) {
            const t = setTimeout(() => {
                const payload = {
                    name: '$page_view',
                    website_id: config.websiteId,
                    page_url: _processUrl(url.toString()),
                    host_name: window.location.hostname,
                    referrer: _getReferrer(),
                    lang: window.navigator.language,
                    screen: `${window.screen.width}x${window.screen.height}`,
                    metadata: { title },
                };
                _send(POST_EVENT_PATH, payload);
                clearTimeout(t);
            }, 100);
        }
    };
    window.history.pushState = hook(window.history, 'pushState', handlePush);
    window.history.replaceState = hook(
        window.history,
        'replaceState',
        handlePush,
    );
};
const _getReferrer = () => {
    return !window.document.referrer.includes(window.location.hostname)
        ? window.document.referrer
        : '';
};
