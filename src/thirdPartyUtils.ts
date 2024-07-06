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
