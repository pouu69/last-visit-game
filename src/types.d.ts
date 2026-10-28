export interface Choice {
  id: string;
  title: string;
  detail: string;
  result: string;
  add?: string[];
  remove?: string[];
  route?: string;
  plan?: string;
  credit?: string;
}
export interface Entry { step: number; scene: string; title: string; choice: string; label: string; result: string; }
export interface State { team: number; name: string; step: number; route: string; plan: string; credit: string; flags: string[]; history: Entry[]; }
export interface Scene { page: string; chapter: number; time: string; place: string; title: string; image: string; paragraphs: string[]; question: string; discussion: string; choices: Choice[]; mission?: {intro: string; clues: string[]; hints: string[]; answer: string; explanation: string; grid?: string[][]}; }
export interface Ending { id: string; title: string; subtitle: string; image: string; paragraphs: string[]; question: string; }
