export class TrackGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // Hitting the newly announced Lyria preview model
    this.lyriaEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent?key=${apiKey}`;
  }

  buildLyriaPrompt(config, targetBPM) {
    const genreProfiles = {
      'hip-hop': {
        style: "Modern hard-hitting Hip-Hop",
        drums: "Crisp 808 kicks, sharp claps, and busy hi-hat patterns",
        texture: "Deep sub-bass, soul-sampled vocal chops, and cinematic strings",
        energy_focus: "Heavy groove, head-nodding bounce"
      },
      'edm': {
        style: "High-energy Pulsing Dance music",
        drums: "Heavy four-on-the-floor kick, bright white-noise snare, and side-chained pads",
        texture: "Acid synth leads, rhythmic arpeggios, and build-up swells",
        energy_focus: "Maximum drive, stadium energy"
      },
      'lo-fi': {
        style: "Chill Bit-crushed Lo-Fi Beats",
        drums: "Lazy dusty drum breaks, muffled kicks, and shakers",
        texture: "Vinyl crackle, warm rhodes piano, and detuned jazz guitar",
        energy_focus: "Relaxed atmosphere, focus-oriented"
      },
      'pop': {
        style: "Bright Chart-topping Pop Instrumental",
        drums: "Clean punchy electronic drums, layered handclaps",
        texture: "Shimmering synth plucks, funky bass guitar, and catchy melodic hooks",
        energy_focus: "Upbeat, melodic, and polished"
      }
    };

    const profile = genreProfiles[config.genre.toLowerCase()] || genreProfiles['hip-hop'];

    const promptObject = {
      instruction: "Generate a professional high-fidelity loopable instrumental track",
      tempo_bpm: Math.round(targetBPM),
      genre_specification: {
        primary_style: profile.style,
        drum_profile: profile.drums,
        sonic_texture: profile.texture,
        mood: config.mood
      },
      compositional_rules: [
        "Maintain strict rhythmic consistency for physical activity synchronization",
        `Reflect energy level ${config.energy}/10: ${profile.energy_focus}`,
        "Ensure clear transient attacks for dribble impact processing",
        `Incorporate these specific instruments: ${config.instruments.join(', ')}`
      ]
    };

    return JSON.stringify(promptObject, null, 2);
  }

  async generateTrack(bpm, config) {
    const prompt = this.buildLyriaPrompt(config, bpm);
    console.log(`[Lyria] Generating ${bpm} BPM track:`, prompt);
    
    if (!this.apiKey) {
       throw new Error("No API key provided. Cannot generate Lyria audio.");
    }
    
    try {
      const response = await fetch(this.lyriaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            role: "user", 
            parts: [{ text: prompt }] 
          }],
          generationConfig: {
              responseModalities: ["AUDIO", "TEXT"]
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lyria API rejected the request (${response.status}): ${errText}`);
      }

      const data = await response.json();
      console.log("Lyria Generation Complete!");
      
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));
      
      if (!audioPart) {
          throw new Error(`Lyria returned a successful response, but the parts array contained no Audio binary. Payload: ${JSON.stringify(data)}`);
      }
      
      return this._createBlobUrlFromBase64(audioPart.inlineData.data, audioPart.inlineData.mimeType);
      
    } catch (e) {
      console.error("Lyria generation failed entirely", e);
      throw e;
    }
  }

  _createBlobUrlFromBase64(base64, mimeType) {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for( let i = 0; i < binary.length; i++ ) { array[i] = binary.charCodeAt(i); }
    const blob = new Blob([array], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  async generateSoundEffect(type) {
    // Skipping custom Lyria SFX for time, maintaining tone.js SFX synth we just built natively
    return null;
  }
}
