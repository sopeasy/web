# @sopeasy/web

peasy is a lightweight, privacy-focused analytics tool for websites and products. this package provides the client-side JavaScript/TypeScript library for integrating peasy analytics into your web applications.

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

// initialize Peasy with your website ID at your app's root level
// for example:
//   - Next.js: in pages/_app.js or app/layout.tsx
//   - SvelteKit: in routes/+layout.svelte
//   - React: in your root App.jsx
peasy.init({
    websiteId: '<website_id>',
});

// that's it! Page views will be tracked automatically
```

## Configuration

The `init` function accepts the following configuration options:

```typescript
type Config = {
    // required: Your website Id from the peasy dashboard
    websiteId: string;

    // optional: custom ingest url (default: 'https://api.peasy.so/v1/ingest/')
    ingestUrl?: string;

    // optional: patterns to mask in URL tracking (e.g. ['/customer/*', '/user/*'])
    maskPatterns?: string[];

    // optional: patterns to skip in URL tracking (e.g. ['/admin/*'])
    skipPatterns?: string[];

    // Optional: Automatically track page views (default: true)
    autoPageView?: boolean;
};
```

## Usage

### track custom events

the `track` method allows you to track custom events within your application. This is useful for monitoring specific actions that users take, such as completing a purchase or signing up for a newsletter.

```javascript
peasy.track('order_created', {
    order_id: 123,
    total: 100,
});
```

### manually track page views

the `page` method is for manually tracking page views when the `data-auto-page-view` option is set to `false`.

```javascript
peasy.page();
```

### set visitor profile

the `setProfile` method allows you to set or update the profile of a visitor. great for tracking your authorized users.

```javascript
peasy.setProfile('123', {
    name: 'John Doe',
    avatar: 'https://yoursite.com/images/avatar.png',
});
```

### form submission tracking

peasy can automatically track form submissions with detailed field data:

```html
<form
    data-peasy-event="signup_form_submit"
    data-peasy-event-form_type="newsletter"
>
    <input type="email" name="email" />
    <input type="text" name="name" />
    <input type="password" name="password" />
    <input type="checkbox" name="receive_newsletter" />
    <input type="text" name="sensitive" data-peasy-ignore />
    <button type="submit">Submit</button>
</form>
```

the form submission event will include:

- all non-empty field values (except passwords and fields with the `data-peasy-ignore` attribute)
- the form's action url
- any additional data-peasy-event-\* attributes
- checkbox and radio button states

### click tracking

track element clicks with custom metadata:

```html
<!-- Simple button tracking -->
<button data-peasy-event="login_click">Log In</button>

<!-- With dynamic attributes -->
<button
    data-peasy-event="purchase_click"
    data-peasy-event-product_id="123"
    data-peasy-event-price="99.99"
    data-peasy-event-currency="USD"
>
    Buy Now
</button>
```

## License

MIT License - see [LICENSE](LICENSE) for details
