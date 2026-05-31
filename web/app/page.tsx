"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, UserPlus, Play, Trophy, X } from "lucide-react";

const socket = io("https://genlayer-whot-server.onrender.com");

interface Player { id: string; username: string; cardCount?: number; cardSum?: number; }
interface Card { id: string; shape: string; number: number; isAction: boolean; }
interface LeaderboardEntry { id: string; username: string; cardCount: number; cardSum: number; }

export default function Home() {
  const [appState, setAppState] = useState(0);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);

  // 🔥 SESSION PERSISTENCE STATE
  const [sessionId, setSessionId] = useState("");

  const [myHand, setMyHand] = useState<Card[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [currentTurnId, setCurrentTurnId] = useState("");
  const [marketCount, setMarketCount] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [winnerData, setWinnerData] = useState<{ id: string, name: string } | null>(null);
  
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    // 🔥 GENERATE OR FETCH SESSION ID USING LOCAL STORAGE (Survives hard refreshes and new tabs)
    let storedSessionId = localStorage.getItem('whot_sessionId');
    if (!storedSessionId) {
        storedSessionId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('whot_sessionId', storedSessionId);
    }
    setSessionId(storedSessionId);

    const params = new URLSearchParams(window.location.search);
    if (params.get("room")) {
      setRoomId(params.get("room")!.toUpperCase());
      setAppState(3);
    }

    socket.on("room_updated", (data) => {
      setPlayers(data.players);
      setMaxPlayers(data.maxPlayers);
      if (data.host === socket.id) setIsHost(true);
    });

    socket.on("game_updated", (data) => {
      setActiveCard(data.activeCard);
      setMyHand(data.myHand);
      setMarketCount(data.marketCount);
      setCurrentTurnId(data.currentTurnId);
      setPlayers(data.players); 
      setAppState(prev => prev === 6 ? 6 : 5); 
    });

    socket.on("action_notification", (data) => {
      setActionMessage(data.message);
      setTimeout(() => setActionMessage(null), 3500); 
    });

    socket.on("game_over", (data) => {
      setWinnerData({ id: data.winnerId, name: data.winnerName });
      setFinalLeaderboard(data.leaderboard);
      setAppState(6); 
    });

    return () => {
      socket.off("room_updated");
      socket.off("game_updated");
      socket.off("action_notification");
      socket.off("game_over");
    };
  }, []);

  const handleJoinLobby = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && roomId) {
      // 🔥 PASS LOCAL STORAGE SESSION ID TO SERVER
      socket.emit("join_room", { 
          roomId: roomId.toUpperCase(), 
          username, 
          maxPlayers,
          sessionId: localStorage.getItem('whot_sessionId') || sessionId 
      });
      setAppState(4);
    }
  };

  const startGame = () => socket.emit("start_game", { roomId: roomId.toUpperCase() });

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId.toUpperCase()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPlayable = (card: Card) => {
    if (!activeCard) return false;
    return card.shape === activeCard.shape || card.number === activeCard.number;
  };

  const handlePlayCard = (card: Card) => {
    if (currentTurnId !== socket.id || !isPlayable(card)) return; 
    socket.emit("play_card", { roomId, cardId: card.id });
  };

  const handleDrawCard = () => {
    if (currentTurnId !== socket.id) return; 
    socket.emit("draw_card", { roomId });
  };

  const resetToLobby = () => {
    setWinnerData(null);
    setFinalLeaderboard(null); 
    setAppState(1); 
  };

  const getCardSymbol = (shape: string) => {
    switch (shape) {
      case "Circle": return { symbol: "⚫", color: "text-red-800" };
      case "Triangle": return { symbol: "▲", color: "text-red-800" };
      case "Cross": return { symbol: "✚", color: "text-red-800" };
      case "Square": return { symbol: "■", color: "text-red-800" };
      case "Star": return { symbol: "★", color: "text-red-800" };
      default: return { symbol: shape, color: "text-slate-800" };
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative bg-[#080808] font-sans">
      
      {/* --- GLOBAL CINEMATIC BACKGROUND --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div 
          animate={{ 
            scale: appState === 0 && !showTrailer ? [1, 1.05, 1] : 1.1,
            opacity: appState === 0 && !showTrailer ? 1 : 0.15,
            filter: appState === 0 && !showTrailer ? "blur(0px)" : "blur(20px)"
          }}
          transition={{ 
            scale: { duration: 20, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 1 },
            filter: { duration: 1 }
          }}
          className="absolute inset-0"
        >
          <Image src="/mac.png" alt="Lagos Underground" fill className="object-cover object-center" priority />
        </motion.div>
        
        <div className={`absolute inset-0 transition-opacity duration-1000 ${appState === 0 ? 'bg-gradient-to-r from-[#080808] via-[#080808]/80 to-transparent' : 'bg-transparent'}`}></div>
        <div className="absolute inset-0 bg-amber-900/10 mix-blend-overlay"></div>
      </div>

      {/* --- MAIN UI CONTENT --- */}
      <AnimatePresence mode="wait">
        
        {/* --- STATE 0: THE ARCANE HERO SECTION --- */}
        {appState === 0 && (
          <motion.div 
            key="splash" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, x: -50 }} 
            className="w-full h-full flex flex-col justify-center px-6 md:px-16 lg:px-24 z-10 min-h-screen"
          >
            <div className="max-w-3xl">
              <motion.p 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="text-amber-500 font-bold tracking-[0.2em] text-sm md:text-base mb-4 uppercase"
              >
                GenLayer Native
              </motion.p>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[1.1] mb-6 tracking-tighter drop-shadow-2xl"
              >
                The Streets Met <br />The Blockchain.
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="text-lg md:text-xl text-slate-300 mb-10 max-w-lg leading-relaxed drop-shadow-md"
              >
                The unforgiving rules of Naija Whot, powered by Intelligent Contracts. No central servers. No rigged decks. Just pure, Afro-futuristic card combat deployed on GenLayer.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6"
              >
                <button 
                  onClick={() => setAppState(1)} 
                  className="px-10 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-lg rounded-full shadow-[0_0_40px_rgba(217,119,6,0.4)] transform transition-all active:scale-95 flex items-center justify-center"
                >
                  Enter The Lounge
                </button>
                <button 
                  onClick={() => setShowTrailer(true)}
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold text-lg rounded-full transition-all flex items-center justify-center space-x-2 group"
                >
                  <Play size={20} className="text-white group-hover:text-amber-400 transition-colors" />
                  <span>Watch Gameplay</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* --- STATE 1: CROSSROADS --- */}
        {appState === 1 && (
          <motion.div key="cross" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-2xl grid md:grid-cols-2 gap-6 z-10 p-4">
            <button 
              onClick={() => {
                setRoomId(Math.random().toString(36).substring(2, 7).toUpperCase());
                setAppState(2);
              }} 
              className="flex flex-col items-center p-10 bg-[#111111]/80 hover:bg-[#1a1a1a] backdrop-blur-xl border border-white/10 hover:border-amber-500/50 rounded-3xl group transition-all shadow-2xl"
            >
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all"><Users size={32} /></div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Create Game</h2>
              <p className="text-slate-400 text-sm text-center">Host a table in the VIP room.</p>
            </button>
            <button 
              onClick={() => {
                setRoomId(""); 
                setAppState(3);
              }} 
              className="flex flex-col items-center p-10 bg-[#111111]/80 hover:bg-[#1a1a1a] backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 rounded-3xl group transition-all shadow-2xl"
            >
              <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all"><UserPlus size={32} /></div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Join Table</h2>
              <p className="text-slate-400 text-sm text-center">Have a code? Sit down and play.</p>
            </button>
          </motion.div>
        )}

        {/* --- STATE 2 & 3: FORMS --- */}
        {(appState === 2 || appState === 3) && (
          <motion.div key="forms" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-md p-8 rounded-3xl bg-[#111111]/90 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] z-10 m-4">
            <div className="flex items-center space-x-4 mb-8"><button onClick={() => setAppState(1)} className="text-amber-500 hover:text-amber-400">← Back</button><h2 className="text-2xl font-bold text-white tracking-tight">{appState === 2 ? "Host Table" : "Join Table"}</h2></div>
            <form onSubmit={handleJoinLobby} className="space-y-6">
              <input type="text" placeholder="Your Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-4 bg-[#080808] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all" required />
              
              {appState === 3 ? (
                 <input type="text" placeholder="Room Code (e.g., LAGOS)" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="w-full px-4 py-4 bg-[#080808] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-amber-500 uppercase font-mono outline-none transition-all" required />
              ) : (
                 <div className="w-full px-4 py-4 bg-[#080808]/50 border border-slate-800 rounded-xl flex justify-between items-center">
                    <span className="text-amber-500/80 uppercase font-mono font-bold tracking-widest">{roomId}</span>
                    <span className="text-xs text-slate-500 tracking-wider uppercase font-bold bg-white/5 px-2 py-1 rounded-md">Auto-Generated</span>
                 </div>
              )}

              {appState === 2 && (
                <div className="pt-2"><label className="block text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider text-xs">Max Players</label><div className="flex space-x-2">{[2, 3, 4, 5, 6].map((num) => (<button key={num} type="button" onClick={() => setMaxPlayers(num)} className={`flex-1 py-3 rounded-lg font-bold transition-all ${maxPlayers === num ? "bg-amber-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>{num}</button>))}</div></div>
              )}
              <button type="submit" className={`w-full py-4 text-white font-bold rounded-xl transition-all active:scale-95 text-lg ${appState === 2 ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:shadow-[0_0_20px_rgba(217,119,6,0.4)]" : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:shadow-[0_0_20px_rgba(8,145,178,0.4)]"}`}>{appState === 2 ? "Open Table" : "Enter Lounge"}</button>
            </form>
          </motion.div>
        )}

        {/* --- STATE 4: WAITING ROOM --- */}
        {appState === 4 && (
          <motion.div key="wait" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-md p-8 rounded-3xl bg-[#111111]/90 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] z-10 m-4">
            <div className="bg-[#080808] p-6 rounded-2xl border border-slate-800 text-center mb-8 relative"><p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-2">Room Code</p><h2 className="text-4xl font-black text-white font-mono tracking-wider">{roomId}</h2><button onClick={copyInviteLink} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors">{copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}</button></div>
            <div className="mb-8"><div className="flex justify-between items-center mb-4"><h3 className="text-white font-bold uppercase tracking-wider text-sm">Players</h3><span className="text-amber-500 font-bold text-sm">{players.length} / {maxPlayers}</span></div><ul className="space-y-3">{players.map((p) => (<li key={p.id} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5"><div className="flex items-center space-x-3"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div><span className="text-white font-medium">{p.username}</span></div>{p.id === socket.id && <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">YOU</span>}</li>))}{Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, i) => (<li key={`e-${i}`} className="flex items-center space-x-3 bg-white/5 p-4 rounded-xl border border-white/5 border-dashed opacity-50"><div className="w-2 h-2 rounded-full bg-slate-700"></div><span className="text-slate-500 italic">Waiting for player...</span></li>))}</ul></div>
            {isHost ? <button onClick={startGame} disabled={players.length < 2} className={`w-full py-4 font-bold text-lg rounded-xl flex items-center justify-center space-x-2 transition-all ${players.length >= 2 ? "bg-amber-600 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)] cursor-pointer active:scale-95" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}><Play size={20} fill="currentColor" /><span>Deal Cards</span></button> : <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5"><p className="text-amber-500/70 animate-pulse font-medium">Waiting for host...</p></div>}
          </motion.div>
        )}

        {/* --- STATE 5: ACTIVE GAME BOARD --- */}
        {appState === 5 && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full max-w-6xl flex flex-col justify-between z-10 relative">
            <AnimatePresence>
              {actionMessage && (
                <motion.div initial={{ opacity: 0, scale: 0.5, y: -50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.2, filter: "blur(10px)" }} className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none w-full max-w-[90vw] md:max-w-3xl px-4 flex justify-center">
                  <div className="bg-red-600/90 backdrop-blur-xl border-4 border-red-400 px-8 py-6 rounded-3xl shadow-[0_0_80px_rgba(220,38,38,1)] text-center">
                    <h2 className="text-2xl md:text-5xl font-black text-white tracking-widest uppercase italic drop-shadow-lg leading-tight">{actionMessage}</h2>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center space-x-4 p-4 mt-8 flex-wrap gap-y-4">
              {players.filter(p => p.id !== socket.id).map(opponent => (
                <div key={opponent.id} className={`backdrop-blur-xl px-6 py-3 rounded-full border shadow-lg flex items-center space-x-3 transition-colors ${opponent.cardCount === 1 ? 'bg-red-500/20 border-red-500 animate-pulse' : 'bg-[#111111]/80 border-white/10'}`}>
                   <div className={`w-3 h-3 rounded-full ${currentTurnId === opponent.id ? 'bg-amber-400 animate-pulse shadow-[0_0_15px_#fbbf24]' : opponent.cardCount === 1 ? 'bg-red-500' : 'bg-slate-600'}`}></div>
                   <span className={`${opponent.cardCount === 1 ? 'text-red-400 font-bold' : 'text-slate-200 font-medium'}`}>
                       {opponent.username} 
                       <span className={`text-sm ml-1 ${opponent.cardCount === 1 ? 'text-red-500' : 'text-slate-500'}`}>
                           ({opponent.cardCount} cards | Score: {opponent.cardSum})
                       </span>
                   </span>
                </div>
              ))}
            </div>

            <div className="flex-1 flex items-center justify-center space-x-8 md:space-x-16">
              <div onClick={handleDrawCard} className={`w-32 h-48 md:w-40 md:h-60 bg-[#080808] rounded-2xl border flex flex-col items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.8)] transition-all ${currentTurnId === socket.id ? "border-amber-500 hover:-translate-y-2 cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.2)]" : "border-slate-800 opacity-80 cursor-not-allowed"}`}>
                <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center mb-3"><Image src="/genlayer-logo.jpg" alt="Logo" width={24} height={24} className="opacity-40" /></div>
                <span className={`font-bold uppercase tracking-widest text-sm ${currentTurnId === socket.id ? "text-amber-500" : "text-slate-500"}`}>Draw</span>
                <span className="text-slate-600 text-xs mt-1">({marketCount} left)</span>
              </div>

              {activeCard && (
                <motion.div key={`active-${activeCard.id}`} initial={{ scale: 0.8, y: -20 }} animate={{ scale: 1, y: 0 }} className={`w-32 h-48 md:w-40 md:h-60 bg-[#f4ebd8] rounded-2xl flex flex-col items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)] border-4 border-[#dcd1be] relative ${getCardSymbol(activeCard.shape).color}`}>
                  <span className="absolute top-3 left-4 text-xl md:text-2xl font-black">{activeCard.number}</span>
                  <span className="absolute bottom-3 right-4 text-xl md:text-2xl font-black rotate-180">{activeCard.number}</span>
                  <span className="text-6xl md:text-7xl drop-shadow-sm">{getCardSymbol(activeCard.shape).symbol}</span>
                </motion.div>
              )}
            </div>

            <div className="p-8 mb-4">
               <div className="flex items-center justify-center mb-8"><h3 className={`font-bold px-8 py-3 rounded-full text-sm tracking-widest uppercase shadow-lg ${currentTurnId === socket.id ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-[#111111]/80 text-slate-500 border border-white/5"}`}>{currentTurnId === socket.id ? "🟢 YOUR TURN" : "⏳ WAITING FOR OPPONENT..."}</h3></div>
               <div className="flex justify-center gap-[-20px] overflow-visible">
                  <AnimatePresence>
                    {myHand.map((card, index) => {
                      const { symbol, color } = getCardSymbol(card.shape);
                      const canPlay = isPlayable(card);
                      const isMyTurn = currentTurnId === socket.id;
                      
                      return (
                        <motion.div
                          key={card.id}
                          initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: isMyTurn && !canPlay ? 0.3 : 1 }} exit={{ y: -100, opacity: 0, scale: 0.5 }} onClick={() => handlePlayCard(card)}
                          className={`w-28 h-40 md:w-36 md:h-56 bg-[#f4ebd8] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center border-2 transition-all relative -ml-6 md:-ml-8 first:ml-0 ${color} ${isMyTurn && canPlay ? "border-[#dcd1be] hover:border-amber-500 hover:-translate-y-8 hover:z-50 cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.3)]" : "border-[#dcd1be] cursor-not-allowed"}`}
                        >
                          <span className="absolute top-2 left-3 text-lg md:text-xl font-black">{card.number}</span>
                          <span className="absolute bottom-2 right-3 text-lg md:text-xl font-black rotate-180">{card.number}</span>
                          <span className="text-5xl md:text-6xl drop-shadow-sm">{symbol}</span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
               </div>
            </div>
          </motion.div>
        )}

        {/* --- STATE 6: GAME OVER SCREEN --- */}
        {appState === 6 && winnerData && (
          <motion.div key="victory" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center z-50 text-center w-full max-w-xl p-8 md:p-12 bg-[#111111]/90 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.9)] relative overflow-hidden m-4">
             <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${winnerData.id === socket.id ? 'from-amber-400 to-orange-600' : 'from-red-400 to-rose-600'}`}></div>
             <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl ${winnerData.id === socket.id ? 'bg-amber-500/20 text-amber-500 border-2 border-amber-500' : 'bg-red-500/20 text-red-500 border-2 border-red-500'}`}><Trophy size={40} className="md:w-12 md:h-12" /></div>
             <h2 className="text-lg md:text-xl text-slate-400 font-medium mb-2 tracking-widest uppercase">Table Closed</h2>
             <h1 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight">{winnerData.id === socket.id ? "YOU WON!" : `${winnerData.name.toUpperCase()} WINS`}</h1>
             
             {finalLeaderboard && (
               <div className="w-full bg-[#080808]/50 rounded-2xl p-4 md:p-6 mb-8 text-left border border-white/5 shadow-inner">
                 <h3 className="text-xs text-slate-500 mb-4 uppercase tracking-widest font-bold">Final Standings (Lowest Score Wins)</h3>
                 <ul className="space-y-3">
                   {finalLeaderboard.map((player, index) => (
                     <li key={player.id} className="flex justify-between items-center text-slate-300 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                       <span className="font-medium flex items-center gap-3">
                         <span className="text-slate-600 font-mono w-4">{index + 1}</span>
                         {player.username}
                         {index === 0 && <span className="text-amber-500 ml-2 text-xl drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]">👑</span>}
                       </span>
                       
                       <span className="text-amber-500 font-mono text-sm font-bold">
                         Score: {player.cardSum} <span className="text-slate-600 text-xs font-normal">({player.cardCount} cards)</span>
                       </span>
                     </li>
                   ))}
                 </ul>
               </div>
             )}

             <button onClick={resetToLobby} className="px-10 py-4 bg-white text-[#080808] font-bold rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-transform w-full text-lg uppercase tracking-wider">Return to Lounge</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- LOCAL CINEMATIC VIDEO MODAL --- */}
      <AnimatePresence>
        {showTrailer && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)]">
              <button 
                onClick={() => setShowTrailer(false)}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-amber-600 text-white rounded-full transition-colors"
              >
                <X size={24} />
              </button>
              
              <video 
                src="/gameplay.mp4" 
                autoPlay 
                loop 
                controls 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}