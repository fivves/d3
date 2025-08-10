import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.motivationQuote.count();
  if (count > 0) {
    console.log('Quotes already seeded. Skipping.');
    return;
  }
  const quotes = [
    { text: 'Discomfort is the price of admission to a meaningful life.', author: 'Susan David', source: 'Emotional Agility' },
    { text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', author: 'Will Durant', source: 'The Story of Philosophy' },
    { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear', source: 'Atomic Habits' },
    { text: 'Mood follows action.', author: 'Rich Roll', source: 'Podcast' },
    { text: 'The only way out is through.', author: 'Robert Frost' },
    { text: 'Tiny gains, remarkable results.', author: 'James Clear', source: 'Atomic Habits' },
    { text: 'Discipline equals freedom.', author: 'Jocko Willink' },
    { text: 'What you practice grows stronger.', author: 'Shauna Shapiro' },
    { text: 'Cravings are waves—learn to surf them.', author: 'Adapted from Urge Surfing' },
    { text: 'Action is the antidote to anxiety.', author: 'Naval Ravikant' }
  ];
  await prisma.motivationQuote.createMany({ data: quotes });
  console.log('Seeded motivation quotes.');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });


