/**
 * The executable RCSA stages.
 *
 * One import per implemented stage. A stage module registers its loaders,
 * preparer, forms, decision rules, payload builders, artifact builders,
 * completion checks and completion hooks with the process engine when it is
 * imported, so adding a stage is adding a line here and setting
 * `implementation` to `IMPLEMENTED` on its contract in `../definition.ts`.
 *
 * `./sources` and `./run-decisions` hold what several stages share: the
 * loaders the later stages read, and the completion hooks that present a
 * later run's own decision when a stage that binds one opens.
 */

import "./sources";
import "./run-decisions";
import "./scope-trigger";
import "./evidence-refresh";
import "./risk-control-change";
import "./first-line-input";
import "./challenge-workshop";
import "./rating-appetite";
import "./actions-approval";
import "./monitoring-reassessment";
