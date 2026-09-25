Sohay Android launcher icon set
================================

Copy the contents of this package into:

    <your-android-project>/app/src/main/res/

Files included:
- mipmap-mdpi/ic_launcher.png + ic_launcher_round.png
- mipmap-hdpi/ic_launcher.png + ic_launcher_round.png
- mipmap-xhdpi/ic_launcher.png + ic_launcher_round.png
- mipmap-xxhdpi/ic_launcher.png + ic_launcher_round.png
- mipmap-xxxhdpi/ic_launcher.png + ic_launcher_round.png
- mipmap-anydpi-v26/ic_launcher.xml + ic_launcher_round.xml
- drawable/ic_launcher_foreground.png
- values/colors.xml

AndroidManifest.xml should use:
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"

Then rebuild:
    cd android
    ./gradlew clean
    ./gradlew assembleDebug

Note:
The APK file icon shown by a particular Android file manager is controlled partly
by that file manager. Embedding the application icon in the APK is the part that
can be controlled by the Android project.
