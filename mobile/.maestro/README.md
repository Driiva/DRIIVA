# Maestro characterisation flows (rebuild mission, 2026-07)

These flows lock in CURRENT mobile behaviour — including stubs and dead ends.
A failing flow means behaviour changed (or the flow is wrong), never "found a bug".

## Status: AUTHORED, EXECUTION BLOCKED

Running these requires a simulator build of the app, and as of 2026-07-02 **no
runnable build can be produced from this repo**:

1. `expo run:ios` against the machine-local `mobile/ios/` prebuild fails with
   gRPC-C++ compile errors under the current Xcode toolchain (38 errors first
   run; the incremental retry also never produced a complete .app bundle —
   only `Frameworks/`, no Info.plist).
2. `mobile/ios/` is NOT git-tracked (mobile/.gitignore ignores /ios) and there
   is no eas.json — no reproducible native build path exists in the repo.
3. Even a successful build would throw at first Firebase touch: there is no
   GoogleService-Info.plist / googleServicesFile / Firebase.configure()
   anywhere (audit-mobile MOB-01).
4. Expo Go is NOT a substitute: lib/firebase.ts substitutes a fully mocked
   auth/firestore in Expo Go, so nothing real is exercised (MOB-05).

These blockers are on the manual-verify list (findings.md §1c). Once a build
exists: `maestro test mobile/.maestro/` with the app installed on a booted
simulator (bundle id com.driiva.app).

Flow → audit-ID map: 01=MOB-T01/T02, 02=MOB-T10, 03=MOB-T09, 04=MOB-T12,
05=MOB-T11, 06=MOB-T07.
