'use client'

import { useState, useEffect } from 'react'
import { Trophy, Target, TrendingUp, Award, LogOut, Hexagon, Crosshair, ChevronRight, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import VotedMatchCard from '@/app/components/VotedMatchCard'

export default function PlayerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [votedMatches, setVotedMatches] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
    fetchVotedMatches()
  }, [])

  const checkAuth = async () => {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    const data = await res.json()
    
    if (!data.user) {
      router.push('/login')
      return
    }
    
    setUser(data.user)
  }

  const fetchVotedMatches = async () => {
    try {
      const res = await fetch('/api/user/votes', { cache: 'no-store' })
      if (!res.ok) {
        console.error('Failed to fetch voted matches')
        return
      }
      const data = await res.json()
      setVotedMatches(data.matches || [])
    } catch(err) {
      console.error('Fetch error:', err)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!user) return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center relative overflow-hidden">
       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.15),transparent_50%)] animate-pulse" />
       <p className="text-cyan-400 font-black tracking-widest uppercase animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">Initializing Uplink...</p>
    </div>
  )

  const accuracy = user.predictions_count > 0 
    ? Math.round((user.correct_predictions / user.predictions_count) * 100) 
    : 0

  return (
    <div className="min-h-screen bg-[#070B14] relative overflow-hidden text-white font-sans selection:bg-cyan-500/30">
      {/* Dynamic Cyber Grid Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34,211,238,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34,211,238,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 60%)'
        }}
      />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        
        {/* HUD Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
          
          <div className="flex items-center gap-5 z-10">
            <div className="relative">
               <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-30 animate-pulse rounded-full" />
               <div className="w-16 h-16 rounded-full border-2 border-cyan-400/50 bg-black/60 flex items-center justify-center relative overflow-hidden backdrop-blur-md">
                 <img src={`https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${user.email}`} alt="Avatar" className="w-14 h-14 opacity-90" />
               </div>
            </div>
            <div>
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.3em] mb-1">Authenticated Operative</p>
              <h1 className="text-3xl font-black text-white tracking-tight">{user.name}</h1>
            </div>
          </div>
          
          <div className="flex gap-4 z-10 w-full md:w-auto mt-4 md:mt-0">
             <Link href="/" className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-400/50 border border-white/10 text-cyan-50 font-bold rounded-xl transition shadow-[inset_0_1px_rgba(255,255,255,0.1)]">
               <Zap className="w-4 h-4 text-cyan-400" /> To Arena
             </Link>
             <button onClick={handleLogout} className="flex items-center justify-center p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition group">
               <LogOut className="w-5 h-5 group-hover:animate-bounce" />
             </button>
          </div>
        </header>

        {/* Global HUD Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
          
          <div className="bg-black/30 backdrop-blur-md rounded-[1.5rem] p-6 border border-white/5 shadow-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/20 blur-2xl rounded-full" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em]">Total Score</span>
              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-yellow-600 relative z-10">{user.points}</p>
          </div>

          <div className="bg-black/30 backdrop-blur-md rounded-[1.5rem] p-6 border border-white/5 shadow-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform border-l border-l-cyan-500/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-2xl rounded-full" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em]">Predictions</span>
              <Target className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-4xl md:text-5xl font-black text-cyan-100 relative z-10">{user.predictions_count}</p>
          </div>

          <div className="bg-black/30 backdrop-blur-md rounded-[1.5rem] p-6 border border-cyan-400/10 shadow-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
            <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em]">Wins</span>
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-4xl md:text-5xl font-black text-emerald-400 relative z-10">{user.correct_predictions}</p>
          </div>

          <div className="bg-[#0b1021]/80 backdrop-blur-md rounded-[1.5rem] p-6 border border-fuchsia-400/20 shadow-[-5px_0_30px_rgba(192,38,211,0.1)] relative overflow-hidden group hover:-translate-y-1 transition-transform">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(192,38,211,0.15),transparent)]" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-[10px] text-fuchsia-200/50 font-bold uppercase tracking-[0.2em]">Hit Rate</span>
              <TrendingUp className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div className="flex items-end gap-2 relative z-10">
              <p className="text-4xl md:text-5xl font-black text-fuchsia-400">{accuracy}</p>
              <span className="text-xl font-bold text-fuchsia-400/50 mb-1">%</span>
            </div>
          </div>
          
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          
          {/* Main Content Area - Voted Matches */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-black flex items-center gap-3">
                 <Crosshair className="w-6 h-6 text-cyan-400" />
                 BATTLE LOG
              </h2>
            </div>
            
            {votedMatches.length === 0 ? (
               <div className="bg-black/30 rounded-[1.5rem] p-10 border border-white/5 text-center flex flex-col items-center justify-center min-h-[300px]">
                 <Hexagon className="w-16 h-16 text-white/10 mb-4" strokeWidth={1} />
                 <p className="text-white/40 text-sm font-bold tracking-widest uppercase mb-4">No active deployments</p>
                 <Link href="/" className="px-6 py-3 bg-cyan-500/10 text-cyan-400 font-bold tracking-wider rounded-xl border border-cyan-500/20 hover:bg-cyan-500/20 transition uppercase text-[10px]">
                   Access Arena
                 </Link>
               </div>
            ) : (
               <div className="grid sm:grid-cols-2 gap-6">
                 {votedMatches.map(match => (
                   <VotedMatchCard key={match.id} match={match} />
                 ))}
               </div>
            )}
          </div>

          {/* Right Sidebar - Ranking & Network */}
          <div className="space-y-6">
            <div className="flex items-center border-b border-white/10 pb-4">
              <h2 className="text-xl font-black flex items-center gap-3">
                 <Target className="w-6 h-6 text-fuchsia-400" />
                 NETWORK RANKING
              </h2>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[1.5rem] p-6 relative overflow-hidden group">
               <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-[conic-gradient(from_0deg_at_50%_50%,rgba(192,38,211,0.1),transparent,transparent)] animate-[spin_10s_linear_infinite]" />
               
               <div className="relative z-10 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white/5 to-transparent rounded-2xl border border-white/10 backdrop-blur-md mb-6 shadow-inner">
                 <p className="text-[10px] text-fuchsia-200/50 uppercase font-black tracking-[0.3em] mb-4">Current Ladder Position</p>
                 <div className="w-20 h-20 rounded-full bg-black/50 border-2 border-fuchsia-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(192,38,211,0.3)] mb-4">
                   <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-400 to-fuchsia-600">
                     #1
                   </p>
                 </div>
                 <p className="text-xl font-black text-white">{user.name}</p>
                 <p className="text-sm font-bold text-white/50">{user.points} PT</p>
               </div>

               <div className="space-y-4 relative z-10">
                 <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-2 mb-2">Upcoming Rivals</p>
                 
                 <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition border border-transparent hover:border-white/10">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">#2</div>
                     <span className="font-bold text-sm text-white/80">NeonGamer</span>
                   </div>
                   <span className="text-sm font-black text-cyan-400">950</span>
                 </div>
                 
                 <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition border border-transparent hover:border-white/10">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">#3</div>
                     <span className="font-bold text-sm text-white/80">CryptoKing</span>
                   </div>
                   <span className="text-sm font-black text-cyan-400">820</span>
                 </div>
               </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  )
}
