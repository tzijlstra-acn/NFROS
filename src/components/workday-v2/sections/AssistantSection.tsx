/**
 * The deeper assistant view.
 *
 * This route is no longer the only meaningful AI surface. The persistent
 * partner dock carries the conversation that belongs beside the work, and this
 * page is what it says it is: a larger view for a longer conversation.
 *
 * The baseline audit found that the V1 version of this route put the chat
 * input below four substantial panels, so a user had to scroll past the mode
 * table, the autonomy state, the withheld actions and the available actions
 * before reaching the field. The panels contained genuine information, the
 * authority gate state is not decoration, but the ordering made a
 * conversation feel like a form.
 *
 * So the order is inverted. The conversation is first. The governance detail
 * is still here, in full, one disclosure below it, and the same information is
 * permanently available in Trust and in the Control Room where a reviewer
 * rather than an operator would look for it.
 */

import { getRole, getUser } from "@/db/repositories/workday";
import { toolsAvailableAt } from "@/server/security/authority";
import { getPublicHealth } from "@/server/config/runtime";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import { AUTONOMY_LABELS, MODE_LABELS, t, type Language } from "@/i18n/labels";
import { AssistantChatPanel } from "@app/workday/[role]/assistant/chat-panel";
import { AuthorityChip, Chip, Data, Item, List, Notice, SectionHead } from "../primitives";
import { Disclosure } from "../interactive";

export function AssistantSection({
  roleId,
  language,
  autonomyLevel,
}: {
  roleId: RoleId;
  language: Language;
  autonomyLevel: AutonomyLevel;
}) {
  const role = getRole(roleId);
  const holder = role ? getUser(role.holderUserId) : undefined;
  const health = getPublicHealth();
  const { available, withheld } = toolsAvailableAt(autonomyLevel, roleId);

  /*
   * Safe and offline mode answer the scripted beats from cache. A free
   * question may or may not reach a model, and the panel says which, because
   * a presenter who believes a cached answer was generated live will draw the
   * wrong conclusion from how fast it arrived.
   */
  const freeQuestionsMayNotReachAModel = health.mode !== "live";

  return (
    <div className="app-stack-5">
      <p className="app-one-line">
        {language === "de"
          ? `Der laengere Verlauf. Fuer Fragen zur aktuellen Arbeit ist der Partner rechts schneller, weil er weiss, was Sie gerade ansehen.`
          : `The longer conversation. For a question about the work in front of you the partner on the right is quicker, because it already knows what you are looking at.`}
      </p>

      <section className="app-section">
        <AssistantChatPanel
          roleId={roleId}
          mode={health.mode}
          freeQuestionsMayNotReachAModel={freeQuestionsMayNotReachAModel}
        />
      </section>

      <Disclosure
        label={
          language === "de"
            ? "Was dieser Assistent darf, und was nicht"
            : "What this assistant may and may not do"
        }
        count={withheld.length}
      >
        <div className="app-stack-4">
          <div className="app-row app-row-wrap">
            <Chip>{t(MODE_LABELS, health.mode, language)}</Chip>
            <Chip tone="warning">{t(AUTONOMY_LABELS, autonomyLevel, language)}</Chip>
            <span className="app-meta">
              {language === "de" ? "handelt als" : "acting as"} {holder?.name ?? roleId}
            </span>
          </div>

          {health.modeDowngraded && health.modeReason ? (
            <Notice tone="warning">{health.modeReason}</Notice>
          ) : null}

          <Notice>
            {language === "de"
              ? "Die Autonomiestufe ist kein Hinweis. Das Tor liest sie aus der Datenbank und verweigert jede Aktion, die auf dieser Stufe nicht erreichbar ist, unabhaengig davon, worum gebeten wird."
              : "The autonomy level is not a label. The gate reads it from the database and refuses every action that is not reachable at this level, whatever it is asked to do."}
          </Notice>

          {withheld.length > 0 ? (
            <section>
              <SectionHead
                title={language === "de" ? "Auf dieser Stufe zurueckgehalten" : "Withheld at this level"}
                count={withheld.length}
              />
              <List label={language === "de" ? "Zurueckgehalten" : "Withheld"}>
                {withheld.slice(0, 24).map((entry) => (
                  <Item
                    key={entry.tool.name}
                    title={entry.tool.name}
                    subtitle={entry.reason}
                    trailing={
                      <AuthorityChip
                        authorityClass={entry.tool.authorityClass}
                        language={language}
                      />
                    }
                  />
                ))}
              </List>
              {withheld.length > 24 ? (
                <span className="app-meta">
                  {language === "de" ? "und " : "and "}
                  {withheld.length - 24}
                  {language === "de" ? " weitere" : " more"}
                </span>
              ) : null}
            </section>
          ) : null}

          <section>
            <SectionHead
              title={language === "de" ? "Auf dieser Stufe verfuegbar" : "Available at this level"}
              count={available.length}
            />
            <List label={language === "de" ? "Verfuegbar" : "Available"}>
              {available.slice(0, 24).map((tool) => (
                <Item
                  key={tool.name}
                  title={tool.name}
                  subtitle={tool.description}
                  trailing={
                    <AuthorityChip authorityClass={tool.authorityClass} language={language} />
                  }
                />
              ))}
            </List>
            {available.length > 24 ? (
              <span className="app-meta">
                {language === "de" ? "und " : "and "}
                {available.length - 24}
                {language === "de" ? " weitere" : " more"}
              </span>
            ) : null}
          </section>

          <div className="app-row app-row-wrap">
            <span className="app-meta">
              {language === "de" ? "Werkzeuge gesamt" : "Tools in the registry"}
            </span>
            <Data>{available.length + withheld.length}</Data>
          </div>
        </div>
      </Disclosure>
    </div>
  );
}
