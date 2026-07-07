import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";

const { app } = createApp();

describe("API integration", () => {
  it("pagination works correctly", async () => {
    const res = await request(app).get("/api/cats?page=1&limit=5");
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.cats.length).toBeLessThanOrEqual(5);
  });

  it("voivodeship filter works", async () => {
    const res = await request(app).get("/api/cats?voivodeship=mazowieckie");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("cats");
  });

  it("suggest shelter endpoint works", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({ name: "Test Shelter", city: "Test City" });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("submitted");
  });

  it("suggest shelter requires name and city", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("suggest shelter rejects javascript: URLs", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({ 
        name: "Test Shelter", 
        city: "Test City",
        website_url: "javascript:alert('XSS')"
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid URL scheme");
  });

  it("suggest shelter accepts valid http URLs", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({ 
        name: "Test Shelter", 
        city: "Test City",
        website_url: "http://example.com"
      });
    expect(res.status).toBe(200);
  });

  it("suggest shelter accepts valid https URLs", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({ 
        name: "Test Shelter", 
        city: "Test City",
        website_url: "https://example.com"
      });
    expect(res.status).toBe(200);
  });
});
