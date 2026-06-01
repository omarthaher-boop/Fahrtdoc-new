package com.fahrtdoc.app

import androidx.car.app.CarAppService
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

/**
 * Android Auto entry point — declared in AndroidManifest.xml with the
 * androidx.car.app.CarAppService intent filter.
 *
 * The setup script (scripts/setup-carplay-native.sh) copies this file and
 * patches the manifest after `expo prebuild`.
 */
class FahrtDocCarAppService : CarAppService() {

    override fun createHostValidator(): HostValidator =
        HostValidator.ALLOW_ALL_HOSTS_VALIDATOR

    override fun onCreateSession(): Session = FahrtDocCarSession()
}
