# @sopeasy/web

Peasy is a lightweight, privacy-focused analytics tool for websites and products. This package provides the client-side JavaScript/TypeScript library for integrating Peasy analytics into your web applications.

## Installation

```bash
npm install @sopeasy/web
# or
pnpm add @sopeasy/web
# or
yarn add @sopeasy/web
```

## Quick Start

```javascript
import * as peasy from '@sopeasy/web';

// Initialize Peasy with your website ID at your app's root level
// For example:
//   - Next.js: in pages/_app.js or app/layout.tsx
//   - SvelteKit: in routes/+layout.svelte
//   - React: in your root App.jsx
peasy.init({
    websiteId: 'your-website-id',
});

// That's it! Page views will be tracked automatically
```

## Configuration

The `init` function accepts the following configuration options:

```typescript
type Config = {
    // Required: Your website ID from the Peasy dashboard
    websiteId: string;

    // Optional: Custom ingest host (default: 'https://api.peasy.so/v1/ingest/')
    ingestHost?: string;

    // Optional: Patterns to mask in URL tracking (e.g. ['/customer/*', '/user/*'])
    maskPatterns?: string[];

    // Optional: Automatically track page views (default: true)
    autoPageView?: boolean;

    // Optional: Ignore query parameters in tracked URLs (default: true)
    ignoreQueryParams?: boolean;
};
```

## Usage

### Automatic Page View Tracking

By default, Peasy automatically tracks page views. This includes both initial page loads and client-side navigation in single-page applications.

### Manual Page View Tracking

If you've disabled automatic page view tracking (`autoPageView: false`), you can manually track page views:

```javascript
peasy.page();
```

### Custom Event Tracking

Track custom events with optional metadata:

```javascript
peasy.track('button_click', {
    button_id: 'signup',
    location: 'header',
});

peasy.track('purchase_completed', {
    order_id: '123',
    total: 99.99,
    currency: 'USD',
});
```

### URL Masking

Protect sensitive information in URLs by configuring mask patterns:

```javascript
peasy.init({
    websiteId: 'your-website-id',
    maskPatterns: [
        '/user/*', // Masks: /user/123 → /user/*
        '/customer/*', // Masks: /customer/456 → /customer/*
    ],
});
```

## Privacy Features

-   No cookies or local storage usage
-   URL masking capabilities
-   Query parameter filtering
-   Privacy-first design

## License

MIT License - see [LICENSE](LICENSE) for details
