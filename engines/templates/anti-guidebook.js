// Built-in template: The anti-guidebook (Gen Z survival guide).
// Source: the owner's teacher publication, March 2026 ("Az anti-útikönyv, avagy a Z-generációs
// túlélőkalauz"), translated and made international. Written by hand in the project skeleton
// (engines/skeleton.js), so a teacher can run it without any AI step (Hub spec, P1).
//
// Note: in phase "polish" the students use an AI chatbot themselves, outside Potluck, as a native-speaker
// editor (that is the original lesson idea). Potluck itself runs no AI during a project.

export const template = {
  slug: 'anti-guidebook',
  status: 'live',
  meta: {
    tags: ['languages', 'writing', 'speaking', 'media'],
    ageRange: [13, 19],
    durationHint: '3-4 lessons',
  },
  skeleton: {
    schemaVersion: 1,
    basics: {
      title: 'The anti-guidebook',
      drivingQuestion: 'What does a new student from abroad really need to know to survive our school or town?',
      summary: 'Editorial teams write an honest, useful survival guide to their own school or town for a student of their age from abroad: the places, tips and unwritten rules that no official brochure mentions. They write in the target language, polish the text with an AI editor, build a digital magazine, map or video, and present it to the class.',
      brief: 'Your team is the editorial office of a survival guide for exchange students. Collect 5-8 tips or places that are not in any official brochure but that a student your age would find essential. Write them in the target language, make them sound natural, and turn them into a guide people want to read.',
      product: {
        type: 'magazine',
        description: 'A short digital magazine (Canva), a Google My Maps map with your own photos, or a video tour, or a mix of these. 5-8 tips, each with a title, a short text and a picture.',
      },
      audience: 'Exchange students of the same age who arrive at the school or in the town; the class votes for the most useful guide.',
      subjects: [
        {
          name: 'Foreign language',
          contribution: 'Writing for a real reader, natural everyday language and slang instead of textbook sentences, presenting the guide in the target language.',
        },
      ],
      level: { ageMin: 13, ageMax: 19, cefr: 'B1' },
      duration: { unit: 'lessons', amount: 4, lessonMinutes: 45 },
      workingLanguage: 'en',
    },
    groups: {
      sizeMin: 3,
      sizeMax: 4,
      briefs: [],
    },
    phases: [
      {
        id: 'scout',
        title: 'Scout the real school',
        goal: 'Each team agrees on 5-8 survival tips or places that are not in any official brochure and splits them between its members.',
        lessons: 0.5,
        steps: [
          'Hook: show a page of an official school or town brochure and ask what an exchange student would really ask on day one.',
          'Form editorial teams of 3-4 and let them pick their roles.',
          'Teams brainstorm tips and places: the secret menu of the canteen, how to survive Monday mornings, the best place to spend a free period.',
          'Each team keeps 5-8 tips and decides who writes which one.',
        ],
        milestone: {
          title: 'Tip list',
          deliverable: 'A shared document with 5-8 tips, one line each, and the name of the team member who writes it.',
          handIn: 'link',
        },
      },
      {
        id: 'draft',
        title: 'Write the first drafts',
        goal: 'Every team member writes their tips in the target language with their own vocabulary.',
        lessons: 1,
        steps: [
          'Rule of the day: no pasting a finished text into a translator. Students may look up single words and slang.',
          'Each student writes 60-100 words per tip in the shared document.',
          'The language lead reads every draft and marks unclear sentences.',
          'Walk around and help with structure, not with full sentences.',
        ],
        milestone: {
          title: 'First drafts',
          deliverable: 'All tips written as first drafts in the shared document.',
          handIn: 'link',
        },
      },
      {
        id: 'polish',
        title: 'Polish with an AI editor',
        goal: 'Teams use an AI chatbot as a native-speaker editor, keep the changes they understand and can explain them.',
        lessons: 0.5,
        steps: [
          'Hand out the AI editor prompt card and show the prompt.',
          'Students paste their own draft and the prompt into a chatbot (ChatGPT, Gemini or similar, as the school allows).',
          'They compare the two versions and keep only the changes they understand.',
          'Each team picks 3 changes and explains them in one sentence each.',
        ],
        milestone: {
          title: 'Before and after',
          deliverable: 'The polished tips, and 3 changes the team made, each with the original sentence, the new one and why it is better.',
          handIn: 'link',
        },
      },
      {
        id: 'build',
        title: 'Build the guide',
        goal: 'Teams turn the polished texts into a guide that is easy and fun to read.',
        lessons: 1,
        steps: [
          'Teams choose the format: Canva magazine, Google My Maps map or video tour.',
          'They add their own photos (no faces without permission) and a title for every tip.',
          'The editor-in-chief checks that every tip is in and the guide has a cover and a short introduction.',
        ],
        milestone: {
          title: 'The guide',
          deliverable: 'A link to the finished guide (magazine, map or video), viewable without signing in.',
          handIn: 'link',
        },
      },
      {
        id: 'present',
        title: 'Present and vote',
        goal: 'Teams present their guide in the target language, score the other guides and vote for the most useful one.',
        lessons: 1,
        steps: [
          'Each team presents its guide in 3-4 minutes in the target language.',
          'Gallery round: every student scores the other teams’ guides on their phone.',
          'The class votes for the most useful guide.',
          'Everyone fills in the self-assessment and the team contribution questions.',
        ],
        milestone: {
          title: 'Presentation',
          deliverable: 'The team presents its guide to the class.',
          handIn: 'none',
        },
      },
    ],
    roles: [
      {
        id: 'editor',
        name: 'Editor-in-chief',
        responsibility: 'Keeps the deadlines, decides who writes which tip, checks that the guide is complete.',
        optional: false,
      },
      {
        id: 'language',
        name: 'Language lead',
        responsibility: 'Reads every draft, runs the AI editor step and keeps the list of changes the team explains.',
        optional: false,
      },
      {
        id: 'designer',
        name: 'Designer',
        responsibility: 'Chooses the format and builds the magazine, map or video from the team’s texts and photos.',
        optional: false,
      },
      {
        id: 'scout',
        name: 'Scout',
        responsibility: 'Finds the places, takes the photos and checks that every tip is true and up to date.',
        optional: true,
      },
    ],
    tasks: [
      { id: 'scout-brainstorm', phaseId: 'scout', title: 'Brainstorm tips and places', detail: 'Collect at least 10 ideas a student from abroad would need and no brochure mentions.', roleId: null },
      { id: 'scout-pick', phaseId: 'scout', title: 'Pick 5-8 tips', detail: 'Keep the most useful ones and write them as one line each in the shared document.', roleId: 'editor' },
      { id: 'scout-split', phaseId: 'scout', title: 'Split the tips', detail: 'Write a name next to every tip: who writes it.', roleId: 'editor' },
      { id: 'draft-write', phaseId: 'draft', title: 'Write my tips', detail: 'Write 60-100 words per tip in the target language. Look up single words, never paste a whole text into a translator.', roleId: null },
      { id: 'draft-read', phaseId: 'draft', title: 'Read every draft', detail: 'Mark sentences that are unclear and agree with the writer what they mean.', roleId: 'language' },
      { id: 'draft-photos', phaseId: 'draft', title: 'Plan the photos', detail: 'List the photo you need for every tip and where to take it.', roleId: 'scout' },
      { id: 'polish-run', phaseId: 'polish', title: 'Run the AI editor', detail: 'Paste each draft with the prompt from the AI editor card into a chatbot.', roleId: 'language' },
      { id: 'polish-compare', phaseId: 'polish', title: 'Compare and keep', detail: 'Compare the two versions of your own tips and keep only the changes you understand.', roleId: null },
      { id: 'polish-explain', phaseId: 'polish', title: 'Explain 3 changes', detail: 'Write the original sentence, the new one and one sentence on why it is better, for 3 changes.', roleId: 'language' },
      { id: 'build-format', phaseId: 'build', title: 'Choose the format', detail: 'Magazine, map or video: agree on one and set it up so everyone can edit.', roleId: 'designer' },
      { id: 'build-photos', phaseId: 'build', title: 'Take and add the photos', detail: 'Your own photos only; no faces without permission.', roleId: 'scout' },
      { id: 'build-layout', phaseId: 'build', title: 'Lay out the guide', detail: 'Cover, short introduction, a title, text and picture for every tip.', roleId: 'designer' },
      { id: 'build-check', phaseId: 'build', title: 'Final check', detail: 'Every tip is in, the link opens without signing in.', roleId: 'editor' },
      { id: 'present-prepare', phaseId: 'present', title: 'Prepare the presentation', detail: 'Decide who presents which part; 3-4 minutes in the target language.', roleId: null },
      { id: 'present-score', phaseId: 'present', title: 'Score the other guides', detail: 'In the gallery round, score every other team’s guide.', roleId: null },
    ],
    assessment: {
      criteria: [
        {
          id: 'useful',
          name: 'Useful tips',
          subject: 'all',
          weight: 2,
          peer: true,
          levels: [
            { score: 1, descriptor: 'Fewer than 5 tips, or most of them are in any official brochure.' },
            { score: 2, descriptor: '5 or more tips, but only some would really help a student from abroad.' },
            { score: 3, descriptor: '5-8 tips that a student of the same age would find useful.' },
            { score: 4, descriptor: '5-8 tips that are surprising, specific and clearly from the students’ own life.' },
          ],
        },
        {
          id: 'natural',
          name: 'Natural language',
          subject: 'Foreign language',
          weight: 2,
          peer: false,
          levels: [
            { score: 1, descriptor: 'Reads like a translation or a textbook.' },
            { score: 2, descriptor: 'Mostly textbook sentences with a few natural expressions.' },
            { score: 3, descriptor: 'Mostly natural, everyday language that fits the reader.' },
            { score: 4, descriptor: 'Sounds like a student of that age wrote it; the team can explain its changes.' },
          ],
        },
        {
          id: 'accuracy',
          name: 'Accuracy',
          subject: 'Foreign language',
          weight: 1,
          peer: false,
          levels: [
            { score: 1, descriptor: 'Many mistakes make the text hard to understand.' },
            { score: 2, descriptor: 'Mistakes are frequent but the meaning is clear.' },
            { score: 3, descriptor: 'A few mistakes that do not disturb the reader.' },
            { score: 4, descriptor: 'Hardly any mistakes.' },
          ],
        },
        {
          id: 'design',
          name: 'Design and clarity',
          subject: 'all',
          weight: 1,
          peer: true,
          levels: [
            { score: 1, descriptor: 'Hard to find your way; pictures are missing.' },
            { score: 2, descriptor: 'Complete, but plain or crowded.' },
            { score: 3, descriptor: 'Clear structure, a picture for every tip.' },
            { score: 4, descriptor: 'Inviting and easy to use; you want to keep reading.' },
          ],
        },
        {
          id: 'presentation',
          name: 'Presentation',
          subject: 'Foreign language',
          weight: 1,
          peer: true,
          levels: [
            { score: 1, descriptor: 'Read from the screen, hard to follow.' },
            { score: 2, descriptor: 'Understandable, but mostly read out.' },
            { score: 3, descriptor: 'Spoken freely, clear and in time.' },
            { score: 4, descriptor: 'Spoken freely, lively, and everyone in the team takes part.' },
          ],
        },
      ],
      selfQuestions: [
        { id: 'proud', text: 'Which tip or part of the guide are you most proud of, and why?', kind: 'text' },
        { id: 'learned', text: 'Write one expression you learned in this project and how you would use it.', kind: 'text' },
        { id: 'effort', text: 'How much did you put into this project?', kind: 'scale' },
      ],
      contributionQuestions: [
        { id: 'did-share', text: 'Did their share of the work, on time.', kind: 'scale' },
        { id: 'helped', text: 'Helped the team move forward.', kind: 'scale' },
      ],
    },
    handouts: [
      {
        id: 'ai-editor',
        title: 'AI editor prompt card',
        for: 'group',
        body: '## Your AI editor\n\nThe chatbot does not write for you. It edits what **you** wrote.\n\n1. Paste your own draft into the chatbot.\n2. Add this prompt (choose British, American or another variety):\n\n> Act like a trendy 17-year-old [British/American] high-school student who edits the school newspaper. Here is a short text I wrote for our school’s survival guide. Read it and correct the grammar mistakes. Most important: rewrite the sentences that sound too much like a textbook or too formal, and use natural, everyday expressions or slang that you and your friends would use today. Briefly explain why you changed each word.\n\n3. Compare the two versions. Keep only the changes you understand.\n4. Pick 3 changes and write: the original sentence, the new one, and why it is better.',
      },
      {
        id: 'tip-hunt',
        title: 'Tip hunting sheet',
        for: 'group',
        body: '## Tip hunting\n\nA student your age arrives from abroad tomorrow. What do they really need to know?\n\n- **Food:** where is the best and cheapest snack near the school?\n- **Rules nobody writes down:** which teacher wants what?\n- **Survival:** how do you get through Monday mornings, tests, the long break?\n- **Places:** where do students hang out, and where not to go?\n- **Getting around:** the fastest way home, the bus that is always late.\n\nWrite 10 ideas, then keep the best 5-8.',
      },
    ],
    teacherNotes: {
      preparation: 'Check the school’s rules on students using AI chatbots and phones, and agree on the format options (Canva, Google My Maps, video). Prepare one official brochure page for the hook. Remind the students: no faces in photos without permission.',
      variations: [
        'Shorter (3 lessons): skip the AI editor step and let the teams swap drafts and edit each other’s texts.',
        'With a second subject: the art or IT teacher assesses design and the digital product.',
        'Town instead of school: the guide covers the town, and the scouts take the photos at the weekend.',
      ],
    },
  },
};
