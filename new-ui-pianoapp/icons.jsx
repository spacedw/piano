// Minimal stroke icon set — 1.5px strokes, 20px viewBox.
// Designed in-house; no third-party brand marks.
const Icon = ({ children, size = 18, stroke = "currentColor", strokeWidth = 1.5, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {children}
  </svg>
);

const I = {
  Play: (p) => <Icon {...p}><path d="M6 4l10 6-10 6V4z" fill="currentColor" stroke="none"/></Icon>,
  Pause: (p) => <Icon {...p}><rect x="5.5" y="4" width="3.2" height="12" rx="1" fill="currentColor" stroke="none"/><rect x="11.3" y="4" width="3.2" height="12" rx="1" fill="currentColor" stroke="none"/></Icon>,
  Stop: (p) => <Icon {...p}><rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/></Icon>,
  Record: (p) => <Icon {...p}><circle cx="10" cy="10" r="5" fill="currentColor" stroke="none"/></Icon>,
  Back: (p) => <Icon {...p}><path d="M12 4v12L4 10l8-6zM16 4v12"/></Icon>,
  Forward: (p) => <Icon {...p}><path d="M8 4v12l8-6-8-6zM4 4v12"/></Icon>,
  Library: (p) => <Icon {...p}><path d="M3 4h2v12H3zM7 4h2v12H7zM12 4l4 1-2.5 11.5L9.5 15"/></Icon>,
  Chart: (p) => <Icon {...p}><path d="M3 16h14M5 13v-3M9 13V7M13 13V4M17 13v-6"/></Icon>,
  Users: (p) => <Icon {...p}><circle cx="7" cy="8" r="2.4"/><path d="M3 16c0-2.2 1.8-4 4-4s4 1.8 4 4"/><circle cx="13.5" cy="9" r="2"/><path d="M11.5 16c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5"/></Icon>,
  Settings: (p) => <Icon {...p}><circle cx="10" cy="10" r="2.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4"/></Icon>,
  Search: (p) => <Icon {...p}><circle cx="9" cy="9" r="5"/><path d="M13 13l4 4"/></Icon>,
  Plus: (p) => <Icon {...p}><path d="M10 4v12M4 10h12"/></Icon>,
  Close: (p) => <Icon {...p}><path d="M5 5l10 10M15 5L5 15"/></Icon>,
  Star: (p) => <Icon {...p}><path d="M10 3l2.2 4.6 5 .6-3.7 3.5.9 5L10 14.3 5.6 16.7l.9-5L2.8 8.2l5-.6L10 3z"/></Icon>,
  Heart: (p) => <Icon {...p}><path d="M10 16s-6-3.5-6-8a3.5 3.5 0 016-2.5A3.5 3.5 0 0116 8c0 4.5-6 8-6 8z"/></Icon>,
  Upload: (p) => <Icon {...p}><path d="M10 13V3m0 0L6 7m4-4l4 4M3 13v3a1 1 0 001 1h12a1 1 0 001-1v-3"/></Icon>,
  Download: (p) => <Icon {...p}><path d="M10 3v10m0 0L6 9m4 4l4-4M3 13v3a1 1 0 001 1h12a1 1 0 001-1v-3"/></Icon>,
  Grid: (p) => <Icon {...p}><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></Icon>,
  List: (p) => <Icon {...p}><path d="M6 5h11M6 10h11M6 15h11"/><circle cx="3.5" cy="5" r="0.8" fill="currentColor"/><circle cx="3.5" cy="10" r="0.8" fill="currentColor"/><circle cx="3.5" cy="15" r="0.8" fill="currentColor"/></Icon>,
  Filter: (p) => <Icon {...p}><path d="M3 5h14l-5 6v5l-4-2v-3L3 5z"/></Icon>,
  Metronome: (p) => <Icon {...p}><path d="M7 4h6l2 13H5L7 4zM10 6v8M10 14l4-3"/></Icon>,
  Hand: (p) => <Icon {...p}><path d="M7 9V5a1 1 0 012 0v4M9 9V4a1 1 0 012 0v5M11 9V5a1 1 0 012 0v4M13 9V7a1 1 0 012 0v6c0 2.5-2 4-4.5 4S6 16 6 13v-1l-1.5-2a1 1 0 011.5-1.4L7 10"/></Icon>,
  Loop: (p) => <Icon {...p}><path d="M4 8a4 4 0 014-4h4l-2-2m2 2l-2 2M16 12a4 4 0 01-4 4H8l2 2m-2-2l2-2"/></Icon>,
  Wait: (p) => <Icon {...p}><circle cx="10" cy="10" r="6"/><path d="M10 7v3l2 1"/></Icon>,
  Rec: (p) => <Icon {...p}><circle cx="10" cy="10" r="4" fill="currentColor" stroke="none"/></Icon>,
  Midi: (p) => <Icon {...p}><circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="6" r="0.6" fill="currentColor"/><circle cx="6.5" cy="8.5" r="0.6" fill="currentColor"/><circle cx="13.5" cy="8.5" r="0.6" fill="currentColor"/><circle cx="7.5" cy="13" r="0.6" fill="currentColor"/><circle cx="12.5" cy="13" r="0.6" fill="currentColor"/></Icon>,
  Pedal: (p) => <Icon {...p}><path d="M4 13h12l-1 3H5l-1-3zM6 13l1-5h6l1 5"/></Icon>,
  Volume: (p) => <Icon {...p}><path d="M4 8h2l4-3v10L6 12H4V8zM13 7c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3M15.5 5c1.5 1.2 2.5 3 2.5 5s-1 3.8-2.5 5"/></Icon>,
  VolumeMute: (p) => <Icon {...p}><path d="M4 8h2l4-3v10L6 12H4V8zM13 8l4 4M17 8l-4 4"/></Icon>,
  Globe: (p) => <Icon {...p}><circle cx="10" cy="10" r="6.5"/><path d="M3.5 10h13M10 3.5c2 2.5 2 10.5 0 13M10 3.5c-2 2.5-2 10.5 0 13"/></Icon>,
  Check: (p) => <Icon {...p}><path d="M4 10l4 4 8-8"/></Icon>,
  Trash: (p) => <Icon {...p}><path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/></Icon>,
  Edit: (p) => <Icon {...p}><path d="M4 14l9-9 3 3-9 9H4v-3zM12 6l3 3"/></Icon>,
  More: (p) => <Icon {...p}><circle cx="5" cy="10" r="1" fill="currentColor"/><circle cx="10" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></Icon>,
  Chevron: (p) => <Icon {...p}><path d="M7 5l5 5-5 5"/></Icon>,
  ChevronDown: (p) => <Icon {...p}><path d="M5 7l5 5 5-5"/></Icon>,
  Sparkle: (p) => <Icon {...p}><path d="M10 3v4M10 13v4M3 10h4M13 10h4M5 5l2 2M13 13l2 2M5 15l2-2M13 7l2-2"/></Icon>,
  Crown: (p) => <Icon {...p}><path d="M3 6l2 9h10l2-9-4 3-3-5-3 5-4-3z"/></Icon>,
  Note: (p) => <Icon {...p}><path d="M8 14V4l8-1v10"/><circle cx="6" cy="14" r="2"/><circle cx="14" cy="13" r="2"/></Icon>,
  Piano: (p) => <Icon {...p}><rect x="3" y="5" width="14" height="10" rx="1"/><path d="M7 5v6M11 5v6M15 5v6M5 11h2v4M9 11h2v4M13 11h2v4"/></Icon>,
  Folder: (p) => <Icon {...p}><path d="M3 6a1 1 0 011-1h4l1.5 1.5H16a1 1 0 011 1V15a1 1 0 01-1 1H4a1 1 0 01-1-1V6z"/></Icon>,
  Calendar: (p) => <Icon {...p}><rect x="3" y="5" width="14" height="12" rx="1"/><path d="M3 8h14M7 3v3M13 3v3"/></Icon>,
  Flame: (p) => <Icon {...p}><path d="M10 17c-3 0-5-2-5-5 0-2 1.5-3 2-5 .3-1 0-3 0-3s2 1 3 3 0-3 2-4c0 0 0 3 1 4s2 2.5 2 5c0 3-2 5-5 5z"/></Icon>,
  Clock: (p) => <Icon {...p}><circle cx="10" cy="10" r="6.5"/><path d="M10 6v4l3 2"/></Icon>,
  Trophy: (p) => <Icon {...p}><path d="M6 4h8v4a4 4 0 01-8 0V4zM4 5H2v2a3 3 0 003 3M16 5h2v2a3 3 0 01-3 3M8 13h4v3H8zM7 17h6"/></Icon>,
  Mic: (p) => <Icon {...p}><rect x="8" y="3" width="4" height="9" rx="2"/><path d="M5 10a5 5 0 0010 0M10 15v3M7 18h6"/></Icon>,
  ArrowRight: (p) => <Icon {...p}><path d="M4 10h12M11 5l5 5-5 5"/></Icon>,
  ArrowLeft: (p) => <Icon {...p}><path d="M16 10H4M9 5l-5 5 5 5"/></Icon>,
  Sun: (p) => <Icon {...p}><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5L6 6M14 14l1.5 1.5M4.5 15.5L6 14M14 6l1.5-1.5"/></Icon>,
  Moon: (p) => <Icon {...p}><path d="M14 11A6 6 0 016 4a6 6 0 108 7z"/></Icon>,
  Eye: (p) => <Icon {...p}><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="10" cy="10" r="2"/></Icon>,
  Phone: (p) => <Icon {...p}><rect x="6" y="2" width="8" height="16" rx="1.5"/><path d="M9 16h2"/></Icon>,
};

window.I = I;
