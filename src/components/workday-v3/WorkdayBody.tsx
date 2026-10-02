"use client";

/**
 * The body row of the frame: the rail and the main region.
 *
 * It exists for one attribute. The rail's width and the visibility of its
 * labels are a CSS contract keyed on `data-nav` on `.wd-body`, and nothing was
 * setting that attribute, so the expand control changed the chevron and the
 * badge style and left the rail 56px wide forever. A client wrapper is the
 * smallest thing that can write it, because the state lives in the chrome
 * context and `WorkdayAppFrame` is a server component.
 *
 * The children are still server rendered. They are passed through untouched,
 * so making this boundary a client component does not pull the navigation
 * counts, the header model or the page into the browser bundle.
 */

import type { ReactNode } from "react";
import { useWorkdayChrome } from "./ChromeContext";

export function WorkdayBody({
  nav,
  children,
}: {
  nav: ReactNode;
  children: ReactNode;
}) {
  const chrome = useWorkdayChrome();

  return (
    <div className="wd-body" data-nav={chrome.navExpanded ? "expanded" : "collapsed"}>
      {nav}
      <main id="main" className="wd-main">
        {children}
      </main>
    </div>
  );
}
