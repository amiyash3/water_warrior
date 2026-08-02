import { useMemo } from 'react';
import { getRandomFact } from '../data/waterFacts';
import './LoadingScreen.css';

export default function LoadingScreen() {
  const fact = useMemo(() => getRandomFact(), []);

  return (
    <div className="loading-screen">
      <div className="loading-drop">
        <svg viewBox="0 0 64 64">
          <path
            className="fill"
            d="M32 4C32 4 12 30 12 44a20 20 0 0 0 40 0C52 30 32 4 32 4Z"
          />
        </svg>
      </div>
      <p className="loading-fact">{fact}</p>
    </div>
  );
}
