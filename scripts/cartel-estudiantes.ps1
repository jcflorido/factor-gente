# Cartel vertical con QR para estudiantes y egresados (1080x1350) en diseno/anuncios
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot "..\diseno\anuncios"
$marino = [Drawing.Color]::FromArgb(0x12, 0x39, 0x6A)
$amarillo = [Drawing.Color]::FromArgb(0xF2, 0xC1, 0x4E)
$claro = [Drawing.Color]::FromArgb(0xF2, 0xF7, 0xFC)
$gris = [Drawing.Color]::FromArgb(0xBF, 0xD5, 0xEE)
$blanco = [Drawing.Color]::White
$W = 1080; $H = 1350; $M = 80

function Font([double]$px, [bool]$bold) {
  $style = if ($bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
  New-Object Drawing.Font "Segoe UI", ([single]$px), $style, ([Drawing.GraphicsUnit]::Pixel)
}
function Txt($g, [string]$t, [double]$px, [bool]$bold, $color, [double]$x, [double]$y, [double]$w, [double]$h, [string]$align = 'Near') {
  $fmt = New-Object Drawing.StringFormat; $fmt.Alignment = $align
  $g.DrawString($t, (Font $px $bold), (New-Object Drawing.SolidBrush $color), (New-Object Drawing.RectangleF ([single]$x), ([single]$y), ([single]$w), ([single]$h)), $fmt)
}
function Logo($g, [double]$x, [double]$y, [double]$size, $c1, $c2) {
  $u = $size / 82.0; $w = [single](14 * $u)
  $p1 = New-Object Drawing.Pen $c1, $w; $p1.StartCap = 'Round'; $p1.EndCap = 'Round'
  $p2 = New-Object Drawing.Pen $c2, $w; $p2.StartCap = 'Round'; $p2.EndCap = 'Round'
  $g.DrawLine($p1, [single]($x + 15*$u), [single]($y + 48*$u), [single]($x + 32*$u), [single]($y + 65*$u))
  $g.FillEllipse((New-Object Drawing.SolidBrush $c1), [single]($x + 4*$u), [single]($y + 17*$u), [single](20*$u), [single](20*$u))
  $g.DrawLine($p2, [single]($x + 32*$u), [single]($y + 65*$u), [single]($x + 60*$u), [single]($y + 33*$u))
  $g.FillEllipse((New-Object Drawing.SolidBrush $c2), [single]($x + 57*$u), [single]($y + 3*$u), [single](20*$u), [single](20*$u))
}

$bmp = New-Object Drawing.Bitmap $W, $H
$g = [Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.Clear($claro)

# Franja superior
$g.FillRectangle((New-Object Drawing.SolidBrush $marino), 0, 0, $W, 560)
Logo $g $M 60 70 $blanco $amarillo
$f = Font 46 $true
$g.DrawString("Factor", $f, (New-Object Drawing.SolidBrush $blanco), [single]($M + 86), 66)
$w1 = $g.MeasureString("Factor", $f).Width - 14
$g.DrawString([string][char]0x00B7, $f, (New-Object Drawing.SolidBrush $amarillo), [single]($M + 86 + $w1), 66)
$w2 = $g.MeasureString([string][char]0x00B7, $f).Width - 18
$g.DrawString("Gente", (Font 46 $false), (New-Object Drawing.SolidBrush $blanco), [single]($M + 86 + $w1 + $w2), 66)
Txt $g "ESTUDIANTES Y EGRESADOS" 30 $true $amarillo $M 190 920 50
Txt $g "¿Buscas tu primer empleo o un mejor trabajo?" 72 $true $blanco $M 240 920 300

# Beneficios
$items = @("Registro gratis desde tu celular, en 5 minutos", "Vacantes en San Francisco del Rincón, Purísima y León", "Te conectamos con empresas donde tu perfil encaja", "Tus datos están protegidos")
$y = 610
foreach ($it in $items) {
  $g.FillEllipse((New-Object Drawing.SolidBrush $amarillo), [single]$M, [single]($y + 4), 40, 40)
  $p = New-Object Drawing.Pen $marino, 6; $p.StartCap = 'Round'; $p.EndCap = 'Round'; $p.LineJoin = 'Round'
  $g.DrawLines($p, [Drawing.PointF[]]@((New-Object Drawing.PointF ([single]($M+11)), ([single]($y+25))), (New-Object Drawing.PointF ([single]($M+18)), ([single]($y+32))), (New-Object Drawing.PointF ([single]($M+30)), ([single]($y+16)))))
  Txt $g $it 34 $true $marino ($M + 60) $y 520 90
  $y += 105
}

# QR
$qr = [Drawing.Image]::FromFile((Join-Path $dir "qr.png"))
$g.FillRectangle((New-Object Drawing.SolidBrush $blanco), 640, 600, 360, 360)
$g.DrawImage($qr, 650, 610, 340, 340)
$qr.Dispose()
Txt $g "Escanea y regístrate" 28 $true $marino 640 970 360 40 'Center'

# Pie
$g.FillRectangle((New-Object Drawing.SolidBrush $marino), 0, 1110, $W, 240)
Txt $g "factorgente.jcflorido.me" 54 $true $blanco 0 1160 $W 70 'Center'
Txt $g "Bolsa de trabajo con filtro · Es gratis para quienes buscan empleo" 28 $false $gris 0 1245 $W 50 'Center'

$bmp.Save((Join-Path $dir "cartel-estudiantes.png"), [Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "Listo"
