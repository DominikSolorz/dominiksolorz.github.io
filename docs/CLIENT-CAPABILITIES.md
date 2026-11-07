# Account capabilities across clients

The signed-in owner's capabilities should be organized differently on desktop and phone, not removed by layout CSS. Displaying a control never grants permission: existing account/PIN checks and signed commands remain authoritative.

| Capability | Desktop browser / Windows | Phone browser |
|---|---|---|
| Live video, listening, zoom | Live workspace | Home |
| Start, stop recording, restart, operating mode | Controls | Settings → Sterowanie i zapis |
| Image and microphone configuration | Settings | Settings → image/sound |
| Archive, playback, download/share, authorized deletion | Recordings | Recordings |
| Previously approved computer folder | Folder panel | Recordings → computer folder |
| Events and diagnostic state | Events / Diagnostics | Alarms / Settings → System |
| Account, PIN and sign out | Account menu | App options → profile / sign out |

This is a navigation map for existing code, not an end-to-end certification of every camera/command. Phone control requires the recorder PC to be online and its owner panel unlocked with the correct PIN. A receiver-only link remains read-only.

First permission for an arbitrary new computer directory, physical USB device installation, Windows installer application, and computer capture are native-host duties. The phone can send supported commands; it cannot directly access another device's disk or grant that device's OS permissions. Cloud upload must be reported from server receipts, not from a clicked button.

The current recorder is still panel MediaRecorder based; this navigation change does not turn it into an independent native DVR. Additional preview tiles are not per-camera recording engines. Physical iPhone/Android and actual signed-command tests are separate acceptance steps.
