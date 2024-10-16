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
     * default: true
     */
    autoPageView?: boolean;

    /**
     * 'ignoreQueryParams' is a boolean value that determines whether to ignore query params when tracking page views.
     *
     * optional
     * default: true
     * */
    ignoreQueryParams?: boolean;
};

let config: Config = {
    websiteId: '',
    ingestHost: 'https://ingest.peasy.so',
    maskPatterns: [],
    autoPageView: true,
};
const isBrowser = typeof window !== 'undefined';
let initialized = false;
let beforeInitializationQueue: (
    | {
          type: 'track';
          object: {
              name: string;
              metadata?: Record<string, any>;
          };
      }
    | {
          type: 'set_visitor_profile';
          object: {
              profile_id: string;
              profile: Record<string, any>;
          };
      }
)[] = [];

/**
 * 'init' initializes Peasy.
 *
 * note: must be called before any other function.
 */
export const init = (params: Config) => {
    if (!isBrowser || initialized) return;

    config.websiteId = params.websiteId;
    config.ingestHost = params.ingestHost ?? 'https://ingest.peasy.so';
    config.maskPatterns = params.maskPatterns ?? [];
    config.autoPageView = params.autoPageView ?? true;
    config.ignoreQueryParams = params.ignoreQueryParams ?? true;

    initialized = true;

    if (config.autoPageView) {
        track('$page_view', {
            page_title: document.title,
        });
        registerPageChangeListeners();
    }

    for (const { type, object } of beforeInitializationQueue) {
        if (type === 'track') {
            track(object.name, object.metadata);
        } else if (type === 'set_visitor_profile') {
            setVisitorProfile(object.profile_id, object.profile);
        }
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
        beforeInitializationQueue.push({
            type: 'track',
            object: { name, metadata },
        });
        return;
    }

    const payload = {
        name: name,
        website_id: config.websiteId,
        page_url: getPageUrl(window.location.href),
        host_name: window.location.hostname,
        referrer: !window.document.referrer.includes(location.hostname)
            ? window.document.referrer
            : null,
        lang: window.navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        metadata: metadata ?? {},
    };

    send('/v1/e', payload);
};

let lastPage: string | null = null;
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

/**
 * 'setVisitorProfile' is for setting visitor profile.
 *
 * example usage:
 *
 * ```javascript
 * peasy.setVisitorProfile("123", { name: "John Doe", email: "john@doe.com" });
 * ```
 */
export const setVisitorProfile = (
    profile_id: string,
    profile: Record<string, any>,
) => {
    if (!initialized) {
        beforeInitializationQueue.push({
            type: 'set_visitor_profile',
            object: { profile_id, profile },
        });
        return;
    }

    const payload = {
        website_id: config.websiteId,
        profile_id,
        profile,
    };

    send('/v1/p', payload);
};

const getPageUrl = (url: string) => {
    let _url = new URL(url);

    if (config.maskPatterns && config.maskPatterns.length > 0) {
        for (const mask of config.maskPatterns) {
            const maskedPathname = maskPathname(mask, _url.pathname);

            if (maskedPathname !== _url.pathname) {
                _url.pathname = maskedPathname;
                break;
            }
        }
    }

    return _url.href;
};

const send = (path: string, payload: any) => {
    const url = `${config.ingestHost}${path}`;
    try {
        if (!navigator?.sendBeacon(url, JSON.stringify(payload))) {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            });
        }
    } catch (e) {
        console.error(e);
    }
};

const maskPathname = (maskPattern: string, pathname: string) => {
    const maskSegments = normalizeUrl(maskPattern).split('/');
    const pathSegments = normalizeUrl(pathname).split('/');

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
};

const normalizeUrl = (url: string) => {
    if (url.endsWith('/')) {
        return url.slice(0, -1);
    }
    return url;
};

const registerPageChangeListeners = () => {
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

    const handlePush = (state: any, title: string, url: string | URL) => {
        if (!url) return;

        const urlBeforePush = config.ignoreQueryParams
            ? window.location.pathname
            : window.location.href;
        const urlAfterPush = config.ignoreQueryParams
            ? new URL(url).pathname.toString()
            : url.toString();

        if (urlBeforePush !== urlAfterPush) {
            const t = setTimeout(() => {
                const payload = {
                    name: '$page_view',
                    website_id: config.websiteId,
                    page_url: getPageUrl(url.toString()),
                    host_name: window.location.hostname,
                    referrer: !window.document.referrer.includes(
                        location.hostname,
                    )
                        ? window.document.referrer
                        : null,
                    lang: window.navigator.language,
                    screen: `${window.screen.width}x${window.screen.height}`,
                    metadata: { title },
                };

                send('/v1/e', payload);
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
