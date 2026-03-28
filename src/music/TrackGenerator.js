export class TrackGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // Hitting the newly announced Lyria preview model
    this.lyriaEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent?key=${apiKey}`;
  }

  buildLyriaPrompt(config, targetBPM) {
    const parts = [];
    parts.push('Generate original ambient audio');
    parts.push('soft warm pad textures and gentle environmental sounds');
    parts.push('no melody, no drums, no vocals, no rhythm');
    parts.push('smooth background atmosphere');
    parts.push(`${config.mood} feeling`);
    parts.push(`slow evolving texture around ${Math.round(targetBPM)} BPM`);
    parts.push('original composition, unique sound design');
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
