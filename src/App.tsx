import { type KeyboardEvent, type MouseEvent, type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BookOpen, ChevronRight, CircleHelp, Code2, Copy, Flame, Gauge, Home as House, Link2, Moon, PencilLine, Play, Plus, RotateCcw, Settings, Share2, Sparkles, Sun, Timer, Trophy, Volume2, X } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import type { User } from 'firebase/auth';
import type { Card, DraftTopic, Knight, Theme, Topic } from '@/types';
import { ensureAnonymousUser, firebaseConfigured, loadCloudKnights, loadSharedKnight, saveCloudKnight, saveSharedKnight, subscribeToFirebaseAuth } from '@/lib/firebase';
import { playSound } from '@/lib/sounds';

const queryClient = new QueryClient();
const STORAGE_KEY = 'memy-mate-knights-v1';
const THEME_KEY = 'memy-mate-theme-v1';
const SHARED_KEY = 'memy-mate-shared-v1';

const seededKnights: Knight[] = [
  {
    id: 'neural-pathways',
    name: 'Neural Pathways',
    topic: 'Biology · Chapter 04',
    description: 'The signals behind how we learn, move, and remember.',
    sessions: 6,
    bestScore: 88,
    createdAt: '2026-01-12',
    cards: [
      { id: 'np-1', prompt: 'What is a synapse?', answer: 'The junction where one neuron communicates with another cell.', seconds: 12 },
      { id: 'np-2', prompt: 'Name the two major types of neurotransmitters.', answer: 'Excitatory and inhibitory neurotransmitters.', seconds: 12 },
      { id: 'np-3', prompt: 'What does long-term potentiation strengthen?', answer: 'The connection between neurons after repeated activation.', seconds: 12 },
    ],
  },
  {
    id: 'french-cafe',
    name: 'French at the Café',
    topic: 'Language · Starter set',
    description: 'Small phrases for a brave first conversation.',
    sessions: 3,
    bestScore: 64,
    createdAt: '2026-01-19',
    cards: [
      { id: 'fr-1', prompt: 'How do you ask for a coffee?', answer: 'Je voudrais un café, s’il vous plaît.', seconds: 10 },
      { id: 'fr-2', prompt: 'What does “à bientôt” mean?', answer: 'See you soon.', seconds: 10 },
    ],
  },
  {
    id: 'design-principles',
    name: 'Design Principles',
    topic: 'Studio · Foundations',
    description: 'A compact set for making visual decisions with intent.',
    sessions: 0,
    bestScore: 0,
    createdAt: '2026-02-01',
    cards: [
      { id: 'dp-1', prompt: 'What creates visual hierarchy?', answer: 'Difference: size, weight, color, spacing, or position.', seconds: 14 },
      { id: 'dp-2', prompt: 'Why use a spacing system?', answer: 'To make relationships predictable and the interface easier to scan.', seconds: 14 },
    ],
  },
];

function getTopics(knight: Knight): Topic[] {
  if (knight.topics?.length) return knight.topics;
  return [{ id: `${knight.id}-topic`, name: knight.topic, cards: knight.cards }];
}

function getCards(knight: Knight): Card[] {
  return getTopics(knight).flatMap((topic) => topic.cards);
}

function autoSeconds(text: string): number {
  return Math.max(1, Math.ceil(text.length / 20));
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type AppState = {
  knights: Knight[];
  addKnight: (knight: Knight) => void;
  updateKnight: (id: string, patch: Partial<Knight>) => void;
  shareKnight: (knight: Knight) => Promise<string>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  firebaseUser: User | null;
  firebaseReady: boolean;
};
const AppContext = createContext<AppState | null>(null);
const useAppState = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error('MeMyMate state is unavailable');
  return value;
};

function readKnights(): Knight[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : seededKnights;
  } catch {
    return seededKnights;
  }
}

function readTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'sunset' ? stored : 'light';
}

function sharePath(id: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/share/${encodeURIComponent(id)}`;
}

function saveLocalSharedKnight(knight: Knight): void {
  try {
    const current = JSON.parse(window.localStorage.getItem(SHARED_KEY) || '{}') as Record<string, Knight>;
    window.localStorage.setItem(SHARED_KEY, JSON.stringify({ ...current, [knight.id]: knight }));
  } catch {
    // Sharing still returns a usable link when local storage is unavailable.
  }
}

function loadLocalSharedKnight(id: string): Knight | null {
  try {
    const current = JSON.parse(window.localStorage.getItem(SHARED_KEY) || '{}') as Record<string, Knight>;
    return current[id] ?? null;
  } catch {
    return null;
  }
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="MeMyMate home">
      <span className="brand-symbol">M</span>
      {!compact && <span className="brand-name">MeMy<b>Mate</b></span>}
    </span>
  );
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: House },
  { href: '/create', label: 'Create a Knight', icon: Plus },
  { href: '/guide', label: 'Quick guide', icon: CircleHelp },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function Navigation() {
  const [location] = useLocation();
  const { firebaseUser } = useAppState();
  return (
    <>
      <aside className="sidebar">
        <Link href="/" className="brand" data-testid="link-brand"><LogoMark /></Link>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} aria-current={location === href ? 'page' : undefined} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon className="nav-icon" strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <Link href="/guide" className="button button-soft" data-testid="button-open-guide"><BookOpen size={15} /> How it works</Link>
          <div className="profile-chip">
            <span className="avatar">{firebaseUser ? 'MM' : 'AS'}</span>
            <span><strong>{firebaseUser ? 'Anonymous student' : 'Offline student'}</strong><small>{firebaseUser ? 'Firebase synced' : 'Device-only mode'}</small></span>
          </div>
        </div>
      </aside>
      <nav className="mobile-bar" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} aria-current={location === href ? 'page' : undefined} data-testid={`mobile-link-${label.toLowerCase().replaceAll(' ', '-')}`}>
            <Icon className="nav-icon" strokeWidth={1.8} /><span>{label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="app-shell"><Navigation /><main className="main"><a className="skip-link" href="#main-content">Skip to content</a><div className="page-wrap" id="main-content" tabIndex={-1}>{children}</div></main></div>;
}

function Topbar({ current }: { current: string }) {
  return (
    <header className="topbar">
      <div className="breadcrumb"><span>MeMyMate</span><ChevronRight size={12} style={{ verticalAlign: 'middle', margin: '0 5px' }} /><strong>{current}</strong></div>
      <div className="top-actions">
        <Link href="/guide" className="icon-button" aria-label="Open quick guide" data-testid="button-top-guide"><CircleHelp size={17} /></Link>
        <Link href="/settings" className="icon-button" aria-label="Open settings" data-testid="button-top-settings"><Settings size={17} /></Link>
        <Link href="/create" className="button button-primary" data-testid="button-top-create"><Plus size={15} /> New Knight</Link>
      </div>
    </header>
  );
}

function Splash() {
  return (
    <div className="splash" data-testid="status-splash">
      <div>
        <div className="splash-mark"><img src={`${import.meta.env.BASE_URL}arct-logo.png`} alt="ARCT" className="splash-logo" /></div>
        <div className="splash-copy"><strong className="display">MeMyMate</strong><p>loading your study arena</p></div>
      </div>
    </div>
  );
}

function Home() {
  const { knights, shareKnight } = useAppState();
  const featured = knights[0];
  const totalCards = knights.reduce((sum, knight) => sum + getCards(knight).length, 0);
  const [sharedId, setSharedId] = useState('');
  const handleShare = async (event: MouseEvent, knight: Knight) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const link = await shareKnight(knight);
      await copyText(link);
      setSharedId(knight.id);
      window.setTimeout(() => setSharedId(''), 2600);
    } catch {
      setSharedId('');
    }
  };
  return (
    <Shell>
      <Topbar current="Dashboard" />
      <section className="hero-grid fade-in">
        <div>
          <div className="eyebrow">Your study arena</div>
          <h1 className="display hero-title">Ready to make<br />memory <em>stick?</em></h1>
          <p className="hero-copy">Turn your notes into Knights, then take them for a quick speaking-and-tapping duel. One card at a time. No dull drills.</p>
          <div style={{ marginTop: 24 }}><Link href={`/practice/${featured.id}`} className="button button-primary" data-testid="button-continue-practice"><Play size={15} fill="currentColor" /> Continue practice</Link></div>
        </div>
        <div className="level-card rise-in stagger-2">
          <div className="level-meta"><span>Your progress</span><strong>LEVEL 04</strong></div>
          <h3 className="display">Pathfinder</h3>
          <div className="progress-track"><div className="progress-fill" style={{ width: '68%' }} /></div>
          <div className="level-foot"><span>340 XP to next rank</span><span>68%</span></div>
        </div>
      </section>

      <div className="section-head">
        <div><h2 className="display">Your Knights</h2><p>Small challenges, real recall.</p></div>
        <Link href="/create" className="text-link" data-testid="link-see-create">Build a new one <ChevronRight size={14} style={{ verticalAlign: 'middle' }} /></Link>
      </div>
      <section className="knight-grid" aria-label="Your Knights">
        {knights.slice(0, 3).map((knight, index) => (
          <Link href={`/practice/${knight.id}`} key={knight.id} className={`knight-card rise-in stagger-${index + 1} ${index === 0 ? 'large' : ''}`} data-testid={`card-knight-${knight.id}`}>
            <div className="card-art"><span className="card-number">0{index + 1} / KNIGHT</span></div>
            <div className="card-body"><span className="tag">{knight.topic.split(' · ')[0]}</span><h3>{knight.name}</h3><p>{knight.description}</p><div className="card-bottom"><span>{getTopics(knight).length} topics · {getCards(knight).length} cards</span><span className="card-actions"><span>{knight.bestScore ? `${knight.bestScore}% best` : 'Not started'}</span><button type="button" className="card-share" onClick={(event) => void handleShare(event, knight)} aria-label={`Copy share link for ${knight.name}`} title="Copy share link"><Share2 size={13} />{sharedId === knight.id ? 'Copied' : 'Share'}</button></span></div></div>
          </Link>
        ))}
      </section>
      <p className="share-note" aria-live="polite">{sharedId ? 'Share link copied. Anyone with the link can open a read-only preview.' : 'Share any Knight with a friend from its card.'}</p>

      <div className="section-head"><div><h2 className="display">Your rhythm</h2><p>A little consistency beats a perfect plan.</p></div></div>
      <section className="stats-row">
        <div className="stat-card"><span className="label">Cards in your armory</span><strong className="value">{totalCards}<small> total</small></strong></div>
        <div className="stat-card"><span className="label">Practice sessions</span><strong className="value">{knights.reduce((sum, knight) => sum + knight.sessions, 0)}<small> wins</small></strong></div>
        <div className="stat-card streak-card"><span className="label"><Flame size={13} style={{ verticalAlign: 'middle' }} /> Current streak</span><strong className="value">4<small> days</small></strong><div className="streak-dots" aria-label="Four day streak"><i className="on" /><i className="on" /><i className="on" /><i className="on" /><i /></div></div>
      </section>
    </Shell>
  );
}

function parseCardBody(body: string, secondsToken?: string, repetitionsToken?: string): Card {
  const [promptPart, answerPart] = body.trim().split(/\s*(?:=>|->|\|)\s*/, 2);
  const prompt = answerPart ? promptPart.trim() : 'Say the memorized content';
  const answer = (answerPart ?? promptPart).trim();
  const requestedSeconds = Number(secondsToken);
  const requestedRepetitions = Number(repetitionsToken);
  return {
    id: makeId('card'),
    prompt,
    answer,
    seconds: requestedSeconds > 0 ? requestedSeconds : autoSeconds(answer),
    repetitions: requestedRepetitions > 0 ? Math.floor(requestedRepetitions) : 1,
  };
}

function parseKnightLanguage(input: string, fallbackTopic: string): { name: string; topic: string; topics: Topic[]; cards: Card[] } {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let name = fallbackTopic.trim() || 'Untitled Knight';
  let currentTopic = 'Custom set';
  const topicMap = new Map<string, Card[]>();
  const ensureTopic = (topicName: string) => {
    currentTopic = topicName.trim() || `Topic ${topicMap.size + 1}`;
    if (!topicMap.has(currentTopic)) topicMap.set(currentTopic, []);
  };
  ensureTopic(currentTopic);

  const xmlTokens = /<topic\d*\s*>([\s\S]*?)<\/topic\s*>|<k\d*(?:\s+([\d.]+))?\s*>([\s\S]*?)<(\d+)?\/k\s*>/gi;
  const titleMatch = input.match(/<title\s*>([\s\S]*?)<\/title\s*>/i);
  if (titleMatch) name = titleMatch[1].trim();
  let xmlMatch: RegExpExecArray | null;
  let hadXml = false;
  while ((xmlMatch = xmlTokens.exec(input))) {
    hadXml = true;
    if (xmlMatch[1] !== undefined) {
      ensureTopic(xmlMatch[1]);
    } else {
      topicMap.get(currentTopic)?.push(parseCardBody(xmlMatch[3], xmlMatch[2], xmlMatch[4]));
    }
  }

  if (!hadXml) {
    for (const line of lines) {
      const topicMatch = line.match(/^(?:topic|title|name)\s*[:=]\s*(.+)$/i) ?? line.match(/^\[topic\]\s*(.+)$/i);
      if (topicMatch) {
        const topicName = topicMatch[1].trim();
        if (/^(?:title|name)$/i.test(topicMatch[0].split(/[:=]/)[0].trim())) name = topicName;
        ensureTopic(topicName);
        continue;
      }
      const cardMatch = line.match(/^(?:k|card)\s*(?:(\d+(?:\.\d+)?)\s*)?(?:x(\d+)\s*)?(?::|=)\s*(.+)$/i) ?? line.match(/^\[k\]\s*(.+)$/i);
      if (cardMatch) {
        const body = cardMatch[3] ?? cardMatch[1] ?? cardMatch[2];
        if (body) topicMap.get(currentTopic)?.push(parseCardBody(body, cardMatch[1], cardMatch[2]));
      }
    }
    if (!Array.from(topicMap.values()).some((cards) => cards.length)) {
      for (const line of lines) {
        if (/^(?:topic|title|name|k|card)\b/i.test(line)) continue;
        topicMap.get(currentTopic)?.push(parseCardBody(line));
      }
    }
  }

  const topics = Array.from(topicMap.entries())
    .map(([topicName, cards], index) => ({ id: makeId(`topic-${index}`), name: topicName, cards: cards.slice(0, 50) }))
    .filter((topic) => topic.cards.length);
  if (!topics.length) topics.push({ id: makeId('topic'), name: currentTopic, cards: [] });
  const cards = topics.flatMap((topic) => topic.cards);
  const firstTopic = topics[0]?.name ?? 'Custom set';
  if (name === fallbackTopic && firstTopic !== 'Custom set') name = firstTopic;
  return { name, topic: topics.length > 1 ? `${firstTopic} · ${topics.length} topics` : firstTopic, topics, cards };
}

function CreatePage() {
  const [, setLocation] = useLocation();
  const { addKnight } = useAppState();
  const [mode, setMode] = useState<'typed' | 'language'>('typed');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [typedTopics, setTypedTopics] = useState<DraftTopic[]>([{
    id: 'topic-draft-1',
    name: 'Topic 1',
    cards: [{ id: 'card-draft-1', prompt: '', answer: '', seconds: 1, repetitions: 1 }],
  }]);
  const [language, setLanguage] = useState('<knightcode>\n<title>The Water Cycle</title>\n<topic1>Evaporation</topic>\n<k1 5>What powers evaporation? => Heat from the sun.<3/k>\n<topic2>Rainfall</topic>\n<k1>Where does rain begin? => In clouds, when water vapor condenses.</k>\n</knightcode>');
  const [error, setError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const aiPrompt = 'Create Knight Code for MeMyMate. Use 2 to 4 topics. Each topic must contain concise spoken-answer playcards. Format every card as <k1 5>Question => Answer<3/k>. Use 100 characters = 5 seconds when timing is omitted. Return only the Knight Code.';
  const updateTopic = (topicId: string, patch: Partial<DraftTopic>) => {
    setTypedTopics((topics) => topics.map((topicItem) => topicItem.id === topicId ? { ...topicItem, ...patch } : topicItem));
  };
  const updateCard = (topicId: string, cardId: string, patch: Partial<Card>) => {
    setTypedTopics((topics) => topics.map((topicItem) => topicItem.id === topicId
      ? { ...topicItem, cards: topicItem.cards.map((card) => card.id === cardId ? { ...card, ...patch } : card) }
      : topicItem));
  };
  const addTopic = () => {
    const index = typedTopics.length + 1;
    setTypedTopics((topics) => [...topics, { id: makeId('topic-draft'), name: `Topic ${index}`, cards: [{ id: makeId('card-draft'), prompt: '', answer: '', seconds: 1, repetitions: 1 }] }]);
  };
  const removeTopic = (topicId: string) => {
    setTypedTopics((topics) => topics.length > 1 ? topics.filter((topicItem) => topicItem.id !== topicId) : topics);
  };
  const addCard = (topicId: string) => {
     setTypedTopics((topics) => topics.map((topicItem) => topicItem.id === topicId ? { ...topicItem, cards: [...topicItem.cards, { id: makeId('card-draft'), prompt: '', answer: '', seconds: 1, repetitions: 1 }] } : topicItem));
  };
  const removeCard = (topicId: string, cardId: string) => {
    setTypedTopics((topics) => topics.map((topicItem) => topicItem.id === topicId && topicItem.cards.length > 1 ? { ...topicItem, cards: topicItem.cards.filter((card) => card.id !== cardId) } : topicItem));
  };
  const submit = () => {
    let parsed: { name: string; topic: string; topics: Topic[]; cards: Card[] };
    if (mode === 'language') {
      if (!language.trim()) { setError('Add Knight Code before you enter the arena.'); return; }
      parsed = parseKnightLanguage(language, name || 'My New Knight');
    } else {
      const topics = typedTopics.map((topicItem, topicIndex) => ({
        id: makeId(`topic-${topicIndex}`),
        name: topicItem.name.trim() || `Topic ${topicIndex + 1}`,
        cards: topicItem.cards
          .filter((card) => card.prompt.trim() || card.answer.trim())
          .map((card) => {
            const prompt = card.prompt.trim() || card.answer.trim();
            const answer = card.answer.trim() || prompt;
            return { ...card, id: makeId('card'), prompt, answer, seconds: card.seconds > 0 ? card.seconds : autoSeconds(answer), repetitions: Math.max(1, Math.floor(card.repetitions ?? 1)) };
          }),
      })).filter((topicItem) => topicItem.cards.length);
      const cards = topics.flatMap((topicItem) => topicItem.cards);
      if (!cards.length) { setError('Add at least one playcard before you enter the arena.'); return; }
      parsed = { name: name.trim() || 'My New Knight', topic: topics[0].name, topics, cards };
    }
    if (!parsed.cards.length) { setError('Add at least one playcard before you enter the arena.'); return; }
    const knight: Knight = { ...parsed, name: name.trim() || parsed.name, id: makeId('knight'), description: description.trim() || 'A fresh challenge from your notes.', sessions: 0, bestScore: 0, createdAt: new Date().toISOString() };
    addKnight(knight);
    setLocation(`/practice/${knight.id}`);
  };
  return (
    <Shell>
      <Topbar current="Create a Knight" />
      <div className="page-title fade-in"><div className="eyebrow">Forge a new challenge</div><h1 className="display">Give your notes<br />a fighting chance.</h1><p>One Knight can hold many topics. Each topic holds playcards with their own speaking time and consecutive repeats.</p></div>
      <div className="form-layout">
        <section className="panel rise-in">
          <h2>Build your Knight</h2><p>During memorization, each answer stays visible for the number of repetitions you choose. The final test hides it.</p>
          <div className="mode-toggle" role="tablist" aria-label="Card input mode">
            <button type="button" className={mode === 'typed' ? 'active' : ''} onClick={() => setMode('typed')} data-testid="button-mode-typed"><PencilLine size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Type notes</button>
            <button type="button" className={mode === 'language' ? 'active' : ''} onClick={() => setMode('language')} data-testid="button-mode-language"><Code2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Knight Code</button>
          </div>
          <div className="field"><label htmlFor="knight-name">Knight name</label><input id="knight-name" className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Organic Chemistry" data-testid="input-knight-name" /></div>
          {mode === 'typed' ? <>
            <div className="field"><label htmlFor="knight-description">Short description <span className="field-hint">(optional)</span></label><input id="knight-description" className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Biology, Chapter 04" data-testid="input-knight-description" /></div>
            <div className="topic-stack">
              {typedTopics.map((topicItem, topicIndex) => <section className="topic-builder" key={topicItem.id}>
                <div className="topic-builder-head"><div><span className="eyebrow">Topic {String(topicIndex + 1).padStart(2, '0')}</span><input className="input topic-name-input" value={topicItem.name} onChange={(event) => updateTopic(topicItem.id, { name: event.target.value })} aria-label={`Topic ${topicIndex + 1} name`} data-testid={`input-topic-name-${topicIndex}`} /></div><button type="button" className="icon-button" onClick={() => removeTopic(topicItem.id)} aria-label={`Remove topic ${topicIndex + 1}`} disabled={typedTopics.length === 1}><X size={15} /></button></div>
                <div className="playcard-stack">
                  {topicItem.cards.map((card, cardIndex) => <div className="playcard-builder" key={card.id}>
                    <div className="playcard-number">{String(cardIndex + 1).padStart(2, '0')}</div>
                    <div className="playcard-fields">
                      <div className="field"><label htmlFor={`${card.id}-prompt`}>Question / cue</label><input id={`${card.id}-prompt`} className="input" value={card.prompt} onChange={(event) => updateCard(topicItem.id, card.id, { prompt: event.target.value })} placeholder="What do you want to be asked?" data-testid={`input-card-prompt-${topicIndex}-${cardIndex}`} /></div>
                       <div className="field"><label htmlFor={`${card.id}-answer`}>Answer to say</label><textarea id={`${card.id}-answer`} className="textarea compact-textarea" value={card.answer} onChange={(event) => updateCard(topicItem.id, card.id, { answer: event.target.value, ...(!card.secondsManual ? { seconds: autoSeconds(event.target.value) } : {}) })} placeholder="What you will say aloud" data-testid={`input-card-answer-${topicIndex}-${cardIndex}`} /><small className="field-note">{card.secondsManual ? 'Custom time' : `${card.seconds || autoSeconds(card.answer)} sec · updates as you type`}</small></div>
                      <div className="card-settings">
                         <div className="field"><label htmlFor={`${card.id}-seconds`}>Seconds</label><input id={`${card.id}-seconds`} className="input" type="number" min="1" step="1" value={card.seconds} onChange={(event) => updateCard(topicItem.id, card.id, { seconds: Number(event.target.value) || 1, secondsManual: true })} data-testid={`input-card-seconds-${topicIndex}-${cardIndex}`} /></div>
                        <div className="field"><label htmlFor={`${card.id}-repetitions`}>Repeats</label><input id={`${card.id}-repetitions`} className="input" type="number" min="1" step="1" value={card.repetitions ?? 1} onChange={(event) => updateCard(topicItem.id, card.id, { repetitions: Number(event.target.value) })} data-testid={`input-card-repetitions-${topicIndex}-${cardIndex}`} /></div>
                      </div>
                    </div>
                    <button type="button" className="icon-button playcard-remove" onClick={() => removeCard(topicItem.id, card.id)} aria-label={`Remove playcard ${cardIndex + 1}`} disabled={topicItem.cards.length === 1}><X size={14} /></button>
                  </div>)}
                </div>
                <button type="button" className="button button-soft add-card-button" onClick={() => addCard(topicItem.id)} data-testid={`button-add-card-${topicIndex}`}><Plus size={14} /> Add playcard</button>
              </section>)}
            </div>
            <button type="button" className="button button-ghost add-topic-button" onClick={addTopic} data-testid="button-add-topic"><Plus size={14} /> Add another topic</button>
          </> : <div className="field"><label htmlFor="knight-cards">Knight Code</label><textarea id="knight-cards" className="textarea code-textarea" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder={'<topic1>Topic name</topic>\n<k1 5>Question => Answer<3/k>'} data-testid="textarea-knight-cards" /></div>}
          {error && <p role="alert" style={{ color: 'hsl(var(--destructive))', fontSize: 11, margin: '12px 0 0' }} data-testid="status-create-error">{error}</p>}
          <div className="form-footer"><Link href="/" className="button button-ghost" data-testid="button-cancel-create">Cancel</Link><button type="button" className="button button-primary" onClick={submit} data-testid="button-create-knight"><Sparkles size={15} /> Enter the arena</button></div>
        </section>
        <aside>
          <section className="panel rise-in stagger-1"><h2>Build for speaking</h2><p>Each playcard is a small spoken memory, not a multiple-choice question.</p><div className="tip-list"><div className="tip"><span className="tip-mark">01</span><div><strong>One idea</strong><p>Write a cue and the answer you want to say aloud.</p></div></div><div className="tip"><span className="tip-mark">02</span><div><strong>One clock</strong><p>100 characters equals 5 seconds. Knight Code fills this in when you omit time.</p></div></div><div className="tip"><span className="tip-mark">03</span><div><strong>Repeat it</strong><p>Set consecutive repeats until the answer feels familiar.</p></div></div></div></section>
           <section className="panel rise-in stagger-2"><h2>Knight Code</h2><p>Use tags when you want to paste a set quickly.</p><div className="syntax-box">&lt;topic1&gt;Memory basics&lt;/topic&gt;{'\n'}&lt;k1 5&gt;What is recall? =&gt; Finding stored knowledge&lt;3/k&gt;</div><div style={{ marginTop: 15 }}><Link href="/guide" className="text-link" data-testid="link-learn-syntax">See the full syntax <ChevronRight size={13} style={{ verticalAlign: 'middle' }} /></Link></div></section>
           <section className="panel rise-in stagger-3"><h2>Prompt an AI</h2><p>Paste this into your preferred AI tool, then paste its result into Knight Code.</p><div className="syntax-box ai-prompt">{aiPrompt}</div><button type="button" className="button button-soft prompt-copy" onClick={() => { void copyText(aiPrompt); setPromptCopied(true); window.setTimeout(() => setPromptCopied(false), 2200); }}><Copy size={14} /> {promptCopied ? 'Prompt copied' : 'Copy prompt'}</button></section>
        </aside>
      </div>
    </Shell>
  );
}

function PracticePage() {
  const params = useParams<{ id: string }>();
  const { knights, updateKnight } = useAppState();
  const knight = knights.find((item) => item.id === params.id) ?? knights[0];
  const topics = knight ? getTopics(knight).filter((topic) => topic.cards.length) : [];
  const [topicIndex, setTopicIndex] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [repeatIndex, setRepeatIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'topic-intro' | 'memorize' | 'test' | 'failed' | 'complete'>('topic-intro');
  const topic = topics[topicIndex];
  const card = topic?.cards[cardIndex];
  const total = topics.reduce((sum, item) => sum + item.cards.length, 0);
  const repetitions = card?.repetitions ?? 1;

  useEffect(() => {
    if ((status !== 'memorize' && status !== 'test') || !card) return;
    if (timeLeft <= 0) {
      setStatus('failed');
      playSound('error');
      return;
    }
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [status, card, timeLeft]);

  useEffect(() => {
    if ((status === 'memorize' || status === 'test') && timeLeft > 0 && timeLeft <= 3) playSound('tick');
  }, [status, timeLeft]);

  const reset = () => {
    setTopicIndex(0);
    setCardIndex(0);
    setRepeatIndex(0);
    setTimeLeft(0);
    setStatus('topic-intro');
    playSound('transition');
  };
  const startTopic = () => {
    if (!card) return;
    setTimeLeft(card.seconds);
    setStatus('memorize');
    playSound('transition');
  };
  const nextTopicOrComplete = () => {
    if (topicIndex < topics.length - 1) {
      setTopicIndex((current) => current + 1);
      setCardIndex(0);
      setRepeatIndex(0);
      setTimeLeft(0);
      setStatus('topic-intro');
      playSound('transition');
      return;
    }
    setStatus('complete');
    updateKnight(knight.id, { sessions: knight.sessions + 1, bestScore: Math.max(knight.bestScore, 100) });
    playSound('complete');
  };
  const advance = () => {
    if (!card) return;
    playSound('tap');
    if (status === 'memorize' && repeatIndex + 1 < repetitions) {
      setRepeatIndex((current) => current + 1);
      setTimeLeft(card.seconds);
      return;
    }
    if (cardIndex < topic.cards.length - 1) {
      setCardIndex((current) => current + 1);
      setRepeatIndex(0);
      setTimeLeft(card.seconds);
      return;
    }
    if (status === 'memorize') {
      setCardIndex(0);
      setRepeatIndex(0);
      setTimeLeft(topic.cards[0].seconds);
      setStatus('test');
      playSound('transition');
      return;
    }
    nextTopicOrComplete();
  };
  const handleCardKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      advance();
    }
  };

  if (!knight || !topic || !card) return <Shell><Topbar current="Practice" /><div className="panel">This Knight has no cards yet. <Link href="/create" className="text-link" data-testid="link-empty-create">Create one</Link></div></Shell>;
  const progress = card.seconds ? Math.max(0, Math.min(1, timeLeft / card.seconds)) : 0;
  const active = status === 'memorize' || status === 'test';
  return (
    <Shell>
      <Topbar current={`Practice · ${knight.name}`} />
      <div className="practice-wrap fade-in">
        <div className="practice-top">
          <div><div className="eyebrow">{status === 'test' ? 'Recall test' : status === 'memorize' ? 'Speak and remember' : 'Topic checkpoint'}</div><h1 className="display">{topic.name}</h1></div>
          <div className="practice-top-actions"><span data-testid="text-practice-progress">TOPIC {String(topicIndex + 1).padStart(2, '0')} / {String(topics.length).padStart(2, '0')}</span><button type="button" className="icon-button" onClick={reset} aria-label="Restart Knight" title="Restart Knight" data-testid="button-restart-practice"><RotateCcw size={16} /></button></div>
        </div>
        {active && <div className="timer-card" data-testid="status-timer"><svg className="timer-ring" viewBox="0 0 100 100" aria-label={`${timeLeft} seconds remaining`}><circle className="timer-bg" cx="50" cy="50" r="45" /><circle className="timer-progress" cx="50" cy="50" r="45" strokeDasharray="283" strokeDashoffset={283 * (1 - progress)} /></svg><div className="timer-center"><strong>{timeLeft}</strong><span>seconds</span></div><span className="timer-topic">{status === 'test' ? 'test' : `repeat ${repeatIndex + 1}/${repetitions}`}</span></div>}
        <div className="screen-swap" key={`${topicIndex}-${status}-${cardIndex}-${repeatIndex}`}>
          {status === 'topic-intro' && <button type="button" className="practice-card topic-gate" onClick={startTopic} data-testid="button-start-topic"><span className="topic-gate-mark"><Play size={22} fill="currentColor" /></span><span className="card-index">{topic.name}</span><h2>Start this topic</h2><span className="topic-gate-meta">{topic.cards.length} playcards · no time limit to begin</span></button>}
          {active && <button type="button" className={`practice-card content-card ${status === 'test' ? 'test-card' : ''}`} onClick={advance} onKeyDown={handleCardKeyDown} aria-label="Tap when you have said the answer" data-testid="button-advance-card"><span className="practice-card-content">{status === 'memorize' ? card.answer : card.prompt}</span></button>}
          {status === 'failed' && <div className="result fail"><div className="result-mark"><X size={27} /></div><h2 className="display">Time slipped away.</h2><p>Restart the Knight and try the topic again. The next attempt starts with a fresh clock.</p><button type="button" className="button button-primary" onClick={reset} data-testid="button-restart-failed"><RotateCcw size={15} /> Restart Knight</button></div>}
          {status === 'complete' && <div className="result"><div className="result-mark"><Trophy size={27} /></div><h2 className="display">Knight cleared.</h2><p>You completed all {total} playcards across {topics.length} topics.</p><button type="button" className="button button-primary" onClick={reset} data-testid="button-practice-again"><Play size={15} fill="currentColor" /> Run it again</button></div>}
        </div>
        {status === 'topic-intro' && <p className="practice-hint"><Volume2 size={13} /> Tap the topic card when you are ready to begin.</p>}
        {active && <p className="practice-hint"><Volume2 size={13} /> Tap anywhere on the card after you say the content.</p>}
      </div>
    </Shell>
  );
}

function SharedPage() {
  const params = useParams<{ id: string }>();
  const { addKnight, firebaseUser } = useAppState();
  const [knight, setKnight] = useState<Knight | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const shared = params.id ? ((await loadSharedKnight(params.id)) ?? loadLocalSharedKnight(params.id)) : null;
      if (!mounted) return;
      setKnight(shared);
      setStatus(shared ? 'ready' : 'missing');
    })();
    return () => { mounted = false; };
  }, [params.id]);
  const copyToCollection = () => {
    if (!knight) return;
    const copy = { ...knight, id: makeId('knight'), name: `${knight.name} · copy`, sessions: 0, bestScore: 0, createdAt: new Date().toISOString() };
    addKnight(copy);
  };
  return (
    <Shell>
      <Topbar current="Shared Knight" />
      {status === 'loading' && <div className="panel share-loading"><div className="loading-orbit" /><p>Opening the shared Knight…</p></div>}
      {status === 'missing' && <div className="result fail"><div className="result-mark"><Link2 size={27} /></div><h1 className="display">This link has expired.</h1><p>The Knight may have been removed or Firebase is not connected for this deployment.</p><Link href="/" className="button button-primary">Back to dashboard</Link></div>}
      {status === 'ready' && knight && <div className="shared-layout fade-in"><section className="shared-hero"><div className="eyebrow">Shared Knight</div><h1 className="display">{knight.name}</h1><p>{knight.description}</p><div className="shared-meta"><span>{getTopics(knight).length} topics</span><span>{getCards(knight).length} playcards</span><span>{firebaseUser ? 'Firebase synced' : 'Read-only preview'}</span></div><div className="shared-actions"><button type="button" className="button button-primary" onClick={copyToCollection} data-testid="button-copy-shared-knight"><Copy size={15} /> Copy to my Knights</button><Link href={`/practice/${knight.id}`} className="button button-ghost">Preview practice</Link></div></section><section className="shared-topics">{getTopics(knight).map((topic) => <article className="shared-topic" key={topic.id}><span className="card-index">{topic.name}</span><h2>{topic.cards.length} playcards</h2><p>{topic.cards.slice(0, 2).map((card) => card.answer).join(' · ')}</p></article>)}</section></div>}
    </Shell>
  );
}

function GuidePage() {
  return (
    <Shell>
      <Topbar current="Quick guide" />
      <div className="page-title fade-in"><div className="eyebrow">The Knight loop</div><h1 className="display">Study like you<br />have a quest.</h1><p>MeMyMate makes memorization a short, active challenge. Build a set, recall it under a timer, then return when the gaps start to feel comfortable.</p></div>
      <section className="guide-grid">
        <article className="loop-card accent rise-in"><span className="loop-number">01 / FORGE</span><h3>Build a Knight</h3><p>Turn a topic into compact sentence cards. Each card is one thing you want your future self to be able to say.</p></article>
        <article className="loop-card rise-in stagger-1"><span className="loop-number">02 / START</span><h3>Tap when ready</h3><p>Each topic opens on a calm checkpoint. There is no countdown until you tap its playcard.</p></article>
        <article className="loop-card rise-in stagger-2"><span className="loop-number">03 / RECALL</span><h3>Speak, then tap</h3><p>The answer or question is the only thing on the playcard. Tap the card after you say it aloud.</p></article>
        <article className="loop-card rise-in stagger-3"><span className="loop-number">04 / MOVE</span><h3>Change the scene</h3><p>Every topic ends with a screen transition and a new topic checkpoint, so the session stays easy to follow.</p></article>
        <section className="panel guide-wide rise-in"><h2>Knight Code</h2><p>Use a topic tag, then give each playcard an optional time and repeat count.</p><table className="syntax-table"><thead><tr><th>Write</th><th>What it does</th><th>Example</th></tr></thead><tbody><tr><td>&lt;topic1&gt;</td><td>Starts a topic. A Knight can have many.</td><td><span className="mono">&lt;topic1&gt;Cell biology&lt;/topic&gt;</span></td></tr><tr><td>&lt;k1 5&gt;</td><td>Creates a card with a 5 second timer.</td><td><span className="mono">&lt;k1 5&gt;What is ATP? =&gt; Cell energy&lt;/k&gt;</span></td></tr><tr><td>&lt;3/k&gt;</td><td>Repeats the card 3 consecutive times.</td><td><span className="mono">&lt;k1 5&gt;...&lt;3/k&gt;</span></td></tr><tr><td>Omitted values</td><td>Repeat defaults to 1. Time uses 100 characters = 5 seconds.</td><td><span className="mono">&lt;k1&gt;A long answer...&lt;/k&gt;</span></td></tr></tbody></table><div style={{ marginTop: 19 }}><Link href="/create" className="button button-primary" data-testid="button-try-language"><Code2 size={15} /> Try Knight Code</Link></div></section>
      </section>
    </Shell>
  );
}

function SettingsPage() {
  const { theme, setTheme, firebaseUser, firebaseReady } = useAppState();
  const choices: { id: Theme; label: string; caption: string; icon: typeof Sun }[] = [{ id: 'light', label: 'Paper', caption: 'Bright and clear', icon: Sun }, { id: 'dark', label: 'Midnight', caption: 'Low light focus', icon: Moon }, { id: 'sunset', label: 'Apricot', caption: 'Warm and vivid', icon: Sparkles }];
  return (
    <Shell>
      <Topbar current="Settings" />
      <div className="page-title fade-in"><div className="eyebrow">Your study space</div><h1 className="display">Make it feel<br />like yours.</h1><p>Choose the atmosphere that makes opening a Knight feel like a small invitation, not another task.</p></div>
      <div className="settings-layout">
        <section className="panel rise-in"><h2>Appearance</h2><p>Your theme is saved on this device.</p><div className="theme-grid">{choices.map(({ id, label, caption, icon: Icon }) => <button type="button" key={id} className={`theme-choice ${theme === id ? 'active' : ''}`} onClick={() => setTheme(id)} aria-pressed={theme === id} data-testid={`button-theme-${id}`}><div className={`theme-preview ${id}`}><span /></div><strong><Icon size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {label}</strong><small>{caption}</small></button>)}</div></section>
        <section className="panel rise-in stagger-1"><h2>Profile</h2><p>Anonymous sign-in keeps your study space private without a password.</p><div className="profile-card"><div className="profile-avatar">{firebaseUser ? 'MM' : 'AS'}</div><div><h3>{firebaseUser ? 'Anonymous student' : 'Offline student'}</h3><p>{firebaseReady ? 'Firebase Authentication is active' : 'Local mode · add Firebase web config to sync'}</p></div></div><div className="auth-status"><span className={`status-dot ${firebaseUser ? 'online' : ''}`} />{firebaseUser ? 'Signed in anonymously' : 'Using this device only'}</div></section>
        <section className="panel rise-in stagger-2"><h2>Practice preferences</h2><p>Small choices that shape the arena.</p><div className="tip-list"><div className="tip"><span className="tip-mark"><Timer size={13} /></span><div><strong>Default timer</strong><p>Each new card starts with 12 seconds. Edit the set later for a faster duel.</p></div></div><div className="tip"><span className="tip-mark"><Gauge size={13} /></span><div><strong>Recall first</strong><p>Answers stay hidden during practice. Your voice is the only shortcut.</p></div></div></div></section>
      </div>
    </Shell>
  );
}

function NotFound() {
  return <Shell><Topbar current="Lost page" /><div className="panel" style={{ textAlign: 'center', padding: 60 }}><h1 className="display">This path is not on the map.</h1><p style={{ color: 'hsl(var(--muted-foreground))' }}>Return to your dashboard and pick a Knight.</p><Link href="/" className="button button-primary" data-testid="button-return-home"><House size={15} /> Back to dashboard</Link></div></Shell>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const [location] = useLocation();
  const [showSplash, setShowSplash] = useState(location === '/');
  useEffect(() => {
    if (location !== '/') { setShowSplash(false); return; }
     const timer = window.setTimeout(() => setShowSplash(false), 3000);
    return () => window.clearTimeout(timer);
  }, [location]);
  if (showSplash) return <Splash />;
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/create" component={CreatePage} /><Route path="/practice/:id" component={PracticePage} /><Route path="/share/:id" component={SharedPage} /><Route path="/guide" component={GuidePage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function App() {
  const [knights, setKnights] = useState<Knight[]>(readKnights);
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(!firebaseConfigured);
  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(knights)); }, [knights]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubscribe = subscribeToFirebaseAuth(async (user) => {
      setFirebaseUser(user);
      setFirebaseReady(true);
      if (!user) return;
      try {
        const cloudKnights = await loadCloudKnights(user.uid);
        if (cloudKnights.length) setKnights(cloudKnights);
        else await Promise.all(knights.map((knight) => saveCloudKnight(user.uid, knight)));
      } catch (error) {
        console.warn('Firebase sync unavailable', error);
      }
    });
    void ensureAnonymousUser().catch((error) => {
      console.warn('Firebase anonymous sign-in unavailable', error);
      setFirebaseReady(true);
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-sunset', theme === 'sunset');
  }, [theme]);
  const value = useMemo<AppState>(() => ({
    knights,
    addKnight: (knight) => {
      setKnights((current) => [knight, ...current]);
      if (firebaseUser) void saveCloudKnight(firebaseUser.uid, knight);
    },
    updateKnight: (id, patch) => {
      setKnights((current) => current.map((knight) => knight.id === id ? { ...knight, ...patch } : knight));
      const updated = knights.find((knight) => knight.id === id);
      if (firebaseUser && updated) void saveCloudKnight(firebaseUser.uid, { ...updated, ...patch });
    },
    shareKnight: async (knight) => {
      saveLocalSharedKnight(knight);
      if (firebaseUser) await saveSharedKnight(firebaseUser.uid, knight);
      const link = new URL(sharePath(knight.id), window.location.origin).toString();
      return link;
    },
    theme,
    setTheme: setThemeState,
    firebaseUser,
    firebaseReady,
  }), [knights, theme, firebaseUser, firebaseReady]);
  return <QueryClientProvider client={queryClient}><TooltipProvider><AppContext.Provider value={value}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></AppContext.Provider></TooltipProvider></QueryClientProvider>;
}

export default App;