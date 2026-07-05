export function Volunteer() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-bold text-center mb-2">Volunteer at a Shelter 🙋</h1>
      <p className="text-center text-gray-500 mb-10">Make a real difference in animals' lives — no experience needed</p>

      <div className="space-y-8">
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-cat-sand">
          <h2 className="text-xl font-display font-bold mb-3">What do volunteers do?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="flex gap-2"><span>🐱</span><p><strong>Socialize cats</strong> — sit with them, pet them, play. Helps shy cats become adoptable.</p></div>
            <div className="flex gap-2"><span>📸</span><p><strong>Photography</strong> — good photos dramatically increase adoption chances.</p></div>
            <div className="flex gap-2"><span>🧹</span><p><strong>Cleaning</strong> — enclosures, litter boxes, feeding areas.</p></div>
            <div className="flex gap-2"><span>🚗</span><p><strong>Transport</strong> — drive animals to vet appointments or foster homes.</p></div>
            <div className="flex gap-2"><span>🏠</span><p><strong>Foster care</strong> — temporarily house a cat until it finds a permanent home.</p></div>
            <div className="flex gap-2"><span>📋</span><p><strong>Admin help</strong> — answer phones, process paperwork, update social media.</p></div>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-cat-sand">
          <h2 className="text-xl font-display font-bold mb-3">How to get started</h2>
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600">
            <li><strong>Find your local shelter</strong> — use our map to locate the nearest one.</li>
            <li><strong>Call or visit</strong> — ask about their volunteer program. Most accept walk-ins.</li>
            <li><strong>Fill out an application</strong> — basic info, availability, interests.</li>
            <li><strong>Attend orientation</strong> — usually 1-2 hours, covers safety and procedures.</li>
            <li><strong>Start helping!</strong> — most shelters let you begin the same week.</li>
          </ol>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-cat-sand">
          <h2 className="text-xl font-display font-bold mb-3">Who can volunteer?</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✅ Anyone 16+ (some shelters accept younger with a parent)</li>
            <li>✅ No experience required — training provided</li>
            <li>✅ Any amount of time helps — even 2 hours a week makes a difference</li>
            <li>✅ Students looking for community service hours</li>
            <li>✅ Remote volunteers (social media, fundraising, graphic design)</li>
          </ul>
        </section>

        <section className="bg-primary-50 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-display font-bold mb-2">Can't volunteer in person?</h2>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto">
            You can still help remotely — share adoption posts on social media, donate supplies from wishlists,
            sponsor a cat's medical treatment, or help shelters with their websites and marketing materials.
          </p>
        </section>
      </div>
    </div>
  );
}
