# @sopeasy/web

## 1.7.2

### Patch Changes

- 37e1bee: export LOCALSTORAGE key to allow for more advanced usage in managing locally stored visitor ids. Add config option to disable localstorage visitor ids

## 1.7.1

### Patch Changes

- 6d2da9c: fix issue with requests being sent as PATCH, not POST

## 1.7.0

### Minor Changes

- 3cf71e8: merge setVisitorProfile and updateVisitorProfile functionality into just setVisitorProfile

### Patch Changes

- e8535fa: change metadata type from Record<string,any> to Record<string,Primitive>

## 1.6.1

### Patch Changes

- 15ee73c: set a persistent visitorId when setProfile is used so stats arent messed up by salted hash

## 1.6.0

### Minor Changes

- 2bfb546: Add updateProfile method to allow editing of existing profiles

## 1.5.0

### Minor Changes

- 6c63da3: add setProfile method to allow for setting visitor profile data that will appear in dashboard

## 1.4.0

### Minor Changes

- ea411ba: fix masking function masking urls that dont match the mask

## 1.3.2

### Patch Changes

- a3809ae: fix events not being sent due to a bug in ingestUrl and event path joining

## 1.3.1

### Patch Changes

- c6dae9b: fix default config not being set properly

## 1.3.0

### Minor Changes

- d6e03a8: refactor library code to be more readable, change ingestHost -> ingestUrl and set new default ingestUrl in accordance to api changes

## 1.2.0

### Minor Changes

- 3077191: removed setVisitorProfile functionality over privacy concerns

## 1.1.1

### Patch Changes

- edd73f7: add proper error handling to ensure failures that occure while sending events dont take down dependents

## 1.1.0

### Minor Changes

- fd10ad4: add setVisitorProfile function which allows visitors to be branded with more custom data

## 1.0.3

### Patch Changes

- 851937c: fix bug where url was being sent under metadata.url instead of url on pushState

## 1.0.2

### Patch Changes

- 78980df: track page views at least once on init to make sure non-spa page views are tracked

## 1.0.1

### Patch Changes

- 8313444: Initial release
