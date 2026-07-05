import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";

const { app } = createApp();

describe("Security headers", () => {
  it("includes security headers from helmet", async () => {
    const res = await request(app).get("/api/shelters");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("includes content-security-policy", async () => {
    const res = await request(app).get("/api/shelters");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("Input validation", () => {
  it("returns 400 for non-integer shelter ID", async () => {
    const res = await request(app).get("/api/shelters/abc/cats");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid shelter ID");
  });

  it("returns 400 for zero shelter ID", async () => {
    const res = await request(app).get("/api/shelters/0/cats");
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative shelter ID", async () => {
    const res = await request(app).get("/api/shelters/-1/cats");
    expect(res.status).toBe(400);
  });
});

describe("CORS", () => {
  it("allows requests from configured origin", async () => {
    const res = await request(app)
      .get("/api/shelters")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});
