# NFR Workspace: presenter guide

Synthetic institution and data. Illustrative regulatory context, not legal advice.

Five acts, six to eight minutes, inside the 30-minute meeting. Every screen below reads from the
seeded records; nothing is a mock-up and nothing needs a model or a network.

The pitch deck hands over to this product after its **Enter NFR Workspace** screen and takes back
at its **AI prepares. Professionals decide. Systems record.** screen.

## Meeting timebox (30 minutes)

| Minutes | Where | What |
|---|---|---|
| 0 to 7 | Deck | Problem, four ways to work, three layers, Enter NFR Workspace |
| 7 to 15 | This product | The five acts below |
| 15 to 20 | Deck | AI prepares, professionals decide, systems record; six months to one loop |
| 20 to 24 | Deck | Value and economics summary |
| 24 to 30 | Deck appendix | Discussion and the deep dives the room asks for |

## Before the meeting

| Step | How |
|---|---|
| Start | Double-click `Launch NFROS.cmd`. It checks Node and the database, builds only after a code change, starts the showcase on http://localhost:3200 with its own database, waits until the scripted journey is ready, warms every page of the five acts and then switches the browser from the starting page to the product. The window prints each check; everything also goes to `data\launcher.log`. Keep the window open. |
| Ready | The window ends with **Ready. The showcase day is clean.** If it says the day shows earlier work, reset (next row). In a browser, http://localhost:3200/api/health/demo shows the same checks. |
| Clean day | Account menu (top right), **Reset demonstration**, then **Confirm reset of the demonstration** within four seconds. The label changes to *Demonstration reset*. Or close the window and start with `Launch NFROS.cmd --reset`. |
| Rehearse once | Sign in, ask the first question, run act 4 once, then reset again. Or run `node scripts/demo/rehearse.mjs --base http://localhost:3200`, which walks all five acts, checks for errors and resets at the end. |
| Signed out | Account menu, **Sign out**. Opening http://localhost:3200 then plays the startup. |
| Browser | A dedicated window or profile, notifications off, password-manager prompts off, no personal bookmarks bar, 100 percent zoom at 1440 x 900 or larger. Product tab open on http://localhost:3200; deck tab open at its return screen. Share that window, not the desktop. |
| Fallback | Have `exports\demo-fallback-v6\` ready: one screenshot per step and `five-act-journey.webm`, made from the same data by the rehearsal script. |
| Stop | `Stop NFROS.cmd`, or close the launcher window. |

## Act 1: the Workspace feels real (about 45 seconds)

1. Switch from the deck to the product tab at http://localhost:3200. The mark draws, three status
   lines, then **Sign in**.
2. Type `Admin` and a wrong password, Enter: the refusal names neither field.
3. Type `Admin` / `Admin`, Enter. Three steps resolve with real facts: the acting role and its
   authority scopes, three decisions that need a person, records as of 06.10.2026, 07:45.

> The user does not start with a blank chatbot. The Workspace starts with the work and the
> decisions relevant to the role.

If slow or stuck: reload http://localhost:3200/login. If it still fails, show screenshots 01 to 03.

## Act 2: the next decision arrives prepared (about 60 seconds)

1. **Today**: one item under **Needs you now**, the RepairDesk recovery time gap on supplier
   TP-0042, with what changed, why it matters and the action. At most three under **Next**.
   **Watching** and **Done today** are collapsed: open **Done today** to show what ran without the
   person.
2. To show the evidence behind the decision, click **Record the decision**: the decision opens at
   its question; step 3 **Evidence** lists the five cited documents. Do not use the **Evidence**
   button on the Now card in this build: its drawer shows only what the Work Hub last selected
   and opens empty in a fresh session.

> The Workspace brings together the case, the evidence and the required action before the user
> starts searching.

If the Now item is missing or shows earlier work: reset the demonstration. Fallback: screenshots
04 and 05.

## Act 3: a live question, a visual answer (about 2 minutes)

1. Back on **Today**, under **Ask the records**, type or click: *Which critical third-party
   services are deteriorating, and why?*
2. The three preparation steps resolve and the analysis opens. Read the conclusion aloud:
   *3 critical third parties are deteriorating, led by Novalink (up 23 points); 2 of them share
   Basalt Cloud.*
3. Point at the five figures (3 of 11 deteriorating, 11 incidents since July, 2 of 3 on one
   provider, 7 open high issues, 4 acceptances expiring within 90 days), then the ranking
   *Novalink moved most: up 23 points in three months* with its deterioration threshold.
   **Explain this chart** and **Show as table** are under the title.
4. Scroll to **What the records show**; click **12 sources** on Novalink to open the evidence
   with its freshness (the 22.05.2026 recovery test is marked stale).
5. Click the follow-up **Concentration**: a dependency map with Basalt Cloud under four critical
   suppliers and the undeclared Fernblick link dashed.

> The AI does not merely return words. It returns a governed analysis built from connected
> records, in the right visual form, with its evidence. No number came from a model.

Optional: open **How this was prepared**, then **How it works**, for an IT audience.

If the answer takes more than a few seconds: it is being built for the first time; the launcher
normally does this at start. If the question is declined: click the suggestion chip
**Deteriorating third parties** instead. Fallback: screenshots 07 to 10.

## Act 4: from insight to action (about 90 seconds)

1. Back on the deterioration analysis (browser back), **Recommended next step**: *Request
   current recovery test evidence from Novalink*, **Review and approve**.
2. The review shows the system of record, every field before and after, the reason, the
   evidence and the authority the gate will apply. **Approve and commit** stays disabled until
   the box *I confirm the judgment and the reason are my own* is ticked.
3. Tick, commit. The receipt shows the transaction, the new record, the approval bound to this
   exact payload and consumed by the commit, who and when.
4. **View in audit log** opens the entry in Records. **Open the record** shows it in the Work Hub.

> The Workspace connects assistance to a controlled process. The professional approves; the
> system records.

If the recommendation already shows *Done*: the day was used; reset after the meeting and use
**Assess the shared Basalt Cloud dependency** under More actions now. Fallback: screenshots 11
to 16.

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

Then switch back to the deck tab, at **AI prepares. Professionals decide. Systems record.**, and map
what the room just saw onto it. Do not apologise for any recovery step; carry on from the
fallback screenshot. Fallback: screenshots 17 to 19.

## After the meeting

Reset the demonstration (account menu), or close the launcher window and start next time with
`Launch NFROS.cmd --reset`.

## The questions it answers

Third-party deterioration; provider concentration; what changed in the payment service review;
repeatedly failing controls; overdue high-severity issues; risk acceptances expiring in 90
days; resilience gaps by service; impact of the latest policy change; a one-page management
summary; the next action on the current case. German phrasings work too. Any other question is
declined with these as suggestions, never answered with a guess.

## If something goes wrong

| Symptom | Do |
|---|---|
| The launcher window says it could not start | It names the cause and the fix (Node, `npm install`, `npm rebuild better-sqlite3`, port 3200 in use). Run `Stop NFROS.cmd` and start again. The log is `data\launcher.log`. |
| THE BUILD FAILED in the window | The showcase runs on the slower development server. It still works; first pages take longer. Fix after the meeting. |
| A page asks to sign in again | The session ends with the browser. Sign in; it returns to the page you asked for. |
| The day shows earlier write-backs | Reset demonstration (account menu, click, then confirm). |
| A first page is slow | The launcher warms the pages before the browser opens; with `npm run demo:safe` click each area once before presenting. |
| The AI Partner declines a free question | Expected for questions outside the ten; ask one of them, or use the Ask bar. |
| Nothing works | Play `exports\demo-fallback-v6\five-act-journey.webm`, or step through its screenshots, and return to the deck. |
