import React, { useState } from 'react';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { airplane, openOutline, playCircleOutline, warningOutline } from 'ionicons/icons';
import { fetchAircraft } from '../services/aircraftService';
import { DEFAULT_SETTINGS } from '../services/settings';
import { useApp } from '../state/AppContext';
import './WelcomeScreen.css';

/** Anleitung zum Einrichten des ADS-B-Empfängers auf dem Raspberry Pi */
const PI_SETUP_URL = 'https://github.com/sansan88/flightradar24';

/**
 * Vollbild-Overlay bei der Ersteinrichtung: Raspberry Pi verbinden oder
 * die App mit Demodaten ausprobieren. Verschwindet, sobald eine der beiden
 * Optionen gewählt wurde (setupCompleted).
 */
const WelcomeScreen: React.FC = () => {
  const { settings, settingsReady, updateSettings } = useApp();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(String(DEFAULT_SETTINGS.port));
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  if (!settingsReady || settings.setupCompleted) return null;

  const parsedPort = parseInt(port, 10);
  const inputValid =
    ip.trim().length > 0 &&
    !Number.isNaN(parsedPort) &&
    parsedPort > 0 &&
    parsedPort <= 65535;

  const connect = async () => {
    if (!inputValid || testing) return;
    setTesting(true);
    setError(null);
    try {
      await fetchAircraft({ ...settings, ip: ip.trim(), port: parsedPort });
      updateSettings({
        ip: ip.trim(),
        port: parsedPort,
        demoMode: false,
        setupCompleted: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setToastOpen(true);
    } finally {
      setTesting(false);
    }
  };

  /** Adresse trotz fehlgeschlagenem Verbindungstest übernehmen */
  const saveAnyway = () => {
    updateSettings({
      ip: ip.trim(),
      port: parsedPort,
      demoMode: false,
      setupCompleted: true,
    });
  };

  const startDemo = () => {
    updateSettings({ demoMode: true, setupCompleted: true });
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo" aria-hidden="true">
          <IonIcon icon={airplane} />
        </div>
        <h1>Willkommen bei SkyPi</h1>
        <p className="welcome-tagline">Live-Flugradar im Heimnetz</p>
        <p className="welcome-intro">
          SkyPi zeigt alle Flugzeuge live auf der Karte, die dein Raspberry Pi
          mit ADS-B-Empfänger (dump1090/readsb) im Heimnetz empfängt.
        </p>

        <div className="welcome-section">
          <div className="welcome-section-header">Raspberry Pi verbinden</div>
          <IonList inset className="welcome-form">
            <IonItem>
              <IonInput
                label="IP-Adresse"
                labelPlacement="fixed"
                inputmode="decimal"
                placeholder="192.168.1.100"
                value={ip}
                disabled={testing}
                onIonInput={(e) => {
                  setIp(e.detail.value ?? '');
                  setError(null);
                }}
              />
            </IonItem>
            <IonItem>
              <IonInput
                label="Port"
                labelPlacement="fixed"
                type="number"
                placeholder="8080"
                value={port}
                disabled={testing}
                onIonInput={(e) => {
                  setPort(e.detail.value ?? '');
                  setError(null);
                }}
              />
            </IonItem>
          </IonList>
          <IonButton
            expand="block"
            className="welcome-button"
            disabled={!inputValid || testing}
            onClick={() => void connect()}
          >
            {testing ? <IonSpinner name="crescent" /> : 'Verbinden'}
          </IonButton>
          {error && (
            <IonButton
              expand="block"
              fill="outline"
              className="welcome-button"
              onClick={saveAnyway}
            >
              Adresse trotzdem übernehmen
            </IonButton>
          )}
          <IonNote className="welcome-hint">
            Noch keinen Empfänger? Anleitung zum Pi-Setup:{' '}
            <a href={PI_SETUP_URL} target="_blank" rel="noreferrer">
              github.com/sansan88/flightradar24
              <IonIcon icon={openOutline} aria-hidden="true" />
            </a>
          </IonNote>
        </div>

        <div className="welcome-divider" role="separator">
          oder
        </div>

        <IonButton
          expand="block"
          fill="outline"
          className="welcome-button welcome-demo-button"
          onClick={startDemo}
        >
          <IonIcon slot="start" icon={playCircleOutline} />
          Mit Demodaten ausprobieren
        </IonButton>
        <IonNote className="welcome-hint welcome-hint--center">
          Die Demodaten werden entfernt, sobald du in den Einstellungen einen
          Service verbindest.
        </IonNote>
      </div>
      <IonToast
        isOpen={toastOpen}
        onDidDismiss={() => setToastOpen(false)}
        message={
          error
            ? `Verbindung fehlgeschlagen (${error}). Prüfe, ob der Pi im selben Netzwerk erreichbar ist.`
            : ''
        }
        position="top"
        color="danger"
        duration={1500}
        icon={warningOutline}
      />
    </div>
  );
};

export default WelcomeScreen;
