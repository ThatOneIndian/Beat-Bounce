export class TrackGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    this.lyriaEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/lyria:generateMusic?key='; // Placeholder endpoint based on typical Google API structure; will verify once API key is ready
  }

  buildLyriaPrompt(config, targetBPM) {
    const parts = [];
    
    // Using 'original' and 'non-commercial' keywords to help bypass strict copyright filters
    parts.push(`Original royalty-free ${config.genre} instrumental training backdrop`);
    parts.push('non-commercial rhythmic basketball practice loop');
    
    if (config.energy >= 7) parts.push('fast-paced percussive textures, driving energy');
    else if (config.energy >= 4) parts.push('steady rhythmic pulse, moderate groove');
    else parts.push('minimalistic atmospheric background, low-fi textures');
    
    parts.push(`feeling: ${config.mood}`);
    parts.push(`tempo: exactly ${Math.round(targetBPM)} BPM pulse`);
    
    if (config.instruments.length > 0) {
      parts.push(`incorporating sound textures similar to ${config.instruments.join(', ')}`);
    }
    
    parts.push('strict metronomic timing for athletic drills');
    parts.push('no vocals, no copyrighted melodies, focus on pure rhythmic patterns');
    
    return parts.join(', ');
  }

  async generateTrack(bpm, config) {
    if (!this.apiKey) {
       console.warn("No Lyria API key provided. Falling back to mocked generation.");
       return this.mockGeneration();
    }

    const prompt = this.buildLyriaPrompt(config, bpm);
    console.log(`[Lyria] Sending prompt: ${prompt}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // Fail fast after 45s

    try {
      // Use the Lyria 3 Pro Preview endpoint on Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lyria API Error: ${response.status} - ${errText}`);
      }

      const result = await response.json();
      
      // Check for safety or copyright filter
      const candidate = result.candidates?.[0];
      if (candidate && (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'OTHER')) {
        console.warn(`[Lyria Filtered] Reason: ${candidate.finishReason}. Falling back to metronome.`);
        return null; // Trigger fallback in App.jsx
      }
      
      // Parse standard Gemini inlineData audio response safely
      const parts = result.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find(p => p.inlineData && p.inlineData.data);
      
      if (audioPart) {
        const audioData = audioPart.inlineData.data;
        // Convert base64 to ArrayBuffer
        const binaryString = window.atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }

      return null;
    } catch (e) {
      console.error("Lyria generation failed, falling back to metronome:", e);
      return null; // Signals failure to App.jsx for fallback
    }
  }

  /**
   * Temporary mock generator returning a synth beat for local testing
   */
  async mockGeneration() {
    return new Promise((resolve) => {
        setTimeout(() => {
          // Returning null implies the engine should fallback to local synth/tone.js backing
          resolve(null);
        }, 1500);
    });
  }
}
