/**
 * Demo data for development. Everything goes through the services, so cached
 * progress, ranks, carry counts and ActivityEvents are exactly what real use
 * would produce. Dates are relative to the demo user's "today".
 *
 * Re-runnable: it deletes the demo user (and, by cascade, all of their rows)
 * before seeding again. It never touches any other user.
 */
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { addDays, getLocalToday, type LocalDate } from "@/lib/domain/dates";
import type { MentionTargetType } from "@/lib/domain/mentions";
import { createGoal, createMilestone } from "@/services/goals";
import { saveJournalEntry } from "@/services/journal";
import { carryOverTasks, completeTask, createTask, type TaskLink } from "@/services/tasks";

export type SeedOptions = {
  email?: string;
  /** Supabase auth.users.id to attach the demo data to. */
  authId?: string;
  timezone?: string;
  /** Display name for the recreated user row. Default "Demo". */
  name?: string;
  /** The moment to treat as "now". */
  now?: Date;
};

export type SeedSummary = {
  userId: string;
  email: string;
  today: LocalDate;
  goals: number;
  milestones: number;
  tasks: number;
  doneTasks: number;
  carriedTasks: number;
  journalEntries: number;
  journalLinks: number;
  events: number;
};

export const DEMO_EMAIL = "demo@planner.local";
export const DEMO_AUTH_ID = "00000000-0000-4000-8000-00000000d3e0";

type TaskSpec = {
  title: string;
  day: number;
  link?: TaskLink;
  km?: number;
  books?: number;
  startMin?: number;
  durationMin?: number;
  topThree?: boolean;
  done?: boolean;
  /** Carry forward one day at a time, this many times, before finishing or leaving it. */
  carries?: number;
};

export async function seedDemo(options: SeedOptions = {}): Promise<SeedSummary> {
  const email = options.email ?? DEMO_EMAIL;
  const timezone = options.timezone ?? "America/New_York";
  const now = options.now ?? new Date();

  await prisma.user.deleteMany({ where: { email } });
  // Creating the User row directly is allowed: it's what sign-up will do.
  const user = await prisma.user.create({
    data: { email, authId: options.authId ?? DEMO_AUTH_ID, name: options.name ?? "Demo", timezone, dayStartsAt: 240 },
  });
  const userId = user.id;
  const today = getLocalToday(user, now);
  const day = (offset: number) => addDays(today, offset);
  /** A local wall-clock time on a relative day, as a real instant. */
  const at = (offset: number, hour: number, minute = 0) =>
    fromZonedTime(`${day(offset)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`, timezone);

  // ---------------------------------------------------------------- goals
  const marathon = await createGoal(userId, {
    title: "Run a sub-4 marathon",
    why: "Prove I can train consistently for six months.",
    progressMode: "METRIC",
    metricUnit: "km",
    metricTarget: 500,
    startDate: day(-30),
    targetDate: day(150),
  });
  const portfolio = await createGoal(userId, {
    title: "Launch portfolio site",
    why: "Have one link that shows my product and design work.",
    progressMode: "MILESTONES",
    startDate: day(-14),
    targetDate: day(30),
  });
  const reading = await createGoal(userId, {
    title: "Read 12 books",
    why: "Read more than I scroll.",
    progressMode: "METRIC",
    metricUnit: "books",
    metricTarget: 12,
    startDate: day(-60),
    targetDate: day(300),
  });

  // ----------------------------------------------------------- milestones
  const base = await createMilestone(userId, marathon.id, { title: "Build base to 40 km a week", weight: 1, targetDate: day(21) });
  const half = await createMilestone(userId, marathon.id, { title: "Run a half marathon", weight: 2, targetDate: day(60) });
  const longRun = await createMilestone(userId, marathon.id, { title: "Complete a 32 km long run", weight: 3, targetDate: day(120) });
  const design = await createMilestone(userId, portfolio.id, { title: "Pick stack and design", weight: 1, targetDate: day(-3) });
  const caseStudies = await createMilestone(userId, portfolio.id, { title: "Build case study pages", weight: 2, targetDate: day(10) });
  const about = await createMilestone(userId, portfolio.id, { title: "Write the about page", weight: 1, targetDate: day(14) });
  const launch = await createMilestone(userId, portfolio.id, { title: "Launch on a custom domain", weight: 2, targetDate: day(30) });
  const quarter = await createMilestone(userId, reading.id, { title: "Finish 3 books this quarter", weight: 1, targetDate: day(45) });

  const toBase = { milestoneId: base.id };
  const toHalf = { milestoneId: half.id };
  const toLong = { milestoneId: longRun.id };
  const toQuarter = { milestoneId: quarter.id };

  // ---------------------------------------------------------------- tasks
  const specs: TaskSpec[] = [
    // Marathon (13)
    { title: "Easy run 8 km", day: -7, link: toBase, km: 8, startMin: 390, durationMin: 50, done: true },
    { title: "Tempo run 10 km", day: -6, link: toBase, km: 10, startMin: 390, durationMin: 60, done: true },
    { title: "Strength: legs and core", day: -5, link: toBase, startMin: 1080, durationMin: 45, done: true },
    { title: "Easy run 6 km", day: -4, link: toBase, km: 6, startMin: 390, durationMin: 40, done: true },
    { title: "Long run 16 km", day: -3, link: toBase, km: 16, startMin: 420, durationMin: 100, done: true },
    { title: "Intervals 6 x 800 m", day: -2, link: toBase, km: 9, startMin: 390, durationMin: 60, carries: 1, done: true },
    { title: "Recovery run 5 km", day: -1, link: toBase, km: 5, startMin: 390, durationMin: 35, done: true },
    { title: "Easy run 8 km", day: 0, link: toBase, km: 8, startMin: 390, durationMin: 50, topThree: true },
    { title: "Strength: legs and core", day: 1, link: toBase, startMin: 1080, durationMin: 45 },
    { title: "Tempo run 12 km", day: 2, link: toBase, km: 12, startMin: 390, durationMin: 70 },
    { title: "Long run 18 km", day: 4, link: toHalf, km: 18, startMin: 420, durationMin: 110 },
    { title: "Easy run 8 km", day: 6, link: toBase, km: 8, startMin: 390, durationMin: 50 },
    { title: "Long run 20 km", day: 7, link: toLong, km: 20, startMin: 420, durationMin: 125 },
    // Portfolio (12)
    { title: "Choose a Next.js template", day: -7, link: { milestoneId: design.id }, done: true },
    { title: "Sketch the homepage wireframe", day: -6, link: { milestoneId: design.id }, startMin: 1200, durationMin: 60, done: true },
    { title: "Pick the color palette and type", day: -5, link: { milestoneId: design.id }, done: true },
    { title: "Draft case study: card valuation models", day: -4, link: { milestoneId: caseStudies.id }, startMin: 1170, durationMin: 90, done: true },
    { title: "Draft case study: BaseCamp", day: -3, link: { milestoneId: caseStudies.id }, durationMin: 90, carries: 3, topThree: true },
    { title: "Collect screenshots for case studies", day: -2, link: { milestoneId: caseStudies.id }, done: true },
    { title: "Write the about page first draft", day: -1, link: { milestoneId: about.id }, durationMin: 60, carries: 1 },
    { title: "Set up the Vercel project", day: 0, link: { milestoneId: launch.id }, startMin: 1140, durationMin: 45 },
    { title: "Edit case study copy", day: 1, link: { milestoneId: caseStudies.id }, startMin: 1170, durationMin: 60 },
    { title: "Buy the domain and connect DNS", day: 3, link: { milestoneId: launch.id }, durationMin: 30 },
    { title: "Ask two friends for feedback", day: 5, link: { milestoneId: launch.id }, durationMin: 15 },
    { title: "Launch and share the site", day: 7, link: { milestoneId: launch.id }, durationMin: 30 },
    // Reading (8)
    { title: "Read 30 pages", day: -7, link: toQuarter, startMin: 1290, durationMin: 30, done: true },
    { title: "Read 30 pages", day: -5, link: toQuarter, startMin: 1290, durationMin: 30, done: true },
    { title: "Finish Project Hail Mary", day: -4, link: toQuarter, books: 1, startMin: 1260, durationMin: 60, done: true },
    { title: "Read 30 pages", day: -2, link: toQuarter, startMin: 1290, durationMin: 30 },
    { title: "Read 30 pages", day: -1, link: toQuarter, startMin: 1290, durationMin: 30, done: true },
    { title: "Read 30 pages", day: 0, link: toQuarter, startMin: 1290, durationMin: 30, topThree: true },
    { title: "Start The Pragmatic Programmer", day: 2, link: toQuarter, durationMin: 30 },
    { title: "Finish Atomic Habits", day: 6, link: toQuarter, books: 1, durationMin: 45 },
    // Loose (7)
    { title: "Dentist appointment", day: -6, startMin: 540, durationMin: 60, done: true },
    { title: "Groceries", day: -3, durationMin: 45, done: true },
    { title: "Call Mom", day: -1, durationMin: 20 },
    { title: "Laundry", day: 0, durationMin: 30 },
    { title: "Get passport photos taken", day: 1, durationMin: 20 },
    { title: "Pay credit card bill", day: 3, durationMin: 10 },
    { title: "Haircut", day: 5, startMin: 1020, durationMin: 45 },
  ];

  const ids = new Map<string, string>();
  let doneTasks = 0;
  let carriedTasks = 0;

  for (const spec of specs) {
    const task = await createTask(userId, {
      title: spec.title,
      link: spec.link ?? null,
      scheduledDate: day(spec.day),
      startMin: spec.startMin ?? null,
      durationMin: spec.durationMin ?? 30,
      contribution: spec.km ?? spec.books ?? null,
      isTopThree: spec.topThree ?? false,
    });
    ids.set(`${spec.title}@${spec.day}`, task.id);

    let current = spec.day;
    for (let i = 0; i < (spec.carries ?? 0); i++) {
      await carryOverTasks(userId, day(current), day(current + 1), [task.id], { now: at(current + 1, 7, 30) });
      current += 1;
    }
    if (spec.carries) carriedTasks += 1;

    if (spec.done) {
      await completeTask(userId, task.id, { now: at(current, spec.startMin ? 23 : 20, 0) });
      doneTasks += 1;
    }
  }

  const task = (title: string, dayOffset: number) => {
    const id = ids.get(`${title}@${dayOffset}`);
    if (id === undefined) throw new Error(`Seed bug: no task "${title}" on day ${dayOffset}`);
    return id;
  };

  // --------------------------------------------------------------- journal
  let blockCounter = 0;
  const blockId = () => `seed-block-${++blockCounter}`;
  const text = (value: string) => ({ type: "text", text: value });
  const mention = (targetType: MentionTargetType, id: string, label: string) => ({
    type: "mention",
    attrs: { id, label, targetType },
  });
  const p = (...content: object[]) => ({ type: "paragraph", attrs: { id: blockId() }, content });
  const h = (title: string) => ({ type: "heading", attrs: { id: blockId(), level: 3 }, content: [text(title)] });
  const bullets = (...items: object[][]) => ({
    type: "bulletList",
    content: items.map((content) => ({ type: "listItem", attrs: { id: blockId() }, content: [p(...content)] })),
  });

  const M = mention("GOAL", marathon.id, "Run a sub-4 marathon");
  const P = mention("GOAL", portfolio.id, "Launch portfolio site");
  const R = mention("GOAL", reading.id, "Read 12 books");

  const entries: { day: number; mood: number; intention: string; content: object[] }[] = [
    {
      day: -9,
      mood: 3,
      intention: "Lay out the running plan for the next block",
      content: [h("Reflection"), p(text("Signed up for the spring race. "), M, text(" is officially on the calendar."))],
    },
    {
      day: -8,
      mood: 4,
      intention: "Pick a portfolio template",
      content: [p(text("Started thinking about "), P, text(". The hard part is deciding what to leave out."))],
    },
    {
      day: -7,
      mood: 4,
      intention: "Sketch the homepage before work",
      content: [
        p(text("Easy run felt smooth. "), mention("TASK", task("Easy run 8 km", -7), "Easy run 8 km"), text(" done before 7.")),
        p(text("Template chosen for "), mention("MILESTONE", design.id, "Pick stack and design"), text(".")),
      ],
    },
    {
      day: -6,
      mood: 5,
      intention: "Choose colors and type",
      content: [
        h("Wins"),
        bullets(
          [mention("TASK", task("Tempo run 10 km", -6), "Tempo run 10 km"), text(" at goal pace")],
          [text("Wireframe for "), P, text(" is done")],
        ),
      ],
    },
    {
      day: -5,
      mood: 3,
      intention: "Start the first case study",
      content: [p(text("Legs heavy after strength. Still on track for "), mention("MILESTONE", base.id, "Build base to 40 km a week"), text("."))],
    },
    {
      day: -4,
      mood: 5,
      intention: "Long run tomorrow morning, early night",
      content: [
        p(text("Finished "), mention("TASK", task("Finish Project Hail Mary", -4), "Finish Project Hail Mary"), text(". One down for "), R, text(".")),
        p(text("First case study draft written for "), mention("MILESTONE", caseStudies.id, "Build case study pages"), text(".")),
      ],
    },
    {
      day: -3,
      mood: 4,
      intention: "Write the BaseCamp case study",
      content: [
        p(text("16 km long run done. "), M, text(" feels real now.")),
        p(text("Did not get to "), mention("TASK", task("Draft case study: BaseCamp", -3), "Draft case study: BaseCamp"), text(". Carrying it.")),
      ],
    },
    {
      day: -2,
      mood: 2,
      intention: "Intervals first thing, no excuses",
      content: [
        h("What got in the way"),
        p(text("Late meeting ate the evening. Skipped intervals and reading. "), mention("TASK", task("Intervals 6 x 800 m", -2), "Intervals 6 x 800 m"), text(" moves to tomorrow.")),
      ],
    },
    {
      day: -1,
      mood: 3,
      intention: "Break the BaseCamp case study into smaller pieces",
      content: [
        p(text("Intervals done a day late. Recovery run too.")),
        p(text("The BaseCamp case study has slipped three times. Need to split it before it stalls "), P, text(".")),
      ],
    },
    {
      day: 0,
      mood: 4,
      intention: "Outline the about page",
      content: [
        h("Today"),
        bullets(
          [text("Easy run for "), M],
          [text("Set up hosting for "), mention("MILESTONE", launch.id, "Launch on a custom domain")],
          [text("30 pages toward "), R],
        ),
      ],
    },
  ];

  for (const entry of entries) {
    await saveJournalEntry(userId, day(entry.day), {
      version: 0,
      content: { type: "doc", content: entry.content },
      intention: entry.intention,
      mood: entry.mood,
    });
  }

  const [goals, milestones, tasks, journalEntries, journalLinks, events] = [
    await prisma.goal.count({ where: { userId } }),
    await prisma.milestone.count({ where: { userId } }),
    await prisma.task.count({ where: { userId } }),
    await prisma.journalEntry.count({ where: { userId } }),
    await prisma.journalLink.count({ where: { entry: { userId } } }),
    await prisma.activityEvent.count({ where: { userId } }),
  ];

  return { userId, email, today, goals, milestones, tasks, doneTasks, carriedTasks, journalEntries, journalLinks, events };
}
