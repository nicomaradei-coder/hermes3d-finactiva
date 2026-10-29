// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/runtime/custom route", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("allows loopback and blocks other hosts in production when no allowlist is configured", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.CUSTOM_RUNTIME_ALLOWLIST;
    delete process.env.UPSTREAM_ALLOWLIST;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { POST } = await import("@/app/api/runtime/custom/route");
    const blocked = await POST(
      new Request("http://localhost/api/runtime/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeUrl: "http://example.com",
          pathname: "/health",
          method: "GET",
        }),
      })
    );
    expect(blocked.status).toBe(400);
    await expect(blocked.json()).resolves.toMatchObject({
      error: "runtimeUrl is not in the allowed hosts list.",
    });

    const lan = await POST(
      new Request("http://localhost/api/runtime/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeUrl: "http://10.1.1.5:7770",
          pathname: "/health",
          method: "GET",
        }),
      })
    );
    expect(lan.status).toBe(400);

    const allowed = await POST(
      new Request("http://localhost/api/runtime/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeUrl: "http://127.0.0.1:7770",
          pathname: "/health",
          method: "GET",
        }),
      })
    );
    expect(allowed.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:7770/health",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("allows only loopback in development unless a host is explicitly allowlisted", async () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    delete process.env.CUSTOM_RUNTIME_ALLOWLIST;
    delete process.env.UPSTREAM_ALLOWLIST;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    const { POST } = await import("@/app/api/runtime/custom/route");

    const post = (runtimeUrl: string) =>
      POST(
        new Request("http://localhost/api/runtime/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runtimeUrl, pathname: "/health", method: "GET" }),
        })
      );

    expect((await post("http://example.com/health")).status).toBe(400);
    expect((await post("http://10.1.1.5:7770")).status).toBe(400);
    expect((await post("http://127.0.0.1:7770")).status).toBe(200);
    expect((await post("http://localhost:7770")).status).toBe(200);
    expect((await post("http://[::1]:7770")).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    process.env.CUSTOM_RUNTIME_ALLOWLIST = "runtime.example.com";
    expect((await post("http://runtime.example.com")).status).toBe(200);
    expect((await post("http://other.example.com")).status).toBe(400);
    expect((await post("http://127.0.0.1:7770")).status).toBe(200);
  });

  it("allows only listed hosts when a custom runtime allowlist is configured", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      CUSTOM_RUNTIME_ALLOWLIST: "127.0.0.1",
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { POST } = await import("@/app/api/runtime/custom/route");
    const response = await POST(
      new Request("http://localhost/api/runtime/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runtimeUrl: "http://127.0.0.1:7770",
          pathname: "/health",
          method: "GET",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:7770/health",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("returns 400 for malformed JSON request bodies", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });

    const { POST } = await import("@/app/api/runtime/custom/route");
    const response = await POST(
      new Request("http://localhost/api/runtime/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad json",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid JSON request body.",
    });
  });
});
