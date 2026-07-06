interface Achievement {
  name: string;
  description: string;
  icon: string;
  unlocked_at: string;
}

interface AchievementBadgesProps {
  achievements: Achievement[];
}

export function AchievementBadges({ achievements }: AchievementBadgesProps) {
  if (!achievements || achievements.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-display font-bold text-center mb-8">
          Odznaki Dominacji
        </h2>
        <div className="flex flex-wrap gap-4 justify-center">
          {achievements.map((achievement) => (
            <div
              key={achievement.name}
              className="flex items-center gap-2 bg-white rounded-2xl px-5 py-3 shadow-sm"
            >
              <span className="text-2xl">{achievement.icon}</span>
              <span className="font-semibold text-cat-dark">{achievement.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
