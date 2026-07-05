import { useState } from "react";

export function SuggestShelter() {
  const [form, setForm] = useState({ name: "", city: "", voivodeship: "", website_url: "", submitter_email: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/suggest-shelter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("sent");
      setForm({ name: "", city: "", voivodeship: "", website_url: "", submitter_email: "" });
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-display font-bold mb-2">Thank you!</h2>
        <p className="text-gray-500">Your shelter suggestion has been submitted for review.</p>
        <button onClick={() => setStatus("idle")} className="mt-6 text-primary-600 hover:text-primary-700 font-medium">
          Submit another →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold mb-2">Suggest a Shelter</h1>
      <p className="text-gray-500 text-sm mb-6">
        Know a shelter that should be in our database? Let us know and we'll add it.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shelter name *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
          <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Voivodeship</label>
          <input value={form.voivodeship} onChange={(e) => setForm({ ...form, voivodeship: e.target.value })}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website URL (cats page)</label>
          <input type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            placeholder="https://..."
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your email (optional)</label>
          <input type="email" value={form.submitter_email} onChange={(e) => setForm({ ...form, submitter_email: e.target.value })}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : "Submit suggestion"}
        </button>
        {status === "error" && <p className="text-red-500 text-sm">Something went wrong. Please try again.</p>}
      </form>
    </div>
  );
}
