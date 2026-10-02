/**
 * The workday header.
 *
 * Server rendered, fixed height, one line, and it depends on nothing that can
 * be slow or absent. Everything it needs comes from `buildHeaderModel`, which
 * is a handful of lookups and two counts and cannot reach evidence retrieval,
 * a connector, an AI call or a workspace view.
 *
 * The interactive controls are a separate client component. That split is the
 * point: the identity, the role and the counts are HTML the moment the server
 * responds, and only the menus and the search trigger wait for hydration. A
 * header whose text waited for JavaScript would still be blank when the
 * database was slow, which is the defect this replaces.
 */

import Link from "next/link";
import { IconCircleDot } from "@tabler/icons-react";
import type { WorkdayHeaderModel } from "@/db/repositories/header";
import { WorkdayHeaderClientActions } from "./WorkdayHeaderClientActions";

export function WorkdayHeader({
  model,
  roleId,
}: {
  model: WorkdayHeaderModel;
  /** Null while the role is unknown, which the fallback label covers. */
  roleId: string | null;
}) {
  const { language } = model;

  return (
    <header className="wd-header">
      <Link
        href="/"
        className="wd-brand"
        aria-label={
          language === "de"
            ? `${model.productName}, zur Startseite`
            : `${model.productName}, to the entry screen`
        }
      >
        {model.productMark ? (
          <img src={model.productMark} alt="" className="wd-brand-mark" width={20} height={20} />
        ) : (
          <IconCircleDot size={18} stroke={2} aria-hidden="true" className="wd-shrink-0" />
        )}
        <span className="wd-brand-name">{model.productName}</span>
      </Link>

      {/*
        * Where am I. Role, entity, and the selected object when the page has
        * named one. The object is the first thing dropped when width runs
        * short, because it is always also the title of the workspace below.
        */}
      <div className="wd-header-location">
        <span className="wd-header-role">{model.roleLabel}</span>
        {model.entityLabel ? (
          <span className="wd-header-entity">{model.entityLabel}</span>
        ) : null}
      </div>

      <WorkdayHeaderClientActions
        language={language}
        updatesCount={model.updatesCount}
        aiState={model.aiState}
        userLabel={model.userLabel}
        roleId={roleId}
      />
    </header>
  );
}
