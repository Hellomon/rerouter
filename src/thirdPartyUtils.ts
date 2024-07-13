import { CounterConfig, DefaultCounterConfig } from './struct';
import { Utils } from './utils';

export class ThirdPartyUtils {
  static sendSlackMessage() {
    // TODO
  }

  /**
   * @description Send GA4 event, will auto-fill fields required by GA4
   * @reference https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#payload
   */
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

    // fill default values need from GA4
    if (!body.timestamp_micros) {
      body.timestamp_micros = Date.now() * 1000;
    }
    if (!body.client_id) {
      body.client_id = 'default_client_id';
    }
    if (!body.user_id) {
      body.user_id = 'default_user_id';
    }
    if (body.events.length === 0) {
      body.events = [{ name: 'default_event_name', params: {} }];
    }
    for (let i = 0; i < body.events.length; i++) {
      if (!body.events[i].params.rerouter_page) {
        body.events[i].params.rerouter_page = 'default_page_name';
      }
      if (!body.events[i].params.rerouter_task) {
        body.events[i].params.rerouter_task = 'default_task_name';
      }
      if (!body.events[i].params.event_hour) {
        body.events[i].params.event_hour = '00';
      }
      if (!body.events[i].params.engagement_time_msec) {
        body.events[i].params.engagement_time_msec = 100;
      }
      if (!body.events[i].params.license_id) {
        body.events[i].params.license_id = 'default_license_id';
      }
      if (!body.events[i].params.xr_user_id) {
        body.events[i].params.xr_user_id = 'default_user_id';
      }
      if (!body.events[i].params.device_id) {
        body.events[i].params.device_id = 'default_device_id';
      }
    }

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
