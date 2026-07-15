import React from 'react';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  airplaneOutline,
  cloudOutline,
  hardwareChipOutline,
  lockClosedOutline,
  logoGithub,
  mapOutline,
} from 'ionicons/icons';
import { version } from '../../package.json';
import './InfoPage.css';

const InfoPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Info</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="grouped-content">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">Info</IonTitle>
        </IonToolbar>
      </IonHeader>

      <div className="info-hero">
        <IonIcon icon={airplaneOutline} className="info-hero-icon" />
        <h1>SkyPi</h1>
        <p>Live-Flugradar im Heimnetz</p>
        <IonNote>Version {version}</IonNote>
      </div>

      <IonList inset>
        <IonListHeader>
          <IonLabel>So funktioniert's</IonLabel>
        </IonListHeader>
        <IonItem lines="none">
          <IonIcon icon={hardwareChipOutline} slot="start" color="primary" />
          <IonLabel className="ion-text-wrap">
            SkyPi verbindet sich mit einem Raspberry Pi in deinem Heimnetz, der
            mit einem ADS-B-Empfänger (dump1090/readsb) die Signale der
            Flugzeuge in Reichweite empfängt — und zeigt sie live auf der Karte
            und in der Liste an.
          </IonLabel>
        </IonItem>
        <IonItem lines="none">
          <IonIcon icon={mapOutline} slot="start" color="primary" />
          <IonLabel className="ion-text-wrap">
            Flugzeuge ohne Positionsangabe erscheinen nur in der Liste.
            Höhenangaben werden in Metern angezeigt. IP-Adresse des Pi,
            Aktualisierungsintervall, Kartenhintergrund und Beschriftung lassen
            sich unter «Einstellungen» anpassen.
          </IonLabel>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Datenquellen</IonLabel>
        </IonListHeader>
        <IonItem lines="none">
          <IonIcon icon={cloudOutline} slot="start" color="primary" />
          <IonLabel className="ion-text-wrap">
            Flugdaten kommen direkt von deinem Raspberry Pi. Flugzeug- und
            Routeninfos liefert adsbdb.com, die Kartenkacheln stammen von
            Swisstopo bzw. OpenStreetMap/Carto, das Niederschlagsradar von
            MeteoSchweiz.
          </IonLabel>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Privatsphäre</IonLabel>
        </IonListHeader>
        <IonItem lines="none">
          <IonIcon icon={lockClosedOutline} slot="start" color="primary" />
          <IonLabel className="ion-text-wrap">
            Alles bleibt lokal und privat: keine Cloud, kein Konto, keine
            Analytics. Die Einstellungen werden nur auf deinem Gerät
            gespeichert.
          </IonLabel>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Projekt</IonLabel>
        </IonListHeader>
        <IonItem
          href="https://github.com/sansan88/flightradar24-app"
          target="_blank"
          rel="noopener"
          detail
        >
          <IonIcon icon={logoGithub} slot="start" color="primary" />
          <IonLabel>App auf GitHub</IonLabel>
        </IonItem>
        <IonItem
          href="https://github.com/sansan88/flightradar24"
          target="_blank"
          rel="noopener"
          detail
        >
          <IonIcon icon={logoGithub} slot="start" color="primary" />
          <IonLabel>Pi-Setup (ADS-B-Empfänger)</IonLabel>
        </IonItem>
      </IonList>
    </IonContent>
  </IonPage>
);

export default InfoPage;
