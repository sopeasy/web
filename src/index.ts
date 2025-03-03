const isBrowser = typeof window !== 'undefined';

const PROFILE_ID_LOCALSTORAGE_KEY = 'peasy-profile-id';
const DO_NOT_TRACK_LOCALSTORAGE_KEY = 'peasy-do-not-track';

export type PeasyOptions = {
    /**
     * 'websiteId' is a unique identifier for your website. You can find it in your peasy dashboard.
     *
     * required
     */
    websiteId: string;

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
     * 'skipPatterns' is an array of pages or page patterns you dont want to track.
     *
     * example
     * ```javascript
     * ['/admin/*']
     * ```
     * optional
     */
    skipPatterns?: string[];

    /**
     * 'autoPageView' is a boolean value that determines whether to automatically track page views.
     *
     * optional
     * default: true
     */
    autoPageView?: boolean;

    /**
     * 'ingestUrl' is the peasy ingest url to be used when setting up a [proxy](https://peasy.so/docs/proxying-through-cf-workers).
     *
     * optional
     */
    ingestUrl?: string;
};

let config = {
    websiteId: '',
    maskPatterns: [] as string[],
    regexMaskPatterns: [] as RegExp[],
    skipPatterns: [] as RegExp[],
    autoPageView: true,
    ingestUrl: '',
};
let initialized = false;
let preInitQueue: (
    | {
          type: 'track';
          name: string;
          metadata?: Record<string, unknown>;
      }
    | {
          type: 'set-profile';
          id: string;
          profile: Record<string, unknown>;
      }
)[] = [];
let lastPage: string | null = null;

/**
 * 'init' initializes Peasy.
 *
 * note: must be called before any other function.
 */
export const init = (params: PeasyOptions) => {
    if (!isBrowser || initialized) return;

    config.websiteId = params.websiteId;
    config.maskPatterns = params.maskPatterns || [];
    config.regexMaskPatterns =
        config.maskPatterns?.map((e) => {
            return new RegExp(`^${_normalizeUrl(e).replace(/\*/g, '[^/]+')}$`);
        }) ?? [];
    config.skipPatterns =
        params.skipPatterns?.map((e) => {
            return new RegExp(`^${_normalizeUrl(e).replace(/\*/g, '[^/]+')}$`);
        }) ?? [];
    config.autoPageView = params.autoPageView ?? true;
    config.ingestUrl = params.ingestUrl ?? 'https://api.peasy.so/v1/ingest/';

    initialized = true;

    if (config.autoPageView) {
        _registerPageChangeListeners();
    }
    _registerCustomEventListeners();

    for (const i of preInitQueue) {
        switch (i.type) {
            case 'track':
                track(i.name, i.metadata);
                break;
            case 'set-profile':
                setProfile(i.id, i.profile);
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
export function track(event: string, data?: Record<string, unknown>) {
    if (_isTrackingDisabled()) return;

    if (!initialized) {
        preInitQueue.push({ type: 'track', name: event, metadata: data });
        return;
    }

    const pageUrl = _processUrl(location.href);
    if (!pageUrl) {
        return;
    }

    const payload = {
        name: event,
        website_id: config.websiteId,
        page_url: pageUrl,
        host_name: location.hostname,
        referrer: _getReferrer(),
        lang: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        metadata: data || {},
    };

    _send('e', payload);
}

/**
 * 'setProfile' is for setting a user profile to a visitor.
 *
 * example usage:
 *
 * ```javascript
 * peasy.setProfile("123", { $name: "John Doe", $avatar: "https://example.com/avatar.png", age: 30 });
 * ```
 *
 * note: '$name' and '$avatar' are reserved keys for name and avatar and can be set to
 * show the user's name and avatar in the peasy dashboard.
 */
export function setProfile(
    id: string,
    profile: {
        $name?: string;
        $avatar?: string;
    } & Record<string, unknown>,
) {
    if (!initialized) {
        preInitQueue.push({ type: 'set-profile', id, profile });
        return;
    }

    localStorage.setItem(PROFILE_ID_LOCALSTORAGE_KEY, id);

    const payload = {
        website_id: config.websiteId,
        host_name: window.location.hostname,
        profile_id: id,
        profile: profile,
    };
    _send('p', payload);
}

/**
 * 'page' is for manually tracking page views when 'config.autoPageView' is set to false.
 */
export function page() {
    if (lastPage === window.location.pathname) return;
    lastPage = window.location.pathname;

    track('$page_view', {
        page_title: window.document.title,
    });
}

function _normalizeUrl(url: string) {
    if (url.endsWith('/')) {
        return url.slice(0, -1);
    }
    return url;
}

function _processUrl(url: string) {
    let _url = new URL(url);
    let pathname = _url.pathname;

    if (config.skipPatterns.some((regex) => regex.test(pathname))) {
        return null;
    }

    for (let i = 0; i < config.regexMaskPatterns.length; i++) {
        if (config.regexMaskPatterns[i]!.test(pathname)) {
            return config.maskPatterns[i];
        }
    }

    _url.pathname = pathname;

    return _url.toString();
}
function _send(path: string, payload: Record<string, unknown>) {
    try {
        const url = new URL(path, config.ingestUrl).href;
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Profile-ID':
                    localStorage.getItem(PROFILE_ID_LOCALSTORAGE_KEY) || '',
            },
            body: JSON.stringify(payload),
            keepalive: true,
        }).then((r) => {
            const visitorId = r.headers.get('X-Profile-ID');
            if (visitorId) {
                localStorage.setItem(PROFILE_ID_LOCALSTORAGE_KEY, visitorId);
            }
        });
    } catch (e) {
        console.error('[peasy.js] Error:', e);
    }
}

function _registerPageChangeListeners() {
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
        originalPushState.apply(history, args);
        page();
    };

    addEventListener('popstate', () => page());

    if (document.visibilityState !== 'visible') {
        document.addEventListener('visibilitychange', () => {
            if (!lastPage && document.visibilityState === 'visible') page();
        });
    } else {
        page();
    }
}

function _registerCustomEventListeners() {
    document.addEventListener('click', (event) => {
        let targetElement = event.target as HTMLElement | null;
        if (
            targetElement?.tagName === 'SELECT' ||
            targetElement?.tagName === 'TEXTAREA' ||
            (targetElement?.tagName === 'INPUT' &&
                !['button', 'submit'].includes(
                    targetElement.getAttribute('type') || '',
                ))
        ) {
            return;
        }
        while (
            targetElement &&
            !targetElement?.hasAttribute('data-peasy-event')
        ) {
            targetElement = targetElement.parentElement;
        }
        if (!targetElement) return;

        const name = targetElement.getAttribute('data-peasy-event');
        if (!name) return;

        const data: Record<string, unknown> = {};

        for (const attr of Array.from(targetElement.attributes)) {
            if (attr.name.startsWith('data-peasy-event-') && attr.value) {
                data[attr.name.slice('data-peasy-event-'.length)] = attr.value;
            }
        }

        if (targetElement.tagName === 'FORM') {
            const form = targetElement as HTMLFormElement;
            const inputs = Array.from(form.elements) as HTMLInputElement[];
            form.action && (data['$action url'] = form.action);
            for (const input of inputs) {
                if (input.type == 'password') continue;
                if (!input.name) continue;
                if (input.hasAttribute('data-peasy-ignore')) continue;

                if (input.type === 'checkbox' || input.type === 'radio') {
                    data[input.name] = input.checked;
                    continue;
                }

                if (input.value) {
                    data[input.name] = input.value;
                }
            }
        }

        track(name, data);
    });
}

function _isTrackingDisabled() {
    return localStorage.getItem(DO_NOT_TRACK_LOCALSTORAGE_KEY) === 'true';
}

function _getReferrer() {
    return !document.referrer.includes(location.hostname)
        ? document.referrer
        : '';
}
