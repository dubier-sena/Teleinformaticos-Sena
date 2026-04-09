param(
    [string]$WorkbookPath = 'G:\Mi unidad\Calendario\Calendario_Pro_2026.xlsx',
    [int]$Port = 8765
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:StartTime = Get-Date
$script:LastSaveTime = $null
$script:BackupPath = $null

function Write-Log {
    param([string]$Message)
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$stamp] $Message"
}

function Add-CorsHeaders {
    param(
        $Response,
        $Request = $null
    )

    $origin = $null
    if ($Request -and $Request.Headers['Origin']) {
        $origin = $Request.Headers['Origin']
    }

    $Response.Headers['Access-Control-Allow-Origin'] = if ($origin) { $origin } else { '*' }
    $Response.Headers['Vary'] = 'Origin'
    $Response.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    $Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type, Access-Control-Request-Private-Network'
    $Response.Headers['Access-Control-Allow-Private-Network'] = 'true'
    $Response.Headers['Access-Control-Max-Age'] = '600'
}

function Write-JsonResponse {
    param(
        $Context,
        [int]$StatusCode,
        $Payload
    )

    $response = $Context.Response
    $response.StatusCode = $StatusCode
    $response.ContentType = 'application/json; charset=utf-8'
    Add-CorsHeaders -Response $response -Request $Context.Request

    $json = $Payload | ConvertTo-Json -Depth 8 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

function Read-JsonBody {
    param($Request)

    $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
    try {
        $body = $reader.ReadToEnd()
    }
    finally {
        $reader.Close()
    }

    if ([string]::IsNullOrWhiteSpace($body)) {
        return @{}
    }

    return $body | ConvertFrom-Json
}

function Convert-DateValueToIso {
    param($Value)

    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        return $null
    }

    return [DateTime]::FromOADate([double]$Value).ToString('yyyy-MM-dd')
}

function Get-BaseIdFromWorksheetRow {
    param(
        $Sheet,
        [int]$Row
    )

    $rowNumber = [string]$Sheet.Cells.Item($Row, 1).Text
    if ($rowNumber -notmatch '^\d+$') {
        return $null
    }

    $dateIso = Convert-DateValueToIso -Value $Sheet.Cells.Item($Row, 2).Value2
    if (-not $dateIso) {
        return $null
    }

    $institution = [string]$Sheet.Cells.Item($Row, 4).Text
    $grade = [string]$Sheet.Cells.Item($Row, 5).Text
    $type = [string]$Sheet.Cells.Item($Row, 8).Text

    switch ($type) {
        'CLASE' { return "$dateIso|$institution|$grade" }
        'SENA' { return "$dateIso|SENA" }
        'SÁBADO' { return "$dateIso|SÁBADO" }
        'DOMINGO' { return "$dateIso|DOMINGO" }
        'DESPLAZAMIENTO' { return "$dateIso|SP" }
        'REUNIÓN RECTOR' { return "$dateIso|SP" }
        default { return $null }
    }
}

function Convert-ToHashtable {
    param($InputObject)

    if ($null -eq $InputObject) {
        return @{}
    }

    if ($InputObject -is [System.Collections.IDictionary]) {
        return $InputObject
    }

    $table = @{}
    foreach ($property in $InputObject.PSObject.Properties) {
        $table[$property.Name] = $property.Value
    }
    return $table
}

function Get-GroupedStateFromPayload {
    param($StatePayload)

    $stateTable = Convert-ToHashtable -InputObject $StatePayload
    $grouped = @{}

    foreach ($key in $stateTable.Keys) {
        $baseId = ($key -replace '\|franja\d+$', '')
        $value = $stateTable[$key]
        $sourceRow = $null
        if ($null -ne $value.PSObject.Properties['sourceRow'] -and -not [string]::IsNullOrWhiteSpace([string]$value.sourceRow)) {
            $sourceRow = [int]$value.sourceRow
        }

        $groupKey = if ($sourceRow) { "row:$sourceRow" } else { "id:$baseId" }
        if (-not $grouped.ContainsKey($groupKey)) {
            $grouped[$groupKey] = New-Object System.Collections.ArrayList
        }

        [void]$grouped[$groupKey].Add([pscustomobject]@{
            id = $key
            baseId = $baseId
            sourceRow = $sourceRow
            state = [string]$value.estado
            obs = [string]$value.obs
            act = $value.act
            grado = [string]$value.grado
        })
    }

    return $grouped
}

function Get-AggregatedRowUpdate {
    param($Entries)

    $grades = $Entries |
        ForEach-Object { [string]$_.grado } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -ne '—' } |
        Select-Object -Unique
    $finalGrade = if ($grades.Count -eq 1) { $grades[0] } else { $null }
    $hasMixedGrades = $grades.Count -gt 1

    if ($Entries.Count -eq 1) {
        $single = $Entries[0]
        $parts = @()
        if (-not [string]::IsNullOrWhiteSpace($single.obs)) {
            $parts += $single.obs.Trim()
        }

        if ($null -ne $single.act) {
            if (-not [string]::IsNullOrWhiteSpace([string]$single.act.nombre)) {
                $parts += "Actividad: $([string]$single.act.nombre)"
            }
            if (-not [string]::IsNullOrWhiteSpace([string]$single.act.fecha)) {
                $parts += "Entrega: $([string]$single.act.fecha)"
            }
        }

        return [pscustomobject]@{
            estado = $single.state
            observacion = ($parts -join ' | ')
            grado = $finalGrade
        }
    }

    $uniqueStates = $Entries | ForEach-Object { $_.state } | Select-Object -Unique
    if ($uniqueStates.Count -eq 1) {
        $finalState = $uniqueStates[0]
    }
    else {
        $finalState = 'Novedad'
    }

    $segments = @()
    foreach ($entry in ($Entries | Sort-Object id)) {
        $label = if ($entry.id -match '\|franja(\d+)$') { "Franja $($matches[1])" } else { 'Registro' }

        $segmentParts = @("$label [$($entry.state)]")
        if (-not [string]::IsNullOrWhiteSpace($entry.obs)) {
            $segmentParts += $entry.obs.Trim()
        }

        if ($hasMixedGrades -and -not [string]::IsNullOrWhiteSpace([string]$entry.grado) -and [string]$entry.grado -ne '—') {
            $segmentParts += "Grado: $([string]$entry.grado)"
        }

        if ($null -ne $entry.act) {
            if (-not [string]::IsNullOrWhiteSpace([string]$entry.act.nombre)) {
                $segmentParts += "Actividad: $([string]$entry.act.nombre)"
            }
            if (-not [string]::IsNullOrWhiteSpace([string]$entry.act.fecha)) {
                $segmentParts += "Entrega: $([string]$entry.act.fecha)"
            }
        }

        $segments += ($segmentParts -join ' | ')
    }

    return [pscustomobject]@{
        estado = $finalState
        observacion = ($segments -join ' || ')
        grado = $finalGrade
    }
}

function Ensure-WorkbookBackup {
    param([string]$Path)

    if ($script:BackupPath) {
        return
    }

    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $directory = Split-Path -Path $Path -Parent
    $name = [System.IO.Path]::GetFileNameWithoutExtension($Path)
    $extension = [System.IO.Path]::GetExtension($Path)
    $backupPath = Join-Path -Path $directory -ChildPath "${name}_backup_${timestamp}${extension}"
    Copy-Item -Path $Path -Destination $backupPath -Force
    $script:BackupPath = $backupPath
    Write-Log "Copia de respaldo creada: $backupPath"
}

function Test-WorkbookUnlocked {
    param([string]$Path)

    try {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        $stream.Close()
        return $true
    }
    catch {
        return $false
    }
}

function Update-WorkbookFromState {
    param(
        [string]$Path,
        $StatePayload
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "No se encontro el archivo Excel en $Path"
    }

    if (-not (Test-WorkbookUnlocked -Path $Path)) {
        throw "El archivo Excel esta abierto o bloqueado por otro proceso. Cierra el libro en Excel y vuelve a intentarlo."
    }

    $groupedState = Get-GroupedStateFromPayload -StatePayload $StatePayload
    Ensure-WorkbookBackup -Path $Path

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $workbook = $null
    $sheet = $null
    $usedRange = $null

    try {
        $workbook = $excel.Workbooks.Open($Path)
        $sheet = $workbook.Worksheets.Item(2)
        $usedRange = $sheet.UsedRange
        $lastRow = $usedRange.Row + $usedRange.Rows.Count - 1

        $rowById = @{}
        for ($row = 4; $row -le $lastRow; $row++) {
            $baseId = Get-BaseIdFromWorksheetRow -Sheet $sheet -Row $row
            if ($baseId) {
                $rowById[$baseId] = $row
            }
        }

        $updated = 0
        $missing = New-Object System.Collections.ArrayList

        foreach ($groupKey in $groupedState.Keys) {
            $entries = $groupedState[$groupKey]
            $firstEntry = $entries[0]

            if ($firstEntry.sourceRow -and $firstEntry.sourceRow -ge 4 -and $firstEntry.sourceRow -le $lastRow) {
                $row = [int]$firstEntry.sourceRow
            }
            elseif ($rowById.ContainsKey($firstEntry.baseId)) {
                $row = $rowById[$firstEntry.baseId]
            }
            else {
                [void]$missing.Add($firstEntry.baseId)
                continue
            }

            $update = Get-AggregatedRowUpdate -Entries $entries
            if (-not [string]::IsNullOrWhiteSpace([string]$update.grado)) {
                $sheet.Cells.Item($row, 5).Value2 = [string]$update.grado
            }
            $sheet.Cells.Item($row, 9).Value2 = [string]$update.estado
            $sheet.Cells.Item($row, 10).Value2 = [string]$update.observacion
            $updated++
        }

        $workbook.Save()
        $script:LastSaveTime = Get-Date

        return [pscustomobject]@{
            updated = $updated
            grouped = $groupedState.Count
            missing = @($missing)
            workbook = $Path
            backup = $script:BackupPath
            savedAt = $script:LastSaveTime.ToString('s')
        }
    }
    finally {
        if ($workbook) { $workbook.Close($true) }
        $excel.Quit()
        if ($usedRange) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($usedRange) }
        if ($sheet) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) }
        if ($workbook) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) }
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}

if (-not ([System.Net.HttpListener]::IsSupported)) {
    throw 'HttpListener no esta soportado en este sistema.'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Log "Servicio activo en http://127.0.0.1:$Port/"
Write-Log "Libro vinculado: $WorkbookPath"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $path = $request.Url.AbsolutePath.Trim('/')

        try {
            if ($request.HttpMethod -eq 'OPTIONS') {
                $context.Response.StatusCode = 204
                Add-CorsHeaders -Response $context.Response -Request $request
                $context.Response.OutputStream.Close()
                continue
            }

            if ($request.HttpMethod -eq 'GET' -and $path -eq 'status') {
                Write-JsonResponse -Context $context -StatusCode 200 -Payload @{
                    ok = $true
                    workbook = $WorkbookPath
                    backup = $script:BackupPath
                    startedAt = $script:StartTime.ToString('s')
                    lastSaveAt = if ($script:LastSaveTime) { $script:LastSaveTime.ToString('s') } else { $null }
                }
                continue
            }

            if ($request.HttpMethod -eq 'POST' -and $path -eq 'save') {
                $payload = Read-JsonBody -Request $request
                if (-not $payload.state) {
                    throw 'El cuerpo de la peticion no incluye la propiedad state.'
                }

                $result = Update-WorkbookFromState -Path $WorkbookPath -StatePayload $payload.state
                Write-Log "Guardado en Excel: $($result.updated) filas actualizadas."
                Write-JsonResponse -Context $context -StatusCode 200 -Payload @{
                    ok = $true
                    result = $result
                }
                continue
            }

            Write-JsonResponse -Context $context -StatusCode 404 -Payload @{
                ok = $false
                error = 'Ruta no encontrada.'
            }
        }
        catch {
            Write-Log "Error: $($_.Exception.Message)"
            Write-JsonResponse -Context $context -StatusCode 500 -Payload @{
                ok = $false
                error = $_.Exception.Message
            }
        }
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
