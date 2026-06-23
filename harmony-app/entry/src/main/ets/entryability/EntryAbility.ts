import AbilityConstant from '@ohos.app.ability.AbilityConstant'
import hilog from '@ohos.hilog'
import UIAbility from '@ohos.app.ability.UIAbility'
import Want from '@ohos.app.ability.Want'
import window from '@ohos.window'

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam) {
    hilog.info(0x0000, 'TodoSync', 'Ability onCreate')
  }

  onDestroy() {
    hilog.info(0x0000, 'TodoSync', 'Ability onDestroy')
  }

  onWindowStageCreate(windowStage: window.WindowStage) {
    windowStage.loadContent('pages/Index', (err, data) => {
      if (err.code) {
        hilog.error(0x0000, 'TodoSync', 'Failed to load content. Cause: %{public}s', JSON.stringify(err))
        return
      }
      hilog.info(0x0000, 'TodoSync', 'Succeeded in loading content. Data: %{public}s', JSON.stringify(data))
    })
  }

  onWindowStageDestroy() {
    hilog.info(0x0000, 'TodoSync', 'onWindowStageDestroy')
  }

  onForeground() {
    hilog.info(0x0000, 'TodoSync', 'onForeground')
  }

  onBackground() {
    hilog.info(0x0000, 'TodoSync', 'onBackground')
  }
}
