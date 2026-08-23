/**
 * Expo config plugin: call FirebaseApp.configure() at launch.
 *
 * WHY THIS EXISTS
 * @react-native-firebase/app ships its own config plugin that is supposed to
 * inject this. On Expo SDK 54 it silently does not, and says so:
 *
 *   » ios: @react-native-firebase/app: Unable to determine correct Firebase
 *     insertion point in AppDelegate.swift. Skipping Firebase addition.
 *
 * Its Swift path anchors on `self.moduleName = "..."`, which the SDK 54
 * AppDelegate template no longer contains; that template now starts React
 * Native with `factory.startReactNative(withModuleName:)`. The plugin still
 * adds `import FirebaseCore`, so the file LOOKS wired, which is what makes
 * this worth a plugin rather than a comment: the failure is a warning in
 * prebuild output that scrolls past, and the symptom arrives much later as
 * "No Firebase App '[DEFAULT]' has been created" on the first Firestore call.
 *
 * A green build with no Firebase is a worse outcome than a red build, because
 * it looks finished.
 *
 * Anchored on the opening of didFinishLaunchingWithOptions so Firebase is
 * configured before React Native starts and before any JS can reach for it.
 * Remove this plugin once the upstream one handles the SDK 54 template; the
 * guard below makes it a no-op if the call is ever injected twice.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CALL = 'FirebaseApp.configure()';

const withFirebaseConfigure = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const appDelegate = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName ?? '',
        'AppDelegate.swift',
      );

      if (!fs.existsSync(appDelegate)) {
        throw new Error(
          `[with-firebase-configure] no AppDelegate.swift at ${appDelegate}. ` +
            'The Expo template changed; update this plugin.',
        );
      }

      let contents = fs.readFileSync(appDelegate, 'utf8');

      // Already wired, by upstream or by a previous run of this plugin.
      if (contents.includes(CALL)) return cfg;

      // The header above says the upstream plugin still adds this import even
      // when it skips the configure call. On SDK 54 it does not: it skips the
      // Swift AppDelegate entirely and adds nothing, so this plugin used to
      // throw on a precondition that could never hold and no iOS build could
      // get past prebuild. Add the import ourselves instead of failing on
      // something we can fix, which also drops the ordering dependency on
      // @react-native-firebase/app.
      if (!contents.includes('import FirebaseCore')) {
        const lines = contents.split('\n');
        let lastImport = -1;
        for (let i = 0; i < lines.length; i++) {
          if (/^import\s+\w/.test(lines[i])) lastImport = i;
        }
        if (lastImport === -1) {
          throw new Error(
            '[with-firebase-configure] AppDelegate.swift has no import block to ' +
              'extend. The Expo template changed; update this plugin.',
          );
        }
        lines.splice(lastImport + 1, 0, 'import FirebaseCore');
        contents = lines.join('\n');
      }

      // The opening brace of didFinishLaunchingWithOptions.
      const anchor = /(\) -> Bool \{\n)/;
      if (!anchor.test(contents)) {
        throw new Error(
          '[with-firebase-configure] could not find didFinishLaunchingWithOptions ' +
            'in AppDelegate.swift. Update this plugin rather than editing ios/, ' +
            'which prebuild regenerates.',
        );
      }

      const patched = contents.replace(
        anchor,
        `$1    // Configure Firebase before React Native starts. Injected by\n` +
          `    // plugins/with-firebase-configure.js because the upstream\n` +
          `    // @react-native-firebase/app plugin cannot find its anchor in the\n` +
          `    // SDK 54 Swift AppDelegate and skips this silently.\n` +
          `    ${CALL}\n\n`,
      );

      fs.writeFileSync(appDelegate, patched, 'utf8');
      return cfg;
    },
  ]);

module.exports = withFirebaseConfigure;
