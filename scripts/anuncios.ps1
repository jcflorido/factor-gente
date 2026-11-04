# Genera las imágenes de los anuncios para empresas (1080x1080) en diseno/anuncios
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot "..\diseno\anuncios"
New-Item -ItemType Directory -Force $out | Out-Null

$marino = [Drawing.Color]::FromArgb(0x12, 0x39, 0x6A)
$azul = [Drawing.Color]::FromArgb(0x1F, 0x62, 0xB0)
$amarillo = [Drawing.Color]::FromArgb(0xF2, 0xC1, 0x4E)
$claro = [Drawing.Color]::FromArgb(0xF2, 0xF7, 0xFC)
$blanco = [Drawing.Color]::White
$gris = [Drawing.Color]::FromArgb(0xBF, 0xD5, 0xEE)
$S = 1080

function Font([double]$px, [bool]$bold) {
  $style = if ($bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
  New-Object Drawing.Font "Segoe UI", ([single]$px), $style, ([Drawing.GraphicsUnit]::Pixel)
}
function Txt($g, [string]$t, [double]$px, [bool]$bold, $color, [double]$x, [double]$y, [double]$w, [double]$h, [string]$align = 'Near') {
  $fmt = New-Object Drawing.StringFormat; $fmt.Alignment = $align; $fmt.LineAlignment = 'Near'
  $g.DrawString($t, (Font $px $bold), (New-Object Drawing.SolidBrush $color), (New-Object Drawing.RectangleF ([single]$x), ([single]$y), ([single]$w), ([single]$h)), $fmt)
}
# Logo A4: dos personas que forman una palomita
function Logo($g, [double]$x, [double]$y, [double]$size, $c1, $c2) {
  $u = $size / 82.0
  $w = [single](14 * $u)
  $p1 = New-Object Drawing.Pen $c1, $w; $p1.StartCap = 'Round'; $p1.EndCap = 'Round'
  $p2 = New-Object Drawing.Pen $c2, $w; $p2.StartCap = 'Round'; $p2.EndCap = 'Round'
  $g.DrawLine($p1, [single]($x + 15*$u), [single]($y + 48*$u), [single]($x + 32*$u), [single]($y + 65*$u))
  $g.FillEllipse((New-Object Drawing.SolidBrush $c1), [single]($x + 4*$u), [single]($y + 17*$u), [single](20*$u), [single](20*$u))
  $g.DrawLine($p2, [single]($x + 32*$u), [single]($y + 65*$u), [single]($x + 60*$u), [single]($y + 33*$u))
  $g.FillEllipse((New-Object Drawing.SolidBrush $c2), [single]($x + 57*$u), [single]($y + 3*$u), [single](20*$u), [single](20*$u))
}
function Marca($g, [double]$x, [double]$y, $cTexto, $cPunto, $c1, $c2) {
  Logo $g $x ($y - 6) 64 $c1 $c2
  $f = Font 44 $true
  $b = New-Object Drawing.SolidBrush $cTexto
  $g.DrawString("Factor", $f, $b, [single]($x + 78), [single]$y)
  $w1 = $g.MeasureString("Factor", $f).Width - 14
  $g.DrawString([string][char]0x00B7, $f, (New-Object Drawing.SolidBrush $cPunto), [single]($x + 78 + $w1), [single]$y)
  $w2 = $g.MeasureString([string][char]0x00B7, $f).Width - 18
  $g.DrawString("Gente", (Font 44 $false), $b, [single]($x + 78 + $w1 + $w2), [single]$y)
}
function Nuevo($fondo) {
  $bmp = New-Object Drawing.Bitmap $S, $S
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.Clear($fondo)
  return @($bmp, $g)
}
function Guardar($bmp, $g, [string]$name) { $bmp.Save((Join-Path $out $name), [Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose() }
function Check($g, [double]$x, [double]$y) {
  $g.FillEllipse((New-Object Drawing.SolidBrush $amarillo), [single]$x, [single]$y, 52, 52)
  $p = New-Object Drawing.Pen $marino, 7; $p.StartCap = 'Round'; $p.EndCap = 'Round'; $p.LineJoin = 'Round'
  $g.DrawLines($p, [Drawing.PointF[]]@((New-Object Drawing.PointF ([single]($x+14)), ([single]($y+27))), (New-Object Drawing.PointF ([single]($x+23)), ([single]($y+36))), (New-Object Drawing.PointF ([single]($x+39)), ([single]($y+17)))))
}
$M = 90  # margen

# 1. El problema
$r = Nuevo $marino; $b = $r[0]; $g = $r[1]
Txt $g "PARA EMPRESAS DE SFR · PURÍSIMA · LEÓN" 30 $true $amarillo $M 110 900 60
Txt $g "¿Contratas y a los dos meses ya se fueron?" 104 $true $blanco $M 200 900 520
Txt $g "Revisar currículums no es tu trabajo. Es el nuestro." 44 $false $gris $M 730 860 150
Marca $g $M 930 $blanco $amarillo $blanco $amarillo
Guardar $b $g "1-problema.png"

# 2. Cómo funciona
$r = Nuevo $claro; $b = $r[0]; $g = $r[1]
Txt $g "Tú solo subes tu vacante." 66 $true $marino $M 100 920 120
Txt $g "Nosotros hacemos el resto:" 46 $false $azul $M 205 900 70
$items = @("Revisamos experiencia, sueldo, horario y distancia de cada candidato", "Aplicamos pruebas de perfil", "Elegimos a los 2 o 3 que mejor encajan con tu puesto", "Coordinamos las entrevistas por ti")
$y = 330
foreach ($it in $items) { Check $g $M $y; Txt $g $it 42 $true $marino ($M + 80) ($y - 4) 820 120; $y += 140 }
Marca $g $M 930 $marino $amarillo $marino $amarillo
Guardar $b $g "2-como-funciona.png"

# 3. Sin riesgo
$r = Nuevo $marino; $b = $r[0]; $g = $r[1]
Txt $g "Pagas solo si contratas." 100 $true $blanco $M 170 900 260
$g.FillRectangle((New-Object Drawing.SolidBrush $amarillo), [single]$M, 470, 120, 10)
Txt $g "Y si la persona se va en los primeros 60 días, te enviamos un reemplazo sin costo." 50 $false $gris $M 530 880 260
Marca $g $M 930 $blanco $amarillo $blanco $amarillo
Guardar $b $g "3-sin-riesgo.png"

# 4. Llamado a la acción
$r = Nuevo $amarillo; $b = $r[0]; $g = $r[1]
Txt $g "Sube tu vacante en 5 minutos" 96 $true $marino $M 150 900 300
Txt $g "Menos tiempo perdido, menos rotación y gente que sí se queda." 46 $false $marino $M 460 880 160
$g.FillRectangle((New-Object Drawing.SolidBrush $marino), [single]$M, 680, 900, 120)
Txt $g "factorgente.jcflorido.me" 52 $true $blanco $M 708 900 80 'Center'
Marca $g $M 930 $marino $blanco $marino $blanco
Guardar $b $g "4-llamado.png"

# Imagen sola (anuncio de una sola imagen)
$r = Nuevo $marino; $b = $r[0]; $g = $r[1]
Txt $g "Tú subes la vacante." 80 $true $blanco $M 110 920 130
Txt $g "Nosotros encontramos a la persona." 80 $true $amarillo $M 225 920 260
Txt $g "Filtramos, aplicamos pruebas y te presentamos solo a quien encaja. Pagas solo si contratas." 44 $false $gris $M 520 880 220
Txt $g "factorgente.jcflorido.me" 44 $true $blanco $M 780 900 70
Marca $g $M 930 $blanco $amarillo $blanco $amarillo
Guardar $b $g "imagen-sola.png"

Write-Output "Listo: $out"
