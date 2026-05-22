const { withXcodeProject, IOSConfig } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Expo Config Plugin: copies PrivacyInfo.xcprivacy into the iOS Xcode project
 * and registers it as a resource so Apple's build system picks it up.
 *
 * Required since iOS 17 / Spring 2024 for any app that accesses location,
 * UserDefaults, file timestamps, or disk space APIs.
 */
const withPrivacyManifest = (config) => {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectRoot = cfg.modRequest.projectRoot;

    const srcFile = path.join(projectRoot, "PrivacyInfo.xcprivacy");
    const iosDir = path.join(cfg.modRequest.platformProjectRoot);
    const destFile = path.join(iosDir, "PrivacyInfo.xcprivacy");

    if (!fs.existsSync(srcFile)) {
      console.warn("[withPrivacyManifest] PrivacyInfo.xcprivacy not found at project root — skipping.");
      return cfg;
    }

    fs.copyFileSync(srcFile, destFile);

    const targetName = cfg.modRequest.projectName;
    const groupName = targetName;

    let pbxGroup = project.pbxGroupByName(groupName);
    if (!pbxGroup) {
      pbxGroup = project.pbxGroupByName(targetName);
    }

    const alreadyAdded = Object.values(project.pbxFileReferenceSection()).some(
      (ref) => ref && ref.path && ref.path.includes("PrivacyInfo.xcprivacy")
    );

    if (!alreadyAdded) {
      project.addResourceFile("PrivacyInfo.xcprivacy", { target: project.getFirstTarget().uuid }, groupName);
    }

    return cfg;
  });
};

module.exports = withPrivacyManifest;
