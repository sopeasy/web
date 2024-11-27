# @sopeasy/web

## 1.3.0

### Minor Changes

-   d6e03a8: refactor library code to be more readable, change ingestHost -> ingestUrl and set new default ingestUrl in accordance to api changes

## 1.2.0

### Minor Changes

-   3077191: removed setVisitorProfile functionality over privacy concerns

## 1.1.1

### Patch Changes

-   edd73f7: add proper error handling to ensure failures that occure while sending events dont take down dependents

## 1.1.0

### Minor Changes

-   fd10ad4: add setVisitorProfile function which allows visitors to be branded with more custom data

## 1.0.3

### Patch Changes

-   851937c: fix bug where url was being sent under metadata.url instead of url on pushState

## 1.0.2

### Patch Changes

-   78980df: track page views at least once on init to make sure non-spa page views are tracked

## 1.0.1

### Patch Changes

-   8313444: Initial release
