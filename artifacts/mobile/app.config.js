const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const baseConfig = require('./app.json');

const expo = baseConfig.expo;

function withCarPlayNative(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'CarPlay',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate',
          },
        ],
      },
    };
    return mod;
  });

  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const { projectRoot } = mod.modRequest;
      const scriptPath = path.join(projectRoot, 'scripts', 'setup-carplay-native.sh');

      if (!fs.existsSync(scriptPath)) {
        console.warn('[withCarPlay] setup-carplay-native.sh nicht gefunden:', scriptPath);
        return mod;
      }

      try {
        execSync(`bash "${scriptPath}"`, {
          stdio: 'inherit',
          cwd: projectRoot,
        });
      } catch (e) {
        console.error('[withCarPlay] setup-carplay-native.sh fehlgeschlagen:', e.message);
      }

      return mod;
    },
  ]);

  return config;
}

module.exports = withCarPlayNative({
  ...expo,
  android: {
    ...expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '',
      },
    },
  },
});
