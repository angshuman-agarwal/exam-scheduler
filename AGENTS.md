## Validation Before Moving To Next Step
For every non-trivial change, always run:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- targeted `npm run test:e2e` scenarios for the affected flow

Do not batch multiple architectural changes before validation.
Keep changes granular and regression-safe.
Update the user at each step before continuing.
