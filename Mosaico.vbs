Option Explicit

Dim shell, files, root, executable
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
executable = files.BuildPath(root, "DesktopApp\src-tauri\target\release\mosaico-desktop.exe")
Dim buildMarker
buildMarker = files.BuildPath(root, "DesktopApp\app\dist\index.html")

If Not files.FileExists(executable) Then
  MsgBox "Mosaico no está compilado. Ejecuta pnpm installer:build desde la raíz del proyecto.", 16, "Mosaico"
  WScript.Quit 1
End If

If files.FileExists(buildMarker) Then
  If files.GetFile(executable).DateLastModified < files.GetFile(buildMarker).DateLastModified Then
    MsgBox "La versiÃ³n Desktop estÃ¡ desactualizada. Ejecuta pnpm installer:build para sincronizarla con la UI actual.", 48, "Mosaico"
    WScript.Quit 2
  End If
End If

shell.Run Chr(34) & executable & Chr(34), 0, False
