/**
 * POST /api/realtime/session
 *
 * Mints a short lived client token for a Realtime voice session.
 *
 * The API key never reaches the browser. This route asks OpenAI for an
 * ephemeral client secret and returns only that, so the worst case if the
 * response were intercepted is a short lived session rather than an account
 * credential.
 *
 * Voice is optional everywhere in this product. When no realtime model is
 * available, this route says so plainly and the typed fallback is used. It
 * never fails in a way that would break a meeting simulation.
 */

import { NextResponse } from "next/server";
import { getOpenAIClient, probeModelAvailability } from "@/server/openai/client";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { createLogger } from "@/server/logging/redact";

export const dynamic = "force-dynamic";

const log = createLogger("api-realtime");

export async function POST() {
  const mode = getResolvedDemoMode();

  if (mode.mode !== "live") {
    return NextResponse.json({
      available: false,
      reason: `Voice requires live mode. The application is running in ${mode.mode} mode. The typed fallback is always available.`,
    });
  }

  const client = getOpenAIClient();
  if (!client) {
    return NextResponse.json({
      available: false,
      reason:
        "No usable OpenAI key was resolved, so voice is unavailable. The typed fallback is always available.",
    });
  }

  const models = await probeModelAvailability();
  if (models.realtime === null) {
    return NextResponse.json({
      available: false,
      reason:
        models.realtimeDisabledReason ??
        "No realtime model is available for this account. The typed fallback is always available.",
    });
  }

  try {
    /*
     * The client secret endpoint has moved between SDK versions, so it is
     * reached through a narrow typed shim rather than pinned to one shape. A
     * failure degrades to the typed fallback.
     */
    const shim = client as unknown as {
      realtime?: { clientSecrets?: { create: (body: unknown) => Promise<unknown> } };
      beta?: { realtime?: { sessions: { create: (body: unknown) => Promise<unknown> } } };
    };

    let response: unknown;
    if (shim.realtime?.clientSecrets?.create) {
      response = await shim.realtime.clientSecrets.create({
        session: { type: "realtime", model: models.realtime },
      });
    } else if (shim.beta?.realtime?.sessions?.create) {
      response = await shim.beta.realtime.sessions.create({ model: models.realtime });
    } else {
      return NextResponse.json({
        available: false,
        reason:
          "This SDK build does not expose a realtime session endpoint. The typed fallback is used.",
      });
    }

    const payload = response as {
      value?: string;
      client_secret?: { value?: string };
      expires_at?: number;
    };
    const token = payload.value ?? payload.client_secret?.value ?? null;

    if (!token) {
      return NextResponse.json({
        available: false,
        reason: "No client token was returned. The typed fallback is used.",
      });
    }

    // Only the short lived token and the model name cross to the browser.
    return NextResponse.json(
      {
        available: true,
        clientSecret: token,
        model: models.realtime,
        expiresAt: payload.expires_at ?? null,
        note: "This is a short lived client token, not the account key.",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.warn("Minting a realtime client token failed.", { error });
    return NextResponse.json({
      available: false,
      reason: "A voice session could not be created. The typed fallback is used.",
    });
  }
}
