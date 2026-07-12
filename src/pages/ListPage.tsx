import React from 'react';
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
import { callsignOf } from '../types/aircraft';
import { useApp } from '../state/AppContext';

function formatAlt(ac: Aircraft): string {
  if (ac.alt_baro === 'ground') return 'Am Boden';
  if (ac.alt_baro != null) return `${ac.alt_baro.toLocaleString('de-CH')} ft`;
  return 'Höhe unbekannt';
}

const ListPage: React.FC = () => {
  const { filteredAircraft, messages, error } = useApp();

  const sorted = [...filteredAircraft].sort((a, b) =>
    callsignOf(a).localeCompare(callsignOf(b))
  );

  const handleRefresh = (event: CustomEvent<RefresherEventDetail>) => {
    // Der Provider pollt bereits – kurz warten, damit der Spinner sichtbar ist
    window.setTimeout(() => event.detail.complete(), 500);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Flugzeuge ({filteredAircraft.length})</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {error && (
          <IonItem color="danger" lines="none">
            <IonLabel>Keine Verbindung zum Aircraft Service: {error}</IonLabel>
          </IonItem>
        )}

        <IonList>
          {sorted.map((ac) => (
            <IonItem key={ac.hex}>
              <IonLabel>
                <h2>
                  {callsignOf(ac)}{' '}
                  {ac.category && <IonBadge color="medium">{ac.category}</IonBadge>}
                  {ac.lat == null && <IonBadge color="warning">Keine Position</IonBadge>}
                </h2>
                <p>
                  {formatAlt(ac)}
                  {ac.gs != null && ` · ${Math.round(ac.gs)} kt`}
                  {ac.track != null && ` · ${Math.round(ac.track)}°`}
                  {ac.squawk && ` · Squawk ${ac.squawk}`}
                </p>
              </IonLabel>
              <IonNote slot="end">{ac.hex.toUpperCase()}</IonNote>
            </IonItem>
          ))}
        </IonList>

        {sorted.length === 0 && !error && (
          <div className="ion-text-center ion-padding">
            <IonNote>Keine Flugzeuge empfangen</IonNote>
          </div>
        )}

        <div className="ion-text-center ion-padding">
          <IonNote>{messages.toLocaleString('de-CH')} Mode-S Messages empfangen</IonNote>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ListPage;
