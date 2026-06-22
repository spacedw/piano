// Mock data: songs, scores, recordings, community feed.

const MOCK_SONGS = [
  { id: 's1', title: 'Nocturne en Mi♭ mayor', artist: 'F. Chopin', difficulty: 4, duration: 274, tags: ['Romántico','Nocturno'], lastScore: 92, lastPlayed: '2026-04-26', favorite: true, plays: 18 },
  { id: 's2', title: 'Clair de Lune', artist: 'C. Debussy', difficulty: 3, duration: 312, tags: ['Impresionismo'], lastScore: 87, lastPlayed: '2026-04-25', favorite: true, plays: 22 },
  { id: 's3', title: 'Gymnopédie No.1', artist: 'E. Satie', difficulty: 2, duration: 198, tags: ['Minimalista'], lastScore: 95, lastPlayed: '2026-04-24', favorite: false, plays: 31 },
  { id: 's4', title: 'Invención No.1 BWV 772', artist: 'J.S. Bach', difficulty: 3, duration: 88, tags: ['Barroco','Contrapunto'], lastScore: 78, lastPlayed: '2026-04-22', favorite: false, plays: 9 },
  { id: 's5', title: 'Sonata "Claro de Luna" Op.27', artist: 'L. v. Beethoven', difficulty: 4, duration: 358, tags: ['Clásico'], lastScore: 81, lastPlayed: '2026-04-20', favorite: true, plays: 14 },
  { id: 's6', title: 'Preludio en Do mayor', artist: 'J.S. Bach', difficulty: 1, duration: 132, tags: ['Estudio'], lastScore: 98, lastPlayed: '2026-04-19', favorite: false, plays: 42 },
  { id: 's7', title: 'Rêverie', artist: 'C. Debussy', difficulty: 3, duration: 244, tags: ['Impresionismo'], lastScore: 84, lastPlayed: '2026-04-15', favorite: false, plays: 7 },
  { id: 's8', title: 'Vals Op.64 No.2', artist: 'F. Chopin', difficulty: 4, duration: 218, tags: ['Vals','Romántico'], lastScore: 73, lastPlayed: '2026-04-12', favorite: true, plays: 11 },
];

const MOCK_COMMUNITY = [
  { id: 'c1', title: 'Comptine d\'un autre été', composer: 'Y. Tiersen', uploader: { name: 'mateo_p', avatar: 'M' }, difficulty: 2, rating: 4.8, downloads: 12480, ratings: 342 },
  { id: 'c2', title: 'River Flows in You', composer: 'Yiruma', uploader: { name: 'sara.k', avatar: 'S' }, difficulty: 3, rating: 4.6, downloads: 28104, ratings: 1204 },
  { id: 'c3', title: 'Spiegel im Spiegel', composer: 'A. Pärt', uploader: { name: 'andrei', avatar: 'A' }, difficulty: 1, rating: 4.9, downloads: 5678, ratings: 198 },
  { id: 'c4', title: 'Howl\'s Moving Castle', composer: 'J. Hisaishi', uploader: { name: 'kana_88', avatar: 'K' }, difficulty: 3, rating: 4.7, downloads: 19420, ratings: 814 },
  { id: 'c5', title: 'La Valse d\'Amélie', composer: 'Y. Tiersen', uploader: { name: 'paul.fr', avatar: 'P' }, difficulty: 2, rating: 4.5, downloads: 8930, ratings: 287 },
  { id: 'c6', title: 'Una mattina', composer: 'L. Einaudi', uploader: { name: 'giulia_e', avatar: 'G' }, difficulty: 2, rating: 4.7, downloads: 14200, ratings: 521 },
];

const MOCK_RECORDINGS = [
  { id: 'r1', name: 'Sesión espontánea — abril 26', date: '2026-04-26 21:14', duration: 184, song: 'Nocturne en Mi♭ mayor', score: 92, accuracy: 96 },
  { id: 'r2', name: 'Improvisación en La menor', date: '2026-04-25 18:02', duration: 92, song: null, score: null, accuracy: null },
  { id: 'r3', name: 'Práctica Bach — Invención', date: '2026-04-22 19:38', duration: 76, song: 'Invención No.1 BWV 772', score: 78, accuracy: 88 },
];

// 90 days of activity (synthetic)
const MOCK_HEATMAP = Array.from({ length: 90 }, (_, i) => {
  const r = Math.sin(i * 0.7) * 0.5 + Math.cos(i * 0.3) * 0.4 + Math.random() * 0.3;
  const v = Math.max(0, Math.min(1, r));
  return v < 0.2 ? 0 : v < 0.4 ? 1 : v < 0.65 ? 2 : v < 0.85 ? 3 : 4;
});

const MOCK_SESSIONS = [
  { date: '26 abr', song: 'Nocturne en Mi♭ mayor', duration: '12:04', score: 92, accuracy: 96 },
  { date: '25 abr', song: 'Clair de Lune', duration: '08:32', score: 87, accuracy: 91 },
  { date: '24 abr', song: 'Gymnopédie No.1', duration: '14:18', score: 95, accuracy: 98 },
  { date: '23 abr', song: 'Vals Op.64 No.2', duration: '06:42', score: 73, accuracy: 84 },
  { date: '22 abr', song: 'Invención No.1 BWV 772', duration: '09:50', score: 78, accuracy: 88 },
];

// Score evolution last 14 days
const MOCK_SCORE_HISTORY = [72, 75, 78, 76, 80, 82, 81, 85, 83, 87, 89, 88, 91, 92];

// Generate a demo waterfall sequence for the player
function generateDemoNotes() {
  const notes = [];
  // Right hand melody (Nocturne-ish, Eb major fragment)
  const rh = [63,68,70,72,75,72,70,68, 70,72,75,77,79,77,75,72,  70,68,67,65,63,65,67,68];
  // Left hand bass
  const lh = [39,46,51,46, 39,46,51,46, 36,43,48,43, 36,43,48,43, 31,38,43,38, 31,38,43,38];
  let t = 1.5;
  rh.forEach((m, i) => {
    notes.push({ midi: m, start: t + i*0.45, duration: 0.4, hand: 'R' });
  });
  let t2 = 1.5;
  lh.forEach((m, i) => {
    notes.push({ midi: m, start: t2 + i*0.45, duration: 0.4, hand: 'L' });
  });
  // Add sustained chord
  notes.push({ midi: 75, start: 12, duration: 1.2, hand: 'R' });
  notes.push({ midi: 79, start: 12, duration: 1.2, hand: 'R' });
  notes.push({ midi: 82, start: 12, duration: 1.2, hand: 'R' });
  return notes;
}

window.MOCK = {
  songs: MOCK_SONGS,
  community: MOCK_COMMUNITY,
  recordings: MOCK_RECORDINGS,
  heatmap: MOCK_HEATMAP,
  sessions: MOCK_SESSIONS,
  scoreHistory: MOCK_SCORE_HISTORY,
  generateDemoNotes,
};
