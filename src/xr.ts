export const updateGameStatus = (deviceId:string, instanceId:string, status: string): boolean => {
  var encodeKey = '2dbe1483caabfe6d089927dd1b4764a87cf224e2aebe0faa8cad6f5a6a0d4b5faf433b10a16a6e0ff4d1f317adddd22c';
  var decodeKey = xDecodeHex(encodeKey);

  var obj = {
    deviceId: deviceId,
    licenseId: instanceId,
    status: status,
    key: decodeKey,
  };

  var result = httpClient('POST', 'https://us-central1-robotmon-98370.cloudfunctions.net/XRobotmonGroup-xPostStatus', JSON.stringify(obj), {
    'Content-Type': 'application/json',
  });

  var resultObj = JSON.parse(result);
  console.log('result', 'success', resultObj.success, 'error', resultObj.error);

  return resultObj.success;
};

export const sendActivityLog = (licenseId: string, category: string, base64Image: string, msg: string) => {
  var encodeKey = '59c599ceab4287cea82a96653182e08062feca20097b2ef81fe3e545f4dd01b6e99ccfafcd1a0a439d7e81832f82a03f';
  var decodeKey = xDecodeHex(encodeKey);

  const body = {
    apiKey: decodeKey,
    licenseId: licenseId,
    base64Image: base64Image,
    category: category,
    msg: msg,
  };
  httpClient('POST', 'https://asia-east1-robotmon-98370.cloudfunctions.net/xGameAPI-saveActivityLog', JSON.stringify(body), {
    'Content-Type': 'application/json',
  });
}

export const sendLog = (channel: string, level: string, title: string, message: string) => {
  var encodeKey = '771ddf6567977bfb72a0ca364b8e044cd4d467ef32f9f0a70fe1e2cb02c380db93edc757b16a94e9f40305966752ccf1';
  var decodeKey = xDecodeHex(encodeKey);

  const body = {
    apiKey: decodeKey,
    channel: channel,
    level: level,
    title: title,
    message: message,
  };
  httpClient('POST', 'https://asia-east1-robotmon-98370.cloudfunctions.net/xLoggingAPI-log', JSON.stringify(body), {
    'Content-Type': 'application/json',
  });
}
