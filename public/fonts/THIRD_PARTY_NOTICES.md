# Third party font notices

This directory contains nine font files that are redistributed with this
repository rather than fetched from a content delivery network at runtime. The
reason is stated in `src/styles/tokens.css`: the application must render with
its intended typography in offline mode, and the build must not depend on
network access.

All nine are licensed under the **SIL Open Font License, Version 1.1**, which
permits redistribution, including bundled with software, provided the licence
notice is retained. This file is that notice.

| File | Family | Copyright | Licence | Source |
|---|---|---|---|---|
| `space-grotesk.woff2` | Space Grotesk | Copyright (c) 2019, Florian Karsten | SIL OFL 1.1 | https://github.com/floriankarsten/space-grotesk |
| `inter.woff2` | Inter | Copyright (c) 2016, The Inter Project Authors | SIL OFL 1.1 | https://github.com/rsms/inter |
| `jetbrains-mono.woff2` | JetBrains Mono | Copyright (c) 2020, JetBrains s.r.o. | SIL OFL 1.1 | https://github.com/JetBrains/JetBrainsMono |
| `geist-sans.woff2` | Geist | Copyright (c) 2023 Vercel, in collaboration with basement.studio | SIL OFL 1.1 | https://github.com/vercel/geist-font |
| `geist-mono.woff2` | Geist Mono | Copyright (c) 2023 Vercel, in collaboration with basement.studio | SIL OFL 1.1 | https://github.com/vercel/geist-font |
| `ibm-plex-sans-400.woff2` | IBM Plex Sans Regular | Copyright (c) 2017 IBM Corp. with Reserved Font Name "Plex" | SIL OFL 1.1 | https://github.com/IBM/plex |
| `ibm-plex-sans-500.woff2` | IBM Plex Sans Medium | Copyright (c) 2017 IBM Corp. with Reserved Font Name "Plex" | SIL OFL 1.1 | https://github.com/IBM/plex |
| `ibm-plex-sans-600.woff2` | IBM Plex Sans SemiBold | Copyright (c) 2017 IBM Corp. with Reserved Font Name "Plex" | SIL OFL 1.1 | https://github.com/IBM/plex |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono Regular | Copyright (c) 2017 IBM Corp. with Reserved Font Name "Plex" | SIL OFL 1.1 | https://github.com/IBM/plex |

Each file is variable weight form, so one file per family covers the whole
weight range the design uses. Space Grotesk, Inter and JetBrains Mono were
obtained from the Google Fonts distribution of each project. The two Geist
files are the unmodified `Geist-Variable.woff2` and `GeistMono-Variable.woff2`
artefacts from the official `geist` npm package published by Vercel, copied
into this directory at build setup time.

The IBM Plex files are the `Latin1` subsets taken from the official `@ibm/plex`
npm package at version 6.4.1, copied into this directory and the package then
removed. The package ships every weight for every script it supports and
occupies several hundred megabytes installed, which is not a reasonable
dependency for four files. The four here are the weights the application
actually uses: 400, 500 and 600 for the sans, 400 for the mono, 82 KB in total.
"Plex" is a Reserved Font Name under the licence, so these files are unmodified
and are not renamed.

The three families serve different surfaces. Space Grotesk, Inter and JetBrains
Mono are the presentation typeface set, used by `/story` and the reporting
routes. Geist and Geist Mono are the V2 application set, scoped under
`.workday-v2`. IBM Plex Sans and IBM Plex Mono are the V3.1 analyst set,
scoped under `.workday-v3`. The separation is
deliberate and is explained in `docs/INTERACTIVE_WORKDAY_V2.md`: a
presenter-led deck and a working application want different typography, and
scoping them avoids one compromising the other.

## Licence text

The full SIL Open Font License, Version 1.1 is available at
https://openfontlicense.org and is reproduced in summary below. The
authoritative text is the one published at that address.

Permission is granted, free of charge, to any person obtaining a copy of the
font software and associated documentation, to use, study, copy, merge, embed,
modify, redistribute, and sell modified and unmodified copies of the font
software, subject to the following conditions:

1. Neither the font software nor any of its individual components, in original
   or modified versions, may be sold by itself.
2. Original or modified versions may be bundled, redistributed and sold with
   any software, provided that each copy contains the above copyright notice
   and this licence. These can be included either as stand-alone text files,
   human-readable headers or in the appropriate machine-readable metadata
   fields within text or binary files as long as those fields can be easily
   viewed by the user.
3. No modified version may use the Reserved Font Name unless explicit written
   permission is granted by the copyright holder.
4. The name of the copyright holder may not be used to promote, endorse or
   advertise any modified version, except to acknowledge the contributions of
   the copyright holder.
5. The font software, modified or unmodified, in part or in whole, must be
   distributed entirely under this licence, and may not be distributed under
   any other licence.

The font software is provided "as is", without warranty of any kind.

## Note on modification

These files are unmodified as distributed by Google Fonts and by the official
`geist` package. No glyph, metric or name table has been altered, and no
Reserved Font Name is reused.
