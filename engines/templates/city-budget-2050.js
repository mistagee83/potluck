// Built-in template: The 2050 city budget (where maths turns into money).
// Source: the owner's teacher publication, January 2026 ("A jövő városának költségvetése"), translated and
// made international. Written by hand in the project skeleton, so it runs without any AI step.
// In the source, teams check their plan with an AI advisor and pitch to an AI "investor" outside Potluck;
// Potluck itself runs no AI during a project. Size decided by András (2026-11-21): 3 weeks, 6 lessons.

export const template = {
  slug: 'city-budget-2050',
  status: 'live',
  meta: {
    tags: ['maths', 'economics', 'languages', 'sustainability'],
    ageRange: [15, 18],
    durationHint: '3 weeks, 6 lessons',
  },
  skeleton: {
    schemaVersion: 1,
    basics: {
      title: 'The 2050 city budget',
      drivingQuestion: 'Can you convince a sceptical investor that your self-sufficient city of 2050 pays for itself?',
      summary: 'It is 2050 and climate change calls for new self-sufficient neighbourhoods. Teams are developers with an idea but no money. They plan the city, calculate area, building cost, running cost and payback on a loan, check the weak points with a SWOT analysis, and pitch the business plan in the target language to a sceptical investor.',
      brief: 'Your team develops a self-sufficient city for 1,000 people in 2050. You have a concept but no money. Plan the city, make the numbers add up, find the weak points before an investor does, and convince the investor that the city pays back a 10-billion loan.',
      product: {
        type: 'report',
        description: 'A business plan: a spreadsheet with the budget and payback calculation, a short PDF plan with a SWOT analysis, and a recording or screenshots of the investor pitch.',
      },
      audience: 'A sceptical international investor (played by the class or an AI chat outside Potluck), and the class on investor day.',
      subjects: [
        { name: 'Mathematics', contribution: 'Area, costs, monthly running costs and the payback of a loan with interest, in a spreadsheet.' },
        { name: 'Foreign language', contribution: 'Pitching a business plan and answering tough questions about the numbers in the target language.' },
        { name: 'Economics', contribution: 'Revenue sources, costs, risk and a SWOT analysis of a real investment.' },
      ],
      level: { ageMin: 15, ageMax: 18, cefr: 'B2' },
      duration: { unit: 'weeks', amount: 3, lessonMinutes: 45 },
      workingLanguage: 'en',
    },
    groups: {
      sizeMin: 3,
      sizeMax: 4,
      briefs: [
        { id: 'eco-tech', title: 'High-tech eco-city', brief: 'A city run on solar and wind with smart grids. Revenue: selling surplus energy and tech tourism.' },
        { id: 'vertical-farm', title: 'Vertical farm colony', brief: 'A city built around vertical farms. Revenue: selling food to the region and green jobs.' },
        { id: 'underground', title: 'Underground shelter city', brief: 'A city below ground, safe from heat and storms. Revenue: rents, data centres and storage.' },
        { id: 'floating', title: 'Floating city', brief: 'A city on the water, ready for rising seas. Revenue: rents, ports and research.' },
      ],
    },
    phases: [
      {
        id: 'profile',
        title: 'The planning table',
        goal: 'Each team sets its city profile, the basic services and where the money comes from.',
        lessons: 1,
        steps: [
          'Set the scene: 2050, climate change, a new neighbourhood for 1,000 people, and an investor who wants numbers.',
          'Teams choose or get a city profile (eco-city, vertical farm colony, underground city, floating city).',
          'Teams list the basic services (water, energy, waste, health care) and the revenue sources (rents, energy sales, tourism).',
          'Each team writes a one-page city profile.',
        ],
        milestone: {
          title: 'City profile',
          deliverable: 'A shared document with the profile, the basic services and at least three revenue sources.',
          handIn: 'link',
        },
      },
      {
        id: 'numbers',
        title: 'Do the numbers add up?',
        goal: 'Teams calculate area, building cost, monthly running cost and the payback of the loan.',
        lessons: 2,
        steps: [
          'Hand out the budget worksheet and agree on units and sources for prices.',
          'Area: how much space 1,000 people need for homes, services and green areas.',
          'Building cost and monthly running cost, with sources for every unit price.',
          'Payback: a 10-billion loan at 5% interest; in which year does the city earn it back?',
          'Check each team’s formulas on one row before they fill the whole sheet.',
        ],
        milestone: {
          title: 'Budget sheet',
          deliverable: 'A link to the spreadsheet with area, building cost, running cost, revenue and the payback year.',
          handIn: 'link',
        },
      },
      {
        id: 'swot',
        title: 'Ask the advisor',
        goal: 'Teams test their plan with a SWOT analysis and fix the weakest points.',
        lessons: 1,
        steps: [
          'Teams write a short summary of the plan: residents, main revenue, energy supply.',
          'With the advisor prompt card, teams ask an AI chatbot outside Potluck (as the school allows) for a SWOT analysis, or swap plans with another team.',
          'Teams decide which risks are real and change at least two numbers or decisions.',
        ],
        milestone: {
          title: 'SWOT and fixes',
          deliverable: 'A document with the SWOT analysis and the two or more changes the team made, each with a reason.',
          handIn: 'link',
        },
      },
      {
        id: 'pitch',
        title: 'Meet the investor',
        goal: 'Teams pitch the business plan in the target language and defend their numbers under questions.',
        lessons: 1.5,
        steps: [
          'Teams prepare a 3-minute pitch with the pitch phrase sheet.',
          'Practice round: another team plays the sceptical investor, or the team pitches to an AI investor in voice chat with the investor prompt.',
          'Teams record the pitch or take screenshots of the investor chat.',
          'Teams finish the business plan (spreadsheet + PDF) and hand it in with the recording.',
        ],
        milestone: {
          title: 'Business plan and pitch',
          deliverable: 'A link to a folder with the spreadsheet, the PDF plan and the pitch recording or screenshots.',
          handIn: 'link',
        },
      },
      {
        id: 'showcase',
        title: 'Investor day',
        goal: 'Teams present to the class; the class scores the plans as investors.',
        lessons: 0.5,
        steps: [
          'Each team pitches for 3 minutes; the class asks one question per team.',
          'Gallery round: students score the other teams’ plans on their phones.',
          'Everyone fills in the self-assessment and the team contribution questions.',
        ],
        milestone: {
          title: 'Investor day',
          deliverable: 'The team presents its plan to the class.',
          handIn: 'none',
        },
      },
    ],
    roles: [
      { id: 'cfo', name: 'Chief financial officer', responsibility: 'Owns the spreadsheet, checks every formula and the payback calculation.', optional: false },
      { id: 'planner', name: 'City planner', responsibility: 'Plans the area, the services and the profile of the city.', optional: false },
      { id: 'pitch-lead', name: 'Pitch lead', responsibility: 'Prepares and leads the pitch in the target language and handles investor questions.', optional: false },
      { id: 'researcher', name: 'Researcher', responsibility: 'Finds real prices and data, and keeps the list of sources.', optional: true },
    ],
    tasks: [
      { id: 'profile-choose', phaseId: 'profile', title: 'Choose the city profile', detail: 'Pick a profile and write in two sentences why it suits 2050.', roleId: 'planner' },
      { id: 'profile-services', phaseId: 'profile', title: 'List the basic services', detail: 'Water, energy, waste, health care: how does the city provide each?', roleId: 'planner' },
      { id: 'profile-revenue', phaseId: 'profile', title: 'Find three revenue sources', detail: 'Where does the money come from? Rents, energy sales, tourism or others.', roleId: null },
      { id: 'numbers-area', phaseId: 'numbers', title: 'Calculate the area', detail: 'Space per person for homes, services and green areas, then for 1,000 people.', roleId: 'planner' },
      { id: 'numbers-prices', phaseId: 'numbers', title: 'Collect real unit prices', detail: 'Building cost per square metre, energy, water: note the source of every price.', roleId: 'researcher' },
      { id: 'numbers-build', phaseId: 'numbers', title: 'Building and running costs', detail: 'Total building cost and monthly running cost in the spreadsheet.', roleId: 'cfo' },
      { id: 'numbers-payback', phaseId: 'numbers', title: 'Payback of the loan', detail: '10 billion at 5% a year: in which year has the city earned it back?', roleId: 'cfo' },
      { id: 'numbers-check', phaseId: 'numbers', title: 'Check the formulas', detail: 'Another team member checks every formula with a calculator.', roleId: null },
      { id: 'swot-summary', phaseId: 'swot', title: 'Write the plan summary', detail: 'Residents, main revenue, energy supply and payback year in five lines.', roleId: 'pitch-lead' },
      { id: 'swot-run', phaseId: 'swot', title: 'Get the SWOT analysis', detail: 'Use the advisor prompt card, or swap plans with another team.', roleId: null },
      { id: 'swot-fix', phaseId: 'swot', title: 'Fix two weak points', detail: 'Change at least two numbers or decisions and write why.', roleId: 'cfo' },
      { id: 'pitch-write', phaseId: 'pitch', title: 'Write the 3-minute pitch', detail: 'Problem, city, numbers, payback, why now: use the pitch phrase sheet.', roleId: 'pitch-lead' },
      { id: 'pitch-practise', phaseId: 'pitch', title: 'Face the investor', detail: 'Practise with a sceptical investor and note the questions you could not answer.', roleId: 'pitch-lead' },
      { id: 'pitch-pdf', phaseId: 'pitch', title: 'Finish the PDF plan', detail: 'Profile, budget summary, SWOT and changes on 2-3 pages.', roleId: 'planner' },
      { id: 'pitch-folder', phaseId: 'pitch', title: 'Hand in the folder', detail: 'Spreadsheet, PDF and recording in one shared folder that opens without signing in.', roleId: 'researcher' },
      { id: 'showcase-score', phaseId: 'showcase', title: 'Score the other plans', detail: 'In the gallery round, score every other team’s plan as an investor.', roleId: null },
    ],
    assessment: {
      criteria: [
        {
          id: 'numbers', name: 'Realistic numbers', subject: 'Mathematics', weight: 3, peer: false,
          levels: [
            { score: 1, descriptor: 'Numbers are missing or invented without any source.' },
            { score: 2, descriptor: 'Main costs are there, but several prices are unrealistic or unsourced.' },
            { score: 3, descriptor: 'Realistic, sourced prices; area and costs follow from them.' },
            { score: 4, descriptor: 'Every number has a source or a reason, and the team can explain each one.' },
          ],
        },
        {
          id: 'payback', name: 'Payback calculation', subject: 'Mathematics', weight: 2, peer: false,
          levels: [
            { score: 1, descriptor: 'No payback year, or interest is ignored.' },
            { score: 2, descriptor: 'A payback year, but the interest or the running costs are wrong.' },
            { score: 3, descriptor: 'Correct payback year with interest and running costs, small slips.' },
            { score: 4, descriptor: 'Correct, clearly laid-out calculation with a check of the formulas.' },
          ],
        },
        {
          id: 'business', name: 'Business logic and risks', subject: 'Economics', weight: 2, peer: true,
          levels: [
            { score: 1, descriptor: 'Revenue sources are unclear; no risks named.' },
            { score: 2, descriptor: 'Revenue sources named, risks listed but not dealt with.' },
            { score: 3, descriptor: 'Believable revenue; the SWOT led to real changes.' },
            { score: 4, descriptor: 'A convincing plan where every big risk has an answer.' },
          ],
        },
        {
          id: 'pitch', name: 'Pitch in the target language', subject: 'Foreign language', weight: 2, peer: true,
          levels: [
            { score: 1, descriptor: 'Read out, hard to follow, many mistakes.' },
            { score: 2, descriptor: 'Understandable, but mostly read out and general.' },
            { score: 3, descriptor: 'Clear, spoken freely, with the key numbers.' },
            { score: 4, descriptor: 'Confident and persuasive, numbers explained simply, precise business vocabulary.' },
          ],
        },
        {
          id: 'questions', name: 'Answering the investor', subject: 'Foreign language', weight: 1, peer: false,
          levels: [
            { score: 1, descriptor: 'Questions are not answered or not understood.' },
            { score: 2, descriptor: 'Short or vague answers.' },
            { score: 3, descriptor: 'Clear answers that use the team’s numbers.' },
            { score: 4, descriptor: 'Calm, precise answers that turn doubts into arguments.' },
          ],
        },
        {
          id: 'clarity', name: 'Clear business plan', subject: 'all', weight: 1, peer: true,
          levels: [
            { score: 1, descriptor: 'Hard to find the main points.' },
            { score: 2, descriptor: 'Complete, but long or messy.' },
            { score: 3, descriptor: 'Clear structure: profile, budget, SWOT, payback.' },
            { score: 4, descriptor: 'An investor could decide from it in five minutes.' },
          ],
        },
      ],
      selfQuestions: [
        { id: 'hardest', text: 'Which number was the hardest to get right, and how did you solve it?', kind: 'text' },
        { id: 'change', text: 'What would you change in your city if you had one more week?', kind: 'text' },
        { id: 'effort', text: 'How much did you put into this project?', kind: 'scale' },
      ],
      contributionQuestions: [
        { id: 'did-share', text: 'Did their share of the work, on time.', kind: 'scale' },
        { id: 'helped', text: 'Helped the team move forward.', kind: 'scale' },
        { id: 'accurate', text: 'Their part was careful and accurate.', kind: 'scale' },
      ],
    },
    handouts: [
      {
        id: 'budget',
        title: 'Budget worksheet',
        for: 'group',
        body: '## Your city in numbers\n\nWrite every number with its unit and its source.\n\n1. **Area:** square metres per person for homes, services, green areas. Total for 1,000 people.\n2. **Building cost:** cost per square metre x area, plus energy, water and waste systems.\n3. **Running cost per month:** energy, water, staff, maintenance.\n4. **Revenue per month:** rents, energy sales, tourism, others.\n5. **Loan:** 10 billion at 5% interest a year.\n\n## Payback\n\nEach year: debt at the start + 5% interest - (revenue - running costs) x 12 = debt at the end.\n\nRepeat until the debt is 0 or less. That year is your payback year. If the debt grows, your city never pays back: change the plan.',
      },
      {
        id: 'prompts',
        title: 'AI advisor and investor prompt cards',
        for: 'group',
        body: '## Use these outside Potluck, if your school allows it\n\n### The advisor (phase 3)\n\n> You are an architect and economics advisor. Here is the short plan of our city for 2050: [number of residents, main revenue source, energy supply]. Write a SWOT analysis. Where do you see risks? Is it realistic that the city pays back its loan in 10 years?\n\nKeep only the points you understand and can check.\n\n### The investor (phase 4)\n\n> Act as a sceptical venture capitalist. I am pitching you a futuristic city project for 2050. You care only about return on investment and sustainability. Ask me tough questions about my numbers and my business plan in English. If my answers are vague, be critical. Let\'s start.\n\nRecord the conversation or take screenshots for your hand-in.',
      },
      {
        id: 'pitch-phrases',
        title: 'Pitch phrases',
        for: 'student',
        body: '## Opening\n\n- By 2050, ... Our city solves this by ...\n- Imagine a city where ...\n\n## The numbers\n\n- The total investment is ... We break even in year ...\n- Our main revenue comes from ..., which brings in ... a month.\n\n## Risks\n\n- The biggest risk is ... That is why we ...\n- Even in the worst case, ...\n\n## Answering questions\n\n- That is a fair question. Our numbers show ...\n- We looked at that. Let me show you ...\n- We do not know yet, but here is how we will find out: ...',
      },
    ],
    teacherNotes: {
      preparation: 'Agree with your colleagues who leads which phase (maths for the numbers, the language teacher for the pitch). Decide whether teams use an AI chatbot outside Potluck for the SWOT and the investor role, or play these roles for each other, and check the school’s rules. Have a spreadsheet template with units ready if the class is new to spreadsheets.',
      variations: [
        'Without AI: teams swap plans for the SWOT, and another team plays the investor.',
        'Maths focus: compare two loans (5% and 7%) and show how the payback year changes.',
        'Shorter (4 lessons): give every team the same profile and fixed unit prices.',
      ],
    },
  },
};
