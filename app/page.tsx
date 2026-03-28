'use client';

import { useMuseSession } from '../hooks/useMuseSession';
import { ParameterTile } from '../components/ParameterTile';
import { Music, Activity, Disc, Zap, Headphones, Mic } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const { parameters, isLoaded } = useMuseSession();

  if (!isLoaded) return null; // Wait for Mount

  // This active query will later be managed by Gemini's state context
  const activeParameter: string = 'mood';

  return (
    <main className={styles.main}>
      <div className={styles.layout}>
        {/* Sidebar: AI Producer Chat */}
        <section className={`${styles.chatSidebar} glass`}>
          <div className={styles.chatHeader}>
            <h1 className="gradient-text">The Producer</h1>
            <p>Muse-Tiles Session</p>
          </div>
          
          <div className={styles.chatLog}>
            {/* Developer B & A: Implement chat history here */}
            <div className={styles.aiMessage}>
              <Music className="text-neon-blue" size={20} />
              <p>Hey there! Let's get started. What kind of vibe are you aiming for today?</p>
            </div>
          </div>

          <div className={styles.chatInput}>
            {/* Developer B & A: Implement Chat Input Here */}
            <input type="text" placeholder="e.g. A chill, atmospheric Lo-fi vibe..." disabled />
            <button className={styles.sendBtn} disabled>&rarr;</button>
          </div>
        </section>

        {/* Main Stage: Dynamic Tile Grid */}
        <section className={styles.stage}>
          <header className={styles.stageHeader}>
            <h2>Current Project</h2>
            <button className={styles.exportBtn}>Export JSON</button>
          </header>

          <div className={styles.grid}>
            <ParameterTile 
              id="mood" 
              title="Mood" 
              value={parameters.mood} 
              icon={Activity} 
              isActive={activeParameter === 'mood'} 
            />
            <ParameterTile 
              id="genre" 
              title="Genre" 
              value={parameters.genre} 
              icon={Disc} 
              isActive={activeParameter === 'genre'} 
            />
            <ParameterTile 
              id="tempo" 
              title="Tempo" 
              value={parameters.tempo} 
              icon={Zap} 
              isActive={activeParameter === 'tempo'} 
            />
            <ParameterTile 
              id="primary_instrumentation" 
              title="Instruments" 
              value={parameters.primary_instrumentation} 
              icon={Headphones} 
              isActive={activeParameter === 'primary_instrumentation'} 
            />
            <ParameterTile 
              id="vocal_element" 
              title="Vocals" 
              value={parameters.vocal_element?.style} 
              icon={Mic} 
              isActive={activeParameter === 'vocal_element'} 
            />
          </div>
        </section>
      </div>
    </main>
  );
}
