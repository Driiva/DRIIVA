// app.json stays the source of truth for every static value. This wrapper
// exists for exactly one reason, and please do not fold it back into app.json:
//
// `ios.googleServicesFile` has to come from an environment variable. The plist
// is gitignored (it is per-project Firebase config, and the repo deliberately
// keeps it out of git), so on EAS it arrives as a secret *file* env var whose
// value is the path the builder wrote it to. app.json is static JSON and never
// expands anything, so `"$GOOGLE_SERVICES_PLIST"` was being handed to the
// config plugins verbatim as a filename:
//
//   [ios.infoPlist]: withIosInfoPlistBaseMod: ENOENT: no such file or
//   directory, open '.../mobile/$GOOGLE_SERVICES_PLIST'
//
// That fails during `eas build`'s entitlement introspection, which happens
// before credentials are even considered, so no iOS build could start at all.
// EAS build history for @mrshippers/driiva was empty, which is why this went
// unnoticed - it had been recorded as "unblocked up to Apple credentials"
// without a build ever running to prove it.
//
// On the EAS builder process.env.GOOGLE_SERVICES_PLIST is the written path.
// Locally it is usually unset, so fall back to the plist next to this file.
//
// Android needs exactly the same treatment, and used to look fine only because
// android had no `googleServicesFile` key at all - `expo export` passed and read
// as proof while the first real android build died in prebuild:
//
//   [android.dangerous]: withAndroidDangerousBaseMod: Path to
//   google-services.json is not defined. Please specify the
//   expo.android.googleServicesFile field in app.json.
//
// @react-native-firebase/app's copyGoogleServices mod requires it whenever the
// plugin is present, so both platforms are wired here and neither belongs in
// app.json.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
