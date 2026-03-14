import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const { matchId, type } = await request.json()
    
    // Get match details
    const { rows } = await sql`
      SELECT * FROM matches WHERE id = ${matchId}
    `
    
    if (!rows.length) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    
    const match = rows[0]
    
    // Create prompts based on type
    let prompt = ''
    if (type === 'pre') {
      prompt = `Create an exciting sports match promotional flyer for ${match.team1} vs ${match.team2} in ${match.sport}. 
      Style: Mobile game aesthetic with vibrant neon colors (electric green #00ff87, hot pink #ff006e, gold #ffd700). 
      Include: Dynamic energy, stadium atmosphere, bold typography showing team names and VS text. 
      Make it look like a modern esports tournament poster. 
      Aspect ratio: 9:16 vertical. 
      NO TEXT ON IMAGE - pure visual design only.`
    } else {
      prompt = `Create a post-match results flyer for ${match.team1} vs ${match.team2} in ${match.sport}. 
      Score: ${match.team1_score || 0} - ${match.team2_score || 0}. 
      Style: Mobile game aesthetic, victory celebration with neon effects. 
      Show trophy, confetti, winner highlight. 
      Colors: neon green #00ff87, pink #ff006e, gold #ffd700. 
      Aspect ratio: 9:16 vertical. 
      NO TEXT - visual celebration only.`
    }
    
    // Call Gemini via Composio (this will be handled by client calling Composio API)
    // For now, return the prompt for the client to generate
    
    return NextResponse.json({ 
      prompt,
      matchId,
      type,
      message: 'Ready to generate flyer - call Gemini with this prompt'
    })
  } catch (error: any) {
    console.error('Flyer generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}