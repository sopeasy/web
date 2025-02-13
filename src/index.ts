const POST_EVENT_PATH = 'e';
const POST_PROFILE_PATH = 'p';

export const VISITOR_ID_LOCALSTORAGE_KEY = 'peasy-visitor-id';

const isBrowser = typeof window !== 'undefined';

type Primitive = string | number | boolean | null | undefined;

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

    /**
     * 'setLocalVisitorId' is a boolean value that determines whether to set a local visitor id when setProfile is set.
     *
     * optional
     * default: true
     *
     * note: disabling this may cause issues with visitor tracking.
     */
    setLocalVisitorId?: boolean;
};

let config: Config = {
    websiteId: '',
    ingestUrl: '',
    maskPatterns: [],
    autoPageView: true,
    ignoreQueryParams: false,
    setLocalVisitorId: true,
};
let initialized = false;
let preInitQueue: (
    | {
          type: 'track';
          name: string;
          metadata?: Record<string, Primitive>;
      }
    | {
          type: 'set-profile';
          profileId: string;
          profile: Record<string, Primitive>;
      }
)[] = [];
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

    for (const i of preInitQueue) {
        switch (i.type) {
            case 'track':
                track(i.name, i.metadata);
                break;
            case 'set-profile':
                setProfile(i.profileId, i.profile);
                break;
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
export const track = (name: string, metadata?: Record<string, Primitive>) => {
    if (!initialized) {
        preInitQueue.push({ type: 'track', name, metadata });
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
 * 'setProfile' is for setting user profile.
 *
 * example usage:
 *
 * ```javascript
 * peasy.setProfile("123", { $name: "John Doe", $avatar: "https://example.com/avatar.png", age: 30 });
 * ```
 *
 * note: '$name' and '$avatar' are reserved keys for name and avatar and can be set to
 * show the user's name and avatar in the Peasy dashboard.
 */
export const setProfile = (
    profileId: string,
    profile: {
        $name?: string;
        $avatar?: string;
    } & Record<string, Primitive>,
) => {
    if (!initialized) {
        preInitQueue.push({ type: 'set-profile', profileId, profile });
        return;
    }

    const payload = {
        website_id: config.websiteId,
        host_name: window.location.hostname,
        profile_id: profileId,
        profile: profile,
    };
    _send(POST_PROFILE_PATH, payload);
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
            headers: {
                'Content-Type': 'application/json',
                'X-Visitor-ID':
                    localStorage.getItem(VISITOR_ID_LOCALSTORAGE_KEY) ?? '',
            },
            body: JSON.stringify(payload),
            keepalive: true,
        }).then((r) => {
            const visitorId = r.headers.get('X-Visitor-ID');
            if (visitorId && config.setLocalVisitorId) {
                localStorage.setItem(VISITOR_ID_LOCALSTORAGE_KEY, visitorId);
            }
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
