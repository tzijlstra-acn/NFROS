/**
 * RCSA Cycle Assistant.
 *
 * A dispatcher. The interface version is resolved from the request header and
 * the chosen implementation receives the same parameters.
 * See src/workday/dispatch.tsx for why the choice is centralised.
 */

import { createWorkdayPage } from "@/workday/dispatch";
import V1 from "./v1";
import V2 from "./v2";
import V3 from "./v3";

export const dynamic = "force-dynamic";

export default createWorkdayPage(V1, V2, V3);
