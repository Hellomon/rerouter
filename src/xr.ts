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
