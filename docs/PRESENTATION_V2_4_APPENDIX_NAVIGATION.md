# Presentation V2.4: navigation, appendix and export contract

The V2.4 deck lives at `/story` (default) and `/story?deck=v2.4`. This note describes how a
presenter moves through it and the contract the exporter relies on.

## Play order

`PRESENTATION_SLIDES_V24` defines play positions 1 to 14: the thirteen core slides, then the
closing Q&A slide. Core slides show the counter `N / 13`. The cover (position 1) and the
closing slide (position 14) render full bleed with no counter. Right arrow on slide 13 opens
the closing slide.

## URL scheme

Every move pushes one history entry, so browser Back and Forward walk the slide history and a
hard refresh restores the same view.

| View | URL |
| --- | --- |
| Core slide | `/story?deck=v2.4&core=N` (N is 1 to 14) |
| Appendix slide | `/story?deck=v2.4&appendix=app-XX&from=core-N` |
| Appendix index | `/story?deck=v2.4&view=appendix-index&from=core-N` |

`export` and `safe` query parameters are preserved on every move. An appendix slide opened
without `from` returns to the first core slide whose `appendixRefs` reference it, or to the
agenda (slide 2) when none does. The index without `from` returns to the agenda.

## Appendix

The index groups slides by `APPENDIX_GROUP_ORDER` (Product, Processes, Controls, Technology,
Service and rollout); slides without a group go to a final Other group. Index order is also
the order the arrow keys follow inside the appendix: the index first, then each slide.

Each appendix slide shows its group as the section label, its code (`app-08` reads `A08`),
the implementation status badge and note, one visual on the fixed 1920 x 780 stage, the
source line, a "Return to slide N" control and a link to the index.

## Keys

| Key | Action |
| --- | --- |
| Right arrow, Page Down, Space | Next slide in the core story or the appendix |
| Left arrow, Page Up | Previous slide |
| Home, End | First core slide, last core slide (13) |
| A | Agenda in the core story; appendix index in the appendix |
| C | Return to the originating core slide (does nothing in the core story) |
| R | Replay the current slide's animation (remounts it, never changes slide) |
| M | Pause or resume all motion |
| D | Download menu |
| F | Full screen |
| P | Presenter notes with the next slide's title |
| ? | Keyboard help |
| Esc | Close any open panel or menu |

Keys are ignored while Ctrl, Alt or Meta is held, and while focus is in a text field. Space
and Enter keep their default on a focused button or link.

## Export contract

1. `?export=1` hides all presenter chrome: hover slide menu, download buttons, overlays,
   help and the motion pill. Exhibits render their final state.
2. Every page renders `<script type="application/json" data-presentation-slides>` with the
   full deck order: core 1 to 13, closing, appendix index, then appendix slides in index
   order. Each entry is `{ key, kind, position, coreNumber, id, title, section, group, url,
   speakerNotes }`. `kind` is `core`, `closing`, `appendix-index` or `appendix`. `position`
   is 1 to 14 for core and closing, otherwise null. `coreNumber` is 1 to 13 or null. `url`
   carries no host and no origin, for example `/story?deck=v2.4&core=3`,
   `/story?deck=v2.4&view=appendix-index`, `/story?deck=v2.4&appendix=app-08`.
3. The `.pv24-slide` element carries `data-slide-key` (the manifest `key`) and
   `data-slide-ready="true"` once fonts are loaded, every image on the slide has settled and
   two animation frames have passed.
4. Link anchors carry `data-link-target`: ref chips `appendix:app-XX`, the return control
   `core:N`, index entries `appendix:app-XX`, links to the index `appendix-index`. They stay
   visible in export mode so the exporter can place links over them.

## Downloads

The menu offers Core PDF, Full PDF, PowerPoint and Speaker notes from `/downloads/`. Each
file is checked with a HEAD request when the menu opens; a file that does not exist yet is
shown as "Not yet exported" and is not a link.
