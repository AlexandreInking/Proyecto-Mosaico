Unicode true
ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2
RequestExecutionLevel user
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef INNER_INSTALLER
  !error "INNER_INSTALLER is required"
!endif
!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "mosaico-setup.exe"
!endif
!ifndef APP_ICON
  !error "APP_ICON is required"
!endif
!ifndef HERO_BITMAP
  !error "HERO_BITMAP is required"
!endif

!define PRODUCT_NAME "Mosaico"
!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.2.17"
!endif
!define APP_EXE "$LOCALAPPDATA\Mosaico\mosaico-desktop.exe"

Name "${PRODUCT_NAME}"
OutFile "${OUTPUT_FILE}"
Icon "${APP_ICON}"
BrandingText "Proyecto Mosaico"
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName" "Mosaico"
VIAddVersionKey "FileDescription" "Instalador personalizado de Mosaico"
VIAddVersionKey "CompanyName" "Proyecto Mosaico"
VIAddVersionKey "LegalCopyright" "Copyright © Proyecto Mosaico"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"

Var HeroImage
Var HeroHandle
Var DesktopShortcut
Var LaunchAfterInstall
Var InstallStatus

!define MUI_CUSTOMFUNCTION_GUIINIT MosaicoGUIInit
Page custom WelcomePage WelcomePageLeave
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ProgressPageShow
!insertmacro MUI_PAGE_INSTFILES
Page custom FinishPage FinishPageLeave
!insertmacro MUI_LANGUAGE "Spanish"

Function MosaicoGUIInit
  SetCtlColors $HWNDPARENT "E8F0F2" "11181C"
  GetDlgItem $0 $HWNDPARENT 1256
  ShowWindow $0 ${SW_HIDE}
FunctionEnd

Function StyleNavigation
  GetDlgItem $0 $HWNDPARENT 1
  SetCtlColors $0 "071012" "51E1D2"
  GetDlgItem $1 $HWNDPARENT 2
  SetCtlColors $1 "D8E2E5" "202A2F"
  GetDlgItem $2 $HWNDPARENT 3
  SetCtlColors $2 "D8E2E5" "202A2F"
FunctionEnd

Function WelcomePage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $0 "D8E2E5" "11181C"

  File /oname=$PLUGINSDIR\mosaico-installer-hero.bmp "${HERO_BITMAP}"
  ${NSD_CreateBitmap} 0 0 118u 100% ""
  Pop $HeroImage
  ${NSD_SetImage} $HeroImage "$PLUGINSDIR\mosaico-installer-hero.bmp" $HeroHandle

  ${NSD_CreateLabel} 136u 16u 152u 18u "MOSAICO"
  Pop $1
  CreateFont $2 "Segoe UI" 17 700
  SendMessage $1 ${WM_SETFONT} $2 1
  SetCtlColors $1 "51E1D2" "11181C"

  ${NSD_CreateLabel} 250u 21u 38u 12u "v${PRODUCT_VERSION}"
  Pop $1
  SetCtlColors $1 "71838B" "11181C"

  ${NSD_CreateLabel} 136u 43u 152u 32u "Crea, transforma y anima pixel art en un solo workspace."
  Pop $1
  CreateFont $2 "Segoe UI" 10 600
  SendMessage $1 ${WM_SETFONT} $2 1
  SetCtlColors $1 "F4F7F8" "11181C"

/*
  ${NSD_CreateLabel} 136u 85u 152u 38u "Assets compartidos · Editor · Pipelines · Maps$$\nInstalación local para tu usuario."
  Pop $1
  SetCtlColors $1 "9FB0B7" "11181C"
*/

  ${NSD_CreateLabel} 136u 85u 152u 18u "Assets compartidos · Editor · Pipelines · Maps"
  Pop $1
  SetCtlColors $1 "9FB0B7" "11181C"

  ${NSD_CreateLabel} 136u 105u 152u 16u "Instalación local para tu usuario."
  Pop $1
  SetCtlColors $1 "9FB0B7" "11181C"

  ${NSD_CreateCheckbox} 136u 139u 152u 12u "Crear acceso directo en el escritorio"
  Pop $DesktopShortcut
  ${NSD_Check} $DesktopShortcut
  SetCtlColors $DesktopShortcut "D8E2E5" "11181C"

  ${NSD_CreateCheckbox} 136u 158u 152u 12u "Abrir Mosaico al terminar"
  Pop $LaunchAfterInstall
  ${NSD_Check} $LaunchAfterInstall
  SetCtlColors $LaunchAfterInstall "D8E2E5" "11181C"

  ${NSD_CreateLabel} 136u 188u 152u 22u "No requiere permisos de administrador. Puedes desinstalarlo desde Configuración de Windows."
  Pop $1
  SetCtlColors $1 "71838B" "11181C"

  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Instalar"
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 ${SW_HIDE}
  Call StyleNavigation
  nsDialogs::Show
FunctionEnd

Function WelcomePageLeave
  ${NSD_GetState} $DesktopShortcut $DesktopShortcut
  ${NSD_GetState} $LaunchAfterInstall $LaunchAfterInstall
  ${NSD_FreeImage} $HeroHandle
FunctionEnd

Function ProgressPageShow
  Call StyleNavigation
  GetDlgItem $0 $HWNDPARENT 1
  EnableWindow $0 0
  GetDlgItem $0 $HWNDPARENT 2
  EnableWindow $0 0
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 ${SW_HIDE}
FunctionEnd

Section "Instalar Mosaico"
  InitPluginsDir
  DetailPrint "Preparando Mosaico..."
  File /oname=$PLUGINSDIR\Mosaico-core-setup.exe "${INNER_INSTALLER}"
  DetailPrint "Instalando aplicación y componentes..."
  ExecWait '"$PLUGINSDIR\Mosaico-core-setup.exe" /S' $InstallStatus
  ${If} $InstallStatus != 0
    MessageBox MB_ICONSTOP|MB_OK "Mosaico no pudo instalarse (código $InstallStatus)."
    SetErrorLevel $InstallStatus
    Quit
  ${EndIf}
  ${If} $DesktopShortcut == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Mosaico.lnk" "${APP_EXE}" "" "${APP_EXE}" 0
  ${EndIf}
SectionEnd

Function FinishPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $0 "D8E2E5" "11181C"

  ${NSD_CreateLabel} 22u 28u 254u 24u "Mosaico está listo"
  Pop $1
  CreateFont $2 "Segoe UI" 18 700
  SendMessage $1 ${WM_SETFONT} $2 1
  SetCtlColors $1 "51E1D2" "11181C"

  ${NSD_CreateLabel} 22u 68u 254u 42u "La instalación terminó correctamente. Tus proyectos y Assets se guardan localmente y puedes exportar un workspace .mws cuando quieras."
  Pop $1
  SetCtlColors $1 "D8E2E5" "11181C"

  ${NSD_CreateLabel} 22u 132u 254u 34u "Consejo: abre Assets primero para importar PNG o GIF y compartirlos con Editor, Pipelines y Maps."
  Pop $1
  SetCtlColors $1 "9FB0B7" "11181C"

  GetDlgItem $0 $HWNDPARENT 1
  ${If} $LaunchAfterInstall == ${BST_CHECKED}
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Abrir Mosaico"
  ${Else}
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Cerrar"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 ${SW_HIDE}
  Call StyleNavigation
  nsDialogs::Show
FunctionEnd

Function FinishPageLeave
  ${If} $LaunchAfterInstall == ${BST_CHECKED}
    ExecShell "open" "${APP_EXE}"
  ${EndIf}
FunctionEnd
