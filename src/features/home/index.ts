/**
 * Home: the role's Now, Next, Your day, Partner update and Done, from rows.
 *
 * `read.ts` is the read model the route calls. `assemble.ts` holds the pure
 * rules it applies, exported for tests. `sources.ts` lists what Home reads, so
 * a server action that writes one of those tables knows to call
 * `revalidateWorkday` from `src/workday/revalidate.ts`.
 */

export type {
  DoneRow,
  DoneSummary,
  HomeNow,
  HomeState,
  HomeView,
  LineageKind,
  LineageRef,
  PartnerSource,
  PartnerSourceStatus,
  PartnerStatement,
  PartnerUpdate,
  YourDay,
  YourDayActions,
  YourDayInbox,
  YourDayMeeting,
} from "./types";
export {
  assembleActions,
  assembleDone,
  assembleInbox,
  assembleMeeting,
  assemblePartnerUpdate,
  assembleYourDay,
  automaticUnits,
  doneKindLabel,
  doneSummaryLine,
  happenedToday,
  isAutomaticRow,
  needsAttention,
  orderStatements,
  whatChangedFrom,
  ATTENTION_TRIAGE,
  PARTNER_SOURCE_ORDER,
  PARTNER_STATEMENT_LIMIT,
  type DayWindow,
  type DoneInputs,
  type PartnerInputs,
} from "./assemble";
export { HOME_COPY, pick } from "./copy";
export { HOME_DATA_SOURCES, HOME_FRESHNESS_CHANGES, type HomeDataSource } from "./sources";
export { readHomeView } from "./read";
