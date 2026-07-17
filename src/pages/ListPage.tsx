import React, { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  type RefresherEventDetail,
} from '@ionic/react';
import type { Aircraft } from '../types/aircraft';
import { callsignOf, formatAltitude, formatSpeed } from '../types/aircraft';
import { flagEmoji, formatAircraftDetails, formatRoute } from '../services/adsbdbService';
import { useApp } from '../state/AppContext';
import AircraftDetailModal from '../components/AircraftDetailModal';
import './ListPage.css';

/** Aktiv = aktuelle Position vorhanden und kürzlich empfangen */
function isActive(ac: Aircraft): boolean {
  return ac.lat != null && ac.lon != null && (ac.seen ?? 0) < 60;
}

const ListPage: React.FC = () => {
  const { filteredAircraft, enrichments, messages, showOnMap } = useApp();
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const history = useHistory();

  // presentingElement für das iOS Card-Modal (Seite rückt in den Hintergrund)
  const page = useRef<HTMLElement | null>(null);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPresentingElement(page.current);
  }, []);

  // Das ausgewählte Flugzeug live aus dem aktuellen Poll nachführen;
  // verschwindet es aus dem Feed, bleibt der letzte Stand sichtbar
  const lastSelected = useRef<Aircraft | null>(null);
  const selected = selectedHex
    ? (filteredAircraft.find((ac) => ac.hex === selectedHex) ?? lastSelected.current)
    : null;
  if (selected) lastSelected.current = selected;

  // Aktive Flieger zuoberst, innerhalb der Gruppen nach Callsign sortiert
  const sorted = [...filteredAircraft].sort((a, b) => {
    const activeDiff = Number(isActive(b)) - Number(isActive(a));
    if (activeDiff !== 0) return activeDiff;
    return callsignOf(a).localeCompare(callsignOf(b));
  });

  const handleRefresh = (event: CustomEvent<RefresherEventDetail>) => {
    // Der Provider pollt bereits – kurz warten, damit der Spinner sichtbar ist
    window.setTimeout(() => event.detail.complete(), 500);
  };

  return (
    <IonPage ref={page}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Flugzeuge ({filteredAircraft.length})</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="grouped-content">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Flugzeuge</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonList inset>
          {sorted.map((ac) => {
            const enrichment = enrichments[ac.hex];
            const route = formatRoute(enrichment?.route);
            const aircraftInfo = formatAircraftDetails(enrichment?.details);
            const flag = flagEmoji(enrichment?.details?.registered_owner_country_iso_name);
            return (
              <IonItem
                key={ac.hex}
                button
                detail
                onClick={() => setSelectedHex(ac.hex)}
              >
                <IonLabel>
                  <h2>
                    {flag && <span className="country-flag">{flag}</span>}
                    {callsignOf(ac)}{' '}
                    {enrichment?.details?.registration && (
                      <IonBadge color="light">{enrichment.details.registration}</IonBadge>
                    )}{' '}
                    {ac.category && <IonBadge color="medium">{ac.category}</IonBadge>}{' '}
                    {!isActive(ac) && <IonBadge color="warning">Inaktiv</IonBadge>}
                  </h2>
                  {aircraftInfo && <p>{aircraftInfo}</p>}
                  {route && <p className="route-info">{route}</p>}
                  <p>
                    {formatAltitude(ac.alt_baro)}
                    {ac.gs != null && ` · ${formatSpeed(ac.gs)}`}
                    {ac.track != null && ` · ${Math.round(ac.track)}°`}
                    {ac.squawk && ` · Squawk ${ac.squawk}`}
                  </p>
                </IonLabel>
              </IonItem>
            );
          })}
        </IonList>

        {sorted.length === 0 && (
          <div className="ion-text-center ion-padding">
            <IonNote>Keine Flugzeuge empfangen</IonNote>
          </div>
        )}

        <div className="ion-text-center ion-padding">
          <IonNote>{messages.toLocaleString('de-CH')} Mode-S Messages empfangen</IonNote>
        </div>

        <AircraftDetailModal
          aircraft={selected}
          enrichment={selected ? enrichments[selected.hex] : undefined}
          presentingElement={presentingElement}
          onShowOnMap={
            selected
              ? () => {
                  showOnMap(selected.hex);
                  setSelectedHex(null);
                  history.push('/map');
                }
              : undefined
          }
          onDismiss={() => setSelectedHex(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default ListPage;
