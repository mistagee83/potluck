// Built-in template: 5-star disaster (the worst trip, sold as luxury).
// Source: the owner's teacher publication, May 2026 ("Az 5 csillagos katasztrófa"), translated and made
// international. Written by hand in the project skeleton, so it runs without any AI step.
// In the source, teams may use AI outside Potluck for ideas and for building the product; Potluck itself
// runs no AI during a project.

export const template = {
  slug: 'five-star-disaster',
  status: 'live',
  meta: {
    tags: ['languages', 'tourism', 'writing', 'speaking', 'humour'],
    ageRange: [14, 19],
    durationHint: '2 lessons',
  },
  skeleton: {
    schemaVersion: 1,
    basics: {
      title: '5-star disaster',
      drivingQuestion: 'Can you sell the worst trip in the world as a luxury experience?',
      summary: 'Teams work in the "disaster department" of a travel agency. They build the worst legal holiday package they can imagine and sell it as pure luxury, with a brochure full of polite euphemisms and a two-minute sales pitch where they stay in role under questions.',
      brief: 'Your team is a creative agency. Build the worst holiday package that is still legal: endless transfers, a room with a motorway view, a "cultural visit" to an asphalt plant. Then sell it as the most exclusive trip of the year, without ever saying anything bad about it.',
      product: {
        type: 'poster',
        description: 'A one-page travel brochure, poster or simple web page for the trip: name, destination, programme, price and a photo, every weak point turned into a selling point.',
      },
      audience: 'The class, who listen to the pitch as possible customers and ask about the suspicious details.',
      subjects: [
        { name: 'Foreign language', contribution: 'Travel and complaint vocabulary, euphemisms, persuasive writing and a short sales pitch in the target language.' },
        { name: 'Tourism and marketing', contribution: 'How travel packages and brochures are built, and how marketing language shapes what customers notice.' },
      ],
      level: { ageMin: 14, ageMax: 19, cefr: 'B1' },
      duration: { unit: 'lessons', amount: 2, lessonMinutes: 45 },
      workingLanguage: 'en',
    },
    groups: {
      sizeMin: 3,
      sizeMax: 4,
      briefs: [],
    },
    phases: [
      {
        id: 'agency',
        title: 'Open the disaster department',
        goal: 'Each team picks a destination and collects the worst features of its trip.',
        lessons: 0.5,
        steps: [
          'Hook: show a real travel advert and ask what it does not tell you.',
          'Form creative agencies of 3-4 and let them pick their roles.',
          'Teams pick a destination and list at least 10 terrible but legal features: transfers, rooms, food, programmes.',
          'Each team keeps the 6-8 best disasters for the brochure.',
        ],
        milestone: {
          title: 'Disaster list',
          deliverable: 'A shared document with the destination and 6-8 disasters, each with the polite phrase the brochure will use.',
          handIn: 'link',
        },
      },
      {
        id: 'brochure',
        title: 'Write the brochure',
        goal: 'Teams turn every disaster into a selling point and build the brochure.',
        lessons: 1,
        steps: [
          'Hand out the euphemism toolkit and model one example: "view of the landfill" becomes "industrial panorama with an ecological focus".',
          'Copywriters write the texts in the target language; the designer builds the page as the texts come in.',
          'Walk around and push for precise vocabulary instead of general words like "nice" or "bad".',
          'The spokesperson starts collecting the questions customers might ask.',
        ],
        milestone: {
          title: 'The brochure',
          deliverable: 'A link to the finished brochure, poster or web page, viewable without signing in.',
          handIn: 'link',
        },
      },
      {
        id: 'pitch',
        title: 'Sell the trip',
        goal: 'Each team sells its trip in two minutes and answers questions without leaving its role.',
        lessons: 0.5,
        steps: [
          'Each team pitches for 2 minutes in the target language.',
          'The class asks about the suspicious details; the team answers politely and stays in role.',
          'Gallery round: students score the other teams’ brochures on their phones.',
          'Everyone fills in the self-assessment and the team contribution questions.',
        ],
        milestone: {
          title: 'Sales pitch',
          deliverable: 'A two-minute pitch to the class, with questions.',
          handIn: 'none',
        },
      },
    ],
    roles: [
      { id: 'copywriter', name: 'Copywriter', responsibility: 'Writes the brochure texts and finds a polite phrase for every disaster.', optional: false },
      { id: 'designer', name: 'Designer', responsibility: 'Builds the brochure, poster or web page and chooses the pictures.', optional: false },
      { id: 'spokesperson', name: 'Spokesperson', responsibility: 'Leads the pitch and prepares the answers to awkward questions.', optional: false },
      { id: 'researcher', name: 'Researcher', responsibility: 'Checks the destination, the transfers and the prices so the disasters sound real.', optional: true },
    ],
    tasks: [
      { id: 'agency-destination', phaseId: 'agency', title: 'Pick the destination', detail: 'Choose a real place and decide how the travellers get there.', roleId: null },
      { id: 'agency-list', phaseId: 'agency', title: 'List 10 disasters', detail: 'Transfers, rooms, food, programmes: terrible, but still legal.', roleId: null },
      { id: 'agency-keep', phaseId: 'agency', title: 'Keep the best 6-8', detail: 'Write each disaster with the polite phrase the brochure will use.', roleId: 'copywriter' },
      { id: 'agency-check', phaseId: 'agency', title: 'Make it sound real', detail: 'Check real transfer times, distances and prices for the destination.', roleId: 'researcher' },
      { id: 'brochure-texts', phaseId: 'brochure', title: 'Write the brochure texts', detail: 'Name of the trip, a short introduction and one paragraph per disaster.', roleId: 'copywriter' },
      { id: 'brochure-build', phaseId: 'brochure', title: 'Build the brochure', detail: 'Lay out the page with the texts, a price and pictures; no faces without permission.', roleId: 'designer' },
      { id: 'brochure-price', phaseId: 'brochure', title: 'Set the price', detail: 'An exclusive price with a list of what is included, and what is not.', roleId: null },
      { id: 'brochure-link', phaseId: 'brochure', title: 'Check the link', detail: 'Make sure the brochure opens without signing in, then hand it in.', roleId: 'designer' },
      { id: 'pitch-plan', phaseId: 'pitch', title: 'Plan the two minutes', detail: 'Who says what, in which order, and how you end the pitch.', roleId: 'spokesperson' },
      { id: 'pitch-answers', phaseId: 'pitch', title: 'Prepare three answers', detail: 'Guess three awkward questions and write a polite answer for each.', roleId: 'spokesperson' },
      { id: 'pitch-score', phaseId: 'pitch', title: 'Score the other brochures', detail: 'In the gallery round, score every other team’s brochure.', roleId: null },
    ],
    assessment: {
      criteria: [
        {
          id: 'euphemisms', name: 'Clever euphemisms', subject: 'Foreign language', weight: 2, peer: true,
          levels: [
            { score: 1, descriptor: 'Disasters are named directly or the phrases are unclear.' },
            { score: 2, descriptor: 'Some polite phrases, but many disasters are still said plainly.' },
            { score: 3, descriptor: 'Most disasters are turned into believable selling points.' },
            { score: 4, descriptor: 'Every disaster has a precise, funny euphemism that still tells the truth.' },
          ],
        },
        {
          id: 'vocabulary', name: 'Travel vocabulary', subject: 'Foreign language', weight: 2, peer: false,
          levels: [
            { score: 1, descriptor: 'Only general words (nice, bad, big); mistakes make parts unclear.' },
            { score: 2, descriptor: 'Some travel words, with frequent mistakes.' },
            { score: 3, descriptor: 'A good range of travel and service words, few mistakes.' },
            { score: 4, descriptor: 'Wide, precise travel vocabulary used correctly and naturally.' },
          ],
        },
        {
          id: 'marketing', name: 'Marketing logic', subject: 'Tourism and marketing', weight: 1, peer: false,
          levels: [
            { score: 1, descriptor: 'The package has no clear structure or price.' },
            { score: 2, descriptor: 'A package and a price, but the brochure does not guide the reader.' },
            { score: 3, descriptor: 'Clear package, price and selling points in a sensible order.' },
            { score: 4, descriptor: 'Uses real brochure techniques: headline, highlights, small print, a call to action.' },
          ],
        },
        {
          id: 'brochure', name: 'Brochure design', subject: 'all', weight: 1, peer: true,
          levels: [
            { score: 1, descriptor: 'Hard to read; pictures or key information are missing.' },
            { score: 2, descriptor: 'Complete, but plain or crowded.' },
            { score: 3, descriptor: 'Clear layout with a picture and a price.' },
            { score: 4, descriptor: 'Looks like a real brochure; you want to read every line.' },
          ],
        },
        {
          id: 'pitch', name: 'Pitch and staying in role', subject: 'Foreign language', weight: 1, peer: true,
          levels: [
            { score: 1, descriptor: 'Read from the screen; questions break the role.' },
            { score: 2, descriptor: 'Understandable, but mostly read out; some answers leave the role.' },
            { score: 3, descriptor: 'Spoken freely; most questions answered politely in role.' },
            { score: 4, descriptor: 'Lively and confident; every awkward question turned into a selling point.' },
          ],
        },
      ],
      selfQuestions: [
        { id: 'best-phrase', text: 'Write your best euphemism from the project and what it really meant.', kind: 'text' },
        { id: 'learned', text: 'Write two travel words or phrases you learned and how you would use them.', kind: 'text' },
        { id: 'effort', text: 'How much did you put into this project?', kind: 'scale' },
      ],
      contributionQuestions: [
        { id: 'did-share', text: 'Did their share of the work, on time.', kind: 'scale' },
        { id: 'helped', text: 'Helped the team move forward.', kind: 'scale' },
      ],
    },
    handouts: [
      {
        id: 'euphemisms',
        title: 'Euphemism toolkit',
        for: 'group',
        body: '## Say it nicely\n\nA euphemism is a polite or attractive way to say something unpleasant.\n\n- No window: **an intimate, light-free retreat**\n- Next to the motorway: **excellent transport connections, day and night**\n- 22-hour transfer: **an extended airport experience**\n- Cold food: **a refreshing, chef-inspired buffet**\n- Visit to an asphalt plant: **an exclusive industrial heritage tour**\n\n## Useful frames\n\n- Enjoy the ... of ...\n- Experience ... like never before.\n- Perfect for travellers who appreciate ...\n- Limited availability: ...\n\n## Your turn\n\nWrite each disaster on the left, your phrase on the right. Read it aloud: does it sound like luxury?',
      },
      {
        id: 'brainstorm',
        title: 'Disaster brainstorm',
        for: 'group',
        body: '## Plan the worst trip\n\nFind at least two disasters for each part of the trip.\n\n- **Getting there:** transfers, waiting, luggage\n- **The room:** view, size, noise, bathroom\n- **Food:** what, when, where\n- **Programme:** "cultural" visits, activities, guides\n- **Small print:** extra fees, rules, timings\n\n1. Write 10 ideas.\n2. Keep the best 6-8.\n3. Write a polite phrase for each one.',
      },
    ],
    teacherNotes: {
      preparation: 'Almost none: explain the task and monitor. Have one real travel advert ready for the hook, and decide which tools the teams may use for the brochure (paper, Canva, a slide or a simple web page). If teams use AI for ideas or the page, agree that the texts are their own.',
      variations: [
        'One lesson: skip the web page, write the brochure on paper and pitch in 1 minute.',
        'Complaint follow-up: in the next lesson, teams swap trips and write a polite complaint letter about another team’s package.',
        'Geography focus: every disaster must be true to the real climate and geography of the destination.',
      ],
    },
  },
};
