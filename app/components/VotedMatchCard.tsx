import { type ReactNode } from 'react'
import Link from 'next/link'

interface VotedMatchCardProps {
  match: any
  className?: string
}

export default function VotedMatchCard({ match, className = '' }: VotedMatchCardProps) {
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'
  const isCancelled = match.status === 'cancelled'
  const votedTeamName = match.voted_team === 1 ? match.team1 : match.team2
  const winnerName = match.winner === 1 ? match.team1 : match.winner === 2 ? match.team2 : null
  
  let resultText = 'Match Pending'
  let resultColor = 'text-white'
  let resultBg = 'bg-black/40'
  let summaryText = match.result_summary || 'Awaiting final result'
  
  if (isCancelled) {
     resultText = 'Match Cancelled'
     resultColor = 'text-yellow-400'
     resultBg = 'bg-yellow-900/40 border-yellow-500/30'
     summaryText = 'This fixture was cancelled before a final result was recorded.'
  } else if (isLive) {
     resultText = 'Match Live'
     resultColor = 'text-cyan-300'
     resultBg = 'bg-cyan-900/40 border-cyan-500/30'
     summaryText = match.result_summary || 'Voting is closed once the final result is confirmed.'
  } else if (isFinished) {
     const won = match.winner === match.voted_team
     const hasWinner = match.winner === 1 || match.winner === 2
     
     if (!hasWinner) {
        resultText = 'Result Recorded'
        resultColor = 'text-amber-300'
        resultBg = 'bg-amber-900/40 border-amber-500/30'
        summaryText = match.result_summary || 'The match finished without a winner recorded yet.'
     } else if (won) {
        resultText = 'Prediction Correct'
        resultColor = 'text-green-300'
        resultBg = 'bg-green-900/60 border-green-500/40'
        summaryText = match.result_summary || `${winnerName} won the match.`
     } else {
        resultText = 'Prediction Incorrect'
        resultColor = 'text-red-300'
        resultBg = 'bg-red-900/60 border-red-500/40'
        summaryText = match.result_summary || `${winnerName} won the match.`
     }
  }

  const bgUrl = match.public_artwork_url || match.prediction_artwork_url || null
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const team1Pct = totalVotes > 0 ? Math.round((match.poll_team1_votes / totalVotes) * 100) : 50
  const team2Pct = totalVotes > 0 ? Math.round((match.poll_team2_votes / totalVotes) * 100) : 50

  return (
    <Link href="/player/dashboard" className={`block relative aspect-[9/16] md:aspect-[3/4] rounded-[1.5rem] overflow-hidden shadow-2xl border border-white/10 group transition-all hover:scale-[1.02] ${className}`}>
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{
          backgroundImage: bgUrl
            ? `linear-gradient(180deg, rgba(7,10,20,0.1), rgba(7,10,20,0.6) 50%, rgba(7,10,20,0.95) 100%), url(${bgUrl})`
            : 'linear-gradient(145deg, rgba(18,34,64,0.96), rgba(13,18,32,0.96))'
        }}
      />
      
      <div className="absolute inset-0 flex flex-col p-4 z-10">
        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.2em] font-black text-white/80 mb-auto drop-shadow-md">
          <span className="truncate pr-2">{match.league || match.sport}</span>
          <span className="shrink-0 opacity-70 border border-white/20 px-2 py-0.5 rounded-full">{new Date(match.match_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
        
        <div className="mt-auto space-y-3">
          <div className="text-center px-2">
             <div className={`text-xl font-black drop-shadow-lg leading-none ${match.winner === 1 || !isFinished ? 'text-white' : 'text-white/50'}`}>
                {match.team1}
             </div>
             <div className="text-[10px] text-white/60 tracking-[0.3em] font-bold my-1.5 flex items-center justify-center gap-2">
               <span className="w-6 h-px bg-white/20"></span>
               VS
               <span className="w-6 h-px bg-white/20"></span>
             </div>
             <div className={`text-xl font-black drop-shadow-lg leading-none ${match.winner === 2 || !isFinished ? 'text-white' : 'text-white/50'}`}>
                {match.team2}
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className={`rounded-xl border border-white/10 p-2 text-center backdrop-blur-md ${match.voted_team === 1 ? 'bg-cyan-500/30 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-black/40'}`}>
               <p className="text-[9px] uppercase font-bold text-white/60 tracking-widest">{match.team1.substring(0, 3)}</p>
               <p className={`text-lg font-black ${match.voted_team === 1 ? 'text-cyan-100' : 'text-white'}`}>{team1Pct}%</p>
            </div>
            <div className={`rounded-xl border border-white/10 p-2 text-center backdrop-blur-md ${match.voted_team === 2 ? 'bg-cyan-500/30 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-black/40'}`}>
               <p className="text-[9px] uppercase font-bold text-white/60 tracking-widest">{match.team2.substring(0, 3)}</p>
               <p className={`text-lg font-black ${match.voted_team === 2 ? 'text-cyan-100' : 'text-white'}`}>{team2Pct}%</p>
            </div>
          </div>
          
          <div className={`rounded-xl border border-white/10 p-3 text-center backdrop-blur-md transition-colors ${resultBg}`}>
             <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-white/70 mb-1">Your Pick: <span className="text-white">{votedTeamName}</span></p>
             <p className={`text-[11px] font-black uppercase tracking-wider ${resultColor}`}>{resultText}</p>
             <p className="mt-1 text-[11px] font-medium leading-relaxed text-white/70">{summaryText}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
