import React, { useMemo, useState } from 'react';
import { ArrowDown, Check, Crown, Droplets, Palette, RotateCcw, Sparkles, WandSparkles } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { UserAvatar } from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import { getCustomerDisplayName } from '../shared/finance';
import './universe.css';

type BottleTone = 'classic' | 'sunrise' | 'berry';
type IdentityFrame = 'classic' | 'gold' | 'pearl';
interface IdentitySettings {
  displayTitle: string;
  signature: string;
  bottleTone: BottleTone;
  frame: IdentityFrame;
  glow: number;
}

const DEFAULT_SETTINGS: IdentitySettings = {
  displayTitle: '',
  signature: 'Made of moments. Built to shine.',
  bottleTone: 'classic',
  frame: 'classic',
  glow: 68,
};
const TONES: Array<{ id: BottleTone; label: string; color: string; description: string }> = [
  { id: 'classic', label: 'Classic Ruby', color: '#D71920', description: 'The iconic red look' },
  { id: 'sunrise', label: 'Sunrise', color: '#F06B45', description: 'A warm sunset finish' },
  { id: 'berry', label: 'Berry Glow', color: '#A82D59', description: 'A rich berry accent' },
];
const FRAMES: Array<{ id: IdentityFrame; label: string; className: string }> = [
  { id: 'classic', label: 'Ruby', className: 'cc-frame-ruby' },
  { id: 'gold', label: 'Gold', className: 'cc-frame-gold' },
  { id: 'pearl', label: 'Pearl', className: 'cc-frame-pearl' },
];

function makeDefaultSettings(name: string): IdentitySettings {
  return { ...DEFAULT_SETTINGS, displayTitle: name || 'My Bottle' };
}
function loadIdentity(key: string, fallbackName: string): IdentitySettings {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return makeDefaultSettings(fallbackName);
    const parsed = JSON.parse(raw) as Partial<IdentitySettings>;
    const tone = TONES.some((item) => item.id === parsed.bottleTone) ? parsed.bottleTone as BottleTone : 'classic';
    const frame = FRAMES.some((item) => item.id === parsed.frame) ? parsed.frame as IdentityFrame : 'classic';
    return {
      ...makeDefaultSettings(fallbackName),
      displayTitle: typeof parsed.displayTitle === 'string' ? parsed.displayTitle.slice(0, 24) : fallbackName,
      signature: typeof parsed.signature === 'string' ? parsed.signature.slice(0, 64) : DEFAULT_SETTINGS.signature,
      bottleTone: tone,
      frame,
      glow: typeof parsed.glow === 'number' ? Math.min(100, Math.max(25, parsed.glow)) : DEFAULT_SETTINGS.glow,
    };
  } catch {
    return makeDefaultSettings(fallbackName);
  }
}

function LivingBottle({ tone, glow }: { tone: BottleTone; glow: number }) {
  const liquidColor = tone === 'sunrise' ? '#EF704B' : tone === 'berry' ? '#A82D59' : '#D71920';
  const highlightColor = tone === 'sunrise' ? '#FFC2A8' : tone === 'berry' ? '#E8A0BB' : '#FF9A9E';
  return (
    <div className="cc-bottle-float" style={{ filter: 'drop-shadow(0 18px 25px rgba(160, 30, 35, ' + (glow / 100 * 0.24).toFixed(2) + '))' }}>
      <svg viewBox="0 0 240 560" role="img" aria-label="Personalized digital bottle" className="cc-living-bottle">
        <defs>
          <linearGradient id="ccBottleGlass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity=".42" />
            <stop offset=".22" stopColor="#FFFFFF" stopOpacity=".88" />
            <stop offset=".52" stopColor="#F9E5D7" stopOpacity=".24" />
            <stop offset=".78" stopColor="#FFFFFF" stopOpacity=".72" />
            <stop offset="1" stopColor="#E7BEB4" stopOpacity=".52" />
          </linearGradient>
          <linearGradient id="ccBottleLiquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={highlightColor} />
            <stop offset=".34" stopColor={liquidColor} />
            <stop offset="1" stopColor={tone === 'berry' ? '#631B3D' : '#8C080E'} />
          </linearGradient>
          <linearGradient id="ccBottleLabel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D71920" />
            <stop offset="1" stopColor="#9F080E" />
          </linearGradient>
          <clipPath id="ccBottleClip">
            <path d="M85 50 Q85 31 103 31 H137 Q155 31 155 50 V99 Q155 119 177 130 Q211 147 211 189 V465 Q211 521 160 521 H80 Q29 521 29 465 V189 Q29 147 63 130 Q85 119 85 99 Z" />
          </clipPath>
        </defs>
        <ellipse cx="120" cy="537" rx="79" ry="12" fill="#A94D4A" opacity=".14" />
        <g clipPath="url(#ccBottleClip)">
          <rect x="25" y="30" width="190" height="495" fill="#FFF9F2" opacity=".2" />
          <rect x="25" y="292" width="190" height="240" fill="url(#ccBottleLiquid)" />
          <path d="M28 294 Q70 282 112 294 T212 294" fill="none" stroke={highlightColor} strokeWidth="5" opacity=".86" />
          <circle className="cc-bottle-bubble cc-bubble-one" cx="77" cy="390" r="5" fill="#FFF7EB" opacity=".8" />
          <circle className="cc-bottle-bubble cc-bubble-two" cx="165" cy="433" r="4" fill="#FFF7EB" opacity=".72" />
          <circle className="cc-bottle-bubble cc-bubble-three" cx="101" cy="477" r="3.5" fill="#FFF7EB" opacity=".7" />
          <rect x="43" y="273" width="154" height="143" rx="19" fill="url(#ccBottleLabel)" />
          <path d="M52 286 Q120 271 188 286" fill="none" stroke="#FFFFFF" strokeOpacity=".48" strokeWidth="2" />
          <text x="120" y="337" fill="#FFFFFF" textAnchor="middle" fontSize="25" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700">Coca-Cola</text>
          <path d="M66 351 Q120 365 174 351" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" opacity=".9" />
          <text x="120" y="382" fill="#FFFFFF" textAnchor="middle" fontSize="9" letterSpacing="2.5" fontWeight="700">UNIVERSE EDITION</text>
        </g>
        <path d="M85 50 Q85 31 103 31 H137 Q155 31 155 50 V99 Q155 119 177 130 Q211 147 211 189 V465 Q211 521 160 521 H80 Q29 521 29 465 V189 Q29 147 63 130 Q85 119 85 99 Z" fill="url(#ccBottleGlass)" stroke="#FFFFFF" strokeWidth="5" />
        <path d="M67 157 Q49 176 49 210 V442" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity=".68" />
        <path d="M181 164 Q194 184 194 217 V445" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity=".54" />
        <path d="M93 33 V96 Q93 119 74 131" fill="none" stroke="#FFFFFF" strokeWidth="4" opacity=".72" />
        <rect x="82" y="13" width="76" height="43" rx="9" fill="#C81018" stroke="#FFFFFF" strokeWidth="4" />
        <path d="M85 26 H155 M85 39 H155" stroke="#FFFFFF" strokeOpacity=".66" strokeWidth="2.2" />
        <path d="M43 465 Q120 490 197 465" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity=".56" />
        <path d="M52 183 Q64 151 91 143" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity=".78" />
      </svg>
    </div>
  );
}

export function UniversePage() {
  const { user } = useAuth();
  const actualName = getCustomerDisplayName(user);
  const storageKey = 'coca-cola:universe-identity:' + (user?.id || 'guest');
  const [settings, setSettings] = useState<IdentitySettings>(() => loadIdentity(storageKey, actualName));
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const activeTone = useMemo(() => TONES.find((tone) => tone.id === settings.bottleTone) || TONES[0], [settings.bottleTone]);
  const activeFrame = useMemo(() => FRAMES.find((frame) => frame.id === settings.frame) || FRAMES[0], [settings.frame]);

  const saveIdentity = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
      setSaved(true);
      setSaveError(false);
    } catch {
      setSaved(false);
      setSaveError(true);
    }
  };
  const resetIdentity = () => {
    setSettings(makeDefaultSettings(actualName));
    setSaved(false);
    setSaveError(false);
  };

  return (
    <AppShell title="Coca-Cola Universe">
      <div className="cc-universe-page space-y-6">
        <section className="cc-universe-hero grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
          <div className="relative z-10 flex flex-col justify-center p-6 sm:p-9 lg:p-11">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#B80D13] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Your personal universe
            </div>
            <p className="mt-5 text-sm font-semibold text-[#A74B43]">Welcome to your own little world</p>
            <h2 className="mt-2 max-w-xl text-3xl sm:text-4xl xl:text-5xl font-black leading-[1.08] tracking-tight text-[#68151A]">
              Your world.<br /><span className="text-[#D71920]">Your signature.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm sm:text-base leading-7 text-[#775B57]">
              Shape a digital identity that feels like yours, then bring your Living Bottle to life with your favorite finish and glow.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#identity-studio" className="inline-flex items-center gap-2 rounded-full bg-[#D71920] px-5 py-3 text-sm font-bold text-white shadow-md shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#B80D13]">
                Open Identity Studio <ArrowDown className="h-4 w-4" />
              </a>
              <span className="text-xs font-semibold text-[#A16A63]">A space made for you</span>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3 max-w-md">
              <div className="rounded-2xl border border-rose-100 bg-white/75 p-3"><Palette className="h-4 w-4 text-[#D71920]" /><p className="mt-2 text-[11px] font-bold text-[#6E2024]">Your look</p></div>
              <div className="rounded-2xl border border-rose-100 bg-white/75 p-3"><Droplets className="h-4 w-4 text-[#D71920]" /><p className="mt-2 text-[11px] font-bold text-[#6E2024]">Your bottle</p></div>
              <div className="rounded-2xl border border-rose-100 bg-white/75 p-3"><Crown className="h-4 w-4 text-[#D71920]" /><p className="mt-2 text-[11px] font-bold text-[#6E2024]">Your style</p></div>
            </div>
          </div>
          <div className="cc-universe-stage relative flex min-h-[410px] items-center justify-center overflow-hidden px-4 py-8 sm:min-h-[470px]">
            <div className="cc-universe-orbit cc-orbit-one" /><div className="cc-universe-orbit cc-orbit-two" />
            <div className="cc-universe-spark cc-spark-one">✦</div><div className="cc-universe-spark cc-spark-two">✧</div><div className="cc-universe-spark cc-spark-three">✦</div>
            <div className="absolute left-5 top-8 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#B15A57]">Living Bottle</p><p className="mt-0.5 text-xs font-extrabold text-[#7F1D25]">Universe Edition</p>
            </div>
            <LivingBottle tone={settings.bottleTone} glow={settings.glow} />
            <div className="absolute bottom-5 right-5 rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-right shadow-sm backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-widest text-[#A16A63]">Your signature</p><p className="mt-0.5 max-w-36 truncate text-sm font-bold text-[#741A20]">{settings.displayTitle || actualName}</p>
            </div>
          </div>
        </section>

        <section id="identity-studio" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#D71920]">Personal identity studio</p><h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Make it unmistakably yours.</h2><p className="mt-1 text-sm text-slate-500">Your choices change the preview instantly.</p></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-[#B80D13]"><WandSparkles className="h-3.5 w-3.5" /> Live customization</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-2 rounded-3xl border border-rose-100 bg-gradient-to-br from-white via-[#FFF9F5] to-[#FFE8E5] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#AB5B55]">Identity preview</span><span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold text-[#B80D13] shadow-sm">MY UNIVERSE</span></div>
              <div className="mt-7 flex flex-col items-center text-center">
                <div className={'rounded-full p-1.5 ' + activeFrame.className}><UserAvatar fullName={actualName} avatarUrl={user?.avatarUrl} size="lg" /></div>
                <h3 className="mt-4 max-w-full truncate text-xl font-black text-[#68151A]">{settings.displayTitle || actualName}</h3>
                <p className="mt-1 max-w-xs text-sm leading-6 text-[#895D58]">{settings.signature || 'Your universe, your story.'}</p>
                <div className="mt-5 flex items-center gap-2 rounded-full border border-white bg-white/80 px-3 py-2 shadow-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeTone.color }} /><span className="text-[11px] font-bold text-[#7F3031]">{activeTone.label} bottle finish</span></div>
              </div>
              <div className="mt-7 border-t border-rose-100 pt-4 flex items-center justify-between text-[11px] text-[#9A6A64]"><span>Profile photo stays unchanged</span><span className="font-bold">Preview only</span></div>
            </div>
            <div className="xl:col-span-3 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Universe display name</span>
                  <input value={settings.displayTitle} maxLength={24} onChange={(event) => { setSettings({ ...settings, displayTitle: event.target.value }); setSaved(false); }} placeholder="Give your bottle a name" className="mt-2 w-full rounded-xl border border-slate-200 bg-[#FFFCFA] px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#D71920] focus:ring-4 focus:ring-rose-100" />
                  <span className="mt-1 block text-[10px] text-slate-400">Up to 24 characters · only in your Universe</span>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-700">Your signature line</span>
                  <input value={settings.signature} maxLength={64} onChange={(event) => { setSettings({ ...settings, signature: event.target.value }); setSaved(false); }} placeholder="A short line that represents you" className="mt-2 w-full rounded-xl border border-slate-200 bg-[#FFFCFA] px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#D71920] focus:ring-4 focus:ring-rose-100" />
                  <span className="mt-1 block text-[10px] text-slate-400">Up to 64 characters</span>
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold text-slate-800">Choose your bottle color</h3><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">3 finishes</span></div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {TONES.map((tone) => (
                    <button key={tone.id} type="button" aria-pressed={settings.bottleTone === tone.id} onClick={() => { setSettings({ ...settings, bottleTone: tone.id }); setSaved(false); }} className={'flex items-center gap-3 rounded-2xl border p-3 text-left transition ' + (settings.bottleTone === tone.id ? 'border-[#D71920] bg-rose-50 ring-2 ring-rose-100' : 'border-slate-200 bg-white hover:border-rose-200')}>
                      <span className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-black/5" style={{ backgroundColor: tone.color }} />
                      <span className="min-w-0"><span className="block text-xs font-extrabold text-slate-800">{tone.label}</span><span className="block truncate text-[10px] text-slate-500">{tone.description}</span></span>
                      {settings.bottleTone === tone.id && <Check className="ml-auto h-4 w-4 shrink-0 text-[#D71920]" />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Choose your identity frame</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FRAMES.map((frame) => <button key={frame.id} type="button" aria-pressed={settings.frame === frame.id} onClick={() => { setSettings({ ...settings, frame: frame.id }); setSaved(false); }} className={'rounded-full border px-4 py-2 text-xs font-bold transition ' + (settings.frame === frame.id ? 'border-[#D71920] bg-rose-50 text-[#B80D13]' : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200')}>{frame.label} frame {settings.frame === frame.id ? '✓' : ''}</button>)}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold text-slate-800">Living Bottle glow</h3><span className="text-xs font-bold tabular-nums text-[#B80D13]">{settings.glow}%</span></div>
                <input type="range" min="25" max="100" step="1" value={settings.glow} onChange={(event) => { setSettings({ ...settings, glow: Number(event.target.value) }); setSaved(false); }} aria-label="Bottle glow intensity" className="mt-3 w-full accent-[#D71920]" />
                <p className="mt-1 text-[10px] text-slate-400">A visual effect only. It does not change wallet balances, rewards, or account status.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={saveIdentity} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D71920] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#B80D13] focus:outline-none focus:ring-4 focus:ring-rose-100"><Check className="h-4 w-4" /> Save my identity</button>
                <button type="button" onClick={resetIdentity} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-rose-200 hover:text-[#B80D13]"><RotateCcw className="h-4 w-4" /> Reset</button>
                {saved && <span role="status" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Check className="h-4 w-4" /> Saved on this device</span>}
                {saveError && <span role="alert" className="text-xs font-semibold text-red-700">Browser storage is unavailable. Your changes are not saved.</span>}
              </div>
              <p className="text-[10px] leading-5 text-slate-400">Your Universe identity is stored in this browser on this device. It does not update your official account profile and is not shared with other devices.</p>
            </div>
          </div>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-[#D71920]"><Droplets className="h-5 w-5" /></div><div><h3 className="text-base font-extrabold text-slate-900">The Living Bottle</h3><p className="mt-1 text-sm leading-6 text-slate-500">A signature digital collectible that reflects the color and glow you choose. Your bottle is a visual keepsake, not a financial asset or a reward balance.</p></div></div></div>
          <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-[#FFFDF6] to-[#FFF3D8] p-5 shadow-sm"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm"><Crown className="h-5 w-5" /></div><div><h3 className="text-base font-extrabold text-slate-900">Personal Identity Studio</h3><p className="mt-1 text-sm leading-6 text-slate-500">A playful personal layer on top of your existing account. Your official profile, wallet, and the rest of the platform remain unchanged.</p></div></div></div>
        </section>
      </div>
    </AppShell>
  );
}
