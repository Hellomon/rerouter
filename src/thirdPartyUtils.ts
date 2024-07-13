import { CounterConfig, DefaultCounterConfig } from './struct';
import { Utils } from './utils';

export class ThirdPartyUtils {
  static sendSlackMessage() {
    // TODO
  }
  static sendGA4Event(
    measurementId: string,
    apiSecret: string,
    body: {
      client_id: string;
      events: { name: string; params: Record<string, any> }[];
      user_id?: string;
      timestamp_micros?: number;
      user_properties?: { [k: string]: { value: any } };
      consent?: { ad_user_data?: 'GRANTED' | 'DENIED'; ad_personalization?: 'GRANTED' | 'DENIED' };
    }
  ) {
    const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    // ref: https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#payload
    httpClient('POST', ga4Url, JSON.stringify(body), {
      'Content-Type': 'application/json',
    });
  }
}

// Usage:
// Counter.counterConfig = {
//   userId: this.config.userId,
//   licenseId: this.config.deviceId,
//   deviceId: this.config.licenseId,
//   ga4Url: 'https://www.google-analytics.com/mp/collect?measurement_id=G-XXXXXXXXXX&api_secret=bXX-XXXXXXXXXX_XXXXXXX',
// };
// Counter.sendCounter(taskName, finishedPageName, furthurInfo);

export class Counter {
  public static counterConfig: CounterConfig = DefaultCounterConfig;

  public static assign<T>(target: T, source: Partial<T>): T {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key] as any;
      }
    }
    return target;
  }

  // reference: https://ga-dev-tools.google/ga4/event-builder/, https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events?client_type=gtag#send_an_event
  public static sendCounter(eventTitle: string, eventPageName: string, furthurInfo: object) {
    const eventHour = new Date().getHours();
    const stringHour = (eventHour < 10 ? '0' : '') + eventHour;

    const body = {
      client_id: this.counterConfig.licenseId, // MUST ASSIGN for GA4, else will fail to collect this data
      timestamp_micros: Date.now() * 1000,
      events: [
        {
          name: eventTitle,
          params: this.assign(
            {
              rerouter_page: eventPageName,
              rerouter_task: eventTitle,
              event_hour: stringHour,
              engagement_time_msec: 100,
              license_id: this.counterConfig.licenseId,
              xr_user_id: this.counterConfig.userId,
              device_id: this.counterConfig.deviceId,
            },
            furthurInfo
          ),
        },
      ],
    };

    httpClient('POST', this.counterConfig.ga4Url, JSON.stringify(body), {
      'Content-Type': 'application/json',
    });
    Utils.log(`Sending counter with ${JSON.stringify(this.counterConfig)}, ${JSON.stringify(body)}, task: ${eventTitle}, page: ${eventPageName}`);
  }
}
