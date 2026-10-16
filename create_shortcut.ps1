$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$AppDir = "C:\Users\Shakeel\.gemini\antigravity\scratch\harmonium-drum-studio"
$LauncherVbs = Join-Path $AppDir "launch_studio.vbs"

# 1. Main Studio App Shortcut (Pro Music & Sound Studio 4.0) - Silent Auto-Update on Launch
$AppShortcutPath = Join-Path $DesktopPath "Pro Music & Sound Studio 4.0.lnk"
$AppShortcut = $WshShell.CreateShortcut($AppShortcutPath)
$AppShortcut.TargetPath = "wscript.exe"
$AppShortcut.Arguments = "`"$LauncherVbs`""
$AppShortcut.WorkingDirectory = $AppDir
$AppShortcut.Description = "Pro Music & Sound Studio 4.0 - Auto-Updates from GitHub on Launch"
$AppShortcut.IconLocation = "C:\Windows\System32\shell32.dll,138"
$AppShortcut.Save()

# Also update legacy shortcut name for seamless user convenience
$LegacyShortcutPath = Join-Path $DesktopPath "Harmonium & Drum Studio.lnk"
$LegacyShortcut = $WshShell.CreateShortcut($LegacyShortcutPath)
$LegacyShortcut.TargetPath = "wscript.exe"
$LegacyShortcut.Arguments = "`"$LauncherVbs`""
$LegacyShortcut.WorkingDirectory = $AppDir
$LegacyShortcut.Description = "Pro Music & Sound Studio 4.0 - Auto-Updates from GitHub on Launch"
$LegacyShortcut.IconLocation = "C:\Windows\System32\shell32.dll,138"
$LegacyShortcut.Save()

# 2. Playing Guide Shortcut (English & Song Tutorials)
$GuideShortcutPath = Join-Path $DesktopPath "Studio 4.0 Playing Guide (User Manual).lnk"
$GuideShortcut = $WshShell.CreateShortcut($GuideShortcutPath)
$GuideShortcut.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$GuideShortcut.Arguments = '--app="file:///C:/Users/Shakeel/.gemini/antigravity/scratch/harmonium-drum-studio/PLAYING_GUIDE.html"'
$GuideShortcut.WorkingDirectory = $AppDir
$GuideShortcut.Description = "Complete Pro Studio 4.0 Playing Guide & Song Tutorials"
$GuideShortcut.IconLocation = "C:\Windows\System32\shell32.dll,23"
$GuideShortcut.Save()

# Clean up older Urdu-named guide shortcut if present
$OldGuidePath = Join-Path $DesktopPath "Studio 4.0 Playing Guide (گانے بجانے کی گائیڈ).lnk"
if (Test-Path $OldGuidePath) {
    Remove-Item $OldGuidePath -Force -ErrorAction SilentlyContinue
}
$OldUpdatePath = Join-Path $DesktopPath "Update Studio (GitHub اپ ڈیٹ).lnk"
if (Test-Path $OldUpdatePath) {
    Remove-Item $OldUpdatePath -Force -ErrorAction SilentlyContinue
}

Write-Output "Shortcuts created successfully on Desktop with zero-touch auto-updater!"
