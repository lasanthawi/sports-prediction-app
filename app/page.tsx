'use client'

import { Trophy } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="text-center mb-12">
        <div className="flex justify-center items-center gap-3 mb-4">
          <Trophy className="w-12 h-12 text-yellow-400" />
          <h1 className="text-6xl font-black text-glow bg-gradient-to-r from-green-400 to-pink-500 bg-clip-text text-transparent">
            PREDICTION ARENA
          </h1>
        </div>
        <p className="text-xl text-gray-300">Predict. Vote. Win Glory! 🏆</p>
      </div>

      <div className="max-w-4xl mx-auto bg-gray-800 rounded-xl p-8 card-glow text-center">
        <h2 className="text-3xl font-bold mb-4">Welcome to Sports Prediction Arena!</h2>
        <p className="text-gray-300 mb-6">
          Your AI-powered platform for sports predictions with live polls and match flyers.
        </p>
        <div className="space-y-4 text-left max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="font-bold">AI-Generated Flyers</h3>
              <p className="text-sm text-gray-400">Pre and post-match flyers using Gemini</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🗳️</span>
            <div>
              <h3 className="font-bold">Live Polls</h3>
              <p className="text-sm text-gray-400">Vote on match outcomes in real-time</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <h3 className="font-bold">Countdown Timers</h3>
              <p className="text-sm text-gray-400">Voting closes when match starts</p>
            </div>
          </div>
        </div>
        <button className="mt-8 btn-game">
          Connect Neon DB to Get Started
        </button>
      </div>
    </main>
  )
}