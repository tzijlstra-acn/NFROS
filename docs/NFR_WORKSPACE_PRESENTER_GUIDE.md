# NFR Workspace: presenter guide

Synthetic institution and data. Illustrative regulatory context, not legal advice.

Five acts, six to eight minutes. Every screen below reads from the seeded records; nothing is a
mock-up and nothing needs a model or a network.

## Before you start

| Step | How |
|---|---|
| Start | Double-click `Launch NFROS.cmd` (NFR Workspace on http://localhost:3200, its own database). Wait for "warmed up and ready" in its window. Or `npm run demo:safe` for port 3000. |
| Clean day | Account menu (top right), **Reset demonstration**, click twice. Or `npm run demo:reset`. |
| Signed out | Account menu, **Sign out**. Opening http://localhost:3200 then plays the startup. |
| Display | 1440 x 900 or larger at 100 percent zoom. Light theme is the default. |

## Act 1: the Workspace feels real (about 45 seconds)

1. Open http://localhost:3200. The mark draws, three status lines, then **Sign in**.
2. Type `Admin` and a wrong password, Enter: the refusal names neither field.
3. Type `Admin` / `Admin`, Enter. Three steps resolve with real facts: the acting role and its
   authority scopes, three decisions that need a person, records as of 06.10.2026, 07:45.

> The user does not start with a blank chatbot. The Workspace starts with the work and the
> decisions relevant to the role.

## Act 2: the next decision arrives prepared (about 60 seconds)

1. **Today**: one item under **Needs you now**, the RepairDesk recovery time gap, with what
   changed, why it matters and the action. At most three under **Next**. **Watching** and
   **Done today** are collapsed: open **Done today** to show what ran without the person.
2. **Evidence** on the Now item opens the cited documents.

> The Workspace brings together the case, the evidence and the required action before the user
> starts searching.

## Act 3: a live question, a visual answer (about 2 minutes)

1. Under **Ask the records**, type or click: *Which critical third-party services are
   deteriorating, and why?*
2. The three preparation steps resolve and the analysis opens. Read the conclusion aloud:
   three critical third parties deteriorating, led by Novalink, two sharing Basalt Cloud.
3. Point at the five numbers, then the ranking with its threshold. **Explain this chart** and
   **Show as table** are under the title.
4. Scroll to **What the records show**; click **12 sources** on Novalink to open the evidence
   with its freshness (the 22.05.2026 recovery test is marked stale).
5. Click the follow-up **Concentration**: a dependency map with Basalt Cloud under four
   critical suppliers and the undeclared Fernblick link dashed.

> The AI does not merely return words. It returns a governed analysis built from connected
> records, in the right visual form, with its evidence. No number came from a model.

Optional: open **How this was prepared**, then **How it works**, for an IT audience.

## Act 4: from insight to action (about 90 seconds)

1. Back on the deterioration analysis (browser back), **Recommended next step**: *Request
   current recovery test evidence from Novalink*, **Review and approve**.
2. The review shows the system of record, every field before and after, the evidence and the
   authority the gate will apply. **Approve and commit** stays disabled until the box *I
   confirm the judgment and the reason are my own* is ticked.
3. Tick, commit. The receipt shows the transaction, the new record, the approval bound to this
   exact payload and consumed by the commit, who and when.
4. **View in audit log** opens the entry in Records. **Open the record** shows it in the Work Hub.

> The Workspace connects assistance to a controlled process. The professional approves; the
> system records.

## Act 5: the long tail, governed (about 60 seconds)

1. On any analysis, **Save as agent**. The builder shows four steps: the outcome, **scope and
   permissions** under *This agent inherits your access. It does not create new access.*, the
   plan, and run and save.
2. **Save and run weekly**. It appears under **My agents** with its schedule; **Run now** runs
   the same analysis again through the gate and keeps it in the run history.
3. Point at the promotion path: ad hoc question, saved personal agent, reviewed team template,
   standard NFR app or automation.

> Standard processes cover repeatable work. Agents cover the ad hoc questions without bypassing
> permissions or controls.

## The questions it answers

Third-party deterioration; provider concentration; what changed in the payment service review;
repeatedly failing controls; overdue high-severity issues; risk acceptances expiring in 90
days; resilience gaps by service; impact of the latest policy change; a one-page management
summary; the next action on the current case. German phrasings work too. Any other question is
declined with these as suggestions, never answered with a guess.

## If something goes wrong

| Symptom | Do |
|---|---|
| A page asks to sign in again | The session ends with the browser. Sign in; it returns to the page you asked for. |
| The day shows earlier write-backs | Reset demonstration (account menu, twice). |
| A first page is slow | The launcher warms the pages; with `npm run demo:safe` click each area once before presenting. |
| The AI Partner declines a free question | Expected for questions outside the ten; ask one of them, or use the Ask bar. |
