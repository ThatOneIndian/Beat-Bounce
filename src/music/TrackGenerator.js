export class TrackGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // Hitting the newly announced Lyria preview model
    this.lyriaEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent?key=${apiKey}`;
  }

  buildLyriaPrompt(config, targetBPM) {
    const parts = [];
    parts.push(`Generate audio: ${config.genre} instrumental track`);
    if (config.energy >= 7) parts.push('high energy, driving rhythm');
    else if (config.energy >= 4) parts.push('moderate energy, steady groove');
    else parts.push('low energy, ambient, atmospheric');
    
    parts.push(`${config.mood} mood`);
    parts.push(`strict tempo exactly at ${Math.round(targetBPM)} BPM`);
    
    if (config.instruments.length > 0) {
      parts.push(`featuring ${config.instruments.join(', ')}`);
    }
    
    parts.push('suitable for rhythmic physical activity');
    parts.push('strong clear loopable beat');
    parts.push('highly melodic with complex instrumental layers, distinct piano and synth leads');
    return parts.join(', ');
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
          contents: [{ parts: [{ text: prompt }] }],
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
