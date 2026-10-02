# Presentation V2.2 -- Current State Audit

## Branch and commit

Branch: `main`
Commit: `bb9cd56a7ae5164dcc5bf0d88a68156e54d6316a`

## Default deck (`/story` resolution)

`app/story/page.tsx` line 73:

```ts
const deckVersion = firstValue(params, "deck") ?? "v1";
```

`/story` (no param) resolves to `deckVersion = "v1"` -- the old 16-scene StoryDeck
backed by `STORY_SCENES` from `@/scenario/data/story`. V2.1 is only reachable
via the explicit `?deck=v2.1` param.

## Entry page link target

`app/page.tsx` line 93:

```tsx
<Link href="/story" className="btn btn-primary btn-lg">Open the presentation</Link>
```

The primary CTA and the footer both link to `/story` with no deck param. Because
the default is `v1`, both currently open the old 16-scene deck. After the V2.2
route fix is applied the links remain correct (no deck param = current version).

## Export script URL

`scripts/export-presentation-v2-1.ts` lines 121 and 143:

```ts
const url = `${BASE_URL}/story?deck=v2.1&export=1&slide=${slideIndex}`;
```

The V2.1 export script explicitly requests `deck=v2.1`. This is correct for
producing V2.1 exports and is not a defect in that script.

`package.json` line 33:

```json
"export:presentation": "tsx scripts/export-presentation-v2-1.ts"
```

`export:presentation` runs the V2.1 script. After V2.2 ships this should call
the V2.2 script instead. There is no `export:presentation-v2-1` alias.

## Defects found

| # | Location | Defect |
|---|----------|--------|
| 1 | `app/story/page.tsx:73` | Default deck is `"v1"` (old 16-scene StoryDeck). `/story` should resolve to the current deck (V2.2). |
| 2 | `app/story/page.tsx:42-46` | `<head>` metadata description says "Sixteen scenes across one working day" -- references V1 era content. Must be updated to describe V2.2. |
| 3 | `package.json:33` | `export:presentation` runs the V2.1 export script. Should point to the V2.2 script once it exists. No `export:presentation-v2-1` alias exists for the old script. |
| 4 | `src/presentation-v2-1/components/PresentationV21.tsx` | Does NOT emit a `data-presentation-slides` DOM attribute. The V2.2 export pipeline intends to discover slides from this attribute. PresentationV22 (and V2.1 if captured via V2.2) must emit it before the V2.2 export script can succeed. |
| 5 | `src/presentation-v2-2/` | Directory does not exist. PresentationV22 component must be created as a stub so `/story?deck=v2.2` works immediately. |
| 6 | `scripts/export-presentation-v2-2.ts` | Does not exist. V2.2 export script must be created. |
| 7 | `tests/e2e/presentation-routes.spec.ts` | Does not exist. Route matrix is untested. |
