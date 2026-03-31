## Validation Before Moving To Next Step
For every non-trivial change, always run:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- targeted `npm run test:e2e` scenarios for the affected flow

Do not batch multiple architectural changes before validation.
Keep changes granular and regression-safe.
Update the user at each step before continuing.


## UI Regression Rule
For any change that affects UI state, navigation, routing, app shell, or user actions:
- identify the affected CTA or interaction flow
- run the targeted Playwright scenario for that CTA
- if no targeted Playwright scenario exists, add one before continuing further refactors in that area
- Identify if a new Playwright test is needed to guard. If needed, then add a new test. Existing tests should continue running

Critical interaction flows must remain covered, including:
- Home -> Open today's plan
- Home -> View progress
- Today -> Create suggested plan
- Today -> Complete plan
- Today/Subject Picker -> Add to plan
- Today/Subject Picker -> Remove from plan
- Progress hero CTA navigation
- Timer -> Start session
- Timer -> Pause / resume session
- Timer -> Stop / discard session
- Timer -> Complete session review
- Timer -> Recover active session after reload
