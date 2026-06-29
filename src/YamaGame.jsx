import { useState, useEffect, useRef, useCallback } from "react";
import { Info, X, ChevronRight, RotateCcw, ChevronDown, Shuffle } from "lucide-react";

// ---------- Konstanten ----------
const SUIT_KEYS = ["SP", "HE", "DI", "CL"];
const SUIT_INFO = {
  SP: { symbol: "♠", name: "Pik",   color: "#1c1c1e", isRed: false },
  HE: { symbol: "♥", name: "Herz",  color: "#9e2b25", isRed: true  },
  DI: { symbol: "♦", name: "Karo",  color: "#9e2b25", isRed: true  },
  CL: { symbol: "♣", name: "Kreuz", color: "#1c1c1e", isRed: false },
};
const RANK_LABEL = { 14:"A",13:"K",12:"D",11:"B",10:"10",9:"9",8:"8",7:"7",6:"6",5:"5",4:"4",3:"3",2:"2" };
const SEATS = ["S","E","N","W"];
const PERSONAS = ["Yama","Parn","Aaron","Grace","Denny","Philipp","Batu","Rafa","Max","David","Luca"];
const TARGET_TRICKS = 7;
const COLORS = {
  bg:"#0e1a2b", bg2:"#142235", felt:"#1d4d3a", feltDark:"#143a2c",
  gold:"#c9a227", goldLight:"#e6c75e", cream:"#f8f3e7",
  redAccent:"#9e2b25", redDark:"#7a221c",
};
const SIGNALS = { FESTE:"feste", GEDREHT:"gedreht" };
const SIGNAL_INFO = {
  feste:   { label:"Feste spielen", emoji:"💪", short:"FESTE", color:"#2a7a4a",
             meaning:"Partner soll dieselbe Farbe mit dem niedrigsten Wert nochmal ausspielen – du gewinnst den nächsten Stich dieser Farbe." },
  gedreht: { label:"Gedreht in die Mitte", emoji:"🔄", short:"LETZTE", color:"#7a4a22",
             meaning:"Letzte Karte dieser Farbe. Du kannst jetzt trumpfen. Partner kann Trumpf ausspielen um 2 gegnerische Trümpfe rauszuholen." },
};

// Teams: S+N vs E+W
const teamOf = (p) => (p==="S"||p==="N" ? "home" : "away");

// ---------- Hilfsfunktionen ----------
function buildDeck() {
  const d=[];
  for(const s of SUIT_KEYS) for(let r=2;r<=14;r++) d.push({suit:s,rank:r,id:`${s}${r}`});
  return d;
}
function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function sortHandWithTrump(cards, trumpSuit) {
  if(!trumpSuit){
    const order={SP:0,HE:1,DI:2,CL:3};
    return [...cards].sort((a,b)=>order[a.suit]-order[b.suit]||b.rank-a.rank);
  }
  const trumpIsRed = SUIT_INFO[trumpSuit].isRed;
  const nonTrump = SUIT_KEYS.filter(s=>s!==trumpSuit);
  const opp = nonTrump.filter(s=>SUIT_INFO[s].isRed!==trumpIsRed);
  const same = nonTrump.filter(s=>SUIT_INFO[s].isRed===trumpIsRed);
  const ordered=[trumpSuit, opp[0], same[0], opp[1]].filter(Boolean);
  const idx={};ordered.forEach((s,i)=>idx[s]=i);
  return [...cards].sort((a,b)=>idx[a.suit]-idx[b.suit]||b.rank-a.rank);
}
function sortHand(cards){return sortHandWithTrump(cards,null);}
function groupBySuit(cards){
  const g={SP:[],HE:[],DI:[],CL:[]};
  cards.forEach(c=>g[c.suit].push(c));
  return g;
}
function cardLabel(card){return `${RANK_LABEL[card.rank]}${SUIT_INFO[card.suit].symbol}`;}
function nextInOrder(p){return SEATS[(SEATS.indexOf(p)+1)%4];}
function determineTrickWinner(trick,leadSuit,trumpSuit){
  const tp=trick.filter(t=>t.card.suit===trumpSuit);
  const pool=tp.length>0?tp:trick.filter(t=>t.card.suit===leadSuit);
  let best=pool[0];for(const t of pool)if(t.card.rank>best.card.rank)best=t;
  return best.player;
}
function getCurrentBest(trick,leadSuit,trumpSuit){
  if(trick.length===0)return null;
  const tp=trick.filter(t=>t.card.suit===trumpSuit);
  const pool=tp.length>0?tp:trick.filter(t=>t.card.suit===leadSuit);
  if(pool.length===0)return null;
  let best=pool[0];for(const t of pool)if(t.card.rank>best.card.rank)best=t;
  return best;
}
function isCardPlayable(card, hand, state) {
  if (state.currentTrick.length===0) return true;
  const has = hand.some(c=>c.suit===state.leadSuit);
  if (has) return card.suit===state.leadSuit;
  return true;
}

// ---------- Spiel-Logik ----------
// nextDeclarer-Logik:
// - Gewinnt das Team des letzten Declarers → derselbe Declarer bestimmt Trumpf erneut
// - Verliert das Team des letzten Declarers → nextInOrder(declarer) = Person rechts vom Declarer bestimmt
function getNextDeclarer(lastDeclarer, roundWinner) {
  const declarerTeam = teamOf(lastDeclarer);
  if (declarerTeam === roundWinner) {
    return lastDeclarer;
  } else {
    return nextInOrder(lastDeclarer);
  }
}

// Losverfahren: Ass gilt als 1 (niedrigste Karte)
function drawRankValue(rank) {
  return rank === 14 ? 1 : rank;
}

function dealNewGame(names, handNumber, scoreHome, scoreAway, dealer, log, declarer) {
  // declarer = wer Trumpf bestimmt (kann vom dealer abweichen)
  const trumpDeclarer = declarer ?? dealer;
  const deck = shuffle(buildDeck());
  const hands = {S:[],E:[],N:[],W:[]};
  deck.forEach((card,i) => hands[SEATS[i%4]].push(card));
  // Alle Spieler bekommen sofort ihre vollen 13 Karten (kein Split-Mechanismus mehr -
  // das "nur 5 sichtbar" für den Trumpf-Bestimmer ist rein eine Darstellungsfrage in GameView).
  Object.keys(hands).forEach(p => { hands[p] = sortHand(hands[p]); });
  return {
    phase:"trumpSelect", dealer, declarer:trumpDeclarer, hands, names,
    trumpSuit:null, currentTrick:[], leadSuit:null,
    currentTurn:null, tricksByPlayer:{S:0,E:0,N:0,W:0}, trickNumber:0,
    trickComplete:false, trickWinner:null, lastHandResult:null, signals:{},
    handNumber, scoreHome, scoreAway,
    log:[...log, `Runde ${handNumber}: ${names[dealer]} gibt Karten. ${names[trumpDeclarer]} wählt Trumpf.`],
  };
}
function applySelectTrump(state, suit) {
  const declarer = state.declarer;
  const hands = {};
  Object.keys(state.hands).forEach(p => { hands[p] = sortHandWithTrump(state.hands[p], suit); });
  return {
    ...state, trumpSuit:suit, phase:"playing", hands,
    currentTrick:[], leadSuit:null, currentTurn:declarer, trickNumber:1,
    log:[...state.log,`${state.names[declarer]} bestimmt Trumpf: ${SUIT_INFO[suit].name} ${SUIT_INFO[suit].symbol}.`],
  };
}
function applyPlayCard(state, player, card) {
  const hands = {...state.hands, [player]:state.hands[player].filter(c=>c.id!==card.id)};
  const currentTrick = [...state.currentTrick, {player,card}];
  const isNewLead = state.leadSuit == null;
  const leadSuit = state.leadSuit ?? card.suit;
  let log = [...state.log, `${state.names[player]}: ${cardLabel(card)}`];
  // Signal-Verbrauch: ein Signal ("Feste"/"Gedreht") gilt erst als erfüllt, wenn die
  // signalisierte Farbe TATSÄCHLICH wieder angespielt wird (egal von wem) - vorher darf
  // es nicht verschwinden, sonst verpasst der Partner genau den Moment, für den es gedacht war.
  let signals = state.signals;
  if (isNewLead) {
    const consumed = Object.entries(signals || {}).filter(([,sig]) => sig?.suit === leadSuit);
    if (consumed.length) {
      signals = {...signals};
      consumed.forEach(([p]) => delete signals[p]);
    }
  }
  if (currentTrick.length < 4) {
    return {...state, hands, currentTrick, leadSuit, signals, currentTurn:nextInOrder(player), log};
  }
  const winner = determineTrickWinner(currentTrick, leadSuit, state.trumpSuit);
  const tricksByPlayer = {...state.tricksByPlayer, [winner]:state.tricksByPlayer[winner]+1};
  log = [...log, `${state.names[winner]} gewinnt Stich ${state.trickNumber}.`];
  return {...state, hands, currentTrick, leadSuit, signals, tricksByPlayer, trickComplete:true, trickWinner:winner, currentTurn:null, log};
}
function applyClearTrick(state) {
  // Signale werden jetzt verbrauchsbasiert in applyPlayCard gelöscht (siehe oben),
  // nicht mehr pauschal nach einem Stich - sie bleiben aktiv, bis die signalisierte
  // Farbe wirklich wieder angespielt wurde.
  const signals = state.signals;
  // Gespielte Stiche für das CPU-Wissenssystem merken
  const trickHistory = [...(state.trickHistory || []), state.currentTrick];
  const homeTricks = state.tricksByPlayer.S + state.tricksByPlayer.N;
  const awayTricks = state.tricksByPlayer.E + state.tricksByPlayer.W;
  const decided = homeTricks>=TARGET_TRICKS || awayTricks>=TARGET_TRICKS || state.trickNumber>=13;
  if (decided) {
    const winner = homeTricks>=TARGET_TRICKS?"home" : awayTricks>=TARGET_TRICKS?"away" : homeTricks>awayTricks?"home":"away";
    return {
      ...state, signals, trickHistory, phase:"handEnd", currentTrick:[], trickComplete:false,
      lastHandResult:{winner,homeTricks,awayTricks},
      scoreHome:state.scoreHome+(winner==="home"?1:0),
      scoreAway:state.scoreAway+(winner==="away"?1:0),
      log:[...state.log,`${winner==="home"?"Dein Team":"Die Gegner"} gewinnen die Runde.`],
    };
  }
  return {...state, signals, trickHistory, currentTrick:[], leadSuit:null, currentTurn:state.trickWinner, trickNumber:state.trickNumber+1, trickComplete:false};
}

// ---------- Animationen ----------
function useSignalAnimation(signalType) {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const prevTypeRef = useRef(null);
  useEffect(() => {
    if (!signalType) { setFrame(0); prevTypeRef.current = null; return; }
    if (signalType === prevTypeRef.current) return;
    prevTypeRef.current = signalType;
    startRef.current = null;
    const duration = signalType === SIGNALS.FESTE ? 500 : 650;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      setFrame(p);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
      else setFrame(0);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [signalType]);
  return frame;
}

// ---------- UI-Bausteine ----------
function CardFace({ card, clickable, dim, onClick, highlight }) {
  const info = SUIT_INFO[card.suit];
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      style={{
        width:48, height:64, borderRadius:6, border:`1.5px solid ${highlight?COLORS.gold:"#d8cdb0"}`,
        background:COLORS.cream, color:info.color, opacity:dim?0.35:1,
        display:"flex", flexDirection:"column", justifyContent:"space-between",
        padding:"2px 4px", flexShrink:0, cursor:clickable?"pointer":"default",
        boxShadow:highlight?`0 0 8px ${COLORS.gold}`:"0 2px 4px rgba(0,0,0,0.3)",
        transform:"translateY(0)", transition:"transform 0.12s ease",
      }}
      onMouseEnter={e=>{ if(clickable) e.currentTarget.style.transform="translateY(-8px)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; }}
    >
      <span style={{fontSize:14,fontWeight:"bold",lineHeight:1,textAlign:"left"}}>{RANK_LABEL[card.rank]}</span>
      <span style={{fontSize:20,lineHeight:1,textAlign:"center"}}>{info.symbol}</span>
      <span style={{fontSize:14,fontWeight:"bold",lineHeight:1,textAlign:"right",transform:"rotate(180deg)"}}>{RANK_LABEL[card.rank]}</span>
    </button>
  );
}
function CardBack() {
  return (
    <div style={{
      width:36, height:48, borderRadius:6, flexShrink:0,
      border:`1.5px solid ${COLORS.gold}`,
      background:`repeating-linear-gradient(45deg, ${COLORS.redAccent} 0px, ${COLORS.redAccent} 4px, ${COLORS.redDark} 4px, ${COLORS.redDark} 8px)`,
    }}/>
  );
}
function HiddenCardSlot() {
  // Platzhalter für Karten, die der Trumpf-Bestimmer schon auf der Hand hat,
  // aber vor der Trumpfwahl noch nicht angezeigt bekommt.
  return (
    <div style={{
      width:48, height:64, borderRadius:6, flexShrink:0,
      background:"rgba(255,255,255,0.05)",
      border:"1.5px dashed rgba(255,255,255,0.22)",
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"rgba(248,243,231,0.25)", fontSize:18, fontWeight:"bold",
    }}>?</div>
  );
}
// Eckdaten für den "Einflug" einer Karte aus der jeweiligen Hand-Richtung in die Tischmitte.
const SEAT_FLY = {
  N: { dx:0,   dy:-44, rot:-8 },
  S: { dx:0,   dy:44,  rot:8  },
  E: { dx:44,  dy:0,   rot:8  },
  W: { dx:-44, dy:0,   rot:-8 },
};
// Drei Varianten: normaler Einflug, "Gedreht" (dreht sich mehrfach und bleibt seitlich liegen),
// "Feste" (knallt mit Überschwung in die Mitte - die kleine Rückfederung kommt allein aus der Bezier-Kurve).
const TRICK_ANIM = {
  enter:               { scaleFrom:0.65, rotEnd:0,   dur:"0.3s",  ease:"cubic-bezier(0.22,1,0.36,1)",  flashFrom:"brightness(1)"   },
  [SIGNALS.GEDREHT]:   { scaleFrom:0.6,  rotEnd:810, dur:"0.62s", ease:"cubic-bezier(0.16,1,0.3,1)",   flashFrom:"brightness(1)"   },
  [SIGNALS.FESTE]:     { scaleFrom:0.55, rotEnd:0,   dur:"0.42s", ease:"cubic-bezier(0.34,1.56,0.64,1)", flashFrom:"brightness(1.6)" },
};
function TrickCell({ play, seat, signal }) {
  const prevCardIdRef = useRef(null);
  const lastSignalKeyRef = useRef(null);
  const [animKey, setAnimKey] = useState(0);
  const [variant, setVariant] = useState("enter");

  useEffect(() => {
    if (!play) {
      prevCardIdRef.current = null;
      lastSignalKeyRef.current = null;
      return;
    }
    const isNewCard = play.card.id !== prevCardIdRef.current;
    const matches = signal && signal.cardId === play.card.id;
    const signalKey = matches ? `${signal.type}:${signal.cardId}` : null;
    const shouldReplay = isNewCard || (signalKey && signalKey !== lastSignalKeyRef.current);
    if (!shouldReplay) return;

    prevCardIdRef.current = play.card.id;
    lastSignalKeyRef.current = signalKey;
    setVariant(matches ? signal.type : "enter");
    setAnimKey(k => k + 1);
  }, [play, signal]);

  const cfg = TRICK_ANIM[variant] || TRICK_ANIM.enter;
  const animName = `cardAnim-${seat}-${variant}`;

  return (
    <div style={{width:44,height:58,display:"flex",alignItems:"center",justifyContent:"center"}}>
      {play ? (
        <div key={animKey} style={{
          animation: `${animName} ${cfg.dur} ${cfg.ease} both`,
        }}>
          <CardFace card={play.card} clickable={false}/>
        </div>
      ) : (
        <div style={{width:44,height:58,borderRadius:6,border:"1.5px dashed rgba(255,255,255,0.15)"}}/>
      )}
    </div>
  );
}
function SignalBadge({ signal }) {
  const frame = useSignalAnimation(signal?.type);
  if (!signal) return null;
  const info = SIGNAL_INFO[signal.type];
  let emojiTransform = "scale(1) rotate(0deg)";
  if (frame > 0 && frame < 1) {
    if (signal.type === SIGNALS.FESTE) {
      const shakeX = Math.sin(frame * Math.PI * 5) * 4;
      const shakeR = Math.sin(frame * Math.PI * 4) * 15;
      const scl = 1 + Math.sin(frame * Math.PI) * 0.4;
      emojiTransform = `translateX(${shakeX}px) rotate(${shakeR}deg) scale(${scl})`;
    } else {
      const deg = frame * 360;
      const scl = 1 + Math.sin(frame * Math.PI) * 0.5;
      emojiTransform = `rotate(${deg}deg) scale(${scl})`;
    }
  }
  const now = Date.now();
  const pulse = 0.85 + 0.15 * Math.sin(now / 700 + (signal.type === SIGNALS.FESTE ? 0 : 1.5));
  return (
    <div style={{
      fontSize:10, fontWeight:"bold", padding:"2px 6px", borderRadius:20, marginTop:2,
      background:"rgba(201,162,39,0.18)", border:`1px solid ${COLORS.gold}`,
      color:COLORS.goldLight, display:"flex", alignItems:"center", gap:3,
      boxShadow:`0 0 ${6*pulse}px rgba(201,162,39,${0.3*pulse})`,
    }}>
      <span style={{display:"inline-block", transform:emojiTransform, transition:frame>0&&frame<1?"none":"transform 0.1s"}}>{info.emoji}</span>
      {info.short}
    </div>
  );
}
function PulsingSignalBadge({ signal }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!signal) return;
    const id = setInterval(() => setTick(t => t+1), 80);
    return () => clearInterval(id);
  }, [signal?.type]);
  return <SignalBadge signal={signal}/>;
}
function PlayerSlot({ name, count, active, signal, isMe }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,
      transition:"transform 0.15s", transform:active?"scale(1.06)":"scale(1)"}}>
      {/* Name-Chip */}
      <div style={{
        fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
        background: active ? COLORS.gold : isMe ? "rgba(201,162,39,0.18)" : "rgba(255,255,255,0.07)",
        color: active ? "#1a1a1a" : isMe ? COLORS.goldLight : COLORS.cream,
        border: isMe ? `1px solid rgba(201,162,39,0.5)` : "1px solid transparent",
        letterSpacing:0.5, whiteSpace:"nowrap",
      }}>{name}{isMe?" ✦":""}</div>
      {/* Eine einzelne Kartenrückseite + Anzahl */}
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <div style={{
          width:22, height:30, borderRadius:4, flexShrink:0,
          border:`1.5px solid ${active?COLORS.gold:"rgba(201,162,39,0.4)"}`,
          background:`repeating-linear-gradient(45deg,${COLORS.redAccent} 0px,${COLORS.redAccent} 3px,${COLORS.redDark} 3px,${COLORS.redDark} 6px)`,
          boxShadow: active ? `0 0 6px rgba(201,162,39,0.5)` : "none",
        }}/>
        <span style={{fontSize:13,fontWeight:700,opacity:active?1:0.6,color:active?COLORS.goldLight:COLORS.cream}}>{count}</span>
      </div>
      <PulsingSignalBadge signal={signal}/>
    </div>
  );
}
function SheetWrapper({ title, children }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.55)"}}>
      <div style={{width:"100%",maxWidth:384,borderRadius:"16px 16px 0 0",padding:16,paddingBottom:24,background:COLORS.bg2,borderTop:`2px solid ${COLORS.gold}`}}>
        {title && <h3 style={{fontSize:15,fontWeight:"bold",marginBottom:12,color:COLORS.gold}}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
function SignalButton({ type, isActive, onClick }) {
  const info = SIGNAL_INFO[type];
  const [animFrame, setAnimFrame] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const wasActive = useRef(false);
  useEffect(() => {
    if (isActive && !wasActive.current) {
      wasActive.current = true;
      startRef.current = null;
      const duration = type === SIGNALS.FESTE ? 400 : 600;
      const run = (ts) => {
        if (!startRef.current) startRef.current = ts;
        const p = Math.min((ts - startRef.current) / duration, 1);
        setAnimFrame(p);
        if (p < 1) rafRef.current = requestAnimationFrame(run);
        else setAnimFrame(0);
      };
      rafRef.current = requestAnimationFrame(run);
    } else if (!isActive) {
      wasActive.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAnimFrame(0);
    }
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, type]);
  let emojiStyle = {display:"inline-block", marginRight:4};
  if (animFrame > 0 && animFrame < 1) {
    if (type === SIGNALS.FESTE) {
      const shakeX = Math.sin(animFrame * Math.PI * 5) * 5;
      const scl = 1 + Math.sin(animFrame * Math.PI) * 0.5;
      emojiStyle = {...emojiStyle, transform:`translateX(${shakeX}px) scale(${scl})`};
    } else {
      const deg = animFrame * 360;
      const scl = 1 + Math.sin(animFrame * Math.PI) * 0.6;
      emojiStyle = {...emojiStyle, transform:`rotate(${deg}deg) scale(${scl})`};
    }
  }
  return (
    <button onClick={onClick} style={{
      flex:1, padding:"8px 4px", borderRadius:12, fontSize:12, fontWeight:"bold",
      display:"flex", alignItems:"center", justifyContent:"center",
      background: isActive ? "rgba(201,162,39,0.22)" : "rgba(255,255,255,0.06)",
      border: `1.5px solid ${isActive ? COLORS.gold : "rgba(255,255,255,0.15)"}`,
      color: isActive ? COLORS.goldLight : "rgba(248,243,231,0.55)",
      boxShadow: isActive ? `0 0 12px rgba(201,162,39,0.3)` : "none",
      transform: isActive ? "scale(1.02)" : "scale(1)",
      transition:"background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s",
      cursor:"pointer",
    }}>
      <span style={emojiStyle}>{info.emoji}</span>
      {info.label}
    </button>
  );
}
function TrumpPicker({ onPick, onRandom, previewCards }) {
  return (
    <div style={{padding:"4px 8px 4px",flexShrink:0,borderTop:"1px solid rgba(201,162,39,0.3)"}}>
      <div style={{borderRadius:10,padding:"8px 10px",background:"rgba(201,162,39,0.1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:COLORS.goldLight}}>Trumpffarbe wählen</span>
          <button onClick={onRandom} style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(255,255,255,0.1)",color:COLORS.cream,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
            <Shuffle size={10}/> Zufall
          </button>
        </div>
        <div style={{display:"flex",gap:3,marginBottom:6,overflowX:"auto"}}>
          {previewCards.map(card=><CardFace key={card.id} card={card} clickable={false}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {SUIT_KEYS.map(s=>(
            <button key={s} onClick={()=>onPick(s)} style={{padding:"8px 4px",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",fontWeight:"bold",background:COLORS.cream,color:SUIT_INFO[s].color,cursor:"pointer",border:"none",gap:2}}>
              <span style={{fontSize:22,lineHeight:1}}>{SUIT_INFO[s].symbol}</span>
              <span style={{fontSize:10,lineHeight:1}}>{SUIT_INFO[s].name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function HandEndModal({ state, onNext, mySeat }) {
  const N = state.names;
  const r = state.lastHandResult;
  const myTeam = teamOf(mySeat);
  const iWon = r.winner === myTeam;
  const nextDeclarer = getNextDeclarer(state.declarer, r.winner);
  const declarerKept = nextDeclarer === state.declarer;
  return (
    <SheetWrapper title="Rundenergebnis">
      <p style={{fontSize:13,marginBottom:4}}>Trumpf war {SUIT_INFO[state.trumpSuit].name} {SUIT_INFO[state.trumpSuit].symbol} ({N[state.declarer]} hatte bestimmt).</p>
      <p style={{fontSize:13,marginBottom:8}}>Stiche: {N.S}&{N.N} {r.homeTricks} – {N.E}&{N.W} {r.awayTricks}</p>
      <p style={{fontSize:15,fontWeight:"bold",marginBottom:8,color:iWon?"#7fdb8a":"#e07a6f"}}>{iWon?"Dein Team gewinnt! 🎉":"Gegner gewinnen!"}</p>
      <p style={{fontSize:13,fontWeight:"bold",marginBottom:8}}>Stand: {N.S}&{N.N} {state.scoreHome} : {state.scoreAway} {N.E}&{N.W}</p>
      <p style={{fontSize:12,opacity:0.65,marginBottom:16,padding:"6px 10px",borderRadius:8,background:"rgba(201,162,39,0.1)",border:"1px solid rgba(201,162,39,0.2)"}}>
        Nächste Runde: <strong style={{color:declarerKept?COLORS.goldLight:COLORS.cream}}>{N[nextDeclarer]}</strong> wählt den Trumpf
        {declarerKept ? " (hat gewonnen, bleibt Trumpf-Bestimmer)" : " (rechts vom letzten Bestimmer)"}
      </p>
      <button onClick={onNext} style={{width:"100%",padding:"10px 0",borderRadius:10,fontWeight:"bold",display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:COLORS.gold,color:"#1a1a1a",border:"none",cursor:"pointer",fontSize:14}}>
        Nächste Runde <ChevronRight size={16}/>
      </button>
    </SheetWrapper>
  );
}
function RulesModal({ onClose, names }) {
  const N = names || {};
  return (
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.6)"}}>
      <div style={{width:"100%",maxWidth:384,borderRadius:"16px 16px 0 0",padding:16,paddingBottom:24,background:COLORS.bg2,borderTop:`2px solid ${COLORS.gold}`,maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{fontSize:15,fontWeight:"bold",color:COLORS.gold}}>Regeln</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:COLORS.cream,cursor:"pointer"}}><X size={18}/></button>
        </div>
        <ul style={{fontSize:13,paddingLeft:16,opacity:0.9,marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>
          <li>4 Spieler, 2 Teams – {N.S||"S"} & {N.N||"N"} gegen {N.E||"E"} & {N.W||"W"}.</li>
          <li>Jeder bekommt 13 Karten. Rangfolge: A, K, D, B, 10 … 2.</li>
          <li>Der Trumpf-Bestimmer sieht zunächst nur 5 seiner 13 Karten und wählt damit die Trumpffarbe. Danach werden alle 13 sichtbar.</li>
          <li>Der Kartengeber spielt als Erster aus.</li>
          <li>Farbe muss bedient werden. Sonst darf mit Trumpf gestochen werden.</li>
          <li>Sobald ein Team {TARGET_TRICKS} Stiche hat, gewinnt es die Runde.</li>
        </ul>
        <h4 style={{fontSize:13,fontWeight:"bold",marginBottom:8,color:COLORS.goldLight}}>Signale</h4>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {Object.values(SIGNALS).map(type=>{
            const info=SIGNAL_INFO[type];
            return (
              <div key={type} style={{borderRadius:8,padding:10,background:`${info.color}33`,border:`1px solid ${info.color}`}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{info.emoji} {info.label}</div>
                <div style={{fontSize:12,opacity:0.8}}>{info.meaning}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function SignalLegendDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,padding:"4px 8px",borderRadius:8,background:"rgba(255,255,255,0.08)",color:COLORS.cream,border:"none",cursor:"pointer"}}>
        Signale <ChevronDown size={12} style={{transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}/>
      </button>
      {open && (
        <div style={{position:"absolute",right:0,top:32,zIndex:30,borderRadius:12,padding:12,width:260,boxShadow:"0 8px 32px rgba(0,0,0,0.5)",background:COLORS.bg2,border:`1px solid ${COLORS.gold}`}}>
          <div style={{fontSize:11,fontWeight:"bold",marginBottom:8,color:COLORS.goldLight}}>Signal-Bedeutung</div>
          {Object.values(SIGNALS).map(type=>{
            const info=SIGNAL_INFO[type];
            return (
              <div key={type} style={{marginBottom:6,borderRadius:8,padding:8,background:`${info.color}33`,border:`1px solid ${info.color}`}}>
                <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>{info.emoji} {info.label}</div>
                <div style={{fontSize:11,opacity:0.75}}>{info.meaning}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- LOBBY Screens ----------

function PersonaSelectScreen({ onSelect, takenPersonas = [] }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:`linear-gradient(180deg,${COLORS.bg} 0%,${COLORS.bg2} 100%)`,color:COLORS.cream,fontFamily:"ui-sans-serif,system-ui",padding:"24px 20px"}}>
      <h1 style={{fontSize:32,fontWeight:"bold",letterSpacing:4,fontFamily:"Georgia,serif",color:COLORS.gold,marginBottom:4,textAlign:"center"}}>
        YAMA
      </h1>
      <p style={{fontSize:11,opacity:0.4,marginBottom:4,textAlign:"center",letterSpacing:2}}>AFGHANISCHES STICHSPIEL</p>
      <p style={{fontSize:13,opacity:0.55,marginBottom:28,textAlign:"center"}}>Wähle deine Persona</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,width:"100%",maxWidth:360}}>
        {PERSONAS.map(name => {
          const taken = takenPersonas.includes(name);
          return (
            <button key={name} onClick={()=>!taken&&onSelect(name)}
              onMouseEnter={() => !taken&&setHovered(name)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding:"16px 8px",borderRadius:14,fontWeight:"bold",fontSize:16,
                background: taken?"rgba(255,255,255,0.03)":hovered===name?"rgba(201,162,39,0.22)":"rgba(255,255,255,0.06)",
                border:`1.5px solid ${taken?"rgba(255,255,255,0.06)":hovered===name?COLORS.gold:"rgba(255,255,255,0.15)"}`,
                color: taken?"rgba(255,255,255,0.2)":hovered===name?COLORS.goldLight:COLORS.cream,
                cursor:taken?"not-allowed":"pointer",
                transition:"all 0.15s ease",
                boxShadow:hovered===name&&!taken?`0 0 18px rgba(201,162,39,0.28)`:"none",
                letterSpacing:1,
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Haupt-Game-View ----------
function GameView({ gameState, mySeat, onAction, onNewGame, myHand }) {
  const [showRules, setShowRules] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const state = gameState;
  const N = state.names || {};

  const displayHands = {...state.hands};
  if (myHand) displayHands[mySeat] = myHand;
  const countFor = (seat) => displayHands[seat] ? displayHands[seat].length : (state.handCounts?.[seat] ?? 0);
  const findPlay = (seat) => state.currentTrick.find(t=>t.player===seat);
  const homeTricks = state.tricksByPlayer.S + state.tricksByPlayer.N;
  const awayTricks = state.tricksByPlayer.E + state.tricksByPlayer.W;
  const signals = state.signals || {};

  // Tisch-Wackel-Effekt bei FESTE
  const [tableShake, setTableShake] = useState(false);
  const shakeKeyRef = useRef(null);
  useEffect(() => {
    let hitCardId = null;
    for (const seat of SEATS) {
      const p = state.currentTrick.find(t => t.player === seat);
      const sig = signals[seat];
      if (p && sig?.type === SIGNALS.FESTE && sig.cardId === p.card.id) { hitCardId = sig.cardId; break; }
    }
    const key = hitCardId ? `${state.handNumber}-${state.trickNumber}-${hitCardId}` : null;
    if (key && key !== shakeKeyRef.current) {
      shakeKeyRef.current = key;
      setTableShake(true);
      const t = setTimeout(() => setTableShake(false), 380);
      return () => clearTimeout(t);
    }
  }, [state.currentTrick, signals, state.handNumber, state.trickNumber]);

  const isMyTurn = state.phase==="playing" && state.currentTurn===mySeat && !state.trickComplete;
  const canSignal = state.phase==="playing" && !state.trickComplete;
  const mySignal = signals[mySeat];
  const myCards = displayHands[mySeat] || [];
  const isPreDeclareForMe = state.phase==="trumpSelect" && state.declarer===mySeat;
  const visibleCount = isPreDeclareForMe ? Math.min(5, myCards.length) : myCards.length;
  const shownCards = myCards.slice(0, visibleCount);
  const hiddenCount = myCards.length - visibleCount;

  // Seats: ich unten, Partner oben, Gegner links/rechts
  const seatOrder = ["S","E","N","W"];
  const myIdx = seatOrder.indexOf(mySeat);
  const [bottom, right, top, left] = [0,1,2,3].map(i=>seatOrder[(myIdx+i)%4]);

  let statusText = "";
  if (state.phase==="trumpSelect") {
    statusText = state.declarer===mySeat ? "Wähle Trumpffarbe" : `${N[state.declarer]} wählt Trumpf …`;
  } else if (state.phase==="playing") {
    statusText = state.trickComplete
      ? `${N[state.trickWinner]} gewinnt den Stich`
      : state.currentTurn===mySeat ? "Du bist dran!" : `${N[state.currentTurn]} spielt …`;
  }

  return (
    <div style={{
      position:"fixed", inset:0,
      display:"flex", flexDirection:"column",
      background:`linear-gradient(180deg,${COLORS.bg} 0%,${COLORS.bg2} 100%)`,
      color:COLORS.cream, fontFamily:"ui-sans-serif,system-ui",
      userSelect:"none", WebkitUserSelect:"none", overflow:"hidden",
    }}>
      <style>{`
        @keyframes feltShake {
          0%   { transform:translate(0,0); }
          20%  { transform:translate(-3px,2px); }
          40%  { transform:translate(3px,-2px); }
          60%  { transform:translate(-2px,1px); }
          80%  { transform:translate(2px,-1px); }
          100% { transform:translate(0,0); }
        }
        @keyframes myTurn {
          0%,100% { border-color:rgba(201,162,39,0.35); }
          50%     { border-color:rgba(201,162,39,0.9); }
        }
        @keyframes cardAnim-N-enter {
          from { transform:translate(0px,-44px) scale(0.65) rotate(-8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes cardAnim-N-feste {
          from { transform:translate(0px,-44px) scale(0.55) rotate(-8deg); opacity:0; filter:brightness(1.6); }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; filter:brightness(1); }
        }
        @keyframes cardAnim-N-gedreht {
          from { transform:translate(0px,-44px) scale(0.6) rotate(-8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(810deg); opacity:1; }
        }
        @keyframes cardAnim-S-enter {
          from { transform:translate(0px,44px) scale(0.65) rotate(8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes cardAnim-S-feste {
          from { transform:translate(0px,44px) scale(0.55) rotate(8deg); opacity:0; filter:brightness(1.6); }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; filter:brightness(1); }
        }
        @keyframes cardAnim-S-gedreht {
          from { transform:translate(0px,44px) scale(0.6) rotate(8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(810deg); opacity:1; }
        }
        @keyframes cardAnim-E-enter {
          from { transform:translate(44px,0px) scale(0.65) rotate(8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes cardAnim-E-feste {
          from { transform:translate(44px,0px) scale(0.55) rotate(8deg); opacity:0; filter:brightness(1.6); }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; filter:brightness(1); }
        }
        @keyframes cardAnim-E-gedreht {
          from { transform:translate(44px,0px) scale(0.6) rotate(8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(810deg); opacity:1; }
        }
        @keyframes cardAnim-W-enter {
          from { transform:translate(-44px,0px) scale(0.65) rotate(-8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes cardAnim-W-feste {
          from { transform:translate(-44px,0px) scale(0.55) rotate(-8deg); opacity:0; filter:brightness(1.6); }
          to   { transform:translate(0,0) scale(1) rotate(0deg); opacity:1; filter:brightness(1); }
        }
        @keyframes cardAnim-W-gedreht {
          from { transform:translate(-44px,0px) scale(0.6) rotate(-8deg); opacity:0; }
          to   { transform:translate(0,0) scale(1) rotate(810deg); opacity:1; }
        }
      `}</style>

      {/* ── HEADER: 44px ── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 12px", height:44, flexShrink:0,
        borderBottom:"1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Stich-Stand der aktuellen Runde */}
        <div style={{display:"flex",alignItems:"baseline",gap:6}}>
          <span style={{fontSize:11,opacity:0.5}}>{N.S}&{N.N}</span>
          <span style={{fontSize:20,fontWeight:"bold",color:homeTricks>=TARGET_TRICKS?COLORS.goldLight:COLORS.cream,lineHeight:1}}>{homeTricks}</span>
          <span style={{fontSize:11,opacity:0.3}}>–</span>
          <span style={{fontSize:20,fontWeight:"bold",color:awayTricks>=TARGET_TRICKS?COLORS.goldLight:COLORS.cream,lineHeight:1}}>{awayTricks}</span>
          <span style={{fontSize:11,opacity:0.5}}>{N.E}&{N.W}</span>
        </div>
        {/* Trumpf + Stiche */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {state.trumpSuit && (
            <div style={{fontSize:11,display:"flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:20,background:"rgba(255,255,255,0.07)"}}>
              <span style={{color:SUIT_INFO[state.trumpSuit].isRed?COLORS.redAccent:COLORS.cream,fontSize:14}}>{SUIT_INFO[state.trumpSuit].symbol}</span>
              {state.phase==="playing"&&<span style={{opacity:0.3}}>{Math.min(state.trickNumber,13)}/13</span>}
            </div>
          )}
          <SignalLegendDropdown/>
          <button onClick={()=>setShowRules(true)} style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"none",color:COLORS.cream,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Info size={14}/></button>
          <button onClick={()=>setConfirmRestart(true)} style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"none",color:COLORS.cream,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><RotateCcw size={14}/></button>
        </div>
      </div>

      {/* ── STATUS: 24px ── */}
      <div style={{
        textAlign:"center", fontSize:12, fontWeight:600, padding:"4px 16px", flexShrink:0,
        color: isMyTurn ? COLORS.goldLight : "rgba(248,243,231,0.5)",
      }}>{statusText}</div>

      {/* ── SPIELFELD: flex-grow ── */}
      <div style={{flex:1, padding:"4px 8px", display:"flex", flexDirection:"column", minHeight:0}}>
        <div style={{
          flex:1, borderRadius:16, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"space-between", padding:"8px 6px",
          background:`radial-gradient(ellipse at center,${COLORS.felt} 0%,${COLORS.feltDark} 100%)`,
          border:`2px solid rgba(201,162,39,0.45)`,
          animation:tableShake?"feltShake 0.38s ease-in-out":"none",
          minHeight:0,
        }}>
          {/* Partner oben */}
          <PlayerSlot name={N[top]} count={countFor(top)} active={state.currentTurn===top} signal={signals[top]} isMe={top===mySeat}/>

          {/* Mitte: links | stich-grid | rechts */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:4}}>
            <PlayerSlot name={N[left]} count={countFor(left)} active={state.currentTurn===left} signal={signals[left]} isMe={left===mySeat}/>

            {/* Stich-Grid – 3×3, feste Kartengröße 44×58 */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,44px)",gridTemplateRows:"repeat(3,58px)",gap:3,flexShrink:0}}>
              <div/><TrickCell play={findPlay(top)} seat={top} signal={signals[top]}/><div/>
              <TrickCell play={findPlay(left)} seat={left} signal={signals[left]}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                {state.trumpSuit
                  ? <span style={{fontSize:22,color:COLORS.goldLight}}>{SUIT_INFO[state.trumpSuit].symbol}</span>
                  : <span style={{fontSize:11,opacity:0.25}}>—</span>}
              </div>
              <TrickCell play={findPlay(right)} seat={right} signal={signals[right]}/>
              <div/><TrickCell play={findPlay(bottom)} seat={bottom} signal={signals[bottom]}/><div/>
            </div>

            <PlayerSlot name={N[right]} count={countFor(right)} active={state.currentTurn===right} signal={signals[right]} isMe={right===mySeat}/>
          </div>

          {/* Ich unten */}
          <PlayerSlot name={N[bottom]} count={myCards.length} active={state.currentTurn===bottom} signal={signals[bottom]} isMe={bottom===mySeat}/>
        </div>
      </div>

      {/* ── TRUMPF-WAHL (nur wenn relevant) ── */}
      {state.phase==="trumpSelect" && state.declarer===mySeat && (
        <TrumpPicker
          onPick={suit=>onAction({type:"selectTrump",suit})}
          onRandom={()=>onAction({type:"selectTrump",suit:SUIT_KEYS[Math.floor(Math.random()*4)]})}
          previewCards={shownCards}
        />
      )}

      {/* ── MEINE HAND ── */}
      <div style={{
        flexShrink:0, padding:"4px 8px 2px",
        borderTop:"1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3,padding:"0 2px"}}>
          <span style={{fontSize:9,opacity:0.35,letterSpacing:0.5}}>
            DEINE HAND {isPreDeclareForMe ? `· ${visibleCount}/13 sichtbar` : `· ${myCards.length} Karten`}
          </span>
          {state.trumpSuit && <span style={{fontSize:9,opacity:0.3}}>Trumpf links</span>}
        </div>
        <div style={{
          display:"flex", gap:3, overflowX:"auto", paddingBottom:4,
          WebkitOverflowScrolling:"touch", scrollbarWidth:"none",
          border: isMyTurn ? "1.5px solid rgba(201,162,39,0.6)" : "1.5px solid transparent",
          borderRadius:10, padding:"3px 3px 6px",
          animation: isMyTurn ? "myTurn 1.5s ease-in-out infinite" : "none",
          transition:"border-color 0.3s",
        }}>
          {shownCards.map(card=>{
            const clickable = isMyTurn && isCardPlayable(card, myCards, state);
            const dim = isMyTurn && !clickable;
            return <CardFace key={card.id} card={card} clickable={clickable} dim={dim}
              onClick={()=>onAction({type:"playCard",card})}
              highlight={!!state.trumpSuit && card.suit===state.trumpSuit}/>;
          })}
          {Array.from({length:hiddenCount}).map((_,i)=><HiddenCardSlot key={`h${i}`}/>)}
        </div>
      </div>

      {/* ── SIGNAL-BUTTONS ── */}
      {canSignal && (
        <div style={{padding:"3px 8px 4px",display:"flex",gap:6,flexShrink:0}}>
          {Object.values(SIGNALS).map(type=>(
            <SignalButton key={type} type={type} isActive={mySignal?.type===type}
              onClick={()=>onAction({type:"signal",signalType:type})}/>
          ))}
        </div>
      )}

      {/* ── LOG ── */}
      <div style={{
        padding:"2px 16px 6px", fontSize:10, fontStyle:"italic", opacity:0.35,
        textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flexShrink:0,
      }}>
        {state.log[state.log.length-1]}
      </div>

      {/* ── MODALS ── */}
      {showRules && <RulesModal names={N} onClose={()=>setShowRules(false)}/>}
      {confirmRestart && (
        <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"rgba(0,0,0,0.65)"}}>
          <div style={{width:"100%",maxWidth:300,borderRadius:16,padding:20,background:COLORS.bg2,border:`1px solid ${COLORS.gold}`}}>
            <p style={{fontSize:14,marginBottom:18,textAlign:"center",lineHeight:1.5}}>Neues Spiel?<br/><span style={{opacity:0.5,fontSize:12}}>Rundenstand geht verloren.</span></p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmRestart(false)} style={{flex:1,padding:"10px 0",borderRadius:10,background:"rgba(255,255,255,0.1)",color:COLORS.cream,border:"none",cursor:"pointer",fontWeight:600}}>Abbrechen</button>
              <button onClick={()=>{ setConfirmRestart(false); onNewGame(); }} style={{flex:1,padding:"10px 0",borderRadius:10,fontWeight:"bold",background:COLORS.redAccent,color:COLORS.cream,border:"none",cursor:"pointer"}}>Neu</button>
            </div>
          </div>
        </div>
      )}
      {state.phase==="handEnd" && <HandEndModal state={state} mySeat={mySeat} onNext={()=>onAction({type:"nextHand"})}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BOT-WISSENSSYSTEM  (Ausschlussverfahren + Gedächtnis)
// ─────────────────────────────────────────────────────────────────

/**
 * Leitet aus dem bisherigen Spielverlauf ab, was die CPU "wissen" kann:
 *  - Welche Karten sind noch im Spiel (nicht gespielt)
 *  - Welche Farben hat welcher Spieler NICHT (hat nicht bedient)
 *  - Wie viele Trümpfe sind noch draußen
 *  - Ob ein Spieler keine Trümpfe mehr hat
 *
 * Das Ergebnis wird als "knowledge"-Objekt an alle Bot-Funktionen weitergegeben.
 */
function buildBotKnowledge(state, seat) {
  const { trumpSuit, trickHistory = [], currentTrick, hands } = state;

  // Alle bereits gespielten Karten (abgeschlossene Stiche + laufender Stich)
  const playedCards = new Set();
  (trickHistory || []).forEach(trick => trick.forEach(t => playedCards.add(t.card.id)));
  (currentTrick || []).forEach(t => playedCards.add(t.card.id));

  // Eigene Hand
  const myHand = hands[seat] || [];
  myHand.forEach(c => playedCards.delete(c.id)); // eigene sind noch "da"

  // Karten die noch im Spiel sind (weder gespielt noch in eigener Hand)
  const fullDeck = [];
  for (const s of SUIT_KEYS) for (let r = 2; r <= 14; r++) fullDeck.push({ suit: s, rank: r, id: `${s}${r}` });
  const remainingCards = fullDeck.filter(c => !playedCards.has(c.id) && !myHand.some(m => m.id === c.id));

  // Farb-Absenz: Spieler der nicht bedient hat → hat diese Farbe nicht mehr
  const noSuit = { S: new Set(), E: new Set(), N: new Set(), W: new Set() };
  (trickHistory || []).forEach(trick => {
    const lead = trick[0]?.card?.suit;
    if (!lead) return;
    trick.forEach(t => {
      if (t.card.suit !== lead && t.card.suit !== trumpSuit) {
        // Hat getrumpft oder abgeworfen → hat lead-Farbe nicht
        noSuit[t.player].add(lead);
      }
      if (t.card.suit !== lead && t.card.suit !== trumpSuit) {
        // Hat abgeworfen (kein Trumpf, andere Farbe) → hat lead-Farbe nicht UND hat keinen Trumpf
        // (wird über Trumpf-Erschöpfung separat gehandhabt)
      }
    });
    // Wer nicht getrumpft hat obwohl Gegner trumpfte, hat keinen Trumpf
    const trickHadTrump = trick.some(t => t.card.suit === trumpSuit);
    if (trickHadTrump) {
      trick.forEach(t => {
        if (t.card.suit !== trumpSuit && t.card.suit !== lead) {
          noSuit[t.player].add(trumpSuit);
        }
      });
    }
  });

  // Trumpf-Erschöpfung: wie viele Trümpfe sind noch draußen (nicht in meiner Hand, nicht gespielt)
  const myTrumps = myHand.filter(c => c.suit === trumpSuit);
  const remainingTrumps = remainingCards.filter(c => c.suit === trumpSuit);
  const playedTrumps = [...playedCards].filter(id => id.startsWith(trumpSuit)).length;
  const totalTrumps = 13; // pro Farbe 13 Karten
  const trumpsOut = totalTrumps - myTrumps.length - playedTrumps; // noch bei Gegnern/Partner

  // Ist eine bestimmte Karte noch "gefährlich" (könnte jemand anderes sie haben)?
  const cardStillOut = (suit, rank) => remainingCards.some(c => c.suit === suit && c.rank === rank);

  // Stich-Bilanz
  const myTeam = teamOf(seat);
  const partner = { N:"S", S:"N", E:"W", W:"E" }[seat];
  const homeTricks = state.tricksByPlayer.S + state.tricksByPlayer.N;
  const awayTricks = state.tricksByPlayer.E + state.tricksByPlayer.W;
  const myTeamTricks = myTeam === "home" ? homeTricks : awayTricks;
  const oppTeamTricks = myTeam === "home" ? awayTricks : homeTricks;
  const tricksLeft = 13 - state.trickNumber + 1;

  return {
    remainingCards,        // Karten noch im Umlauf (nicht meine, nicht gespielt)
    remainingTrumps,       // Trümpfe noch im Umlauf
    playedCards,           // IDs aller gespielten Karten
    noSuit,                // noSuit[player].has(suit) → Spieler hat diese Farbe nicht
    trumpsOut,             // Geschätzte Anzahl Trümpfe bei Anderen
    cardStillOut,          // (suit, rank) => boolean
    myTeamTricks,
    oppTeamTricks,
    tricksLeft,
    partner,
    myTeam,
  };
}

// ─────────────────────────────────────────────────────────────────
// BOT-KI  (Teka-Strategie + Ausschlussverfahren)
// ─────────────────────────────────────────────────────────────────

/**
 * Prüft ob eine Karte aus meiner Hand als Ausspieler sicher gewinnt,
 * unter Berücksichtigung des Wissens über gespielte Karten.
 */
function isSafeWinner(card, trumpSuit, hand, knowledge) {
  const { cardStillOut, noSuit, remainingCards } = knowledge;

  if (card.suit === trumpSuit) {
    // Trumpf: sicher wenn kein höherer Trumpf mehr draußen ist
    const higherTrumpsOut = remainingCards.some(c => c.suit === trumpSuit && c.rank > card.rank);
    return !higherTrumpsOut;
  }

  // Nicht-Trumpf: sicher wenn Ass draußen ist ODER wir selbst das Ass haben
  if (card.rank === 14) {
    // Ass: Nur sicher wenn kein Trumpf mehr im Umlauf der uns schlagen könnte
    // (vereinfacht: wenn noch Trümpfe bei Gegnern, ist ein Ass in einer Nebenfarbe riskant)
    // → sicher wenn entweder alle Trümpfe gespielt oder Partner hat noch Trümpfe
    return true; // Ass gewinnt in seiner Farbe immer (wird evtl. getrumpft, aber das ist Risiko)
  }

  if (card.rank === 13) {
    // König: sicher wenn Ass dieser Farbe schon gespielt wurde
    const aceGone = !cardStillOut(card.suit, 14);
    return aceGone;
  }

  return false;
}

/** Wählt die beste Karte zum Ausspielen (erster in einem Stich) */
function botChooseLead(hand, state, knowledge) {
  const { partner, cardStillOut, noSuit, remainingCards, myTeamTricks, oppTeamTricks, tricksLeft } = knowledge;
  const pSig = state.signals?.[partner];
  const by = {}; SUIT_KEYS.forEach(s => by[s] = []);
  hand.forEach(c => by[c.suit].push(c));

  // ── Prio 1: 7:0-Modus ──────────────────────────────────────────────
  // Wir streben an, ALLE Stiche zu gewinnen. Solange der Gegner noch 0 Stiche
  // hat und wir noch keine Stiche verloren haben, maximieren wir den Stich-Gewinn.
  const sevenZeroAlive = oppTeamTricks === 0;

  // ── Prio 2: Rundengewinn sichern ────────────────────────────────────
  // Falls 7:0 nicht mehr möglich, brauchen wir nur noch TARGET_TRICKS (7).
  const needsTricks = TARGET_TRICKS - myTeamTricks;

  // --- Partnersignal beachten (Strategie 5) ---
  if (pSig?.type === SIGNALS.FESTE) {
    const sigSuit = pSig.suit;
    if (sigSuit && by[sigSuit]?.length) {
      return by[sigSuit].slice().sort((a, b) => a.rank - b.rank)[0];
    }
  }
  if (pSig?.type === SIGNALS.GEDREHT) {
    const sigSuit = pSig.suit;
    if (sigSuit && by[sigSuit]?.length) {
      return by[sigSuit].slice().sort((a, b) => a.rank - b.rank)[0];
    }
    const fallback = SUIT_KEYS.filter(s => s !== state.trumpSuit && by[s]?.length > 0);
    if (fallback.length > 0) {
      const best = fallback.sort((a, b) => by[b].length - by[a].length)[0];
      return by[best].slice().sort((a, b) => a.rank - b.rank)[0];
    }
  }

  // --- Sichere Stiche identifizieren (mit Wissens-System) ---
  const safeBySuit = {};
  for (const s of SUIT_KEYS) {
    safeBySuit[s] = by[s].filter(c => isSafeWinner(c, state.trumpSuit, hand, knowledge));
  }
  const totalSafe = Object.values(safeBySuit).flat();

  // --- 7:0-Modus: so aggressiv wie möglich spielen ---
  // Wenn 7:0 noch möglich und wir haben sichere Stiche → sofort spielen
  if (sevenZeroAlive && totalSafe.length > 0) {
    // Erst Trümpfe ziehen (Ass/Könige ziehen gegnerische Trümpfe heraus)
    const safeTrumps = safeBySuit[state.trumpSuit] || [];
    if (safeTrumps.length > 0) {
      // König zuerst wenn wir auch das Ass haben
      if (safeTrumps.some(c => c.rank === 14) && safeTrumps.some(c => c.rank === 13)) {
        return safeTrumps.find(c => c.rank === 13);
      }
      return safeTrumps.slice().sort((a, b) => b.rank - a.rank)[0];
    }
    // Dann sichere Nicht-Trumpf-Stiche
    for (const s of SUIT_KEYS) {
      const hasAce = safeBySuit[s].some(c => c.rank === 14);
      const hasKing = safeBySuit[s].some(c => c.rank === 13);
      if (hasAce && hasKing) return safeBySuit[s].find(c => c.rank === 13);
    }
    return totalSafe.slice().sort((a, b) => b.rank - a.rank)[0];
  }

  // --- 7:0 nicht mehr möglich (Gegner hat schon Stiche) → Prio 2: 7 Stiche holen ---
  // Gegner haben Trümpfe verbraucht → freie Bahn
  const oppSeats = SEATS.filter(s => teamOf(s) !== knowledge.myTeam);
  const oppHasNoTrump = oppSeats.every(s => noSuit[s]?.has(state.trumpSuit));
  if (oppHasNoTrump && by[state.trumpSuit]?.length === 0) {
    const allCards = hand.slice().sort((a, b) => b.rank - a.rank);
    if (allCards.length) return allCards[0];
  }

  // Sichere Stiche spielen (auch im normalen Modus)
  if (totalSafe.length > 0) {
    for (const s of SUIT_KEYS) {
      const hasAce = safeBySuit[s].some(c => c.rank === 14);
      const hasKing = safeBySuit[s].some(c => c.rank === 13);
      if (hasAce && hasKing) return safeBySuit[s].find(c => c.rank === 13);
    }
    return totalSafe.slice().sort((a, b) => b.rank - a.rank)[0];
  }

  // Farbe anspielen wo Gegner Absenz hat
  const oppSeatsArr = SEATS.filter(s => teamOf(s) !== knowledge.myTeam);
  for (const s of SUIT_KEYS) {
    if (s === state.trumpSuit) continue;
    const oppMissingThis = oppSeatsArr.some(op => noSuit[op]?.has(s));
    if (!oppMissingThis && by[s]?.length > 0) {
      const strongest = by[s].slice().sort((a, b) => b.rank - a.rank)[0];
      if (strongest.rank >= 11) return strongest;
    }
  }

  // Keine sicheren Stiche: längste Farbe anspielen
  const nonTrump = SUIT_KEYS.filter(s => s !== state.trumpSuit && by[s].length > 0);
  if (nonTrump.length > 0) {
    const best = nonTrump.slice().sort((a, b) => by[b].length - by[a].length)[0];
    return by[best].slice().sort((a, b) => a.rank - b.rank)[0];
  }
  // Nur Trumpf übrig
  return hand.slice().sort((a, b) => a.rank - b.rank)[0];
}

/** Wählt die beste Karte als Folger (nicht erster im Stich) */
function botChooseFollow(playable, state, knowledge) {
  const { partner, noSuit, remainingTrumps, myTeamTricks, oppTeamTricks, tricksLeft } = knowledge;
  const best = getCurrentBest(state.currentTrick, state.leadSuit, state.trumpSuit);
  const partnerWinning = best && teamOf(best.player) === teamOf(state.currentTurn);
  const isLastToPlay = state.currentTrick.length === 3;
  const partnerTrumped = partnerWinning && best?.card?.suit === state.trumpSuit;

  // ── 7:0-Modus: Gegner hat noch 0 Stiche → wir MÜSSEN jeden Stich gewinnen ──
  const sevenZeroAlive = oppTeamTricks === 0;

  // Ass der angespielten Farbe → immer spielen (sicherer Stich)
  const aceOfLead = state.leadSuit && playable.find(c => c.suit === state.leadSuit && c.rank === 14);
  if (aceOfLead) return aceOfLead;

  // Partner gewinnt den Stich gerade
  if (partnerWinning) {
    if (partnerTrumped) {
      // Partner hat getrumpft → nicht nochmal trumpfen (außer 7:0-Modus hat keine andere Wahl)
      const nonTrumpPlayable = playable.filter(c => c.suit !== state.trumpSuit);
      if (nonTrumpPlayable.length > 0) {
        return nonTrumpPlayable.slice().sort((a, b) => a.rank - b.rank)[0];
      }
      return playable.slice().sort((a, b) => a.rank - b.rank)[0];
    }
    // Im 7:0-Modus: prüfen ob Partner wirklich sicher gewinnt (nicht von Gegner übertroffen werden kann)
    // Wenn Partner nur mit schwacher Karte führt und wir eine bessere haben → im 7:0-Modus selbst gewinnen
    if (sevenZeroAlive && isLastToPlay) {
      // Letzter Spieler: sichergehen dass wir gewinnen, nicht Partner
      // → schwächste Karte abwerfen reicht wenn Partner wirklich führt
      return playable.slice().sort((a, b) => a.rank - b.rank)[0];
    }
    // Partner führt normal → schwächste Karte abwerfen
    return playable.slice().sort((a, b) => a.rank - b.rank)[0];
  }

  // Gegner gewinnt → versuchen zu übernehmen
  const winners = playable.filter(c => {
    if (!best) return true;
    const bestIsTrump = best.card.suit === state.trumpSuit;
    const cIsTrump = c.suit === state.trumpSuit;
    if (bestIsTrump) return cIsTrump && c.rank > best.card.rank;
    if (cIsTrump) return true;
    if (c.suit !== state.leadSuit) return false;
    return c.rank > best.card.rank;
  });

  if (winners.length > 0) {
    // Im 7:0-Modus: mit der STÄRKSTEN Karte gewinnen um sicherzugehen
    if (sevenZeroAlive) {
      return winners.slice().sort((a, b) => b.rank - a.rank)[0];
    }
    // Normalmodus: minimale gewinnende Karte ("billig gewinnen")
    const minWinner = winners.slice().sort((a, b) => a.rank - b.rank)[0];
    if (tricksLeft <= 3 && winners.some(c => c.rank === 14)) {
      return winners.find(c => c.rank === 14);
    }
    return minWinner;
  }

  // Wir können nicht gewinnen: schwächste Karte opfern
  return playable.slice().sort((a, b) => a.rank - b.rank)[0];
}

function botChooseCard(hand, state) {
  const playable = hand.filter(c => isCardPlayable(c, hand, state));
  if (!playable.length) return hand[0];

  const knowledge = buildBotKnowledge(state, state.currentTurn);

  if (state.currentTrick.length === 0) {
    return botChooseLead(playable, state, knowledge);
  }
  return botChooseFollow(playable, state, knowledge);
}

function botChooseTrump(hand) {
  // Wähle die Farbe mit den meisten hohen Karten (Ass, König, Dame, Bube zählen mehr).
  // Motivation: 7:0 braucht möglichst viele sichere Stiche in Trumpf.
  const score = {};
  SUIT_KEYS.forEach(s => {
    const cards = hand.filter(c => c.suit === s);
    score[s] = cards.length * 2
      + cards.filter(c => c.rank === 14).length * 4  // Ass
      + cards.filter(c => c.rank === 13).length * 3  // König
      + cards.filter(c => c.rank === 12).length * 2  // Dame
      + cards.filter(c => c.rank === 11).length * 1; // Bube
  });
  return SUIT_KEYS.reduce((a, b) => score[b] > score[a] ? b : a);
}

function botDecideSignal(seat, card, state) {
  // Signale nur beim Ausspielen (erster im Stich)
  if (state.currentTrick.length !== 0) return null;

  const suitCards = state.hands[seat].filter(c => c.suit === card.suit && c.id !== card.id);

  // GEDREHT: letzte Karte dieser Farbe – Partner kann jetzt trumpfen
  if (suitCards.length === 0) return SIGNALS.GEDREHT;

  // FESTE: höchste Karte gespielt und noch niedrigere in dieser Farbe
  // → Partner soll Farbe nochmal ausspielen, wir gewinnen den nächsten Stich
  const maxRemaining = Math.max(...suitCards.map(c => c.rank));
  if (card.rank > maxRemaining && card.rank >= 12) return SIGNALS.FESTE;
  if (card.suit === state.trumpSuit && card.rank >= 13) return SIGNALS.FESTE;

  // Signal nur geben wenn es dem Partner wirklich nützt – nicht unnötig preisgeben
  return null;
}

// ─────────────────────────────────────────────────────────────────
// LOSVERFAHREN-SCREEN
// ─────────────────────────────────────────────────────────────────
function DrawScreen({ names, onDone }) {
  const [deck] = useState(() => shuffle(buildDeck()));
  const [homeCard, setHomeCard] = useState(null);
  const [awayCard, setAwayCard] = useState(null);
  const [phase, setPhase] = useState("home"); // "home" | "cpuDrawing" | "result"

  const homeRep = "S";
  const awayRep = "E";

  function drawMyCard() {
    const pool = deck.filter(c => !homeCard || c.id !== homeCard.id);
    const card = pool[Math.floor(Math.random() * pool.length)];
    setHomeCard(card);
    setPhase("cpuDrawing");
    // CPU zieht automatisch nach kurzer Pause
    setTimeout(() => {
      const pool2 = deck.filter(c => c.id !== card.id);
      const cpuCard = pool2[Math.floor(Math.random() * pool2.length)];
      setAwayCard(cpuCard);
      setPhase("result");
    }, 900);
  }

  function getWinner() {
    if (!homeCard || !awayCard) return null;
    const hv = drawRankValue(homeCard.rank);
    const av = drawRankValue(awayCard.rank);
    if (hv > av) return "home";
    if (av > hv) return "away";
    return "tie";
  }

  const winner = getWinner();
  const firstDeclarer = winner === "away" ? awayRep : homeRep;

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:`linear-gradient(180deg,${COLORS.bg} 0%,${COLORS.bg2} 100%)`,color:COLORS.cream,fontFamily:"ui-sans-serif,system-ui",padding:24}}>
      <h1 style={{fontSize:26,fontWeight:"bold",letterSpacing:3,fontFamily:"Georgia,serif",color:COLORS.gold,marginBottom:2,textAlign:"center"}}>
        YAMA GAME
      </h1>
      <p style={{fontSize:12,opacity:0.45,marginBottom:28,textAlign:"center",letterSpacing:1}}>LOSVERFAHREN</p>

      <p style={{fontSize:12,opacity:0.55,marginBottom:20,textAlign:"center",lineHeight:1.7,maxWidth:300}}>
        Ziehe eine Karte – wer höher zieht, bestimmt den Trumpf.<br/>
        <span style={{opacity:0.5}}>Ass gilt als 1 (niedrigste Karte)</span>
      </p>

      <div style={{display:"flex",gap:20,justifyContent:"center",alignItems:"flex-start",marginBottom:28,width:"100%",maxWidth:320}}>
        {/* Du */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
          <div style={{fontSize:11,opacity:0.45,letterSpacing:1}}>DU</div>
          <div style={{fontSize:14,fontWeight:700,color:COLORS.goldLight}}>{names[homeRep]}</div>
          {homeCard ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <CardFace card={homeCard} clickable={false} highlight={winner==="home"}/>
              <div style={{fontSize:13,opacity:0.8,fontWeight:600}}>
                {homeCard.rank === 14 ? "Ass = 1" : `${RANK_LABEL[homeCard.rank]} = ${drawRankValue(homeCard.rank)}`}
                {" "}{SUIT_INFO[homeCard.suit].symbol}
              </div>
              {winner==="home" && <div style={{fontSize:12,color:"#7fdb8a",fontWeight:"bold"}}>🏆 Du gewinnst!</div>}
            </div>
          ) : (
            <div style={{width:52,height:70,borderRadius:8,border:"2px dashed rgba(201,162,39,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,opacity:0.5}}>🃏</div>
          )}
        </div>

        <div style={{paddingTop:60,fontSize:16,opacity:0.3,fontWeight:"bold"}}>VS</div>

        {/* CPU */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
          <div style={{fontSize:11,opacity:0.45,letterSpacing:1}}>CPU</div>
          <div style={{fontSize:14,fontWeight:700,color:COLORS.goldLight}}>{names[awayRep]}</div>
          {awayCard ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <CardFace card={awayCard} clickable={false} highlight={winner==="away"}/>
              <div style={{fontSize:13,opacity:0.8,fontWeight:600}}>
                {awayCard.rank === 14 ? "Ass = 1" : `${RANK_LABEL[awayCard.rank]} = ${drawRankValue(awayCard.rank)}`}
                {" "}{SUIT_INFO[awayCard.suit].symbol}
              </div>
              {winner==="away" && <div style={{fontSize:12,color:"#7fdb8a",fontWeight:"bold"}}>🏆 CPU gewinnt!</div>}
            </div>
          ) : phase === "cpuDrawing" ? (
            <div style={{width:52,height:70,borderRadius:8,border:`2px solid ${COLORS.gold}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
              animation:"pulse 0.5s ease-in-out infinite alternate",background:"rgba(201,162,39,0.1)"}}>🃏</div>
          ) : (
            <div style={{width:52,height:70,borderRadius:8,border:"2px dashed rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,opacity:0.2}}>?</div>
          )}
        </div>
      </div>

      {phase === "home" && (
        <button onClick={drawMyCard} style={{
          padding:"16px 40px",borderRadius:14,fontWeight:"bold",fontSize:16,
          background:COLORS.gold,color:"#1a1a1a",border:"none",cursor:"pointer",
          boxShadow:"0 4px 20px rgba(201,162,39,0.35)",letterSpacing:0.5,
        }}>
          🃏 Karte ziehen
        </button>
      )}
      {phase === "cpuDrawing" && (
        <div style={{fontSize:13,opacity:0.55,fontStyle:"italic"}}>CPU zieht …</div>
      )}
      {phase === "result" && (
        <div style={{textAlign:"center",width:"100%",maxWidth:320}}>
          <div style={{marginBottom:16,padding:"10px 16px",borderRadius:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,162,39,0.25)"}}>
            {winner === "tie" ? (
              <p style={{fontSize:13,opacity:0.7,margin:0}}>Gleichstand – du darfst trotzdem Trumpf bestimmen.</p>
            ) : (
              <p style={{fontSize:14,margin:0}}>
                <strong style={{color:COLORS.goldLight}}>{names[firstDeclarer]}</strong> bestimmt den Trumpf!
              </p>
            )}
          </div>
          <button onClick={()=>onDone(firstDeclarer)} style={{width:"100%",padding:"14px 0",borderRadius:14,fontWeight:"bold",fontSize:16,
            background:COLORS.gold,color:"#1a1a1a",border:"none",cursor:"pointer",
            boxShadow:"0 4px 20px rgba(201,162,39,0.35)",letterSpacing:0.5}}>
            Spiel starten 🎴
          </button>
        </div>
      )}
      <style>{`@keyframes pulse { from { opacity:0.6; transform:scale(0.97); } to { opacity:1; transform:scale(1.03); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CPU-MODUS
// ─────────────────────────────────────────────────────────────────
function CPUMode({ playerName, onBack }) {
  const OTHER_NAMES = PERSONAS.filter(n => n !== playerName);
  const CPU_NAMES = {
    S: playerName,
    E: OTHER_NAMES[0] || "Aaron",
    N: OTHER_NAMES[1] || "Grace",
    W: OTHER_NAMES[2] || "Denny",
  };
  const [appPhase, setAppPhase] = useState("draw"); // "draw" | "playing"
  const [firstDeclarer, setFirstDeclarer] = useState(null);
  const [gs, setGs] = useState(null);

  function handleDrawDone(declarer) {
    setFirstDeclarer(declarer);
    const dealer = declarer; // Der erste Trumpf-Bestimmer gibt auch die Karten
    setGs(dealNewGame(CPU_NAMES, 1, 0, 0, dealer, ["Spiel gestartet!"], declarer));
    setAppPhase("playing");
  }

  function dispatch(action) {
    setGs(prev => {
      if (!prev) return prev;
      if (action.type==="selectTrump") {
        if (prev.phase!=="trumpSelect"||prev.declarer!=="S") return prev;
        return applySelectTrump(prev, action.suit);
      }
      if (action.type==="playCard") {
        if (prev.phase!=="playing"||prev.trickComplete||prev.currentTurn!=="S") return prev;
        if (!isCardPlayable(action.card,prev.hands["S"],prev)) return prev;
        const next = applyPlayCard(prev,"S",action.card);
        // Ein vor dem Ausspielen gesetztes Signal ("Feste"/"Gedreht") hat noch keine cardId.
        // Jetzt an die tatsächlich gespielte Karte binden, damit sie MIT der passenden
        // Signal-Animation in die Mitte fliegt (so wie es auch die Bots tun).
        const sig = next.signals?.["S"];
        if (sig && sig.cardId == null) {
          const boundSuit = sig.type === SIGNALS.GEDREHT
            ? (next.leadSuit ?? action.card.suit)
            : action.card.suit;
          return {...next, signals:{...next.signals, ["S"]:{...sig, cardId:action.card.id, suit:boundSuit, trickNumber:prev.trickNumber}}};
        }
        return next;
      }
      if (action.type==="signal") {
        const ex = prev.signals?.["S"];
        if (ex?.type===action.signalType) {
          const signals={...prev.signals}; delete signals["S"];
          return {...prev,signals,log:[...prev.log,`${prev.names["S"]}: Signal zurückgenommen.`]};
        }
        const lastPlayed = prev.currentTrick.find(t => t.player === "S");
        const sigSuit = action.signalType === SIGNALS.GEDREHT
          ? (prev.leadSuit ?? lastPlayed?.card?.suit)
          : (lastPlayed?.card?.suit ?? prev.leadSuit);
        return {...prev,signals:{...prev.signals,["S"]:{type:action.signalType,suit:sigSuit,cardId:lastPlayed?.card?.id,trickNumber:prev.trickNumber}},
          log:[...prev.log,`${prev.names["S"]}: ${SIGNAL_INFO[action.signalType].emoji} ${SIGNAL_INFO[action.signalType].label}`]};
      }
      if (action.type==="nextHand") {
        if (prev.phase!=="handEnd") return prev;
        const rw=prev.lastHandResult?.winner;
        const nd=rw?getNextDeclarer(prev.declarer,rw):nextInOrder(prev.dealer);
        return dealNewGame(CPU_NAMES,prev.handNumber+1,prev.scoreHome,prev.scoreAway,nextInOrder(prev.dealer),prev.log,nd);
      }
      return prev;
    });
  }

  useEffect(()=>{
    if(!gs||gs.phase!=="trumpSelect"||gs.declarer==="S") return;
    const t=setTimeout(()=>setGs(p=>p&&p.phase==="trumpSelect"&&p.declarer!=="S"
      ?applySelectTrump(p,botChooseTrump(p.hands[p.declarer]||[])):p),900);
    return()=>clearTimeout(t);
  },[gs?.phase,gs?.declarer]);

  useEffect(()=>{
    if(!gs||gs.phase!=="playing"||gs.trickComplete||!gs.currentTurn||gs.currentTurn==="S") return;
    const seat=gs.currentTurn;
    const t=setTimeout(()=>{
      setGs(p=>{
        if(!p||p.currentTurn!==seat||p.trickComplete) return p;
        const card=botChooseCard(p.hands[seat]||[],p);
        if(!card) return p;
        const sig=botDecideSignal(seat,card,p);
        let s=p;
        if(sig) s={...p,signals:{...p.signals,[seat]:{type:sig,suit:card.suit,cardId:card.id,trickNumber:p.trickNumber}},
          log:[...p.log,`${p.names[seat]}: ${SIGNAL_INFO[sig].emoji} ${SIGNAL_INFO[sig].label}`]};
        return applyPlayCard(s,seat,card);
      });
    },650+Math.random()*400);
    return()=>clearTimeout(t);
  },[gs?.currentTurn,gs?.phase,gs?.trickComplete,gs?.trickNumber]);

  useEffect(()=>{
    if(!gs?.trickComplete) return;
    const t=setTimeout(()=>setGs(p=>p?.trickComplete?applyClearTrick(p):p),1100);
    return()=>clearTimeout(t);
  },[gs?.trickComplete,gs?.trickNumber]);

  if (appPhase === "draw") {
    return <DrawScreen names={CPU_NAMES} onDone={handleDrawDone}/>;
  }
  if(!gs) return null;
  return <GameView gameState={gs} mySeat="S" myHand={gs.hands["S"]} onAction={dispatch}
    onNewGame={()=>setGs(dealNewGame(CPU_NAMES,1,0,0,"S",["Neues Spiel."]))}/>;
}

// URL-Helper (cleaned up, no multiplayer)
// ─────────────────────────────────────────────────────────────────
// ROOT-APP
// ─────────────────────────────────────────────────────────────────
export default function YamaGame() {
  const [screen, setScreen] = useState("persona"); // "persona" | "game"
  const [playerName, setPlayerName] = useState(null);

  function handlePersonaSelect(name) {
    setPlayerName(name);
    setScreen("game");
  }

  function handleBack() {
    setPlayerName(null);
    setScreen("persona");
  }

  if (screen === "persona") {
    return <PersonaSelectScreen onSelect={handlePersonaSelect} takenPersonas={[]}/>;
  }
  if (screen === "game" && playerName) {
    return <CPUMode playerName={playerName} onBack={handleBack}/>;
  }
  return null;
}
