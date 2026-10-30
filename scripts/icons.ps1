# Genera los íconos PNG de la app (logo A4: dos personas que forman una palomita) en public/icons
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot "..\public\icons"
$marino = [Drawing.Color]::FromArgb(0x12, 0x39, 0x6A)
$blanco = [Drawing.Color]::White
$amarillo = [Drawing.Color]::FromArgb(0xF2, 0xC1, 0x4E)

function New-Icon([int]$size, [string]$name, [bool]$rounded, [double]$scale) {
  $bmp = New-Object Drawing.Bitmap $size, $size
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.Clear([Drawing.Color]::Transparent)
  $brush = New-Object Drawing.SolidBrush $marino
  if ($rounded) {
    $r = $size * 26 / 120; $p = New-Object Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, 2*$r, 2*$r, 180, 90); $p.AddArc($size-2*$r, 0, 2*$r, 2*$r, 270, 90)
    $p.AddArc($size-2*$r, $size-2*$r, 2*$r, 2*$r, 0, 90); $p.AddArc(0, $size-2*$r, 2*$r, 2*$r, 90, 90); $p.CloseFigure()
    $g.FillPath($brush, $p)
  } else { $g.FillRectangle($brush, 0, 0, $size, $size) }
  # El dibujo mide 82x80 unidades; se centra y escala (las versiones "maskable" llevan más margen)
  $u = $size / 120.0 * $scale; $ox = ($size - 82 * $u) / 2; $oy = ($size - 80 * $u) / 2
  function P([double]$x, [double]$y) { New-Object Drawing.PointF ([single]($ox + $x * $u)), ([single]($oy + $y * $u)) }
  $w = [single](14 * $u)
  $pen1 = New-Object Drawing.Pen $blanco, $w; $pen1.StartCap = 'Round'; $pen1.EndCap = 'Round'
  $pen2 = New-Object Drawing.Pen $amarillo, $w; $pen2.StartCap = 'Round'; $pen2.EndCap = 'Round'
  $g.DrawLine($pen1, (P 15 48), (P 32 65))
  $g.FillEllipse((New-Object Drawing.SolidBrush $blanco), [single]($ox + 4 * $u), [single]($oy + 17 * $u), [single](20 * $u), [single](20 * $u))
  $g.DrawLine($pen2, (P 32 65), (P 60 33))
  $g.FillEllipse((New-Object Drawing.SolidBrush $amarillo), [single]($ox + 57 * $u), [single]($oy + 3 * $u), [single](20 * $u), [single](20 * $u))
  $bmp.Save((Join-Path $dir $name), [Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 192 "icon-192.png" $true 1.0
New-Icon 512 "icon-512.png" $true 1.0
New-Icon 512 "icon-maskable-512.png" $false 0.75
New-Icon 180 "apple-touch-icon.png" $false 0.85
Write-Output "Íconos generados en $dir"
