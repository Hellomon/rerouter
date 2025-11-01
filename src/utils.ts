// FIXME: clear log functions
import { overrideConsole } from './overrides';
import { DEFAULT_REROUTER_CONFIG } from './defaults';

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

  public static timeLabel(timezoneOffsetHours: number | undefined = undefined): string {
    const date = new Date();

    // If timezone offset is specified, adjust the date
    if (timezoneOffsetHours !== undefined) {
      const systemOffset = -date.getTimezoneOffset() / 60;
      const hoursDiff = timezoneOffsetHours - systemOffset;
      date.setTime(date.getTime() + hoursDiff * 3600000);
    }

    // Format the date components (will use local time display)
    const YYYY = date.getFullYear();
    const MM = ('0' + (date.getMonth() + 1)).slice(-2); // Months are 0-based
    const DD = ('0' + date.getDate()).slice(-2);
    const HH = ('0' + date.getHours()).slice(-2);
    const mm = ('0' + date.getMinutes()).slice(-2);
    const ss = ('0' + date.getSeconds()).slice(-2);

    return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
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

  public static isScreenAsleep(): boolean {
    const powerInfo = execute('dumpsys power | grep getWakefulnessLocked');
    // getWakefulnessLocked()=Asleep means screen is asleep
    // getWakefulnessLocked()=Awake means screen is awake
    // getWakefulnessLocked()=Dozing means screen is dozing (also treated as asleep)
    return powerInfo.indexOf('getWakefulnessLocked()=Asleep') !== -1 || powerInfo.indexOf('getWakefulnessLocked()=Dozing') !== -1;
  }

  public static isGameBoosterLockScreen(): boolean {
    const gameBoosterInfo = execute('dumpsys window | grep -A1 "DisplayPolicyExtension" | grep -i "GameBooster"');
    return gameBoosterInfo.indexOf('GameBooster Lock Screen') !== -1 || gameBoosterInfo.toLowerCase().indexOf('gamebooster') !== -1;
  }

  public static isAppOnTop(packageName: string): boolean {
    // Check if screen is asleep first
    if (Utils.isScreenAsleep()) {
      // Press wakeup to wake up the screen
      console.log('Screen is asleep, pressing WAKEUP to wake up');
      keycode('WAKEUP', 100);
      Utils.sleep(500);
    }

    // Check for GameBooster Lock Screen
    if (Utils.isGameBoosterLockScreen()) {
      console.log('GameBooster Lock Screen detected, attempting to remove gametool process');
      execute('am force-stop com.samsung.android.game.gametools');
      Utils.sleep(500);
    }

    const topInfo = execute('dumpsys activity activities | grep mResumedActivity');
    // mResumedActivity: ActivityRecord{29199c5 u0 com.linecorp.LGTMTMG/com.linecorp.LGTMTM.TsumTsum t1872}
    return topInfo.indexOf(`${packageName}/`) !== -1;
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

  public static saveScreenshotToDisk(
    folderPath: string,
    suffix: string = '',
    timestamp: boolean = true,
    img: Image = undefined,
    saveImageRoot: string = DEFAULT_REROUTER_CONFIG.saveImageRoot
  ) {
    if (folderPath.charAt(0) === '/') {
      folderPath = folderPath.substring(1);
    }

    const fullFolderPath = `${saveImageRoot}${folderPath}`;

    // Create folder if it doesn't exist
    execute(`mkdir -p "${fullFolderPath}"`);

    // Use the same timezone handling as overrideConsole
    const timeStr = Utils.timeLabel(overrideConsole.timezoneOffsetHour);
    const [datePart, timePart] = timeStr.split(' ');
    const filename = timestamp ? `${datePart}T${timePart.replace(/:/g, '.')}_${suffix}.png` : `${suffix}.png`;

    if (img !== undefined) {
      saveImage(img, `${fullFolderPath}/${filename}`);
    } else {
      img = getScreenshot();
      saveImage(img, `${fullFolderPath}/${filename}`);
      releaseImage(img);
    }

    console.log(`Write to file: ${fullFolderPath}/${filename}`);
  }

  public static removeOldestFilesIfExceedsLimit(
    folderPath: string,
    maxFiles: number = 100,
    maxDays: number = -1,
    saveImageRoot: string = DEFAULT_REROUTER_CONFIG.saveImageRoot
  ): void {
    try {
      if (folderPath.charAt(0) === '/') {
        folderPath = folderPath.substring(1);
      }
      const baseFolder = `${saveImageRoot}${folderPath}`;

      if (maxDays > 0) {
        // Priority 1: Use maxDays - delete entire date folders that are too old
        Utils.cleanupByDays(baseFolder, maxDays);
      } else {
        // Priority 2: Use maxFiles - keep only newest files in flat structure
        Utils.cleanupByFileCount(baseFolder, maxFiles);
      }
    } catch (error: any) {
      console.warn(`Warning in removeOldestFilesIfExceedsLimit: ${error.message}`);
    }
  }

  private static cleanupByDays(baseFolder: string, maxDays: number): void {
    try {
      // Use find command to get items older than maxDays (more reliable on Android)
      const findCmd = `find "${baseFolder}" -maxdepth 1 -mtime +${maxDays} 2>/dev/null || true`;
      const oldItems = execute(findCmd).trim();
      if (!oldItems) return;

      const itemList = oldItems.split('\n').filter(f => f.trim() && f !== baseFolder);

      // Log what we're deleting
      for (const fullPath of itemList) {
        const itemName = fullPath.split('/').pop() || '';
        console.log(`Deleting item: ${itemName} (older than ${maxDays} days)`);
      }

      const deletedCount = Utils.batchDelete(itemList);

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} items older than ${maxDays} days`);
      }
    } catch (error: any) {
      console.warn(`Date cleanup failed: ${error.message}`);
    }
  }

  private static cleanupByFileCount(baseFolder: string, maxFiles: number): void {
    try {
      // Use ls -t1 to get files sorted by time (newest first), one per line
      const sortedFiles = execute(`ls -t1 ${baseFolder} 2>/dev/null || true`).trim();
      if (!sortedFiles) return;

      const fileList = sortedFiles
        .split('\n')
        .filter(f => f.trim())
        .map(f => `${baseFolder}/${f}`);
      if (fileList.length <= maxFiles) return;

      // Keep newest files, delete the rest
      const filesToDelete = fileList.slice(maxFiles);

      // Batch delete files/folders for better performance
      const deletedCount = Utils.batchDelete(filesToDelete);

      if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} oldest items, keeping newest ${maxFiles} items`);
      }
    } catch (error: any) {
      console.warn(`File cleanup failed: ${error.message}`);
    }
  }

  private static batchDelete(itemList: string[]): number {
    if (itemList.length === 0) return 0;

    let deletedCount = 0;
    const batchSize = 100; // Limit to 100 items per batch to avoid command length issues

    // Process items in batches of 100
    for (let i = 0; i < itemList.length; i += batchSize) {
      const batch = itemList.slice(i, i + batchSize);
      const fileListCmd = batch.map(f => `"${f}"`).join(' ');

      try {
        execute(`rm -rf ${fileListCmd}`);
        deletedCount += batch.length;
        console.log(`Batch deleted ${batch.length} items (${deletedCount}/${itemList.length})`);
      } catch (e) {
        console.warn(`Failed to delete batch of ${batch.length} items`);
      }
    }

    return deletedCount;
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
