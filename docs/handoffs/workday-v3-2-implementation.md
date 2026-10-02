# Workday V3.2 Implementation Handoff

Initial skeleton written by Agent C (navigation, redirects, Processes route).
RCSA and TPRM agents: fill in the stubs under their sections.

---

## What changed

### Navigation rail (src/components/workday-v3/WorkdayNavigation.tsx)

Before (V3.1): Home, Decisions, Workbench, Meetings + More (Mail, Calendar, Collaboration)
+ footer: Trust, Settings

After (V3.2): Home, Processes, Decisions
+ footer: collapse/expand only

Removed from rail:
- Workbench
- Meetings
- More disclosure (Mail, Calendar, Collaboration)
- Trust link (/trust)
- Settings link (/settings/organisation)

Added:
- Processes -> /workday/<role>/processes (IconSitemap)

`NavigationCounts.mail` is kept in the interface for backwards compatibility but
is no longer displayed. Callers may stop passing it in a future cleanup.

### Redirects (next.config.ts)

Added `async redirects()`. All permanent: false so destinations can move.

For rcsa and tprm only:

| From | To |
|---|---|
| /workday/{role}/workbench | /workday/{role}/processes |
| /workday/{role}/meetings | /workday/{role}/processes |
| /workday/{role}/mail | /workday/{role} |
| /workday/{role}/calendar | /workday/{role} |
| /workday/{role}/collaboration | /workday/{role}/processes |
| /workday/{role}/assistant | /workday/{role}?partner=open |

Preview roles (control-assurance, incident-resilience, regulatory-change,
nfr-governance) keep their existing routes untouched.

### V3_NATIVE_SEGMENTS (src/workday/contracts.ts)

Before: "", "decisions", "workbench", "meetings", "mail", "calendar",
"collaboration", "assistant"

After: "", "decisions", "processes"

Removed segments redirect at the Next.js config level before the page renders,
so they do not need a V3 segment entry. "processes" added so the middleware
applies the V3 frame to the new route.

---

## New routes

### /workday/[role]/processes

Files:
- app/workday/[role]/processes/page.tsx -- dispatcher (createWorkdayPage)
- app/workday/[role]/processes/v1.tsx -- SectionStub stub
- app/workday/[role]/processes/v2.tsx -- SectionStub stub
- app/workday/[role]/processes/v3.tsx -- V3 implementation (two sections: Process map, Role apps)

The V3 page renders two sections inline (no client-side tabs). For rcsa it
links to /workday/rcsa/processes/rcsa-cycle. For tprm it links to
/workday/tprm/processes/third-party-onboarding. All other roles see an empty
Role apps section.

### /workday/[role]/processes/rcsa-cycle

File: app/workday/[role]/processes/rcsa-cycle/page.tsx

Stub. Returns 200. RCSA agent to implement.

Title (en): "RCSA Cycle Assistant"
Title (de): "RCSA-Zyklus-Assistent"

### /workday/[role]/processes/third-party-onboarding

File: app/workday/[role]/processes/third-party-onboarding/page.tsx

Stub. Returns 200. TPRM agent to implement.

Title (en): "Third-Party Onboarding"
Title (de): "Drittanbieter-Onboarding"

---

## Constraints active in this codebase

- No em dash (U+2014) anywhere
- German: ae oe ue ss (no umlauts)
- "Synthetic institution and data" must appear on every interactive page
- Use existing V3 tokens only (wd-* custom properties)

---

## Next steps for RCSA agent

1. Replace app/workday/[role]/processes/rcsa-cycle/page.tsx with live content
2. Update app/workday/[role]/processes/v3.tsx Process map section to show RCSA
   process hierarchy (read from db/repositories/workday, getProcess)

## Next steps for TPRM agent

1. Replace app/workday/[role]/processes/third-party-onboarding/page.tsx with
   live content
2. Update app/workday/[role]/processes/v3.tsx Process map section to show
   third-party intake workflow

## Future cleanup

- Remove NavigationCounts.mail once no caller passes it
- Consider whether preview roles need their own redirects from deprecated routes
- Consider extracting FLAGSHIP_APPS in processes/v3.tsx to a separate
  role-config file when the list grows
