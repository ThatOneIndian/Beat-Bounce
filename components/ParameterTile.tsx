'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import styles from './ParameterTile.module.css';

interface ParameterTileProps {
  id: string;
  title: string;
  value?: string | null;
  icon: LucideIcon;
  isActive: boolean; // Is Gemini currently asking about this?
}

export function ParameterTile({ id, title, value, icon: Icon, isActive }: ParameterTileProps) {
  const isFilled = value !== undefined && value !== null && value.trim() !== '';

  return (
    <motion.div
      className={`${styles.tile} ${isActive ? styles.active : ''} ${isFilled ? styles.filled : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.header}>
        <Icon className={styles.icon} size={24} />
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.content}>
        {isFilled ? (
          <p className="glow-text">{value}</p>
        ) : (
          <p className={styles.empty}>Awaiting input...</p>
        )}
      </div>
      {isActive && (
        <motion.div
          className={styles.pulseRing}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}
    </motion.div>
  );
}
