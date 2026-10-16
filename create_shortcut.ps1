$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')

# 1. Main Studio App Shortcut (Pro Music & Sound Studio 4.0)
$AppShortcutPath = Join-Path $DesktopPath "Pro Music & Sound Studio 4.0.lnk"
$AppShortcut = $WshShell.CreateShortcut($AppShortcutPath)
$AppShortcut.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$AppShortcut.Arguments = '--app="file:///C:/Users/Shakeel/.gemini/antigravity/scratch/harmonium-drum-studio/index.html"'
$AppShortcut.WorkingDirectory = "C:\Users\Shakeel\.gemini\antigravity\scratch\harmonium-drum-studio"
$AppShortcut.Description = "Pro Music & Sound Studio 4.0 - 8 Instruments, Wedding Dhol, Tabla & Settings"
$AppShortcut.IconLocation = "C:\Windows\System32\shell32.dll,138"
$AppShortcut.Save()

# Also update legacy shortcut name for seamless user convenience
$LegacyShortcutPath = Join-Path $DesktopPath "Harmonium & Drum Studio.lnk"
$LegacyShortcut = $WshShell.CreateShortcut($LegacyShortcutPath)
$LegacyShortcut.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$LegacyShortcut.Arguments = '--app="file:///C:/Users/Shakeel/.gemini/antigravity/scratch/harmonium-drum-studio/index.html"'
$LegacyShortcut.WorkingDirectory = "C:\Users\Shakeel\.gemini\antigravity\scratch\harmonium-drum-studio"
$LegacyShortcut.Description = "Pro Music & Sound Studio 4.0 - 8 Instruments, Wedding Dhol, Tabla & Settings"
$LegacyShortcut.IconLocation = "C:\Windows\System32\shell32.dll,138"
$LegacyShortcut.Save()

# 2. Playing Guide Shortcut
$GuideShortcutPath = Join-Path $DesktopPath "Studio 4.0 Playing Guide (گانے بجانے کی گائیڈ).lnk"
$GuideShortcut = $WshShell.CreateShortcut($GuideShortcutPath)
$GuideShortcut.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$GuideShortcut.Arguments = '--app="file:///C:/Users/Shakeel/.gemini/antigravity/scratch/harmonium-drum-studio/PLAYING_GUIDE.html"'
$GuideShortcut.WorkingDirectory = "C:\Users\Shakeel\.gemini\antigravity\scratch\harmonium-drum-studio"
$GuideShortcut.Description = "Complete Pro Studio 4.0 Playing Guide & Song Tutorials"
$GuideShortcut.IconLocation = "C:\Windows\System32\shell32.dll,23"
$GuideShortcut.Save()

# 3. Auto-Updater Shortcut (GitHub Sync)
$UpdateShortcutPath = Join-Path $DesktopPath "Update Studio (GitHub اپ ڈیٹ).lnk"
$UpdateShortcut = $WshShell.CreateShortcut($UpdateShortcutPath)
$UpdateShortcut.TargetPath = "cmd.exe"
$UpdateShortcut.Arguments = '/c ""C:\Users\Shakeel\.gemini\antigravity\scratch\harmonium-drum-studio\update_app.bat"""'
$UpdateShortcut.WorkingDirectory = "C:\Users\Shakeel\.gemini\antigravity\scratch\harmonium-drum-studio"
$UpdateShortcut.Description = "Check and pull latest updates from GitHub"
$UpdateShortcut.IconLocation = "C:\Windows\System32\shell32.dll,238"
$UpdateShortcut.Save()

Write-Output "Shortcuts created successfully on Desktop!"
