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
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
  },
});
