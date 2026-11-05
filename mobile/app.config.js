const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error('EAS_PROJECT_ID must be the Expo project UUID.');
  }
  if (process.env.GOOGLE_SERVICES_JSON && !fs.existsSync(path.resolve(__dirname, googleServicesFile))) {
    throw new Error('GOOGLE_SERVICES_JSON does not point to an existing google-services.json file.');
  }
  return {
    ...config,
    ...(projectId ? { extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } } : {}),
    android: {
      ...config.android,
      ...(fs.existsSync(path.resolve(__dirname, googleServicesFile)) ? { googleServicesFile } : {}),
    },
  };
};
