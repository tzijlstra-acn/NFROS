/**
 * Loads every stage implementation.
 *
 * The engine imports this one module. Each app keeps its own index of
 * implemented stages, so the two follow-on workstreams (RCSA and TPRM) never
 * edit the same file.
 */

import "@/role-apps/rcsa/stages";
import "@/role-apps/tprm/stages";
