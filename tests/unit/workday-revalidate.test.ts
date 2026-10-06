/**
 * The workday revalidation helper.
 *
 * Two claims. Inside a request it registers exactly the paths that cover the
 * role's Home, Work, Processes and Decisions. Outside one it does nothing and
 * says so, rather than throwing, so engine code shared with tests and scripts
 * can call it unconditionally.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => revalidatePath(path, type),
}));

const { revalidateWorkday, workdayRevalidationTargets } = await import("@/workday/revalidate");

afterEach(() => {
  revalidatePath.mockReset();
});

describe("the targets", () => {
  it("cover the role's whole workday layout for a role-owned change", () => {
    expect(workdayRevalidationTargets("rcsa")).toStrictEqual([{ path: "/workday/rcsa", type: "layout" }]);
  });

  it("cover every workday and the control room for a change no single role owns", () => {
    expect(workdayRevalidationTargets(null)).toStrictEqual([
      { path: "/workday", type: "layout" },
      { path: "/control-room" },
    ]);
  });
});

describe("revalidateWorkday", () => {
  it("registers each target with Next inside a request", () => {
    expect(revalidateWorkday("tprm", "process-stage")).toBe(true);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/workday/tprm", "layout");
  });

  it("is a no-op outside a request, and reports it", () => {
    revalidatePath.mockImplementation(() => {
      throw Object.assign(new Error("Invariant: static generation store missing in revalidatePath /workday/rcsa"), {
        __NEXT_ERROR_CODE: "E263",
      });
    });
    expect(revalidateWorkday("rcsa", "decision")).toBe(false);
  });

  it("still throws a genuine failure, such as revalidating during render", () => {
    revalidatePath.mockImplementation(() => {
      throw new Error('Route /workday/[role] used "revalidatePath /workday/rcsa" during render which is unsupported.');
    });
    expect(() => revalidateWorkday("rcsa", "decision")).toThrow(/during render/);
  });
});
