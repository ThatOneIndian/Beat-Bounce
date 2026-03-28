export class TrackGenerator {
  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_LYRIA_API_KEY || import.meta.env.GEMINI_API_KEY;
    this.apiKey = apiKey;
    // Hitting the newly announced Lyria preview model
    this.lyriaEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent?key=${apiKey}`;
  }

  buildLyriaPrompt(config, targetBPM) {
    const genreProfiles = {
      'hip-hop': {
        style: "modern hard-hitting hip-hop",
        drums: "crisp 808 kicks, sharp claps, and busy hi-hat patterns",
        texture: "deep sub-bass, soul-sampled vocal chops, and cinematic strings",
        energy_focus: "heavy groove, head-nodding bounce"
      },
      'edm': {
        style: "high-energy pulsing electronic dance music",
        drums: "heavy four-on-the-floor kick, bright snare, and side-chained pads",
        texture: "acid synth leads, rhythmic arpeggios, and build-up swells",
        energy_focus: "maximum drive, stadium energy"
      },
      'lo-fi': {
        style: "chill lo-fi beats",
        drums: "lazy dusty drum breaks, muffled kicks, and shakers",
        texture: "vinyl crackle, warm rhodes piano, and detuned jazz guitar",
        energy_focus: "relaxed atmosphere, focus-oriented"
      },
      'pop': {
        style: "bright chart-topping pop instrumental",
        drums: "clean punchy electronic drums, layered handclaps",
        texture: "shimmering synth plucks, funky bass guitar, and catchy melodic hooks",
        energy_focus: "upbeat, melodic, and polished"
      }
    };

    const profile = genreProfiles[config.genre.toLowerCase()] || genreProfiles['hip-hop'];
    const instruments = config.instruments.join(', ');

    return `Generate a ${profile.style} instrumental track at ${Math.round(targetBPM)} BPM. ` +
      `Drums: ${profile.drums}. Texture: ${profile.texture}. ` +
      `Mood: ${config.mood}, energy level ${config.energy} out of 10, ${profile.energy_focus}. ` +
      `Feature these instruments: ${instruments}. ` +
      `Keep strict rhythmic consistency with clear transient attacks. Make it loopable.`;
  }

  async generateTrack(bpm, config) {
    const prompt = this.buildLyriaPrompt(config, bpm);
    console.info(`[Lyria] Starting generation for ${config.genre} @ ${bpm} BPM...`);
    
    if (!this.apiKey) {
       throw new Error("No API key provided. Cannot generate Lyria audio.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout
    
    try {
      const requestBody = {
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"]
        }
      };

      console.info("[Lyria] Dispatching POST request to Generative Language API...");
      const response = await fetch(this.lyriaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Lyria] API Error ${response.status}:`, errText);
        throw new Error(`Lyria API rejected the request (${response.status}): ${errText}`);
      }

      console.info("[Lyria] Response received. Parsing JSON payload...");
      const data = await response.json();
      
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));
      
      if (!audioPart) {
          console.warn("[Lyria] No audio binary found in response parts.", parts);
          throw new Error("Lyria returned a successful response, but it contained no Audio binary. Check prompt/safety filters.");
      }

      console.info(`[Lyria] Successfully extracted ${audioPart.inlineData.mimeType} binary data.`);
      return this._createBlobUrlFromBase64(audioPart.inlineData.data, audioPart.inlineData.mimeType);
      
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        console.error("[Lyria] Request timed out after 50 seconds.");
        throw new Error("Lyria API timed out. The server might be overloaded. Try again in a moment.");
      }
      console.error("[Lyria] Generation failed entirely:", e);
      throw e;
    }
  }

  _createBlobUrlFromBase64(base64, mimeType) {
    if (!base64 || base64.length < 100) {
      throw new Error("Invalid audio data: Base64 string too short or missing.");
    }
    
    try {
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("[TrackGenerator] Failed to create Blob from Base64:", e);
      throw new Error("Failed to process Lyria audio data. The response may be corrupted.");
    }
  }

  async generateSoundEffect(type) {
    // Skipping custom Lyria SFX for time, maintaining tone.js SFX synth we just built natively
    return null;
  }
}
