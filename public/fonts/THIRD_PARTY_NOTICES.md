# Third party font notices

This directory contains three font files that are redistributed with this
repository rather than fetched from a content delivery network at runtime. The
reason is stated in `src/styles/tokens.css`: the application must render with
its intended typography in offline mode, and the build must not depend on
network access.

All three are licensed under the **SIL Open Font License, Version 1.1**, which
permits redistribution, including bundled with software, provided the licence
notice is retained. This file is that notice.

| File | Family | Copyright | Licence | Source |
|---|---|---|---|---|
| `space-grotesk.woff2` | Space Grotesk | Copyright (c) 2019, Florian Karsten | SIL OFL 1.1 | https://github.com/floriankarsten/space-grotesk |
| `inter.woff2` | Inter | Copyright (c) 2016, The Inter Project Authors | SIL OFL 1.1 | https://github.com/rsms/inter |
| `jetbrains-mono.woff2` | JetBrains Mono | Copyright (c) 2020, JetBrains s.r.o. | SIL OFL 1.1 | https://github.com/JetBrains/JetBrainsMono |

Each file is the latin subset in variable weight form, so one file per family
covers the whole weight range the design uses. They were obtained from the
Google Fonts distribution of each project.

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

These files are unmodified subsets as distributed by Google Fonts. No glyph,
metric or name table has been altered, and no Reserved Font Name is reused.
