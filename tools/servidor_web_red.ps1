param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$Port = 8080
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
$script:portalStorePath = Join-Path $script:resolvedRoot "tmp\portal_red_store.json"
$script:storeVersion = 2
$script:guideTitles = @{
  "grupo-10a-guia-01-induccion.html" = "Guía 1 - Inducción | Grupo 10A"
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html" = "Guía 2 - Operar herramientas informáticas y digitales | Grupo 10A"
  "grupo-10b-guia-01-induccion.html" = "Guía 1 - Inducción | Grupo 10B"
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html" = "Guía 2 - Operar herramientas informáticas y digitales | Grupo 10B"
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html" = "Guía 5 - Operar herramientas informáticas y digitales | Grupo 11A"
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html" = "Guía 5 - Operar herramientas informáticas y digitales | Grupo 11B"
  "grupo-11a-guia-06-planificar-informacion.html" = "Guía 6 - Planificar la información | Grupo 11A"
  "grupo-11b-guia-06-planificar-informacion.html" = "Guía 6 - Planificar la información | Grupo 11B"
}

$script:guideTitles["grupo-10a-guia-01-induccion.html"] = "Guia 1 - Induccion | Grupo 10A"
$script:guideTitles["grupo-10a-guia-02-herramientas-informaticas-digitales.html"] = "Guia 2 - Operar herramientas informaticas y digitales | Grupo 10A"
$script:guideTitles["grupo-10b-guia-01-induccion.html"] = "Guia 1 - Induccion | Grupo 10B"
$script:guideTitles["grupo-10b-guia-02-herramientas-informaticas-digitales.html"] = "Guia 2 - Operar herramientas informaticas y digitales | Grupo 10B"
$script:guideTitles["grupo-11a-guia-05-herramientas-informaticas-digitales.html"] = "Guia 5 - Operar herramientas informaticas y digitales | Grupo 11A"
$script:guideTitles["grupo-11b-guia-05-herramientas-informaticas-digitales.html"] = "Guia 5 - Operar herramientas informaticas y digitales | Grupo 11B"
$script:guideTitles["grupo-11a-guia-06-planificar-informacion.html"] = "Guia 6 - Planificar la informacion | Grupo 11A"
$script:guideTitles["grupo-11b-guia-06-planificar-informacion.html"] = "Guia 6 - Planificar la informacion | Grupo 11B"

$script:fichaMap = @{
  "3441939" = @{
    inst = "Institucion Educativa Jhon F. Kennedy"
    grupo = "10A"
    guias = @(
      "grupo-10a-guia-01-induccion.html",
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html"
    )
  }
  "3441942" = @{
    inst = "Institucion Educativa Jhon F. Kennedy"
    grupo = "10B"
    guias = @(
      "grupo-10b-guia-01-induccion.html",
      "grupo-10b-guia-02-herramientas-informaticas-digitales.html"
    )
  }
  "3441944" = @{
    inst = "Institucion Educativa Santa Barbara"
    grupo = "10A"
    guias = @("grupo-10a-guia-01-induccion.html")
  }
  "3441950" = @{
    inst = "Institucion Educativa Santa Barbara"
    grupo = "10B"
    guias = @("grupo-10b-guia-01-induccion.html")
  }
  "3168850" = @{
    inst = "Institucion Educativa Santa Barbara"
    grupo = "11A"
    guias = @("grupo-11a-guia-05-herramientas-informaticas-digitales.html", "grupo-11a-guia-06-planificar-informacion.html")
  }
  "3168852" = @{
    inst = "Institucion Educativa Santa Barbara"
    grupo = "11B"
    guias = @("grupo-11b-guia-05-herramientas-informaticas-digitales.html", "grupo-11b-guia-06-planificar-informacion.html")
  }
}
$script:adminProfile = @{
  fullName = "Dubier Orlando Millan Barbosa"
  username = "Dubier"
  usernameKey = "dubier"
  passwordHash = "d7ee7806b5161383528f4256cceb048a6cd50c80783eb6425428f832916361a7"
}
$script:firebaseProjectId = "sena-portal"
$script:firebaseApiKey = "AIzaSyC0zKUJGVcT0aYcujZyrRBtsbVo1VjBkAA"
$script:firebaseBaseUrl = "https://firestore.googleapis.com/v1/projects/$($script:firebaseProjectId)/databases/(default)/documents"
$script:firebaseProgressCollection = "sena_portal_progress"
$script:calendarFallbackPrefix = "__calendar__:"
$script:portalStore = $null

function Normalize-Text {
  param([object]$Value)
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }
  return $text.Trim()
}

function Normalize-Ficha {
  param([object]$Value)
  return ((Normalize-Text $Value) -replace "\D+", "")
}

function Normalize-Username {
  param([object]$Value)
  return (Normalize-Text $Value).ToLowerInvariant()
}

function Clamp-Number {
  param(
    [double]$Value,
    [double]$Min = 0,
    [double]$Max = 100
  )

  if ($Value -lt $Min) { return $Min }
  if ($Value -gt $Max) { return $Max }
  return $Value
}

function ConvertTo-HashtableRecursive {
  param([object]$Value)

  if ($null -eq $Value) {
    return $null
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $result = @{}
    foreach ($key in $Value.Keys) {
      $result[[string]$key] = ConvertTo-HashtableRecursive $Value[$key]
    }
    return $result
  }

  if ($Value -is [pscustomobject]) {
    $result = @{}
    foreach ($property in $Value.PSObject.Properties) {
      $result[$property.Name] = ConvertTo-HashtableRecursive $property.Value
    }
    return $result
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($item in $Value) {
      $items += ,(ConvertTo-HashtableRecursive $item)
    }
    return $items
  }

  return $Value
}

function Ensure-TmpDirectory {
  $tmpDir = Join-Path $script:resolvedRoot "tmp"
  if (-not (Test-Path -LiteralPath $tmpDir)) {
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
  }
  return $tmpDir
}

function Get-HtmlCharset {
  param([string]$Path)

  try {
    $fileStream = [System.IO.File]::OpenRead($Path)
    try {
      $sampleLength = [Math]::Min(4096, [int]$fileStream.Length)
      $buffer = New-Object byte[] $sampleLength
      [void]$fileStream.Read($buffer, 0, $buffer.Length)
      $sample = [System.Text.Encoding]::ASCII.GetString($buffer)
      $metaMatch = [regex]::Match(
        $sample,
        'charset\s*=\s*["'']?\s*([a-zA-Z0-9._-]+)',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
      )

      if ($metaMatch.Success) {
        return $metaMatch.Groups[1].Value.ToLowerInvariant()
      }
    }
    finally {
      $fileStream.Dispose()
    }
  }
  catch {
  }

  return "utf-8"
}

function Get-ContentType {
  param([string]$Path)

  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=$(Get-HtmlCharset -Path $Path)" }
    ".htm" { "text/html; charset=$(Get-HtmlCharset -Path $Path)" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".txt" { "text/plain; charset=utf-8" }
    ".svg" { "image/svg+xml" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".gif" { "image/gif" }
    ".webp" { "image/webp" }
    ".ico" { "image/x-icon" }
    ".pdf" { "application/pdf" }
    ".doc" { "application/msword" }
    ".docx" { "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    ".xls" { "application/vnd.ms-excel" }
    ".xlsx" { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    ".ppt" { "application/vnd.ms-powerpoint" }
    ".pptx" { "application/vnd.openxmlformats-officedocument.presentationml.presentation" }
    ".zip" { "application/zip" }
    ".mp4" { "video/mp4" }
    ".exe" { "application/octet-stream" }
    ".msi" { "application/octet-stream" }
    default { "application/octet-stream" }
  }
}

function Get-CacheControl {
  param([string]$Path)

  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "no-store, max-age=0" }
    ".htm" { "no-store, max-age=0" }
    ".css" { "no-store, max-age=0" }
    ".js" { "no-store, max-age=0" }
    ".json" { "no-store, max-age=0" }
    ".txt" { "no-store, max-age=0" }
    default { "public, max-age=86400" }
  }
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType = "text/plain; charset=utf-8",
    [byte[]]$Body = @(),
    [bool]$HeadOnly = $false,
    [hashtable]$Headers = @{},
    [string]$CacheControl = "no-store, max-age=0"
  )

  $writer = New-Object System.IO.StreamWriter($Stream, [Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 $StatusCode $StatusText")
  $writer.WriteLine("Content-Type: $ContentType")
  $writer.WriteLine("Content-Length: $($Body.Length)")
  $writer.WriteLine("Cache-Control: $CacheControl")
  if ($CacheControl -eq "no-store, max-age=0") {
    $writer.WriteLine("Pragma: no-cache")
  }
  $writer.WriteLine("X-Content-Type-Options: nosniff")
  $writer.WriteLine("Referrer-Policy: strict-origin-when-cross-origin")
  foreach ($header in $Headers.GetEnumerator()) {
    $writer.WriteLine(("{0}: {1}" -f $header.Key, $header.Value))
  }
  $writer.WriteLine("Connection: close")
  $writer.WriteLine()
  $writer.Flush()

  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
    $Stream.Flush()
  }
}

function Write-JsonResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [object]$Payload,
    [bool]$HeadOnly = $false,
    [hashtable]$Headers = @{}
  )

  $body = [System.Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Depth 12 -Compress))
  Write-Response `
    -Stream $Stream `
    -StatusCode $StatusCode `
    -StatusText $StatusText `
    -ContentType "application/json; charset=utf-8" `
    -Body $body `
    -HeadOnly:$HeadOnly `
    -Headers $Headers
}

function Write-FileResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [string]$FilePath,
    [bool]$HeadOnly = $false
  )

  $fileInfo = Get-Item -LiteralPath $FilePath
  $cacheControl = Get-CacheControl -Path $FilePath
  $writer = New-Object System.IO.StreamWriter($Stream, [Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 200 OK")
  $writer.WriteLine("Content-Type: $(Get-ContentType -Path $FilePath)")
  $writer.WriteLine("Content-Length: $($fileInfo.Length)")
  $writer.WriteLine("Cache-Control: $cacheControl")
  if ($cacheControl -eq "no-store, max-age=0") {
    $writer.WriteLine("Pragma: no-cache")
  }
  $writer.WriteLine("X-Content-Type-Options: nosniff")
  $writer.WriteLine("Referrer-Policy: strict-origin-when-cross-origin")
  $writer.WriteLine("Connection: close")
  $writer.WriteLine()
  $writer.Flush()

  if ($HeadOnly) {
    return
  }

  $fileStream = [System.IO.File]::OpenRead($FilePath)
  try {
    $buffer = New-Object byte[] 131072
    while (($read = $fileStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $Stream.Write($buffer, 0, $read)
    }
    $Stream.Flush()
  }
  finally {
    $fileStream.Dispose()
  }
}

function Get-NetworkProfiles {
  $profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4Connectivity -in @("Internet", "LocalNetwork") }

  if (-not $profiles) {
    return @()
  }

  $allIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    }

  $result = @(
    foreach ($profile in $profiles) {
      $ips = $allIps | Where-Object {
        ($_.InterfaceIndex -eq $profile.InterfaceIndex) -or
        ($_.InterfaceAlias -eq $profile.InterfaceAlias)
      }

      if (-not $ips) {
        continue
      }

      [pscustomobject]@{
        interfaceAlias = $profile.InterfaceAlias
        networkName = $profile.Name
        networkCategory = [string]$profile.NetworkCategory
        ipv4Connectivity = [string]$profile.IPv4Connectivity
        urls = @($ips | Sort-Object SkipAsSource | ForEach-Object { "http://$($_.IPAddress):$Port/" })
      }
    }
  )

  return $result
}

function Get-ServerStatus {
  $profiles = @(Get-NetworkProfiles)
  $urls = @($profiles | ForEach-Object { $_.urls } | Select-Object -Unique)

  [pscustomobject]@{
    running = $true
    port = $Port
    root = $script:resolvedRoot
    localhostUrl = "http://localhost:$Port/"
    localNetworkUrls = @($urls)
    primaryUrl = if ($urls.Count -gt 0) { $urls[0] } else { "http://localhost:$Port/" }
    networkProfiles = @($profiles)
    generatedAt = (Get-Date).ToString("o")
  }
}

function Save-ServerStatus {
  $tmpDir = Ensure-TmpDirectory
  $pidPath = Join-Path $tmpDir "servidor_red.pid"
  $statusPath = Join-Path $tmpDir "servidor_red_status.json"
  $status = Get-ServerStatus

  Set-Content -Path $pidPath -Value $PID -Encoding ASCII
  Set-Content -Path $statusPath -Value ($status | ConvertTo-Json -Depth 6) -Encoding UTF8
}

function Clear-ServerStatus {
  $tmpDir = Ensure-TmpDirectory
  Remove-Item -LiteralPath (Join-Path $tmpDir "servidor_red.pid") -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $tmpDir "servidor_red_status.json") -ErrorAction SilentlyContinue
}

function Write-ServerError {
  param(
    [string]$Context,
    [System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  try {
    $tmpDir = Ensure-TmpDirectory
    $logPath = Join-Path $tmpDir "servidor_red_error.log"
    $details = @(
      ("[{0}] {1}" -f (Get-Date).ToString("o"), $Context),
      ("Exception: {0}" -f $ErrorRecord.Exception.Message),
      ("Category : {0}" -f $ErrorRecord.CategoryInfo),
      ("Script   : {0}" -f $ErrorRecord.ScriptStackTrace),
      ""
    )
    Add-Content -Path $logPath -Value $details -Encoding UTF8
  }
  catch {
  }
}

function New-PortalStore {
  return @{
    version = $script:storeVersion
    users = @()
    sessions = @()
    guideProgress = @{}
    calendarSnapshots = @{}
  }
}

function Normalize-PortalStore {
  param([object]$Store)

  $normalized = if ($Store -is [hashtable]) { $Store } else { @{} }
  if (-not ($normalized.ContainsKey("version"))) {
    $normalized["version"] = $script:storeVersion
  }
  else {
    $normalized["version"] = [int]$normalized["version"]
  }

  if (-not ($normalized["users"] -is [System.Collections.IEnumerable]) -or ($normalized["users"] -is [string])) {
    $normalized["users"] = @()
  }
  else {
    $normalized["users"] = @($normalized["users"] | ForEach-Object {
      if ($_ -is [hashtable]) { $_ } else { ConvertTo-HashtableRecursive $_ }
    })
  }

  if (-not ($normalized["sessions"] -is [System.Collections.IEnumerable]) -or ($normalized["sessions"] -is [string])) {
    $normalized["sessions"] = @()
  }
  else {
    $normalized["sessions"] = @($normalized["sessions"] | ForEach-Object {
      if ($_ -is [hashtable]) { $_ } else { ConvertTo-HashtableRecursive $_ }
    })
  }

  if (-not ($normalized["guideProgress"] -is [hashtable])) {
    $normalized["guideProgress"] = @{}
  }
  else {
    $normalized["guideProgress"] = ConvertTo-HashtableRecursive $normalized["guideProgress"]
  }

  if (-not ($normalized["calendarSnapshots"] -is [hashtable])) {
    $normalized["calendarSnapshots"] = @{}
  }
  else {
    $normalized["calendarSnapshots"] = ConvertTo-HashtableRecursive $normalized["calendarSnapshots"]
  }

  return $normalized
}

function Load-PortalStore {
  Ensure-TmpDirectory | Out-Null
  if (-not (Test-Path -LiteralPath $script:portalStorePath -PathType Leaf)) {
    $store = New-PortalStore
    Set-Content -Path $script:portalStorePath -Value ($store | ConvertTo-Json -Depth 12) -Encoding UTF8
    return $store
  }

  try {
    $raw = Get-Content -LiteralPath $script:portalStorePath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return New-PortalStore
    }

    $parsed = ConvertFrom-Json -InputObject $raw
    return Normalize-PortalStore (ConvertTo-HashtableRecursive $parsed)
  }
  catch {
    return New-PortalStore
  }
}

function Save-PortalStore {
  Ensure-TmpDirectory | Out-Null
  Set-Content -Path $script:portalStorePath -Value ($script:portalStore | ConvertTo-Json -Depth 12) -Encoding UTF8
}

function Get-CalendarStoreMap {
  if (-not ($script:portalStore["calendarSnapshots"] -is [hashtable])) {
    $script:portalStore["calendarSnapshots"] = @{}
  }

  return $script:portalStore["calendarSnapshots"]
}

function Normalize-CalendarSnapshot {
  param(
    [string]$CalendarId,
    [object]$Snapshot
  )

  $raw = if ($Snapshot -is [hashtable]) { $Snapshot } else { ConvertTo-HashtableRecursive $Snapshot }
  if (-not ($raw -is [hashtable])) {
    $raw = @{}
  }

  $state = if ($raw["state"] -is [hashtable]) {
    ConvertTo-HashtableRecursive $raw["state"]
  }
  else {
    @{}
  }

  return @{
    calendarId = if (Normalize-Text $raw["calendarId"]) { Normalize-Text $raw["calendarId"] } else { Normalize-Text $CalendarId }
    version = if ($raw.ContainsKey("version")) { [int]$raw["version"] } else { 1 }
    updatedAt = if (Normalize-Text $raw["updatedAt"]) { Normalize-Text $raw["updatedAt"] } else { [DateTimeOffset]::UtcNow.ToString("o") }
    updatedBy = Normalize-Text $raw["updatedBy"]
    state = $state
  }
}

function Get-CalendarSnapshotFromStore {
  param([string]$CalendarId)

  $calendarKey = Normalize-Text $CalendarId
  if (-not $calendarKey) {
    $calendarKey = "default"
  }

  $map = Get-CalendarStoreMap
  if (-not $map.ContainsKey($calendarKey)) {
    return $null
  }

  return Normalize-CalendarSnapshot -CalendarId $calendarKey -Snapshot $map[$calendarKey]
}

function Save-CalendarSnapshotToStore {
  param(
    [string]$CalendarId,
    [object]$Snapshot
  )

  $calendarKey = Normalize-Text $CalendarId
  if (-not $calendarKey) {
    $calendarKey = "default"
  }

  $normalized = Normalize-CalendarSnapshot -CalendarId $calendarKey -Snapshot $Snapshot
  $map = Get-CalendarStoreMap
  $map[$calendarKey] = $normalized
  return $normalized
}

function Get-FirebaseCalendarDocId {
  param([string]$CalendarId)

  $calendarKey = Normalize-Text $CalendarId
  if (-not $calendarKey) {
    $calendarKey = "default"
  }

  return $script:calendarFallbackPrefix + $calendarKey
}

function Get-FirebaseDocumentUrl {
  param(
    [string]$Collection,
    [string]$DocumentId
  )

  return "$($script:firebaseBaseUrl)/$Collection/$([Uri]::EscapeDataString($DocumentId))?key=$($script:firebaseApiKey)"
}

function ConvertFrom-FirestoreValue {
  param([object]$Value)

  if ($null -eq $Value) {
    return $null
  }

  $propertyNames = @($Value.PSObject.Properties.Name)
  if ($propertyNames -contains "nullValue") {
    return $null
  }
  if ($propertyNames -contains "stringValue") {
    return [string]$Value.stringValue
  }
  if ($propertyNames -contains "integerValue") {
    return [int64]$Value.integerValue
  }
  if ($propertyNames -contains "doubleValue") {
    return [double]$Value.doubleValue
  }
  if ($propertyNames -contains "booleanValue") {
    return [bool]$Value.booleanValue
  }
  if ($propertyNames -contains "arrayValue") {
    $items = @()
    $values = if ($null -ne $Value.arrayValue -and $null -ne $Value.arrayValue.values) { @($Value.arrayValue.values) } else { @() }
    foreach ($entry in $values) {
      $items += ,(ConvertFrom-FirestoreValue $entry)
    }
    return $items
  }
  if ($propertyNames -contains "mapValue") {
    $result = @{}
    $fields = if ($null -ne $Value.mapValue -and $null -ne $Value.mapValue.fields) { $Value.mapValue.fields } else { $null }
    if ($null -ne $fields) {
      foreach ($property in $fields.PSObject.Properties) {
        $result[$property.Name] = ConvertFrom-FirestoreValue $property.Value
      }
    }
    return $result
  }

  return $null
}

function ConvertFrom-FirestoreDocument {
  param([object]$Document)

  if ($null -eq $Document -or $null -eq $Document.fields) {
    return $null
  }

  $result = @{}
  foreach ($property in $Document.fields.PSObject.Properties) {
    $result[$property.Name] = ConvertFrom-FirestoreValue $property.Value
  }
  return $result
}

function Get-CalendarSnapshotFromFirebase {
  param([string]$CalendarId)

  $calendarKey = Normalize-Text $CalendarId
  if (-not $calendarKey) {
    return $null
  }

  try {
    $documentId = Get-FirebaseCalendarDocId -CalendarId $calendarKey
    $response = Invoke-RestMethod -Uri (Get-FirebaseDocumentUrl -Collection $script:firebaseProgressCollection -DocumentId $documentId) -Method Get -TimeoutSec 20
    $plain = ConvertFrom-FirestoreDocument $response
    if (-not $plain) {
      return $null
    }

    if (Normalize-Text $plain["snapshotJson"]) {
      try {
        $parsed = ConvertFrom-Json -InputObject (Normalize-Text $plain["snapshotJson"])
        return Normalize-CalendarSnapshot -CalendarId $calendarKey -Snapshot (ConvertTo-HashtableRecursive $parsed)
      }
      catch {
      }
    }

    return Normalize-CalendarSnapshot -CalendarId $calendarKey -Snapshot $plain
  }
  catch {
    return $null
  }
}

function Save-CalendarSnapshotToFirebase {
  param(
    [string]$CalendarId,
    [object]$Snapshot
  )

  $calendarKey = Normalize-Text $CalendarId
  if (-not $calendarKey) {
    return @{
      ok = $false
      message = "No se indico el calendario que debe sincronizarse."
    }
  }

  $normalized = Normalize-CalendarSnapshot -CalendarId $calendarKey -Snapshot $Snapshot
  $documentId = Get-FirebaseCalendarDocId -CalendarId $calendarKey
  $snapshotJson = $normalized | ConvertTo-Json -Depth 30 -Compress
  $payload = @{
    fields = @{
      _usernameKey = @{ stringValue = $documentId }
      _kind = @{ stringValue = "calendar" }
      calendarId = @{ stringValue = $normalized["calendarId"] }
      updatedAt = @{ stringValue = $normalized["updatedAt"] }
      updatedBy = @{ stringValue = (Normalize-Text $normalized["updatedBy"]) }
      version = @{ integerValue = [string]([int]$normalized["version"]) }
      snapshotJson = @{ stringValue = $snapshotJson }
    }
  }

  try {
    $response = Invoke-WebRequest `
      -Uri (Get-FirebaseDocumentUrl -Collection $script:firebaseProgressCollection -DocumentId $documentId) `
      -Method Patch `
      -ContentType "application/json; charset=utf-8" `
      -Body ($payload | ConvertTo-Json -Depth 20 -Compress) `
      -TimeoutSec 25 `
      -UseBasicParsing

    return @{
      ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
      message = ""
    }
  }
  catch {
    return @{
      ok = $false
      message = $_.Exception.Message
    }
  }
}

function Parse-IsoDate {
  param([object]$Value)

  $text = Normalize-Text $Value
  if (-not $text) {
    return $null
  }

  try {
    return [DateTimeOffset]::Parse($text)
  }
  catch {
    return $null
  }
}

function Cleanup-Sessions {
  $now = [DateTimeOffset]::UtcNow
  $script:portalStore["sessions"] = @($script:portalStore["sessions"] | Where-Object {
    $expiresAt = Parse-IsoDate $_["expiresAt"]
    $lastSeenAt = Parse-IsoDate $_["lastSeenAt"]
    if (-not $expiresAt) { return $false }
    if ($expiresAt -lt $now) { return $false }
    if ($lastSeenAt -and $lastSeenAt.AddDays(21) -lt $now) { return $false }
    return $true
  })
}

function Get-FichaInfo {
  param([object]$Ficha)
  return $script:fichaMap[(Normalize-Ficha $Ficha)]
}

function Get-GuidesForFicha {
  param([object]$Ficha)
  $info = Get-FichaInfo $Ficha
  if ($null -eq $info) {
    return @()
  }
  return @($info["guias"])
}

function Sanitize-UserForClient {
  param([hashtable]$User)

  return @{
    id = Normalize-Text $User["id"]
    fullName = Normalize-Text $User["fullName"]
    username = Normalize-Text $User["username"]
    usernameKey = Normalize-Username $User["usernameKey"]
    ficha = Normalize-Ficha $User["ficha"]
    inst = Normalize-Text $User["inst"]
    grupo = Normalize-Text $User["grupo"]
    createdAt = Normalize-Text $User["createdAt"]
    updatedAt = Normalize-Text $User["updatedAt"]
  }
}

function Build-ProgressResult {
  param(
    [string]$FileName,
    [int]$Completed,
    [int]$Total,
    [string]$Source,
    [string]$UpdatedAt
  )

  $safeTotal = [Math]::Max(0, $Total)
  $safeCompleted = [Math]::Max(0, [Math]::Min($safeTotal, $Completed))
  $percent = if ($safeTotal -gt 0) { [int][Math]::Round(($safeCompleted / $safeTotal) * 100) } else { 0 }

  return @{
    fileName = $FileName
    title = if ($script:guideTitles.ContainsKey($FileName)) { $script:guideTitles[$FileName] } else { $FileName }
    completed = $safeCompleted
    total = $safeTotal
    percent = $percent
    updatedAt = Normalize-Text $UpdatedAt
    source = if (Normalize-Text $Source) { $Source } else { "network" }
  }
}

function Get-UserGuideProgressMap {
  param([string]$UsernameKey)

  if (-not $script:portalStore["guideProgress"].ContainsKey($UsernameKey)) {
    $script:portalStore["guideProgress"][$UsernameKey] = @{}
  }

  return $script:portalStore["guideProgress"][$UsernameKey]
}

function Get-UserProgressSummary {
  param([hashtable]$User)

  $guides = @()
  foreach ($fileName in (Get-GuidesForFicha $User["ficha"])) {
    $userProgressMap = Get-UserGuideProgressMap (Normalize-Username $User["usernameKey"])
    $entry = if ($userProgressMap.ContainsKey($fileName)) { $userProgressMap[$fileName] } else { $null }

    if ($entry) {
      $entryCompleted = if ($entry.ContainsKey("completed")) { [int]$entry["completed"] } else { 0 }
      $entryTotal = if ($entry.ContainsKey("total")) { [int]$entry["total"] } else { 0 }
      $guides += ,(Build-ProgressResult `
        -FileName $fileName `
        -Completed $entryCompleted `
        -Total $entryTotal `
        -Source "network" `
        -UpdatedAt (Normalize-Text $entry["updatedAt"]))
    }
    else {
      $guides += ,(Build-ProgressResult -FileName $fileName -Completed 0 -Total 0 -Source "network" -UpdatedAt "")
    }
  }

  $completed = 0
  $total = 0
  foreach ($guide in $guides) {
    $completed += [int]$guide["completed"]
    $total += [int]$guide["total"]
  }

  $percent = if ($total -gt 0) { [int][Math]::Round(($completed / $total) * 100) } else { 0 }

  return @{
    guides = $guides
    completed = $completed
    total = $total
    percent = $percent
  }
}

function Get-StudentsWithProgress {
  return @(
    $script:portalStore["users"] |
      Sort-Object { Normalize-Text $_["fullName"] } |
      ForEach-Object {
        $safeUser = Sanitize-UserForClient $_
        $safeUser["progress"] = Get-UserProgressSummary $_
        $safeUser
      }
  )
}

function Find-UserIndex {
  param([string]$UsernameKey)

  $normalized = Normalize-Username $UsernameKey
  for ($index = 0; $index -lt $script:portalStore["users"].Count; $index += 1) {
    if ((Normalize-Username $script:portalStore["users"][$index]["usernameKey"]) -eq $normalized) {
      return $index
    }
  }

  return -1
}

function Get-UserByUsernameKey {
  param([string]$UsernameKey)

  $index = Find-UserIndex $UsernameKey
  if ($index -lt 0) {
    return $null
  }

  return $script:portalStore["users"][$index]
}

function New-SessionToken {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  }
  finally {
    $rng.Dispose()
  }

  return ([Convert]::ToBase64String($bytes)).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-SessionRecord {
  param(
    [string]$Role,
    [string]$UsernameKey
  )

  $now = [DateTimeOffset]::UtcNow
  return @{
    token = New-SessionToken
    role = Normalize-Text $Role
    usernameKey = Normalize-Username $UsernameKey
    createdAt = $now.ToString("o")
    lastSeenAt = $now.ToString("o")
    expiresAt = $now.AddDays(14).ToString("o")
  }
}

function Resolve-RequestToken {
  param(
    [hashtable]$Headers,
    [Uri]$Uri,
    [hashtable]$Body
  )

  foreach ($name in @("X-Portal-Token", "x-portal-token")) {
    if ($Headers.ContainsKey($name) -and (Normalize-Text $Headers[$name])) {
      return Normalize-Text $Headers[$name]
    }
  }

  if ($Uri.Query) {
    $query = [System.Web.HttpUtility]::ParseQueryString($Uri.Query)
    if (Normalize-Text $query["token"]) {
      return Normalize-Text $query["token"]
    }
  }

  if ($Body -and (Normalize-Text $Body["token"])) {
    return Normalize-Text $Body["token"]
  }

  return ""
}

function Get-SessionByToken {
  param([string]$Token)

  Cleanup-Sessions
  if (-not (Normalize-Text $Token)) {
    return $null
  }

  foreach ($session in $script:portalStore["sessions"]) {
    if ((Normalize-Text $session["token"]) -eq $Token) {
      $session["lastSeenAt"] = [DateTimeOffset]::UtcNow.ToString("o")
      return $session
    }
  }

  return $null
}

function Get-AdminSessionFromRequest {
  param(
    [hashtable]$Request,
    [Uri]$Uri,
    [hashtable]$Body = $null
  )

  $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $Body
  $session = Get-SessionByToken $token
  if (-not $session -or (Normalize-Text $session["role"]) -ne "admin") {
    return $null
  }

  return $session
}

function Validate-StudentPayload {
  param([hashtable]$Data)

  $fullName = Normalize-Text $Data["fullName"]
  $username = Normalize-Text $Data["username"]
  $usernameKey = Normalize-Username $Data["usernameKey"]
  if (-not $usernameKey) {
    $usernameKey = Normalize-Username $username
  }
  $ficha = Normalize-Ficha $Data["ficha"]
  $passwordHash = Normalize-Text $Data["passwordHash"]

  if ($fullName.Length -lt 6) {
    return @{ ok = $false; message = "Ingresa el nombre completo del aprendiz." }
  }

  if ($username -notmatch "^[a-zA-Z0-9._-]{3,30}$") {
    return @{
      ok = $false
      message = "El nombre de usuario debe tener entre 3 y 30 caracteres y solo usar letras, numeros, punto, guion o guion bajo."
    }
  }

  if ($usernameKey -eq $script:adminProfile["usernameKey"]) {
    return @{ ok = $false; message = "Ese nombre de usuario esta reservado para el administrador." }
  }

  if (-not (Get-FichaInfo $ficha)) {
    return @{ ok = $false; message = "La ficha no existe en el portal. Verifica el numero e intenta de nuevo." }
  }

  if ($passwordHash -notmatch "^[a-f0-9]{64}$") {
    return @{ ok = $false; message = "No fue posible validar la contrasena. Recarga el portal e intenta otra vez." }
  }

  return @{
    ok = $true
    fullName = $fullName
    username = $username
    usernameKey = $usernameKey
    ficha = $ficha
    passwordHash = $passwordHash
  }
}

function Upsert-ProgressEntry {
  param(
    [string]$UsernameKey,
    [string]$FileName,
    [hashtable]$Progress
  )

  $user = Get-UserByUsernameKey $UsernameKey
  if (-not $user) {
    return
  }

  if ((Get-GuidesForFicha $user["ficha"]) -notcontains $FileName) {
    return
  }

  $rawCompleted = if ($Progress.ContainsKey("completed")) { [double]$Progress["completed"] } else { 0 }
  $rawTotal = if ($Progress.ContainsKey("total")) { [double]$Progress["total"] } else { 0 }
  $completed = [int](Clamp-Number -Value $rawCompleted -Min 0 -Max 100000)
  $total = [int](Clamp-Number -Value $rawTotal -Min 0 -Max 100000)
  if ($completed -gt $total -and $total -gt 0) {
    $completed = $total
  }
  $updatedAt = Normalize-Text $Progress["updatedAt"]
  if (-not $updatedAt) {
    $updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
  }

  $map = Get-UserGuideProgressMap (Normalize-Username $UsernameKey)
  $current = if ($map.ContainsKey($FileName)) { $map[$FileName] } else { $null }
  if ($current) {
    $currentDate = Parse-IsoDate $current["updatedAt"]
    $incomingDate = Parse-IsoDate $updatedAt
    if ($currentDate -and $incomingDate -and $incomingDate -lt $currentDate) {
      return
    }
  }

  $map[$FileName] = @{
    completed = $completed
    total = $total
    percent = if ($total -gt 0) { [int][Math]::Round(($completed / $total) * 100) } else { 0 }
    updatedAt = $updatedAt
  }
}

function Ensure-PortalStoreLoaded {
  if (-not $script:portalStore) {
    $script:portalStore = Load-PortalStore
  }
}

function Is-ProtectedRelativePath {
  param([string]$RelativePath)

  $normalized = ($RelativePath -replace "\\", "/").ToLowerInvariant()
  return (
    $normalized.StartsWith("tmp/portal_red_store") -or
    $normalized.StartsWith("tmp/servidor_red") -or
    $normalized.EndsWith(".pid")
  )
}

function Find-HeaderEnd {
  param(
    [byte[]]$Bytes,
    [int]$Length
  )

  for ($index = 0; $index -le ($Length - 4); $index += 1) {
    if (
      $Bytes[$index] -eq 13 -and
      $Bytes[$index + 1] -eq 10 -and
      $Bytes[$index + 2] -eq 13 -and
      $Bytes[$index + 3] -eq 10
    ) {
      return $index
    }
  }

  return -1
}

function Read-HttpRequest {
  param([System.Net.Sockets.NetworkStream]$Stream)

  $buffer = New-Object byte[] 4096
  $headerStream = New-Object System.IO.MemoryStream
  $headerEnd = -1

  try {
    while ($headerStream.Length -lt 65536 -and $headerEnd -lt 0) {
      $read = $Stream.Read($buffer, 0, $buffer.Length)
      if ($read -le 0) {
        break
      }

      $headerStream.Write($buffer, 0, $read)
      $headerEnd = Find-HeaderEnd -Bytes $headerStream.GetBuffer() -Length ([int]$headerStream.Length)
    }

    if ($headerEnd -lt 0) {
      return $null
    }

    $allBytes = $headerStream.ToArray()
    $headerLength = $headerEnd + 4
    $headerText = [Text.Encoding]::ASCII.GetString($allBytes, 0, $headerLength)
    $headerLines = $headerText -split "`r`n"
    if (-not $headerLines -or [string]::IsNullOrWhiteSpace($headerLines[0])) {
      return $null
    }

    $requestLine = $headerLines[0].Trim()
    $requestParts = $requestLine.Split(" ")
    $method = if ($requestParts.Length -gt 0) { $requestParts[0].ToUpperInvariant() } else { "GET" }
    $rawTarget = if ($requestParts.Length -gt 1) { $requestParts[1] } else { "/" }

    $headers = @{}
    if ($headerLines.Length -gt 1) {
      foreach ($line in $headerLines[1..($headerLines.Length - 1)]) {
        if ([string]::IsNullOrWhiteSpace($line)) {
          continue
        }

        $separator = $line.IndexOf(":")
        if ($separator -le 0) {
          continue
        }

        $name = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        if ($name) {
          $headers[$name] = $value
        }
      }
    }

    $contentLength = 0
    if ($headers.ContainsKey("Content-Length")) {
      [void][int]::TryParse([string]$headers["Content-Length"], [ref]$contentLength)
    }

    $bodyBytes = @()
    if ($contentLength -gt 0) {
      $bodyStream = New-Object System.IO.MemoryStream
      try {
        $alreadyRead = $allBytes.Length - $headerLength
        if ($alreadyRead -gt 0) {
          $copyLength = [Math]::Min($alreadyRead, $contentLength)
          $bodyStream.Write($allBytes, $headerLength, $copyLength)
        }

        while ($bodyStream.Length -lt $contentLength) {
          $chunkSize = [Math]::Min($buffer.Length, $contentLength - [int]$bodyStream.Length)
          $read = $Stream.Read($buffer, 0, $chunkSize)
          if ($read -le 0) {
            break
          }
          $bodyStream.Write($buffer, 0, $read)
        }

        $bodyBytes = $bodyStream.ToArray()
      }
      finally {
        $bodyStream.Dispose()
      }
    }

    return @{
      Method = $method
      RawTarget = $rawTarget
      Headers = $headers
      BodyBytes = $bodyBytes
      RequestLine = $requestLine
    }
  }
  finally {
    $headerStream.Dispose()
  }
}

function Get-RequestBodyText {
  param([hashtable]$Request)

  if (-not $Request["BodyBytes"] -or $Request["BodyBytes"].Length -eq 0) {
    return ""
  }

  $charset = "utf-8"
  $contentType = Normalize-Text $Request["Headers"]["Content-Type"]
  if ($contentType -match "charset\s*=\s*([a-zA-Z0-9._-]+)") {
    $charset = $matches[1]
  }

  try {
    $encoding = [Text.Encoding]::GetEncoding($charset)
  }
  catch {
    $encoding = [Text.Encoding]::UTF8
  }

  return $encoding.GetString($Request["BodyBytes"])
}

function Read-JsonBody {
  param([hashtable]$Request)

  $text = Get-RequestBodyText $Request
  if (-not $text) {
    return @{}
  }

  try {
    return ConvertTo-HashtableRecursive (ConvertFrom-Json -InputObject $text)
  }
  catch {
    throw "El cuerpo JSON no es valido."
  }
}

function Handle-ApiRequest {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [hashtable]$Request,
    [Uri]$Uri
  )

  Ensure-PortalStoreLoaded
  Cleanup-Sessions

  $method = $Request["Method"]
  $path = $Uri.AbsolutePath.ToLowerInvariant()
  $body = $null
  if ($method -eq "POST") {
    $body = Read-JsonBody $Request
  }

  switch ($path) {
    "/api/portal/capabilities" {
      if ($method -ne "GET" -and $method -ne "HEAD") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -HeadOnly:($method -eq "HEAD") -Payload @{
        ok = $true
        sharedStore = $true
        server = "portal-red-local"
        version = $script:storeVersion
        generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
      }
      return $true
    }

    "/api/auth/migrate-local" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $syncedUsers = 0
      $syncedProgress = 0
      $incomingUsers = if ($body["users"] -is [System.Collections.IEnumerable] -and -not ($body["users"] -is [string])) { @($body["users"]) } else { @() }
      $incomingProgress = if ($body["guideProgress"] -is [System.Collections.IEnumerable] -and -not ($body["guideProgress"] -is [string])) { @($body["guideProgress"]) } else { @() }

      foreach ($rawUser in $incomingUsers) {
        $candidate = if ($rawUser -is [hashtable]) { $rawUser } else { ConvertTo-HashtableRecursive $rawUser }
        $validation = Validate-StudentPayload @{
          fullName = $candidate["fullName"]
          username = $candidate["username"]
          usernameKey = $candidate["usernameKey"]
          ficha = $candidate["ficha"]
          passwordHash = $candidate["passwordHash"]
        }

        if (-not $validation["ok"]) {
          continue
        }

        $selection = Get-FichaInfo $validation["ficha"]
        $existingIndex = Find-UserIndex $validation["usernameKey"]
        if ($existingIndex -lt 0) {
          $incomingId = Normalize-Text $candidate["id"]
          $script:portalStore["users"] += ,@{
            id = if ($incomingId) { $incomingId } else { "student_" + [Guid]::NewGuid().ToString("N") }
            fullName = $validation["fullName"]
            username = $validation["username"]
            usernameKey = $validation["usernameKey"]
            ficha = $validation["ficha"]
            inst = $selection["inst"]
            grupo = $selection["grupo"]
            passwordHash = $validation["passwordHash"]
            createdAt = if (Normalize-Text $candidate["createdAt"]) { Normalize-Text $candidate["createdAt"] } else { [DateTimeOffset]::UtcNow.ToString("o") }
            updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
          }
          $syncedUsers += 1
        }
        else {
          $existing = $script:portalStore["users"][$existingIndex]
          if ((Normalize-Text $existing["passwordHash"]) -eq $validation["passwordHash"]) {
            $existing["fullName"] = $validation["fullName"]
            $existing["username"] = $validation["username"]
            $existing["ficha"] = $validation["ficha"]
            $existing["inst"] = $selection["inst"]
            $existing["grupo"] = $selection["grupo"]
            $existing["updatedAt"] = [DateTimeOffset]::UtcNow.ToString("o")
          }
        }
      }

      foreach ($rawProgress in $incomingProgress) {
        $candidate = if ($rawProgress -is [hashtable]) { $rawProgress } else { ConvertTo-HashtableRecursive $rawProgress }
        $usernameKey = Normalize-Username $candidate["usernameKey"]
        $fileName = Normalize-Text $candidate["fileName"]
        if (-not $usernameKey -or -not $fileName) {
          continue
        }

        Upsert-ProgressEntry -UsernameKey $usernameKey -FileName $fileName -Progress @{
          completed = $candidate["completed"]
          total = $candidate["total"]
          updatedAt = $candidate["updatedAt"]
        }
        $syncedProgress += 1
      }

      Save-PortalStore
      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{
        ok = $true
        syncedUsers = $syncedUsers
        syncedProgress = $syncedProgress
      }
      return $true
    }

    "/api/auth/register" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $validation = Validate-StudentPayload $body
      if (-not $validation["ok"]) {
        Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Payload $validation
        return $true
      }

      if ((Find-UserIndex $validation["usernameKey"]) -ge 0) {
        Write-JsonResponse -Stream $Stream -StatusCode 409 -StatusText "Conflict" -Payload @{
          ok = $false
          message = "Ese nombre de usuario ya existe. Usa otro diferente."
        }
        return $true
      }

      $selection = Get-FichaInfo $validation["ficha"]
      $user = @{
        id = "student_" + [Guid]::NewGuid().ToString("N")
        fullName = $validation["fullName"]
        username = $validation["username"]
        usernameKey = $validation["usernameKey"]
        ficha = $validation["ficha"]
        inst = $selection["inst"]
        grupo = $selection["grupo"]
        passwordHash = $validation["passwordHash"]
        createdAt = [DateTimeOffset]::UtcNow.ToString("o")
        updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
      }

      $script:portalStore["users"] += ,$user
      $session = New-SessionRecord -Role "student" -UsernameKey $user["usernameKey"]
      $script:portalStore["sessions"] += ,$session
      Save-PortalStore

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{
        ok = $true
        user = (Sanitize-UserForClient $user)
        session = @{
          role = "student"
          token = $session["token"]
          usernameKey = $user["usernameKey"]
          loggedAt = $session["createdAt"]
        }
      }
      return $true
    }

    "/api/auth/login" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $loginName = if (Normalize-Text $body["usernameKey"]) { $body["usernameKey"] } else { $body["username"] }
      $usernameKey = Normalize-Username $loginName
      $passwordHash = Normalize-Text $body["passwordHash"]
      if (-not $usernameKey -or -not $passwordHash) {
        Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Payload @{
          ok = $false
          message = "Ingresa el nombre de usuario y la contrasena."
        }
        return $true
      }

      $user = Get-UserByUsernameKey $usernameKey
      if (-not $user) {
        Write-JsonResponse -Stream $Stream -StatusCode 404 -StatusText "Not Found" -Payload @{
          ok = $false
          message = "No existe un usuario registrado con ese nombre."
        }
        return $true
      }

      if ((Normalize-Text $user["passwordHash"]) -ne $passwordHash) {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Payload @{
          ok = $false
          message = "La contrasena no es correcta."
        }
        return $true
      }

      $user["updatedAt"] = [DateTimeOffset]::UtcNow.ToString("o")
      $session = New-SessionRecord -Role "student" -UsernameKey $user["usernameKey"]
      $script:portalStore["sessions"] += ,$session
      Save-PortalStore

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{
        ok = $true
        user = (Sanitize-UserForClient $user)
        session = @{
          role = "student"
          token = $session["token"]
          usernameKey = $user["usernameKey"]
          loggedAt = $session["createdAt"]
        }
      }
      return $true
    }

    "/api/auth/admin/login" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $passwordHash = Normalize-Text $body["passwordHash"]
      if (-not $passwordHash) {
        Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Payload @{
          ok = $false
          message = "Ingresa la clave del administrador."
        }
        return $true
      }

      if ($passwordHash -ne $script:adminProfile["passwordHash"]) {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Payload @{
          ok = $false
          message = "La contrasena del administrador no es correcta."
        }
        return $true
      }

      $session = New-SessionRecord -Role "admin" -UsernameKey $script:adminProfile["usernameKey"]
      $script:portalStore["sessions"] += ,$session
      Save-PortalStore

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{
        ok = $true
        admin = @{
          role = "admin"
          fullName = $script:adminProfile["fullName"]
          username = $script:adminProfile["username"]
          usernameKey = $script:adminProfile["usernameKey"]
        }
        session = @{
          role = "admin"
          token = $session["token"]
          usernameKey = $script:adminProfile["usernameKey"]
          loggedAt = $session["createdAt"]
        }
      }
      return $true
    }

    "/api/auth/logout" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $body
      if ($token) {
        $script:portalStore["sessions"] = @($script:portalStore["sessions"] | Where-Object {
          (Normalize-Text $_["token"]) -ne $token
        })
        Save-PortalStore
      }

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{ ok = $true }
      return $true
    }

    "/api/progress" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $body
      $session = Get-SessionByToken $token
      if (-not $session -or (Normalize-Text $session["role"]) -ne "student") {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Payload @{
          ok = $false
          message = "La sesion del aprendiz no es valida."
        }
        return $true
      }

      $fileName = Normalize-Text $body["fileName"]
      if (-not $fileName) {
        Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Payload @{
          ok = $false
          message = "No se indico la guia que debe sincronizarse."
        }
        return $true
      }

      Upsert-ProgressEntry -UsernameKey $session["usernameKey"] -FileName $fileName -Progress @{
        completed = $body["completed"]
        total = $body["total"]
        updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
      }
      Save-PortalStore

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{ ok = $true }
      return $true
    }

    "/api/admin/users" {
      if ($method -ne "GET" -and $method -ne "HEAD") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $body
      $session = Get-SessionByToken $token
      if (-not $session -or (Normalize-Text $session["role"]) -ne "admin") {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -HeadOnly:($method -eq "HEAD") -Payload @{
          ok = $false
          message = "La sesion administrativa no es valida."
        }
        return $true
      }

      Save-PortalStore
      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -HeadOnly:($method -eq "HEAD") -Payload @{
        ok = $true
        users = @(Get-StudentsWithProgress)
      }
      return $true
    }

    "/api/admin/password" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $body
      $session = Get-SessionByToken $token
      if (-not $session -or (Normalize-Text $session["role"]) -ne "admin") {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Payload @{
          ok = $false
          message = "La sesion administrativa no es valida."
        }
        return $true
      }

      $usernameKey = Normalize-Username $body["usernameKey"]
      $passwordHash = Normalize-Text $body["passwordHash"]
      if (-not $usernameKey -or $passwordHash -notmatch "^[a-f0-9]{64}$") {
        Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Payload @{
          ok = $false
          message = "La nueva contrasena no es valida."
        }
        return $true
      }

      $user = Get-UserByUsernameKey $usernameKey
      if (-not $user) {
        Write-JsonResponse -Stream $Stream -StatusCode 404 -StatusText "Not Found" -Payload @{
          ok = $false
          message = "No se encontro el usuario solicitado."
        }
        return $true
      }

      $user["passwordHash"] = $passwordHash
      $user["updatedAt"] = [DateTimeOffset]::UtcNow.ToString("o")
      Save-PortalStore

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{
        ok = $true
        user = (Sanitize-UserForClient $user)
      }
      return $true
    }

    "/api/admin/reset-guide" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $body
      $session = Get-SessionByToken $token
      if (-not $session -or (Normalize-Text $session["role"]) -ne "admin") {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Payload @{
          ok = $false
          message = "La sesion administrativa no es valida."
        }
        return $true
      }

      $usernameKey = Normalize-Username $body["usernameKey"]
      $fileName = Normalize-Text $body["fileName"]
      $user = Get-UserByUsernameKey $usernameKey
      if (-not $user -or -not $fileName) {
        Write-JsonResponse -Stream $Stream -StatusCode 404 -StatusText "Not Found" -Payload @{
          ok = $false
          message = "No se encontro el usuario o la guia solicitada."
        }
        return $true
      }

      $map = Get-UserGuideProgressMap $usernameKey
      if ($map.ContainsKey($fileName)) {
        $map.Remove($fileName)
      }
      Save-PortalStore

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{ ok = $true }
      return $true
    }

    "/api/admin/reset-all" {
      if ($method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $body
      $session = Get-SessionByToken $token
      if (-not $session -or (Normalize-Text $session["role"]) -ne "admin") {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Payload @{
          ok = $false
          message = "La sesion administrativa no es valida."
        }
        return $true
      }

      $usernameKey = Normalize-Username $body["usernameKey"]
      $user = Get-UserByUsernameKey $usernameKey
      if (-not $user) {
        Write-JsonResponse -Stream $Stream -StatusCode 404 -StatusText "Not Found" -Payload @{
          ok = $false
          message = "No se encontro el usuario solicitado."
        }
        return $true
      }

      [void]$script:portalStore["guideProgress"].Remove($usernameKey)
      Save-PortalStore

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{ ok = $true }
      return $true
    }

    "/api/admin/calendar" {
      if ($method -ne "GET" -and $method -ne "HEAD" -and $method -ne "POST") {
        Write-JsonResponse -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Payload @{ ok = $false; message = "Metodo no permitido." }
        return $true
      }

      $token = Resolve-RequestToken -Headers $Request["Headers"] -Uri $Uri -Body $body
      $session = Get-SessionByToken $token
      if (-not $session -or (Normalize-Text $session["role"]) -ne "admin") {
        Write-JsonResponse -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -HeadOnly:($method -eq "HEAD") -Payload @{
          ok = $false
          message = "La sesion administrativa no es valida."
        }
        return $true
      }

      $query = [System.Web.HttpUtility]::ParseQueryString($Uri.Query)
      $calendarId = Normalize-Text $(if ($method -eq "POST") { $body["calendarId"] } else { $query["calendarId"] })
      if (-not $calendarId) {
        $calendarId = "calendario_2026_admin"
      }

      if ($method -eq "POST") {
        $incomingSnapshot = if ($body["snapshot"]) {
          if ($body["snapshot"] -is [hashtable]) { $body["snapshot"] } else { ConvertTo-HashtableRecursive $body["snapshot"] }
        }
        else {
          $body
        }

        if (-not $incomingSnapshot) {
          Write-JsonResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Payload @{
            ok = $false
            message = "No se recibieron datos del calendario para guardar."
          }
          return $true
        }

        $normalized = Save-CalendarSnapshotToStore -CalendarId $calendarId -Snapshot $incomingSnapshot
        Save-PortalStore
        $firebaseResult = Save-CalendarSnapshotToFirebase -CalendarId $calendarId -Snapshot $normalized

        Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -Payload @{
          ok = $true
          snapshot = $normalized
          source = if ($firebaseResult["ok"]) { "firebase" } else { "network" }
          remoteSaved = [bool]$firebaseResult["ok"]
          message = if ($firebaseResult["ok"]) { "" } else { Normalize-Text $firebaseResult["message"] }
        }
        return $true
      }

      $refresh = (Normalize-Text $query["refresh"]).ToLowerInvariant() -in @("1", "true", "si", "yes")
      $snapshot = $null
      $source = "network"
      $message = ""
      $remoteLoaded = $false

      if ($refresh) {
        $snapshot = Get-CalendarSnapshotFromFirebase -CalendarId $calendarId
        if ($snapshot) {
          $snapshot = Save-CalendarSnapshotToStore -CalendarId $calendarId -Snapshot $snapshot
          Save-PortalStore
          $source = "firebase"
          $remoteLoaded = $true
        }
      }

      if (-not $snapshot) {
        $snapshot = Get-CalendarSnapshotFromStore -CalendarId $calendarId
      }

      if (-not $snapshot) {
        $remoteSnapshot = Get-CalendarSnapshotFromFirebase -CalendarId $calendarId
        if ($remoteSnapshot) {
          $snapshot = Save-CalendarSnapshotToStore -CalendarId $calendarId -Snapshot $remoteSnapshot
          Save-PortalStore
          $source = "firebase"
          $remoteLoaded = $true
        }
      }

      if (-not $snapshot) {
        $message = "No se encontro un calendario sincronizado todavia."
      }

      Write-JsonResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -HeadOnly:($method -eq "HEAD") -Payload @{
        ok = $true
        snapshot = $snapshot
        source = $source
        remoteLoaded = $remoteLoaded
        message = $message
      }
      return $true
    }
  }

  return $false
}

Ensure-PortalStoreLoaded

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Server.NoDelay = $true
$listener.Start()

$profiles = Get-NetworkProfiles
Save-ServerStatus

Write-Host ""
Write-Host "Servidor web local activo" -ForegroundColor Green
Write-Host "Carpeta: $($script:resolvedRoot)"
Write-Host "Puerto : $Port"
Write-Host ""
Write-Host "Abre desde este PC:"
Write-Host "  http://localhost:$Port/"
Write-Host ""
Write-Host "Abre desde otros equipos en la misma red:"
foreach ($profile in $profiles) {
  Write-Host ("  [{0}] {1} ({2})" -f $profile.interfaceAlias, $profile.networkName, $profile.networkCategory)
  foreach ($url in $profile.urls) {
    Write-Host "    $url"
  }
}
Write-Host ""
Write-Host "Usuarios y avances se guardaran en la red local mientras este servidor siga activo."
Write-Host "Presiona Ctrl + C para detener."
Write-Host ""

try {
  $stopRequested = $false
  while (-not $stopRequested) {
    $client = $listener.AcceptTcpClient()
    $stream = $null
    $request = $null
    try {
      $client.NoDelay = $true
      $client.ReceiveTimeout = 4000
      $client.SendTimeout = 20000
      $stream = $client.GetStream()
      $stream.ReadTimeout = 4000
      $stream.WriteTimeout = 20000

      $request = Read-HttpRequest -Stream $stream
      if (-not $request) {
        continue
      }

      $method = $request["Method"]
      if ($method -notin @("GET", "HEAD", "POST")) {
        Write-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -Body ([Text.Encoding]::UTF8.GetBytes("Metodo no permitido."))
        continue
      }

      $uri = [Uri]("http://localhost" + $request["RawTarget"])
      if ($uri.AbsolutePath -eq "/__share_status.json") {
        $session = Get-AdminSessionFromRequest -Request $request -Uri $uri
        if (-not $session) {
          Write-JsonResponse `
            -Stream $stream `
            -StatusCode 401 `
            -StatusText "Unauthorized" `
            -HeadOnly:($method -eq "HEAD") `
            -Payload @{ ok = $false; message = "La sesion administrativa no es valida." } `
            -Headers @{
              "Access-Control-Allow-Origin" = "*"
              "Access-Control-Allow-Methods" = "GET, HEAD"
            }
          continue
        }

        Save-ServerStatus
        Write-JsonResponse `
          -Stream $stream `
          -StatusCode 200 `
          -StatusText "OK" `
          -HeadOnly:($method -eq "HEAD") `
          -Payload (Get-ServerStatus) `
          -Headers @{
            "Access-Control-Allow-Origin" = "*"
            "Access-Control-Allow-Methods" = "GET, HEAD"
          }
        continue
      }

      if ($uri.AbsolutePath -eq "/__stop") {
        $session = Get-AdminSessionFromRequest -Request $request -Uri $uri
        if (-not $session) {
          Write-JsonResponse `
            -Stream $stream `
            -StatusCode 401 `
            -StatusText "Unauthorized" `
            -HeadOnly:($method -eq "HEAD") `
            -Payload @{ ok = $false; message = "La sesion administrativa no es valida." } `
            -Headers @{
              "Access-Control-Allow-Origin" = "*"
              "Access-Control-Allow-Methods" = "GET, HEAD"
            }
          continue
        }

        Write-JsonResponse `
          -Stream $stream `
          -StatusCode 200 `
          -StatusText "OK" `
          -HeadOnly:($method -eq "HEAD") `
          -Payload @{ ok = $true; message = "Servidor detenido." } `
          -Headers @{
            "Access-Control-Allow-Origin" = "*"
            "Access-Control-Allow-Methods" = "GET, HEAD"
          }
        $stopRequested = $true
        continue
      }

      if ($uri.AbsolutePath.ToLowerInvariant().StartsWith("/api/")) {
        if (Handle-ApiRequest -Stream $stream -Request $request -Uri $uri) {
          continue
        }
      }

      if ($method -eq "POST") {
        Write-JsonResponse -Stream $stream -StatusCode 404 -StatusText "Not Found" -Payload @{ ok = $false; message = "No se encontro el recurso solicitado." }
        continue
      }

      $relativePath = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = "index.html"
      }

      $relativePath = $relativePath.Replace("/", [IO.Path]::DirectorySeparatorChar)
      if (Is-ProtectedRelativePath -RelativePath $relativePath) {
        Write-Response -Stream $stream -StatusCode 403 -StatusText "Forbidden" -Body ([Text.Encoding]::UTF8.GetBytes("Acceso denegado.")) -HeadOnly:($method -eq "HEAD")
        continue
      }

      $candidatePath = Join-Path $script:resolvedRoot $relativePath
      if (Test-Path -LiteralPath $candidatePath -PathType Container) {
        $candidatePath = Join-Path $candidatePath "index.html"
      }

      if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
        Write-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -Body ([Text.Encoding]::UTF8.GetBytes("Archivo no encontrado.")) -HeadOnly:($method -eq "HEAD")
        continue
      }

      $resolvedCandidate = (Resolve-Path -LiteralPath $candidatePath).Path
      if (-not $resolvedCandidate.StartsWith($script:resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Response -Stream $stream -StatusCode 403 -StatusText "Forbidden" -Body ([Text.Encoding]::UTF8.GetBytes("Acceso denegado.")) -HeadOnly:($method -eq "HEAD")
        continue
      }

      Write-FileResponse -Stream $stream -FilePath $resolvedCandidate -HeadOnly:($method -eq "HEAD")
    }
    catch {
      $requestLine = if ($request) { Normalize-Text $request["RequestLine"] } else { "desconocida" }
      Write-ServerError -Context ("Request: {0}" -f $requestLine) -ErrorRecord $_
      try {
        if ($stream) {
          Write-Response -Stream $stream -StatusCode 500 -StatusText "Internal Server Error" -Body ([Text.Encoding]::UTF8.GetBytes("Error interno del servidor."))
        }
      }
      catch {
      }
    }
    finally {
      if ($stream) { $stream.Dispose() }
      $client.Dispose()
    }
  }
}
finally {
  Clear-ServerStatus
  $listener.Stop()
}
