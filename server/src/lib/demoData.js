import { Interview } from '../models/Interview.js';
import { Resume } from '../models/Resume.js';
import { analyseResume } from './resumeParser.js';
import { SAMPLE_RESUME } from './sampleResume.js';
import { assembleReport } from './evaluate.js';


// Three finished example interviews for the shared demo account, so visitors immediately see a
// dashboard with history and a full report. Scores are computed by the same code as real reports.
// The most recent one is based on a real Gemini evaluation of these answers.
const EXAMPLES = [
  {
    daysAgo: 9,
    minutes: 11,
    role: 'Software Engineer Intern',
    type: 'behavioural',
    difficulty: 'easy',
    questions: [
      {
        category: 'behavioural',
        topic: 'Learning from failure',
        basedOn: 'Smart Attendance System project',
        text: 'Tell me about a project that didn’t go to plan. What happened, and what did you learn?',
        idealPoints: ['Sets up the situation briefly', 'Focuses on own actions and reasoning', 'Ends with a result and a lesson'],
        answer: 'In the attendance project our first demo failed because recognition was too slow in the classroom. We had only tested on a laptop with good lighting. After that I started testing in the real environment earlier.',
        scores: [7, 5, 7, 6],
        whatWorked: 'You picked a real failure and named the root cause — testing only in ideal conditions.',
        toImprove: 'Say what you personally did to fix it and the measurable result, so the story has a clear ending.',
        modelAnswer: 'In my Smart Attendance System, our first classroom demo failed: recognising a full class took over ten seconds because we’d only tested on a laptop in good light. I profiled the pipeline and found we were recomputing face embeddings every frame, so I precomputed them at enrolment and added a brightness check. Recognition dropped to under a second. The lesson I took is to test in the real environment early, and I now do a field test before every demo.',
      },
      {
        category: 'behavioural',
        topic: 'Handling disagreement',
        basedOn: 'Example Hackathon 2024',
        text: 'Describe a time you disagreed with a teammate about how to build something. How did you resolve it?',
        idealPoints: ['Explains both viewpoints fairly', 'Uses data or goals to decide', 'Shows a constructive outcome'],
        answer: 'At the hackathon my teammate wanted to use a new framework and I wanted to use what we knew. We argued a bit and then went with what we knew because of time.',
        scores: [6, 4, 6, 5],
        whatWorked: 'You chose a realistic situation and reached a sensible decision given the time limit.',
        toImprove: 'Explain how you reached agreement — the reasoning or data you used — and how the result turned out.',
        modelAnswer: 'At Example Hackathon my teammate wanted to try a new framework, while I preferred React, which we both knew. Instead of arguing, we listed what we had to ship in 24 hours and estimated the learning cost. We agreed to build the core in React and let him prototype one feature with the new tool. We finished on time and placed in the top 10, and he later used that prototype to convince our club to adopt it.',
      },
      {
        category: 'hr',
        topic: 'Strengths and growth',
        basedOn: 'General',
        text: 'What is your biggest strength, and one thing you are actively working to improve?',
        idealPoints: ['Gives an honest, specific answer', 'Connects it to the role', 'Shows a concrete plan'],
        answer: 'My strength is that I learn fast. My weakness is maybe that I take on too much work.',
        scores: [6, 3, 7, 5],
        whatWorked: 'Clear and honest, and both points are relevant to an internship.',
        toImprove: 'Back the strength with an example and describe what you’re doing about taking on too much.',
        modelAnswer: 'My biggest strength is learning quickly: during my fintech internship I hadn’t used Redis before, and within a week I’d added caching that cut search time from 900 to 180 milliseconds. Something I’m working on is saying yes to too much. I now break work into estimates before committing, and I flag early when a deadline looks risky.',
      },
    ],
    overall: {
      headline: 'You pick genuine, relevant stories from your own experience.',
      summary: 'Your examples are real and on-topic, but most answers stop before the result. Practise the STAR structure so every story ends with what you did and what changed.',
      strengths: ['Honest, relevant examples', 'Clear, simple language', 'Good self-awareness about what went wrong'],
      improvements: ['End each story with a measurable result', 'Explain your own actions, not just the team’s', 'Give an example to back up every claim'],
    },
  },
  {
    daysAgo: 4,
    minutes: 16,
    role: 'Backend Developer Intern',
    type: 'technical',
    difficulty: 'medium',
    questions: [
      {
        category: 'technical',
        topic: 'REST vs GraphQL',
        basedOn: 'Skills: REST APIs',
        text: 'Explain the difference between REST and GraphQL. When would you choose each?',
        idealPoints: ['Accurate comparison', 'Concrete example of over- or under-fetching', 'Mentions caching or tooling trade-offs'],
        answer: 'REST exposes resources at fixed endpoints and GraphQL has one endpoint where the client asks for exactly the fields it needs. For a mobile app with many screens GraphQL avoids over-fetching. For simple CRUD like my marketplace I would use REST because it is simpler and works with HTTP caching.',
        scores: [9, 7, 8, 8],
        whatWorked: 'Accurate comparison with a sensible example of when each fits.',
        toImprove: 'Mention a GraphQL downside such as harder caching or rate limiting to show you weigh trade-offs.',
        modelAnswer: 'REST maps resources to URLs and HTTP verbs, so it’s simple and works naturally with HTTP caching. GraphQL exposes one endpoint where clients ask for exactly the fields they need, which helps when many clients need different shapes of data, at the cost of harder caching and query-cost limiting. For my Campus Marketplace, a REST API was the right call: the screens were simple and caching listings mattered.',
      },
      {
        category: 'technical',
        topic: 'Database indexes',
        basedOn: 'Skills: MongoDB, PostgreSQL',
        text: 'What is a database index, and when can adding one hurt performance?',
        idealPoints: ['Clear definition', 'Explains write cost', 'Mentions choosing fields by query patterns'],
        answer: 'An index is like a sorted lookup that lets the database find rows without scanning the whole table. It can hurt because every insert or update also has to update the index, so too many indexes slow down writes.',
        scores: [9, 7, 9, 8],
        whatWorked: 'A clear definition and you correctly named the write cost.',
        toImprove: 'Add how you decide what to index — for example, from slow queries or the fields you filter and sort on.',
        modelAnswer: 'An index is an extra data structure, usually a B-tree, that lets the database find rows by a key without scanning the table. Every write must also update each index, so too many indexes slow inserts and use more storage. I index based on real query patterns: in the attendance system I indexed student ID and date because every report filtered on them.',
      },
      {
        category: 'technical',
        topic: 'Debugging a slow endpoint',
        basedOn: 'Software Engineering Intern, Example Fintech',
        text: 'An endpoint you own suddenly becomes slow in production. How would you find and fix the cause?',
        idealPoints: ['Measures before guessing', 'Checks recent changes and the database', 'Verifies the fix with data'],
        answer: 'I would look at the logs and see what changed recently. Then I would check the database queries and maybe add caching.',
        scores: [7, 4, 7, 5],
        whatWorked: 'Checking recent changes and the database is the right instinct.',
        toImprove: 'Be more methodical: measure where the time goes, form a hypothesis, then confirm the fix with metrics.',
        modelAnswer: 'First I’d confirm the problem with metrics — which percentile got slower and when — and check deploys or traffic changes at that time. Then I’d trace a slow request to see whether time goes to the database, an external call or the code. If it’s a query, I’d run EXPLAIN to look for a missing index or a full scan. After fixing it I’d watch p95 latency to confirm, and add an alert so it’s caught sooner next time.',
      },
      {
        category: 'technical',
        topic: 'Testing in CI',
        basedOn: 'Software Engineering Intern, Example Fintech',
        text: 'You set up integration tests in GitHub Actions. How did you keep them reliable and fast?',
        idealPoints: ['Isolated test data', 'Parallelism or caching', 'Handles flaky tests'],
        answer: 'Each test run used a fresh test database in Docker so tests did not affect each other, and we cached node modules in Actions. That kept the pipeline around four minutes.',
        scores: [8, 6, 8, 7],
        whatWorked: 'Good, concrete detail: isolated databases, dependency caching and a real number.',
        toImprove: 'Say how you handled flaky tests or seeded test data to show deeper ownership.',
        modelAnswer: 'Each run started a fresh PostgreSQL container, so tests never shared state, and each test seeded only the data it needed and cleaned up after itself. We cached node_modules and ran test files in parallel, which kept the pipeline around four minutes. When a test was flaky I fixed the root cause — usually timing assumptions — rather than adding retries.',
      },
    ],
    overall: {
      headline: 'Your technical fundamentals are solid and clearly explained.',
      summary: 'You explain concepts accurately and use your own projects as examples. To move from good to excellent, add trade-offs and a more methodical approach to open-ended debugging questions.',
      strengths: ['Accurate CS fundamentals', 'Relevant examples from your projects', 'Concise, well-organised answers'],
      improvements: ['Name a trade-off for every design choice', 'Use a step-by-step approach for debugging questions', 'Back up results with metrics'],
    },
  },
  {
    daysAgo: 1,
    minutes: 21,
    role: 'Backend Developer Intern',
    type: 'mixed',
    difficulty: 'medium',
    questions: [
      {
        category: 'hr',
        topic: 'Motivation for backend',
        basedOn: 'General',
        text: 'To start off, could you share a bit about your background and why you’re looking for a backend engineering internship?',
        idealPoints: ['Brief, relevant background', 'Specific reason for backend', 'What they hope to learn'],
        answer: 'I’m a final-year computer science student and most of my best work has been on the backend: during my internship at a fintech I built REST APIs in Node.js and Express and added Redis caching that cut search latency from 900 to 180 milliseconds. I enjoy backend work because performance and reliability are measurable. In this internship I want to learn how a production team handles scale, monitoring and code review.',
        scores: [10, 8, 10, 9],
        whatWorked: 'A focused introduction with a concrete achievement and a clear reason for choosing backend.',
        toImprove: 'You could briefly mention how projects like Campus Marketplace reinforced your interest.',
        modelAnswer: 'I’m a final-year CS student who enjoys making systems fast and reliable. At Example Fintech I built REST APIs in Node.js and added Redis caching that cut search latency from 900 to 180 milliseconds, and in my Campus Marketplace project I built real-time chat with Socket.io. I like that backend work is measurable. Here I want to learn how a production team handles scale, monitoring and code review.',
      },
      {
        category: 'technical',
        topic: 'Cache invalidation',
        basedOn: 'Software Engineering Intern, Example Fintech',
        text: 'You used Redis to bring search times down to 180 ms. How did you design cache invalidation so users never saw stale transactions?',
        idealPoints: ['Explains the caching pattern', 'Invalidation on write', 'Consistency trade-off'],
        answer: 'I used a cache-aside pattern. Search results were cached under a key with the account ID and a hash of the filters, with a five-minute TTL as a safety net. When a transaction was created or updated, the service deleted every cached search key for that account, so the next search rebuilt from PostgreSQL. I deleted keys after the database commit to avoid a race, and integration tests checked a new transaction appeared in the very next search.',
        scores: [10, 10, 10, 9],
        whatWorked: 'Excellent: the pattern, key design, invalidation timing and how you tested it.',
        toImprove: 'Mention how you’d handle Redis being unavailable or a cache stampede under load.',
        modelAnswer: 'I used cache-aside: results were cached under the account ID plus a hash of the filters, with a short TTL as a safety net. On every write I deleted that account’s search keys after the database commit, so a racing read couldn’t repopulate stale data. If Redis was down, the service fell back to PostgreSQL, and integration tests checked that new transactions appeared immediately.',
      },
      {
        category: 'technical',
        topic: 'MongoDB vs PostgreSQL',
        basedOn: 'Campus Marketplace project',
        text: 'For Campus Marketplace you chose MongoDB. What trade-offs did you weigh against a relational database?',
        idealPoints: ['Data shape fits the choice', 'Acknowledges what is lost', 'Knows when the other is better'],
        answer: 'Listings had very different attributes per category, so a flexible document model fit better than many nullable columns, and chat messages were append-only and always read by conversation. The trade-off was weaker guarantees for relational data like orders, so I kept those writes small and validated references in the app. If we needed complex reporting, PostgreSQL would be better.',
        scores: [10, 9, 10, 9],
        whatWorked: 'You tied the choice to the actual data shape and were honest about what you gave up.',
        toImprove: 'You could add how you indexed messages by conversation and time for the chat.',
        modelAnswer: 'Listings varied a lot by category, so documents avoided dozens of nullable columns, and chat messages were append-only and always read per conversation, which suits a collection indexed on conversation ID and timestamp. I gave up easy multi-document transactions for things like orders, so I kept those writes small and validated references in code. For heavy reporting I’d choose PostgreSQL.',
      },
      {
        category: 'behavioural',
        topic: 'Performance bottleneck',
        basedOn: 'Smart Attendance System project',
        text: 'Did you hit any unexpected performance bottlenecks in the Smart Attendance System, and how did you resolve them?',
        idealPoints: ['Describes the situation (STAR)', 'Explains the investigation', 'Gives the measurable result'],
        answer: 'Yes, the first version was slow. Recognising faces for a whole class took around ten seconds, so I started computing the face embeddings once when students enrolled instead of every time. That made it much faster, under a second.',
        scores: [8, 5, 8, 5],
        whatWorked: 'You clearly identified the bottleneck and explained the precomputation fix.',
        toImprove: 'Structure it with STAR: set the classroom context, describe how you investigated, and give the full result.',
        modelAnswer: 'In early classroom tests, recognising a full class took over ten seconds, which made roll call slower than doing it by hand. I profiled the pipeline and found we recomputed every student’s face embedding on each frame. I moved that to enrolment, stored the embeddings, and only compared against them at recognition time. Recognition dropped to under a second and roll call went from ten minutes to under one.',
      },
      {
        category: 'technical',
        topic: 'Greedy settlement',
        basedOn: 'Expense Splitter project',
        text: 'How does your Expense Splitter’s greedy settlement algorithm work, and what are its limitations?',
        idealPoints: ['Explains net balances and matching', 'Complexity', 'Not always optimal'],
        answer: 'It computes each person’s net balance, then repeatedly matches the person who owes the most with the person who is owed the most and settles the smaller amount. With two heaps that is O(n log n) and needs at most n minus one payments. It is not always optimal: the true minimum is NP-hard because it involves finding groups whose balances cancel exactly.',
        scores: [10, 10, 9, 9],
        whatWorked: 'A precise explanation with complexity and a correct, well-reasoned limitation.',
        toImprove: 'Briefly walk through a tiny example to make the steps even easier to follow.',
        modelAnswer: 'First I compute each person’s net balance — what they paid minus their share. Then, using a max-heap of creditors and one of debtors, I repeatedly settle the largest debt against the largest credit. That runs in O(n log n) and needs at most n − 1 payments. It isn’t always optimal: the true minimum requires finding subsets whose balances cancel exactly, which is NP-hard, so greedy can add a payment or two.',
      },
    ],
    overall: {
      headline: 'Strong technical depth and impressive clarity on architectural trade-offs.',
      summary: 'You showed high technical competence across caching, database choices and algorithms. The main area for growth is giving behavioural answers full context with the STAR structure.',
      strengths: ['In-depth understanding of caching and invalidation', 'Clear reasoning about database trade-offs', 'Precise algorithm explanations with complexity'],
      improvements: ['Use STAR for behavioural and troubleshooting stories', 'Mention failure modes like a cache going down', 'Give the full numerical result of each fix'],
    },
  },
];

/** Gives the shared demo account its example interviews if it has no finished ones. */
export async function ensureDemoContent(user, now = new Date()) {
  if (await Interview.exists({ user: user._id, status: 'completed' })) return;

  let resume = await Resume.findOne({ user: user._id, fileType: 'sample' });
  if (!resume) {
    resume = await Resume.create({ user: user._id, ...SAMPLE_RESUME, fileType: 'sample', fileSize: 0, ...analyseResume(SAMPLE_RESUME.text) });
  }

  for (const example of EXAMPLES) {
    const completedAt = new Date(now.getTime() - example.daysAgo * 24 * 60 * 60 * 1000);
    const startedAt = new Date(completedAt.getTime() - example.minutes * 60 * 1000);
    const interview = new Interview({
      user: user._id,
      resume: resume._id,
      resumeTitle: resume.title,
      role: example.role,
      type: example.type,
      difficulty: example.difficulty,
      generatedBy: 'demo',
      status: 'completed',
      createdAt: new Date(startedAt.getTime() - 60 * 1000),
      startedAt,
      completedAt,
      questions: example.questions.map((q, i) => ({
        order: i + 1,
        text: q.text,
        category: q.category,
        topic: q.topic,
        basedOn: q.basedOn,
        idealPoints: q.idealPoints,
        answer: { skipped: false, transcript: q.answer, transcriptSource: 'gemini', durationSec: 40 + i * 9, recordedAt: startedAt, confirmedAt: startedAt },
      })),
    });

    const perQuestion = example.questions.map((q, i) => ({
      index: i + 1,
      relevance: q.scores[0],
      depth: q.scores[1],
      clarity: q.scores[2],
      structure: q.scores[3],
      whatWorked: q.whatWorked,
      toImprove: q.toImprove,
      modelAnswer: q.modelAnswer,
    }));
    const { evaluations, report } = assembleReport(interview, perQuestion, example.overall, 'demo');
    interview.questions.forEach((q, i) => {
      q.evaluation = evaluations.get(i + 1);
    });
    interview.report = { ...report, requestedAt: completedAt, evaluatedAt: completedAt };
    await interview.save({ timestamps: false });
  }
}

