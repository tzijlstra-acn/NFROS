/**
 * The header shown when the model cannot be built.
 *
 * Exactly the same box as the loaded header: the same `wd-header` class, the
 * same 48px row from the frame's grid, the same control positions. That is the
 * whole requirement. A fallback of a different height moves the workspace when
 * it is replaced, which is the layout shift the brief sets a threshold on, and
 * a fallback that hides the header leaves a blank strip, which the brief
 * forbids outright.
 *
 * It renders the word `Workday` where the role would be, which the brief
 * explicitly accepts while role data is unavailable. It carries no counts and
 * no AI state, because asserting either without having read them would be a
 * worse answer than saying nothing.
 */

import Link from "next/link";
import { IconCircleDot, IconSearch, IconSparkles, IconUserCircle } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { PRODUCT_IDENTITY } from "@/product/release/identity";

export function WorkdayHeaderFallback({ language = "en" }: { language?: Language }) {
  const name = PRODUCT_IDENTITY.name;
  return (
    <header className="wd-header wd-header-fallback">
      <Link
        href="/"
        className="wd-brand"
        aria-label={language === "de" ? `${name}, zur Startseite` : `${name}, to the entry screen`}
      >
        <IconCircleDot size={18} stroke={2} aria-hidden="true" />
        <span className="wd-brand-name">{name}</span>
      </Link>

      <div className="wd-header-location">
        <span className="wd-header-role">{language === "de" ? "Arbeitstag" : "Workday"}</span>
      </div>

      {/*
        * The controls are present and disabled rather than absent. Their
        * absence would change the width of the row and move everything in it
        * when the real header arrived.
        */}
      <div className="wd-header-actions">
        <button
          type="button"
          className="wd-icon-btn"
          disabled
          aria-label={language === "de" ? "Suche, nicht verfuegbar" : "Search, unavailable"}
        >
          <IconSearch size={18} stroke={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="wd-icon-btn"
          disabled
          aria-label={language === "de" ? "KI Partner, nicht verfuegbar" : "AI Partner, unavailable"}
        >
          <IconSparkles size={18} stroke={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="wd-icon-btn"
          disabled
          aria-label={language === "de" ? "Konto, nicht verfuegbar" : "Account, unavailable"}
        >
          <IconUserCircle size={18} stroke={1.8} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
