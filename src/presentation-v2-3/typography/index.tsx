import React, { type ReactNode, type CSSProperties } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: keyof React.JSX.IntrinsicElements;
  color?: string;
};

function makeTypographyComponent(
  displayName: string,
  defaultTag: keyof React.JSX.IntrinsicElements,
  cssVars: { size: string; lineHeight: string; weight: string },
  fontFamilyVar: string = "--pv23-font-heading",
): React.FC<BaseProps> {
  const Component: React.FC<BaseProps> = ({ children, className, style, as, color }) => {
    const Tag = (as ?? defaultTag) as string;
    return React.createElement(Tag, {
      className,
      style: {
        fontFamily: `var(${fontFamilyVar}, Arial, sans-serif)`,
        fontSize: `var(${cssVars.size})`,
        lineHeight: `var(${cssVars.lineHeight})`,
        fontWeight: `var(${cssVars.weight})`,
        color: color ?? "var(--pv23-text)",
        margin: 0,
        padding: 0,
        ...style,
      },
    }, children);
  };
  Component.displayName = displayName;
  return Component;
}

export const PresentationDisplay = makeTypographyComponent("PresentationDisplay", "h1", {
  size: "--pv23-t-display",
  lineHeight: "--pv23-t-display-lh",
  weight: "--pv23-fw-bold",
});

export const PresentationTitle = makeTypographyComponent("PresentationTitle", "h2", {
  size: "--pv23-t-core-title",
  lineHeight: "--pv23-t-core-title-lh",
  weight: "--pv23-fw-bold",
});

export const PresentationSubtitle = makeTypographyComponent("PresentationSubtitle", "h3", {
  size: "--pv23-t-core-subtitle",
  lineHeight: "--pv23-t-core-subtitle-lh",
  weight: "--pv23-fw-regular",
});

export const PresentationStatement = makeTypographyComponent("PresentationStatement", "p", {
  size: "--pv23-t-statement",
  lineHeight: "--pv23-t-statement-lh",
  weight: "--pv23-fw-bold",
});

export const PresentationBody = makeTypographyComponent(
  "PresentationBody",
  "p",
  {
    size: "--pv23-t-core-body",
    lineHeight: "--pv23-t-core-body-lh",
    weight: "--pv23-fw-regular",
  },
  "--pv23-font-body",
);

export const PresentationLabel = makeTypographyComponent("PresentationLabel", "span", {
  size: "--pv23-t-core-label",
  lineHeight: "--pv23-t-core-label-lh",
  weight: "--pv23-fw-semibold",
});

export const PresentationMeta = makeTypographyComponent(
  "PresentationMeta",
  "span",
  {
    size: "--pv23-t-core-meta",
    lineHeight: "--pv23-t-core-meta-lh",
    weight: "--pv23-fw-regular",
  },
  "--pv23-font-body",
);

export const AppendixTitle = makeTypographyComponent("AppendixTitle", "h2", {
  size: "--pv23-t-appendix-title",
  lineHeight: "--pv23-t-appendix-title-lh",
  weight: "--pv23-fw-bold",
});

export const AppendixSubtitle = makeTypographyComponent("AppendixSubtitle", "h3", {
  size: "--pv23-t-appendix-sub",
  lineHeight: "--pv23-t-appendix-sub-lh",
  weight: "--pv23-fw-regular",
});

export const AppendixBody = makeTypographyComponent(
  "AppendixBody",
  "p",
  {
    size: "--pv23-t-appendix-body",
    lineHeight: "--pv23-t-appendix-body-lh",
    weight: "--pv23-fw-regular",
  },
  "--pv23-font-body",
);

export const AppendixTableText = makeTypographyComponent(
  "AppendixTableText",
  "span",
  {
    size: "--pv23-t-appendix-table",
    lineHeight: "--pv23-t-appendix-table-lh",
    weight: "--pv23-fw-regular",
  },
  "--pv23-font-body",
);

export const PresentationFootnote = makeTypographyComponent(
  "PresentationFootnote",
  "small",
  {
    size: "--pv23-t-footnote",
    lineHeight: "--pv23-t-footnote-lh",
    weight: "--pv23-fw-regular",
  },
  "--pv23-font-body",
);

export const PresentationRefControl = makeTypographyComponent(
  "PresentationRefControl",
  "span",
  {
    size: "--pv23-t-ref-control",
    lineHeight: "--pv23-t-ref-control-lh",
    weight: "--pv23-fw-semibold",
  },
  "--pv23-font-body",
);
