import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import type { Aircraft } from '../types/aircraft';
import { callsignOf, formatAltitude, metersFromFeet } from '../types/aircraft';
import { formatAircraftDetails, formatRoute } from '../services/adsbdbService';
import { useApp } from '../state/AppContext';
import LedMatrixDisplay from '../components/LedMatrixDisplay';
import './RetroPage.css';

/** Kategorien wie in fetch_aircraft_data.py auf dem Pi */
const PI_CATEGORIES = new Set([
  'A0', 'A4', 'A5', 'A6', 'A7',
  'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
]);

/** Anzeigedauer pro Flug, wie die 6 s im Pi-Script */
const CYCLE_MS = 6000;

/**
 * Anflug-Filter des Pi-Scripts: Callsign vorhanden, passende Kategorie,
 * sinkend (geom_rate < -0.1) und unter 15 000 ft.
 */
function matchesPiFilter(ac: Aircraft): boolean {
  if (!ac.flight?.trim()) return false;
  if (!ac.category || !PI_CATEGORIES.has(ac.category)) return false;
  const geomRate = ac.geom_rate ?? 0;
  const altitudeFt = ac.alt_geom ?? 30000;
  return geomRate < -0.1 && altitudeFt < 15000;
}

const RetroPage: React.FC = () => {
  const { aircraft, enrichments, error } = useApp();
  const [piFilter, setPiFilter] = useState(true);
  const [cycle, setCycle] = useState(0);
  const [active, setActive] = useState(false);

  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [active]);

  const matches = piFilter
    ? aircraft.filter(matchesPiFilter)
    : aircraft.filter((ac) => ac.flight?.trim());
  const current = matches.length > 0 ? matches[cycle % matches.length] : null;
  const enrichment = current ? enrichments[current.hex] : undefined;

  // Die drei Textzeilen wie im Pi-Script zusammensetzen
  let top = 'SkyPi';
  let center = piFilter ? 'Kein Anflug' : 'Keine Flugzeuge';
  let bottom = 'Retro Display';
  if (current) {
    const details = enrichment?.details;
    if (details && (details.manufacturer || details.type || details.registered_owner)) {
      top = [details.manufacturer, details.type, details.registered_owner]
        .filter(Boolean)
        .join(' ');
    } else {
      top = `Unknown aircraft ${current.hex.toUpperCase()}`;
    }

    const origin = enrichment?.route?.origin;
    center = origin
      ? [origin.iata_code, origin.name].filter(Boolean).join(' ') || callsignOf(current)
      : callsignOf(current);

    const altitudeFt =
      current.alt_geom ?? (typeof current.alt_baro === 'number' ? current.alt_baro : null);
    bottom =
      altitudeFt != null
        ? Array(5).fill(`${metersFromFeet(altitudeFt)}m`).join(' ')
        : callsignOf(current);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Retro-Anzeige</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="grouped-content">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Retro-Anzeige</IonTitle>
          </IonToolbar>
        </IonHeader>

        {error && (
          <IonItem color="danger" lines="none">
            <IonLabel>Keine Verbindung zum Aircraft Service: {error}</IonLabel>
          </IonItem>
        )}

        <LedMatrixDisplay top={top} center={center} bottom={bottom} active={active} />

        <div className="retro-status ion-text-center">
          <IonNote>
            {piFilter
              ? matches.length > 0
                ? `${matches.length === 1 ? '1 Anflug' : `${matches.length} Anflüge`} im Filter – Anzeige wechselt alle 6 s`
                : 'Kein Flugzeug erfüllt den Anflug-Filter (sinkend, unter 4 572 m)'
              : `${matches.length} Flugzeuge mit Callsign – Anzeige wechselt alle 6 s`}
          </IonNote>
        </div>

        <IonList inset>
          <IonItem>
            <IonToggle
              checked={piFilter}
              onIonChange={(e) => setPiFilter(e.detail.checked)}
            >
              <IonLabel>
                Anflug-Filter wie auf dem Pi
                <p>Nur sinkende Flugzeuge unter 15 000 ft anzeigen</p>
              </IonLabel>
            </IonToggle>
          </IonItem>
          {current && (
            <IonItem lines="none">
              <IonLabel>
                <h2>{callsignOf(current)}</h2>
                {formatAircraftDetails(enrichment?.details) && (
                  <p>{formatAircraftDetails(enrichment?.details)}</p>
                )}
                {formatRoute(enrichment?.route) && (
                  <p className="route-info">{formatRoute(enrichment?.route)}</p>
                )}
                <p>{formatAltitude(current.alt_baro)}</p>
              </IonLabel>
            </IonItem>
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default RetroPage;
