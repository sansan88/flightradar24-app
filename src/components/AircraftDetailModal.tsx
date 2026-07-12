import React from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { Aircraft } from '../types/aircraft';
import { callsignOf, formatAltitude, metersFromFeet } from '../types/aircraft';
import { AIRCRAFT_CATEGORIES } from '../types/aircraft';
import type { Enrichment, RouteAirport } from '../services/adsbdbService';
import './AircraftDetailModal.css';

interface Props {
  aircraft: Aircraft | null;
  enrichment?: Enrichment;
  presentingElement: HTMLElement | null;
  onDismiss: () => void;
}

function formatAirport(airport?: RouteAirport): string | null {
  if (!airport) return null;
  const code = [airport.iata_code, airport.icao_code].filter(Boolean).join(' / ');
  const place = [airport.name, airport.municipality, airport.country_name]
    .filter(Boolean)
    .join(', ');
  return [code, place].filter(Boolean).join(' — ') || null;
}

const Row: React.FC<{ label: string; value?: string | null }> = ({ label, value }) =>
  value ? (
    <IonItem>
      <IonLabel color="medium">{label}</IonLabel>
      <IonNote slot="end" className="detail-value">
        {value}
      </IonNote>
    </IonItem>
  ) : null;

const AircraftDetailModal: React.FC<Props> = ({
  aircraft,
  enrichment,
  presentingElement,
  onDismiss,
}) => {
  const route = enrichment?.route;
  const details = enrichment?.details;
  const ac = aircraft;

  return (
    <IonModal
      isOpen={ac !== null}
      presentingElement={presentingElement ?? undefined}
      onDidDismiss={onDismiss}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{ac ? callsignOf(ac) : ''}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>Schliessen</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {ac && (
          <>
            <IonList inset>
              <IonListHeader>
                <IonLabel>Route</IonLabel>
              </IonListHeader>
              <Row label="Airline" value={route?.airline?.name} />
              <Row label="Abflughafen" value={formatAirport(route?.origin)} />
              <Row label="Zielflughafen" value={formatAirport(route?.destination)} />
              {!route?.origin && !route?.destination && (
                <IonItem lines="none">
                  <IonNote>
                    Keine Routendaten verfügbar (z.&nbsp;B. Militär-, Regierungs- oder
                    Privatflug).
                  </IonNote>
                </IonItem>
              )}
            </IonList>

            <IonList inset>
              <IonListHeader>
                <IonLabel>Flugzeug</IonLabel>
              </IonListHeader>
              <Row label="Hersteller" value={details?.manufacturer} />
              <Row label="Typ" value={details?.type} />
              <Row label="ICAO-Typ" value={details?.icao_type} />
              <Row label="Registration" value={details?.registration} />
              <Row label="Betreiber" value={details?.registered_owner} />
              <Row label="Land" value={details?.registered_owner_country_name} />
              <Row
                label="Kategorie"
                value={ac.category ? AIRCRAFT_CATEGORIES[ac.category] ?? ac.category : null}
              />
              {!details?.type && !details?.registration && (
                <IonItem lines="none">
                  <IonNote>Keine Flugzeugdaten in adsbdb.com gefunden.</IonNote>
                </IonItem>
              )}
            </IonList>

            <IonList inset>
              <IonListHeader>
                <IonLabel>Live-Daten</IonLabel>
              </IonListHeader>
              <Row label="ICAO Hex" value={ac.hex.toUpperCase()} />
              <Row label="Höhe (barometrisch)" value={formatAltitude(ac.alt_baro)} />
              <Row
                label="Höhe (GPS)"
                value={ac.alt_geom != null ? formatAltitude(ac.alt_geom) : null}
              />
              <Row
                label="Geschwindigkeit"
                value={
                  ac.gs != null
                    ? `${Math.round(ac.gs * 1.852)} km/h (${Math.round(ac.gs)} kt)`
                    : null
                }
              />
              <Row label="Kurs" value={ac.track != null ? `${Math.round(ac.track)}°` : null} />
              <Row
                label="Steig-/Sinkrate"
                value={
                  ac.baro_rate != null
                    ? `${metersFromFeet(ac.baro_rate)} m/min (${ac.baro_rate} ft/min)`
                    : null
                }
              />
              <Row label="Squawk" value={ac.squawk} />
              <Row
                label="Notfall"
                value={ac.emergency && ac.emergency !== 'none' ? ac.emergency : null}
              />
              <Row label="Signal" value={ac.rssi != null ? `${ac.rssi} dBFS` : null} />
              <Row
                label="Messages"
                value={ac.messages != null ? ac.messages.toLocaleString('de-CH') : null}
              />
              <Row
                label="Zuletzt empfangen"
                value={ac.seen != null ? `vor ${Math.round(ac.seen)} s` : null}
              />
            </IonList>
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default AircraftDetailModal;
