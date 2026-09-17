Option Explicit

Dim shell, files, root, executable, buildMarker
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
executable = files.BuildPath(root, "DesktopApp\src-tauri\target\release\mosaico-desktop.exe")
buildMarker = files.BuildPath(root, "DesktopApp\app\dist\index.html")

If Not files.FileExists(executable) Then
  MsgBox "Mosaico no esta compilado. Ejecuta pnpm installer:build desde la raiz del proyecto.", 16, "Mosaico"
  WScript.Quit 1
End If

If Not files.FileExists(buildMarker) Then
  MsgBox "La UI de Mosaico no esta compilada. Ejecuta pnpm installer:build desde la raiz del proyecto.", 48, "Mosaico"
  WScript.Quit 2
End If

shell.Run Chr(34) & executable & Chr(34), 0, False
