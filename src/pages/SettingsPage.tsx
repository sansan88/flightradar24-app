import React from 'react';
import {
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonItemDivider,
  IonItemGroup,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRange,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { AIRCRAFT_CATEGORIES } from '../types/aircraft';
import { aircraftUrl } from '../services/settings';
import { useApp } from '../state/AppContext';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings, error, lastUpdate } = useApp();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Einstellungen</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Einstellungen</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList inset>
          <IonItemGroup>
            <IonItemDivider>
              <IonLabel>Aircraft Service (Raspberry Pi)</IonLabel>
            </IonItemDivider>
            <IonItem>
              <IonInput
                label="IP-Adresse"
                labelPlacement="fixed"
                inputmode="decimal"
                placeholder="192.168.1.174"
                value={settings.ip}
                onIonChange={(e) => updateSettings({ ip: (e.detail.value ?? '').trim() })}
              />
            </IonItem>
            <IonItem>
              <IonInput
                label="Port"
                labelPlacement="fixed"
                type="number"
                placeholder="8080"
                value={settings.port}
                onIonChange={(e) => {
                  const port = parseInt(e.detail.value ?? '', 10);
                  if (!Number.isNaN(port) && port > 0 && port <= 65535) {
                    updateSettings({ port });
                  }
                }}
              />
            </IonItem>
            <IonItem lines="none">
              <IonNote>
                Quelle: {aircraftUrl(settings)}
                <br />
                Status:{' '}
                {error
                  ? `Fehler – ${error}`
                  : lastUpdate
                    ? `Verbunden (${new Date(lastUpdate).toLocaleTimeString('de-CH')})`
                    : 'Verbinde…'}
              </IonNote>
            </IonItem>
          </IonItemGroup>
        </IonList>

        <IonList inset>
          <IonItemGroup>
            <IonItemDivider>
              <IonLabel>Aktualisierung</IonLabel>
            </IonItemDivider>
            <IonItem>
              <IonRange
                label={`Intervall: ${settings.refreshInterval} s`}
                labelPlacement="stacked"
                min={1}
                max={30}
                step={1}
                snaps
                pin
                value={settings.refreshInterval}
                onIonChange={(e) =>
                  updateSettings({ refreshInterval: e.detail.value as number })
                }
              />
            </IonItem>
          </IonItemGroup>
        </IonList>

        <IonList inset>
          <IonItemGroup>
            <IonItemDivider>
              <IonLabel>Filter</IonLabel>
            </IonItemDivider>
            <IonItem>
              <IonSelect
                label="Flugzeug-Kategorien"
                labelPlacement="stacked"
                multiple
                placeholder="Alle Kategorien"
                value={settings.categories}
                onIonChange={(e) =>
                  updateSettings({ categories: (e.detail.value as string[]) ?? [] })
                }
              >
                {Object.entries(AIRCRAFT_CATEGORIES).map(([key, label]) => (
                  <IonSelectOption key={key} value={key}>
                    {label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonNote>
                Keine Auswahl = alle Flugzeuge anzeigen. «Ohne Kategorie» zeigt Flugzeuge,
                die keine ADS-B Kategorie senden.
              </IonNote>
            </IonItem>
          </IonItemGroup>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
