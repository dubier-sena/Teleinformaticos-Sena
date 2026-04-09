param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$rootPath = (Resolve-Path -LiteralPath $Root).Path

$expectedRootHtml = @(
  "index.html",
  "panel-administrativo-usuarios.html",
  "calendario-academico-2026.html",
  "grupo-10a-guia-01-induccion.html",
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-01-induccion.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-06-planificar-informacion.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11b-guia-06-planificar-informacion.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html",
  "plantilla-grado-11-guia-06-planificar-informacion.html"
)

$legacyNames = @(
  "10a_guia.html",
  "10a_guia2.html",
  "10b_guia.html",
  "10b_guia2.html",
  "11a_guia.html",
  "11a_guia6.html",
  "11b_guia.html",
  "11b_guia6.html",
  "admin_usuarios.html",
  "calendario_2026.html",
  "grado_guia.html",
  "grado_guia6.html"
)

$requiredFiles = @(
  "js/portal_auth.js",
  "js/script.js",
  "js/script_guia6.js",
  "js/script_induccion.js",
  "js/guia_template.js",
  "js/index_auth.js",
  "tools/servidor_web_red.ps1",
  "tools/prueba_carga_servidor_local.ps1"
)

$unexpectedRootFiles = @(
  "CUsersPCAppDataLocalTempguia2_text.txt",
  "Cï€ºUsersPCAppDataLocalTempguia2_text.txt"
)

$allowedAliasFiles = @(
  "js/admin_usuarios.js",
  "js/script.js",
  "js/script_guia2.js",
  "js/script_guia6.js",
  "js/script_induccion.js",
  "js/guia_template.js"
)

$mojibakeMarkers = @(
  [string][char]0xFFFD,
  "Ã"
)

$issues = New-Object System.Collections.Generic.List[string]

function Add-Issue {
  param([string]$Message)
  $issues.Add($Message) | Out-Null
}

function Is-AllowedLegacyAliasReference {
  param(
    [string]$FilePath,
    [string]$LegacyName
  )

  $normalizedPath = $FilePath.Replace("\", "/")
  if ($LegacyName -in @("admin_usuarios.html", "calendario_2026.html")) {
    return $false
  }

  return $allowedAliasFiles | Where-Object { $normalizedPath.EndsWith($_) }
}

foreach ($file in $expectedRootHtml + $requiredFiles) {
  $path = Join-Path $rootPath $file
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    Add-Issue "Falta el archivo requerido: $file"
  }
}

foreach ($file in $legacyNames + $unexpectedRootFiles) {
  $path = Join-Path $rootPath $file
  if (Test-Path -LiteralPath $path) {
    Add-Issue "Sigue presente un archivo legado o temporal en la raiz: $file"
  }
}

$rootHtml = Get-ChildItem -LiteralPath $rootPath -Filter *.html -File | Select-Object -ExpandProperty Name
$missingHtml = @($expectedRootHtml | Where-Object { $_ -notin $rootHtml })
$extraHtml = @($rootHtml | Where-Object { $_ -notin $expectedRootHtml })
if ($missingHtml.Count -gt 0) {
  Add-Issue ("Faltan HTML esperados en la raiz: " + ($missingHtml -join ", "))
}
if ($extraHtml.Count -gt 0) {
  Add-Issue ("Hay HTML inesperados en la raiz: " + ($extraHtml -join ", "))
}

$tmpPath = Join-Path $rootPath "tmp"
if (Test-Path -LiteralPath $tmpPath) {
  $tmpHtml = Get-ChildItem -LiteralPath $tmpPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -eq ".html" }
  if ($tmpHtml) {
    Add-Issue ("Quedaron HTML temporales dentro de tmp: " + (($tmpHtml | Select-Object -ExpandProperty FullName) -join ", "))
  }
}

$scanFiles = @()
$scanFiles += Get-ChildItem -LiteralPath $rootPath -Filter *.html -File
$scanFiles += Get-ChildItem -LiteralPath (Join-Path $rootPath "js") -Recurse -Include *.js -File
$scanFiles += Get-ChildItem -LiteralPath (Join-Path $rootPath "css") -Recurse -Include *.css -File
$scanFiles += Get-ChildItem -LiteralPath (Join-Path $rootPath "tools") -Recurse -Include *.ps1,*.cmd -File
$scanFiles = $scanFiles | Where-Object { $_.Name -ne "validar_estructura_portal.ps1" }

foreach ($file in $scanFiles) {
  $content = Get-Content -LiteralPath $file.FullName -Raw

  foreach ($legacy in $legacyNames) {
    if ((Is-AllowedLegacyAliasReference -FilePath $file.FullName -LegacyName $legacy)) {
      continue
    }

    if ($content.Contains($legacy)) {
      Add-Issue "Referencia legada encontrada en $($file.FullName): $legacy"
    }
  }

  foreach ($marker in $mojibakeMarkers) {
    if ($content.Contains($marker)) {
      Add-Issue "Posible problema de codificacion en $($file.FullName): contiene '$marker'"
      break
    }
  }
}

if ($issues.Count -gt 0) {
  Write-Host ""
  Write-Host "Validacion fallida" -ForegroundColor Red
  Write-Host ""
  $issues | ForEach-Object { Write-Host "- $_" }
  exit 1
}

Write-Host ""
Write-Host "Validacion correcta" -ForegroundColor Green
Write-Host "- Estructura HTML consistente en raiz"
Write-Host "- Sin nombres legados detectados fuera de alias de compatibilidad"
Write-Host "- Sin marcadores obvios de mojibake en archivos revisados"
