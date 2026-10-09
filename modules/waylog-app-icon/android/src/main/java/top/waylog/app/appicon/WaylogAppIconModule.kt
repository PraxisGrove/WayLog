package top.waylog.app.appicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WaylogAppIconModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val aliases = mapOf(
    "warm-sunburst" to "IconWarmSunburst",
    "warm-handdrawn-check" to "IconWarmHanddrawnCheck",
    "warm-soft-waves" to "IconWarmSoftWaves",
    "warm-diagonal-bands" to "IconWarmDiagonalBands",
    "warm-wide-grid" to "IconWarmWideGrid",
    "warm-tilted-check" to "IconWarmTiltedCheck",
    "nature-sunburst" to "IconNatureSunburst",
    "nature-handdrawn-check" to "IconNatureHanddrawnCheck",
    "nature-soft-waves" to "IconNatureSoftWaves",
    "nature-diagonal-bands" to "IconNatureDiagonalBands",
    "nature-wide-grid" to "IconNatureWideGrid",
    "nature-tilted-check" to "IconNatureTiltedCheck",
    "ocean-sunburst" to "IconOceanSunburst",
    "ocean-handdrawn-check" to "IconOceanHanddrawnCheck",
    "ocean-soft-waves" to "IconOceanSoftWaves",
    "ocean-diagonal-bands" to "IconOceanDiagonalBands",
    "ocean-wide-grid" to "IconOceanWideGrid",
    "ocean-tilted-check" to "IconOceanTiltedCheck",
    "lavender-sunburst" to "IconLavenderSunburst",
    "lavender-handdrawn-check" to "IconLavenderHanddrawnCheck",
    "lavender-soft-waves" to "IconLavenderSoftWaves",
    "lavender-diagonal-bands" to "IconLavenderDiagonalBands",
    "lavender-wide-grid" to "IconLavenderWideGrid",
    "lavender-tilted-check" to "IconLavenderTiltedCheck",
    "cherry-sunburst" to "IconCherrySunburst",
    "cherry-handdrawn-check" to "IconCherryHanddrawnCheck",
    "cherry-soft-waves" to "IconCherrySoftWaves",
    "cherry-diagonal-bands" to "IconCherryDiagonalBands",
    "cherry-wide-grid" to "IconCherryWideGrid",
    "cherry-tilted-check" to "IconCherryTiltedCheck",
  )

  override fun definition() = ModuleDefinition {
    Name("WaylogAppIcon")

    AsyncFunction("setIconAsync") { iconName: String ->
      val targetAlias = aliases[iconName]
        ?: throw IllegalArgumentException("Unknown WayLog app icon: $iconName")
      val packageManager = context.packageManager
      val targetComponent = component(targetAlias)

      if (!isActive(packageManager, iconName, targetComponent)) {
        packageManager.setComponentEnabledSetting(
          targetComponent,
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          PackageManager.DONT_KILL_APP,
        )
      }

      aliases.forEach { (name, alias) ->
        val aliasComponent = component(alias)
        if (
          name != iconName &&
          isActive(packageManager, name, aliasComponent)
        ) {
          packageManager.setComponentEnabledSetting(
            aliasComponent,
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP,
          )
        }
      }

      true
    }
  }

  private fun component(alias: String) =
    ComponentName(context.packageName, "${context.packageName}.$alias")

  private fun isActive(
    packageManager: PackageManager,
    iconName: String,
    component: ComponentName,
  ): Boolean {
    return when (packageManager.getComponentEnabledSetting(component)) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> iconName == "warm-sunburst"
      else -> false
    }
  }
}
