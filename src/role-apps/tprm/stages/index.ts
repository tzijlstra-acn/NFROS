/**
 * The executable Third-Party Onboarding stages.
 *
 * One import per implemented stage. A stage module registers its loaders,
 * preparer, forms, decision rules, payload builders and artifact builders
 * with the process engine when it is imported, so adding a stage is adding a
 * line here and flipping `implementation` to `IMPLEMENTED` on its contract in
 * `../definition.ts`. All eight stages are implemented. `./sources` registers
 * the loaders several stages share; `./evidence-review` registers the four
 * the reference stage introduced.
 */

import "./sources";
import "./request-intake";
import "./classification";
import "./tailored-due-diligence";
import "./evidence-review";
import "./specialist-reviews";
import "./contract-conditions";
import "./decision-onboarding";
import "./monitoring-handover";
