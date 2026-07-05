import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";

// Server now reads from JSON files — these tests verify API behavior
describe("API smoke tests", () => {
  const { app } = createApp();

  it("GET /api/shelters returns array", async () => {
    const res = await request(app).get("/api/shelters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/cats returns paginated response", async () => {
    const res = await request(app).get("/api/cats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("cats");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.cats)).toBe(true);
  });

  it("GET /api/cats with search filters results", async () => {
    const res = await request(app).get("/api/cats?search=test");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("cats");
  });

  it("GET /api/stats returns stats object", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalCats");
    expect(res.body).toHaveProperty("totalShelters");
  });

  it("GET /api/cat-of-the-day returns a cat or null", async () => {
    const res = await request(app).get("/api/cat-of-the-day");
    expect(res.status).toBe(200);
  });

  it("GET /api/shelters/:id/cats returns 400 for invalid ID", async () => {
    const res = await request(app).get("/api/shelters/abc/cats");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid shelter ID");
  });

  it("GET /api/shelters/:id/cats returns 404 for non-existent ID", async () => {
    const res = await request(app).get("/api/shelters/9999999/cats");
    expect(res.status).toBe(404);
  });

  it("POST /api/admin/login returns 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ password: "wrong" });
    expect(res.status).toBe(401);
  });
});
