# PianoApp – Learn Piano with Falling Notes & MIDI

> Practice any song with your MIDI keyboard using a real-time waterfall display, instant scoring, hand separation, and progress tracking — all free in your browser.

**[pianoapp-space.vercel.app](https://pianoapp-space.vercel.app)**

![PianoApp Banner](public/banner.jpg)

---

## Features

- **Waterfall Display** – Falling notes visualization shows exactly which keys to press and when
- **MIDI Keyboard Support** – Connect any MIDI keyboard via the WebMIDI API (Chrome/Edge)
- **Real-time Scoring** – Every note graded on pitch accuracy (50%), timing (35%), and velocity (15%)
- **Hand Separation** – Practice left hand, right hand, or both independently
- **Speed Control** – 7 speed options from 0.25x to 2.0x for progressive difficulty
- **Wait Mode** – Playback pauses until you play the correct note
- **Section Looping** – Set A/B loop points to drill specific passages
- **Metronome** – Adjustable BPM with visual beat indicator
- **Song Library** – Import any `.mid` / `.midi` file via drag-and-drop; saved locally
- **Progress Dashboard** – Session history, accuracy trends, streaks, and best scores per song
- **Performance Recording** – Record your playing and replay it with full playback controls
- **Cloud Sync** *(optional)* – Sync progress across devices with Supabase + Google login

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + Vite 7 |
| Audio Engine | Tone.js 15 |
| MIDI Parsing | @tonejs/midi |
| MIDI Device Input | WebMIDI 3 |
| Local Storage | IndexedDB |
| Cloud Backend | Supabase (optional) |
| Auth | Supabase Auth + Google OAuth |
| Deploy | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Chrome or Edge (required for WebMIDI API)
- A MIDI keyboard *(optional but recommended)*

### Install & Run

```bash
git clone https://github.com/YOUR_USER/pianoapp.git
cd pianoapp
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome or Edge.

### Production Build

```bash
npm run build
npm run preview
```

---

## Environment Variables (optional)

Create a `.env` file to enable cloud sync and Google login:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without these the app works fully offline using IndexedDB.

---

## Supabase Setup (optional)

1. Create a project at [supabase.com](https://supabase.com)
2. Enable **Google** under **Authentication → Providers**
3. Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  song_id TEXT,
  song_name TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  duration REAL DEFAULT 0,
  score INTEGER DEFAULT 0,
  notes_hit INTEGER DEFAULT 0,
  notes_missed INTEGER DEFAULT 0,
  accuracy INTEGER DEFAULT 0,
  max_streak INTEGER DEFAULT 0,
  speed REAL DEFAULT 1,
  hand_mode TEXT DEFAULT 'both'
);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress"
  ON progress FOR ALL USING (auth.uid() = user_id);
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Escape` | Stop |
| `W` | Toggle Wait Mode |
| `M` | Toggle Metronome |
| `L` | Toggle Loop Mode |
| `R` | Toggle Recording |

---

## Score System

| Grade | Score | Color |
|---|---|---|
| Perfect | 95 – 100 | Gold |
| Great | 80 – 94 | Green |
| Good | 60 – 79 | Yellow |
| Miss | 0 – 59 | Red |

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | Full |
| Edge 90+ | Full |
| Firefox | Limited (no WebMIDI) |
| Safari | Limited (no WebMIDI) |

---

## Project Structure

```
src/
├── engine/          # ScoreEngine, NoteScheduler, RecordingEngine, Storage, SupabaseClient
├── hooks/           # MIDI, audio, song state, animation loop, metronome
├── components/
│   ├── Piano/       # Interactive keyboard
│   ├── Waterfall/   # Falling notes display
│   ├── Controls/    # Playback controls
│   ├── SongLibrary/ # Song list & MIDI import
│   ├── Dashboard/   # Progress & session history
│   └── SettingsPanel/ # Account, auth, preferences
└── styles/          # Component CSS files
```

---

## License

MIT © PianoApp
