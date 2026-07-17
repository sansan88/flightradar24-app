import React, { useEffect, useRef, useState } from 'react';
import { IonToast } from '@ionic/react';
import { warningOutline } from 'ionicons/icons';
import { useApp } from '../state/AppContext';

/**
 * Globaler Verbindungs-Hinweis: erscheint einmalig als Toast oben, wenn der
 * Aircraft Service nicht erreichbar ist (statt Banner auf jeder Seite), und
 * verschwindet automatisch, sobald die Verbindung wieder steht. Der Chip auf
 * der Karte bleibt als dauerhafter Indikator.
 */
const ConnectionToast: React.FC = () => {
  const { error } = useApp();
  const [open, setOpen] = useState(false);
  const hadError = useRef(false);

  useEffect(() => {
    // Nur beim Übergang ok → Fehler anzeigen, nicht bei jedem Poll erneut
    if (error && !hadError.current) setOpen(true);
    if (!error) setOpen(false);
    hadError.current = !!error;
  }, [error]);

  return (
    <IonToast
      isOpen={open}
      onDidDismiss={() => setOpen(false)}
      message={error ? `Keine Verbindung zum Aircraft Service: ${error}` : ''}
      position="top"
      color="danger"
      duration={1500}
      icon={warningOutline}
    />
  );
};

export default ConnectionToast;
