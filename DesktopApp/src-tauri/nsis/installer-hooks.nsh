!macro NSIS_HOOK_POSTINSTALL
  ; Keep a self-contained maintenance installer beside the app.
  ClearErrors
  CopyFiles /SILENT "$EXEPATH" "$INSTDIR\Mosaico-setup.exe"
  IfErrors mosaico_maintenance_done
  IfFileExists "$INSTDIR\Mosaico-setup.exe" 0 mosaico_maintenance_done
  WriteRegStr SHCTX "${UNINSTKEY}" "ModifyPath" '$"$INSTDIR\Mosaico-setup.exe$" /P /UPDATE'
  WriteRegStr SHCTX "${UNINSTKEY}" "RepairPath" '$"$INSTDIR\Mosaico-setup.exe$" /P /UPDATE'
  WriteRegDWORD SHCTX "${UNINSTKEY}" "NoModify" 0
  WriteRegDWORD SHCTX "${UNINSTKEY}" "NoRepair" 0
mosaico_maintenance_done:
!macroend
