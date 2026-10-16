' Pro Music & Sound Studio 4.0 - Silent Background Auto-Updater & Launcher
' 100% Invisible: Zero black console popups, automatic GitHub sync on launch

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' 1. Run silent git pull in the background (WindowStyle = 0 means completely hidden)
GitExe = "C:\Users\Shakeel\AppData\Local\github-copilot-git-2.53.0-4\cmd\git.exe"
If Not FSO.FileExists(GitExe) Then
    GitExe = "git"
End If

GitCmd = "cmd /c cd /d """ & ScriptDir & """ && """ & GitExe & """ pull origin main"
On Error Resume Next
WshShell.Run GitCmd, 0, True
On Error GoTo 0

' 2. Launch Pro Music Studio 4.0 in Microsoft Edge Standalone App Mode (or default browser)
EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not FSO.FileExists(EdgePath) Then
    EdgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

AppUrl = "file:///" & Replace(ScriptDir, "\", "/") & "/index.html"

If FSO.FileExists(EdgePath) Then
    LaunchCmd = """" & EdgePath & """ --app=""" & AppUrl & """"
    WshShell.Run LaunchCmd, 1, False
Else
    ' Fallback to default browser
    WshShell.Run """" & AppUrl & """", 1, False
End If
