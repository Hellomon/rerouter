import { CounterConfig, DefaultCounterConfig } from './struct';

export function log(...msgs: any[]) {
  const date = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Taipei',
  });
  let message = `[${date}] `;
  for (const msg of msgs) {
    if (typeof msg === 'object') {
      message += `${JSON.stringify(msg)} `;
    } else {
      message += `${msg} `;
    }
  }

  console.log(message.substr(0, message.length - 1));
}

export class Utils {
  public static identityColor(e1: RGB, e2: RGB) {
    const mean = (e1.r + e2.r) / 2;
    const r = e1.r - e2.r;
    const g = e1.g - e2.g;
    const b = e1.b - e2.b;
    return 1 - Math.sqrt((((512 + mean) * r * r) >> 8) + 4 * g * g + (((767 - mean) * b * b) >> 8)) / 768;
  }

  public static formatXYRGB(xyrgb: XYRGB): string {
    const keys: (keyof XYRGB)[] = Object.keys(xyrgb) as (keyof XYRGB)[];
    const formatObj: { [k: string]: string } = {};
    for (const k of keys) {
      let str = `${xyrgb[k]}`;
      while (str.length < 3) {
        str = ' ' + str;
      }
      formatObj[k] = str;
    }
    const { x, y, r, g, b } = formatObj;
    return `{ x: ${x}, y: ${y}, r: ${r}, g: ${g}, b: ${b} }`;
  }

  public static sortStringNumberMap(map: { [key: string]: number }): { key: string; count: number }[] {
    const results: { key: string; count: number }[] = [];
    for (const key in map) {
      results.push({ key, count: map[key] });
    }
    results.sort((a, b) => b.count - a.count);
    return results;
  }

  public static sleep(during: number) {
    while (during > 200) {
      during -= 200;
      sleep(200);
    }
    if (during > 0) {
      sleep(during);
    }
  }

  public static getTaiwanTime(): number {
    return Date.now() + 8 * 60 * 60 * 1000;
  }

  public static log(...args: any[]) {
    for (let i = 0; i < args.length; i++) {
      let arg = args[i];
      if (typeof arg === 'object') {
        args[i] = JSON.stringify(arg);
      }
    }
    const date = new Date(Utils.getTaiwanTime());
    const dateString = `[${date.getMonth() + 1}-${date.getDate()}T${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]`;
    console.log(dateString, ...args);
  }

  public static notifyEvent(event: string, content: string) {
    if (sendEvent != undefined) {
      Utils.log('sendEvent', event, content);
      sendEvent('' + event, '' + content);
    }
  }

  public static startApp(packageName: string) {
    execute(
      `BOOTCLASSPATH=/system/framework/core.jar:/system/framework/conscrypt.jar:/system/framework/okhttp.jar:/system/framework/core-junit.jar:/system/framework/bouncycastle.jar:/system/framework/ext.jar:/system/framework/framework.jar:/system/framework/framework2.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/mms-common.jar:/system/framework/android.policy.jar:/system/framework/services.jar:/system/framework/apache-xml.jar:/system/framework/webviewchromium.jar am start -n ${packageName}`
    );
    execute(
      `ANDROID_DATA=/data BOOTCLASSPATH=/system/framework/core-oj.jar:/system/framework/core-libart.jar:/system/framework/conscrypt.jar:/system/framework/okhttp.jar:/system/framework/core-junit.jar:/system/framework/bouncycastle.jar:/system/framework/ext.jar:/system/framework/framework.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/ims-common.jar:/system/framework/mms-common.jar:/system/framework/android.policy.jar:/system/framework/apache-xml.jar:/system/framework/org.apache.http.legacy.boot.jar am start -n ${packageName}`
    );
    execute(`ANDROID_DATA=/data monkey --pct-syskeys 0 -p ${packageName} -c android.intent.category.LAUNCHER 1`);
    execute(
      'ANDROID_BOOTLOGO=1 ' +
        'ANDROID_ROOT=/system ' +
        'ANDROID_ASSETS=/system/app ' +
        'ANDROID_DATA=/data ' +
        'ANDROID_STORAGE=/storage ' +
        'ANDROID_ART_ROOT=/apex/com.android.art ' +
        'ANDROID_I18N_ROOT=/apex/com.android.i18n ' +
        'ANDROID_TZDATA_ROOT=/apex/com.android.tzdata ' +
        'EXTERNAL_STORAGE=/sdcard ' +
        'ASEC_MOUNTPOINT=/mnt/asec ' +
        'BOOTCLASSPATH=/apex/com.android.art/javalib/core-oj.jar:/apex/com.android.art/javalib/core-libart.jar:/apex/com.android.art/javalib/core-icu4j.jar:/apex/com.android.art/javalib/okhttp.jar:/apex/com.android.art/javalib/bouncycastle.jar:/apex/com.android.art/javalib/apache-xml.jar:/system/framework/framework.jar:/system/framework/ext.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/ims-common.jar:/system/framework/framework-atb-backward-compatibility.jar:/apex/com.android.conscrypt/javalib/conscrypt.jar:/apex/com.android.media/javalib/updatable-media.jar:/apex/com.android.mediaprovider/javalib/framework-mediaprovider.jar:/apex/com.android.os.statsd/javalib/framework-statsd.jar:/apex/com.android.permission/javalib/framework-permission.jar:/apex/com.android.sdkext/javalib/framework-sdkextensions.jar:/apex/com.android.wifi/javalib/framework-wifi.jar:/apex/com.android.tethering/javalib/framework-tethering.jar ' +
        'DEX2OATBOOTCLASSPATH=/apex/com.android.art/javalib/core-oj.jar:/apex/com.android.art/javalib/core-libart.jar:/apex/com.android.art/javalib/core-icu4j.jar:/apex/com.android.art/javalib/okhttp.jar:/apex/com.android.art/javalib/bouncycastle.jar:/apex/com.android.art/javalib/apache-xml.jar:/system/framework/framework.jar:/system/framework/ext.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/ims-common.jar:/system/framework/framework-atb-backward-compatibility.jar ' +
        'SYSTEMSERVERCLASSPATH=/system/framework/com.android.location.provider.jar:/system/framework/services.jar:/system/framework/ethernet-service.jar:/apex/com.android.permission/javalib/service-permission.jar:/apex/com.android.ipsec/javalib/android.net.ipsec.ike.jar ' +
        `monkey --pct-syskeys 0 -p ${packageName} -c android.intent.category.LAUNCHER 1`
    );
  }

  public static stopApp(packageName: string) {
    execute(
      `BOOTCLASSPATH=/system/framework/core.jar:/system/framework/conscrypt.jar:/system/framework/okhttp.jar:/system/framework/core-junit.jar:/system/framework/bouncycastle.jar:/system/framework/ext.jar:/system/framework/framework.jar:/system/framework/framework2.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/mms-common.jar:/system/framework/android.policy.jar:/system/framework/services.jar:/system/framework/apache-xml.jar:/system/framework/webviewchromium.jar am force-stop ${packageName}`
    );
    execute(
      `ANDROID_DATA=/data BOOTCLASSPATH=/system/framework/core-oj.jar:/system/framework/core-libart.jar:/system/framework/conscrypt.jar:/system/framework/okhttp.jar:/system/framework/core-junit.jar:/system/framework/bouncycastle.jar:/system/framework/ext.jar:/system/framework/framework.jar:/system/framework/telephony-common.jar:/system/framework/voip-common.jar:/system/framework/ims-common.jar:/system/framework/mms-common.jar:/system/framework/android.policy.jar:/system/framework/apache-xml.jar:/system/framework/org.apache.http.legacy.boot.jar am force-stop ${packageName}`
    );
  }

  public static getCurrentApp(): [string, string] {
    let result = execute('dumpsys window windows').split('mCurrentFocus');
    if (result.length < 2) {
      return ['', ''];
    }
    result = result[1].split(' ');
    if (result.length < 3) {
      return ['', ''];
    }
    result[2] = result[2].replace('}', '');
    result = result[2].split('/');

    let packageName = '';
    let activityName = '';

    if (result.length == 1) {
      packageName = result[0].trim();
    } else if (result.length > 1) {
      packageName = result[0].trim();
      activityName = result[1].trim();
    }
    return [packageName, activityName];
  }

  public static isAppOnTop(packageName: string): boolean {
    const topInfo = execute('dumpsys activity activities | grep mResumedActivity');
    return topInfo.indexOf(packageName) !== -1;
  }

  public static sendSlackMessage(url: string, title: string, message: string) {
    const body = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*' + title + '*',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
    };
    httpClient('POST', url, JSON.stringify(body), {
      'Content-Type': 'application/json',
    });
  }

  public static waitForAction(action: () => boolean, timeout: number, matchTimes: number = 1, interval = 600): boolean {
    const now = Date.now();
    let matchs = 0;
    while (Date.now() - now < timeout) {
      if (action()) {
        matchs++;
      }
      if (matchs >= matchTimes) {
        break;
      }
      Utils.sleep(interval);
    }
    if (matchs >= matchTimes) {
      return true;
    }
    return false;
  }

  public static padZero(num: number) {
    return num < 10 ? `0${num}` : `${num}`;
  }

  public static saveScreenshotToDisk(folderPath: string, suffix: string = '', timestamp: boolean = true, img: Image = undefined) {
    const date = new Date(Utils.getTaiwanTime());
    const [YYYY, MM, dd, hh, mm, ss] = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()].map(
      item => this.padZero(item)
    );

    let filename = `${suffix}.png`;
    if (timestamp) {
      filename = `${YYYY}-${MM}-${dd}T${hh}.${mm}.${ss}_${suffix}.png`;
    }

    if (img !== undefined) {
      saveImage(img, `${folderPath}/${filename}`);
    } else {
      img = getScreenshot();
      saveImage(img, `${folderPath}/${filename}`);
      releaseImage(img);
    }

    Utils.log(`Write to file: ${folderPath}/${filename}`);
  }

  public static removeOldestFilesIfExceedsLimit(folderPath: string, maxFiles: number = 100): void {
    const fileList = execute(`ls -l ${folderPath}`).split('\n');

    // Some OS return first line total 8 (Mac, redroid), some not (Memu)
    if (fileList[0] && fileList[0].indexOf('total') === 0) {
      fileList.shift();
    }

    const filesWithDates = fileList.map(line => {
      const parts = line.trim().split(' ');
      const filename = parts[parts.length - 1]; // 2023-09-02T15.08.17_log.png
      const dateObj = new Date(parts[parts.length - 3].split('_')[0]);

      return {
        date: dateObj,
        filename: filename,
      };
    });

    filesWithDates.sort((a, b) => a.date.getTime() - b.date.getTime());

    // If there are more than ${maxFiles} files, remove the oldest
    while (filesWithDates.length > maxFiles) {
      const oldestFile = filesWithDates.shift();
      if (oldestFile) {
        execute(`rm ${folderPath}/${oldestFile.filename}`);
        Utils.log(`rm: ${folderPath}/${oldestFile.filename}`);
      }
    }
  }

  public static joinPaths(path1: string, path2: string) {
    if (path2 === '') {
      return path1;
    }

    if (path1.charAt(path1.length - 1) === '/') {
      return path1 + path2;
    } else {
      return path1 + '/' + path2;
    }
  }

  public static savePointsMarkedImage({
    image,
    name,
    points,
    folderPath,
    rgba,
  }: {
    image: Image;
    name: string;
    points: { x: number; y: number }[];
    folderPath: string;
    rgba?: { r: number; g: number; b: number; a: number };
  }) {
    const filepath = `${folderPath}/${name}.png`;

    // if file exists, skip
    const res = execute(`test -e ${filepath} && echo 1`);
    if (res === '1') {
      return;
    }
    const clonedImg = clone(image);
    const { r, g, b, a } = rgba || { r: 255, g: 0, b: 0, a: 255 };
    const radius = 3;
    for (const i in points) {
      const { x, y } = points[i];
      drawCircle(clonedImg, x, y, radius, r, g, b, a);
    }
    saveImage(clonedImg, filepath);
    releaseImage(clonedImg);
    console.log(`[savePointsMarkedImage]: ${name}`);
  }
}

// Usage:
// Counter.counterConfig = {
//   userId: this.config.userId,
//   licenseId: this.config.deviceId,
//   deviceId: this.config.licenseId,
//   ga4Url: 'https://www.google-analytics.com/mp/collect?measurement_id=G-1J3WHD2SDV&api_secret=bE8-LEC6REuSDW_G3Mt87Q',
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
