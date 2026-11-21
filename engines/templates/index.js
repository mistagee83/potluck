// Built-in templates, written by hand in the project skeleton (P3: the three launch templates).
// The Potluck admin imports them into Firestore (plTemplates); teachers start projects from Firestore.
// The files stay the source for the import, local work and tests.
import { template as fiveStarDisaster } from './five-star-disaster.js';
import { template as antiGuidebook } from './anti-guidebook.js';
import { template as cityBudget2050 } from './city-budget-2050.js';

export const TEMPLATES = [antiGuidebook, fiveStarDisaster, cityBudget2050];
