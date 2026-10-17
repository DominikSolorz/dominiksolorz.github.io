param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'brand'))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$logoPath=Join-Path $PSScriptRoot '..\..\kamera\assets\ds-logo.jpg'
$logo=[Drawing.Image]::FromFile((Resolve-Path -LiteralPath $logoPath))
function Write-BrandBitmap([string]$Name,[int]$Width,[int]$Height,[bool]$Large) {
 $bitmap=New-Object Drawing.Bitmap($Width,$Height)
 $graphics=[Drawing.Graphics]::FromImage($bitmap)
 try {
  $graphics.Clear([Drawing.Color]::FromArgb(12,13,16))
  $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $size=if($Large){132}else{48};$x=[int](($Width-$size)/2);$y=if($Large){35}else{3}
  $graphics.DrawImage($logo,$x,$y,$size,$size)
  if($Large){
   $font=New-Object Drawing.Font('Segoe UI',12,[Drawing.FontStyle]::Bold)
   $small=New-Object Drawing.Font('Segoe UI',8)
   $white=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(243,244,246))
   $red=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(220,41,68))
   try{$graphics.DrawString('HOME',$font,$white,20,190);$graphics.DrawString('SECURITY',$font,$red,20,213);$graphics.DrawString('Twoj panel monitoringu',$small,$white,20,260)}
   finally{$font.Dispose();$small.Dispose();$white.Dispose();$red.Dispose()}
  }
  $bitmap.Save((Join-Path $OutputDirectory $Name),[Drawing.Imaging.ImageFormat]::Bmp)
 } finally {$graphics.Dispose();$bitmap.Dispose()}
}
try {
 Write-BrandBitmap 'wizard.bmp' 164 314 $true
 Write-BrandBitmap 'wizard-small.bmp' 55 55 $false
 $iconBitmap=New-Object Drawing.Bitmap(256,256);$g=[Drawing.Graphics]::FromImage($iconBitmap)
 $memory=New-Object IO.MemoryStream
 try {
  $g.Clear([Drawing.Color]::White);$g.DrawImage($logo,0,0,256,256)
  $iconBitmap.Save($memory,[Drawing.Imaging.ImageFormat]::Png);$png=$memory.ToArray()
  $stream=[IO.File]::Create((Join-Path $OutputDirectory 'home-security.ico'));$writer=New-Object IO.BinaryWriter($stream)
  try{$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]1);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$png.Length);$writer.Write([uint32]22);$writer.Write($png)}finally{$writer.Dispose()}
 }finally{$g.Dispose();$iconBitmap.Dispose();$memory.Dispose()}
} finally {$logo.Dispose()}
