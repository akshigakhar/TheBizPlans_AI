# Free Business Plan Generator

A public, browser-only React application for writing a business plan, calculating three-year financial projections, and downloading PDF and Excel files.

## Run locally

```bash
npm install
npm run dev
```

No environment variables or external services are required. Drafts are saved in browser `localStorage`; business-plan data is not sent to or stored by a server.

## Production build

```bash
npm install
npm run type-check
npm test
npm run build
```

Deploy the generated `dist/` directory to any static host, including an AWS S3 bucket behind CloudFront. PDF and Excel files are generated and downloaded entirely in the browser.

## Application boundaries

The free generator intentionally has no authentication, accounts, database, payment service, subscriptions, administrative portal, or narrative-generation API. Its runtime dependencies are limited to the React UI, icons, and Vite build tooling.
