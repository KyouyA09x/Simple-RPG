# Creates a "Stick RPG" app shortcut (Desktop + Start Menu) that opens the game in its own
# Microsoft Edge app window, on the high-performance GPU. Re-run any time; it overwrites the old shortcuts.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$game = Join-Path $root 'index.html'
$icon = Join-Path $PSScriptRoot 'stickrpg.ico'
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found.' }

# --- draw a 256x256 icon: stickman with a sword on a sunset circle ---
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$rect = New-Object System.Drawing.Rectangle 8, 8, 240, 240
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 60, 25, 70)), ([System.Drawing.Color]::FromArgb(255, 240, 138, 74)), 90
$g.FillEllipse($bg, $rect)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::Black), 14
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'
$g.FillEllipse([System.Drawing.Brushes]::White, 98, 38, 52, 52)
$g.DrawEllipse($pen, 98, 38, 52, 52)
$g.DrawLine($pen, 124, 92, 118, 160)      # body
$g.DrawLine($pen, 118, 160, 88, 214)      # legs
$g.DrawLine($pen, 118, 160, 150, 212)
$g.DrawLine($pen, 122, 108, 92, 140)      # back arm
$g.DrawLine($pen, 122, 108, 160, 124)     # sword arm
$blade = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 230, 120)), 10
$blade.StartCap = 'Round'; $blade.EndCap = 'Triangle'
$g.DrawLine($blade, 160, 124, 214, 48)
$scarf = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 192, 40, 45)), 10
$scarf.StartCap = 'Round'; $scarf.EndCap = 'Round'
$g.DrawBezier($scarf, 118, 96, 96, 92, 84, 108, 60, 100)
$g.Dispose()
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
# wrap the PNG in a single-image .ico container
$fs = [System.IO.File]::Create($icon)
$w = New-Object System.IO.BinaryWriter $fs
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)
$w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0)
$w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$png.Length); $w.Write([UInt32]22)
$w.Write($png); $w.Close()

# --- shortcut: own app window, separate profile (so GPU flags always apply), discrete GPU ---
$url = 'file:///' + ($game -replace '\\', '/')
$edgeProfile = Join-Path $env:LOCALAPPDATA 'StickRPG\EdgeProfile'
$edgeArgs = "--app=`"$url`" --user-data-dir=`"$edgeProfile`" --force_high_performance_gpu --ignore-gpu-blocklist " +
        "--enable-gpu-rasterization --autoplay-policy=no-user-gesture-required --start-maximized --no-first-run --no-default-browser-check"
$shell = New-Object -ComObject WScript.Shell
$targets = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))
foreach ($dir in $targets) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Stick RPG.lnk'))
  $lnk.TargetPath = $edge
  $lnk.Arguments = $edgeArgs
  $lnk.IconLocation = "$icon,0"
  $lnk.WorkingDirectory = $root
  $lnk.Description = 'Stick RPG'
  $lnk.Save()
  Write-Output "Created: $(Join-Path $dir 'Stick RPG.lnk')"
}
