npx expo prebuild --clean
cd android
./gradlew assembleRelease
cd app/build/outputs/apk/release/
adb install -r app-release.apk

