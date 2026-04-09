param(
    [string]$RecordsPath,
    [string]$SeedPath,
    [string]$OutputPath = 'G:\Mi unidad\Calendario\Calendario_Pro_2026_HTML.xlsx'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $RecordsPath) {
    $RecordsPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'data\calendario_2026_records.js'
}

if (-not $SeedPath) {
    $SeedPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'data\calendario_2026_seed.js'
}

function Read-AssignedJson {
    param([string]$Path)

    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $json = $raw -replace '^\s*window\.[^=]+\s*=\s*', '' -replace ';\s*$', ''
    return $json | ConvertFrom-Json
}

function Convert-ToHashtable {
    param($Value)

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $table = @{}
        foreach ($key in $Value.Keys) {
            $table[[string]$key] = Convert-ToHashtable $Value[$key]
        }
        return $table
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $items = @()
        foreach ($item in $Value) {
            $items += ,(Convert-ToHashtable $item)
        }
        return $items
    }

    $properties = @()
    if ($Value.PSObject) {
        $properties = @($Value.PSObject.Properties)
    }

    if ($properties.Count -gt 0) {
        $table = @{}
        foreach ($prop in $properties) {
            $table[[string]$prop.Name] = Convert-ToHashtable $prop.Value
        }
        return $table
    }

    return $Value
}

function Split-HorarioSlots {
    param([string]$Horario)

    if ([string]::IsNullOrWhiteSpace($Horario) -or $Horario -eq '—') {
        return @('—')
    }

    return @(
        ($Horario -split '\s*(?:/|;|\r?\n)+\s*') |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object { $_.Trim() }
    )
}

function Get-HorarioSortValue {
    param([string]$Horario)

    $match = [regex]::Match([string]$Horario, '(\d{1,2}):(\d{2})(am|pm)', 'IgnoreCase')
    if (-not $match.Success) {
        return 9999
    }

    $hour = [int]$match.Groups[1].Value % 12
    if ($match.Groups[3].Value.ToLowerInvariant() -eq 'pm') {
        $hour += 12
    }

    return ($hour * 60) + [int]$match.Groups[2].Value
}

function Get-ExcelDateSerial {
    param([string]$IsoDate)

    return ([datetime]::ParseExact($IsoDate, 'yyyy-MM-dd', $null)).ToOADate()
}

function Get-Abbr {
    param([string]$School)

    if ($School -like '*Kennedy*') { return 'JFK' }
    if ($School -like '*Santa*') { return 'SB' }
    if ($School -like '*Sede SENA*') { return 'SENA' }
    return $School
}

function Expand-Records {
    param([object[]]$Records)

    $expanded = New-Object System.Collections.ArrayList

    for ($i = 0; $i -lt $Records.Count; $i++) {
        $record = $Records[$i]
        $sourceRow = $i + 4
        $base = [ordered]@{
            id        = [string]$record.id
            baseId    = [string]$record.id
            fecha     = [string]$record.fecha
            mes       = [string]$record.mes
            dia       = [string]$record.dia
            colegio   = [string]$record.colegio
            grado     = [string]$record.grado
            horario   = [string]$record.horario
            tipo      = [string]$record.tipo
            defE      = [string]$record.defE
            defO      = [string]$record.defO
            finde     = [bool]$record.finde
            sourceRow = $sourceRow
            slotIndex = 1
            slotCount = 1
        }

        if ($base.tipo -ne 'CLASE') {
            [void]$expanded.Add([pscustomobject]$base)
            continue
        }

        $slots = Split-HorarioSlots $base.horario
        if ($slots.Count -le 1) {
            $base.horario = $slots[0]
            [void]$expanded.Add([pscustomobject]$base)
            continue
        }

        for ($slotIndex = 0; $slotIndex -lt $slots.Count; $slotIndex++) {
            $item = [ordered]@{}
            foreach ($key in $base.Keys) {
                $item[$key] = $base[$key]
            }
            $item.id = '{0}|franja{1}' -f $base.baseId, ($slotIndex + 1)
            $item.horario = $slots[$slotIndex]
            $item.slotIndex = $slotIndex + 1
            $item.slotCount = $slots.Count
            [void]$expanded.Add([pscustomobject]$item)
        }
    }

    return ,$expanded
}

function Get-EffectiveState {
    param(
        $Record,
        [hashtable]$Seed
    )

    $rawState = $null
    if ($Seed.ContainsKey($Record.id)) {
        $rawState = $Seed[$Record.id]
    }
    elseif ($Seed.ContainsKey($Record.baseId)) {
        $rawState = $Seed[$Record.baseId]
    }

    $state = Convert-ToHashtable $rawState
    return [pscustomobject]@{
        estado = if ($state -and $state.ContainsKey('estado') -and -not [string]::IsNullOrWhiteSpace([string]$state.estado)) { [string]$state.estado } else { [string]$Record.defE }
        obs    = if ($state -and $state.ContainsKey('obs')) { [string]$state.obs } else { [string]$Record.defO }
        act    = if ($state -and $state.ContainsKey('act')) { $state.act } else { $null }
        grado  = if ($state -and $state.ContainsKey('grado') -and -not [string]::IsNullOrWhiteSpace([string]$state.grado)) { [string]$state.grado } else { [string]$Record.grado }
    }
}

function Get-AggregatedSourceRow {
    param(
        $SourceRecord,
        [object[]]$ExpandedRows,
        [hashtable]$Seed
    )

    $entries = @()
    foreach ($expanded in ($ExpandedRows | Sort-Object slotIndex, horario)) {
        $eff = Get-EffectiveState -Record $expanded -Seed $Seed
        $entries += [pscustomobject]@{
            id    = $expanded.id
            state = $eff.estado
            obs   = $eff.obs
            act   = $eff.act
            grado = $eff.grado
        }
    }

    $uniqueGrades = @($entries | ForEach-Object { $_.grado } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -ne '—' } | Select-Object -Unique)
    $uniqueStates = @($entries | ForEach-Object { $_.state } | Select-Object -Unique)
    $rowGrade = if ($uniqueGrades.Count -eq 1) { $uniqueGrades[0] } else { [string]$SourceRecord.grado }
    $rowState = if ($uniqueStates.Count -eq 1) { $uniqueStates[0] } else { 'Novedad' }

    $activityNames = New-Object System.Collections.ArrayList
    $activityDates = New-Object System.Collections.ArrayList
    $observation = ''

    if ($entries.Count -eq 1) {
        $parts = New-Object System.Collections.ArrayList
        if (-not [string]::IsNullOrWhiteSpace($entries[0].obs)) {
            [void]$parts.Add($entries[0].obs.Trim())
        }

        if ($entries[0].act) {
            if (-not [string]::IsNullOrWhiteSpace([string]$entries[0].act.nombre)) {
                [void]$activityNames.Add([string]$entries[0].act.nombre)
            }
            if (-not [string]::IsNullOrWhiteSpace([string]$entries[0].act.fecha)) {
                [void]$activityDates.Add([string]$entries[0].act.fecha)
            }
        }

        $observation = ($parts -join ' | ')
    }
    else {
        $segments = New-Object System.Collections.ArrayList
        $mixedGrades = $uniqueGrades.Count -gt 1

        foreach ($entry in ($entries | Sort-Object id)) {
            $label = if ($entry.id -match '\|franja(\d+)$') { 'Franja ' + $matches[1] } else { 'Registro' }
            $parts = New-Object System.Collections.ArrayList
            [void]$parts.Add('{0} [{1}]' -f $label, $entry.state)

            if ($mixedGrades -and -not [string]::IsNullOrWhiteSpace([string]$entry.grado) -and [string]$entry.grado -ne '—') {
                [void]$parts.Add('Grado: ' + [string]$entry.grado)
            }

            if (-not [string]::IsNullOrWhiteSpace($entry.obs)) {
                [void]$parts.Add($entry.obs.Trim())
            }

            if ($entry.act) {
                if (-not [string]::IsNullOrWhiteSpace([string]$entry.act.nombre)) {
                    [void]$parts.Add('Actividad: ' + [string]$entry.act.nombre)
                    [void]$activityNames.Add([string]$entry.act.nombre)
                }
                if (-not [string]::IsNullOrWhiteSpace([string]$entry.act.fecha)) {
                    [void]$parts.Add('Entrega: ' + [string]$entry.act.fecha)
                    [void]$activityDates.Add([string]$entry.act.fecha)
                }
            }

            [void]$segments.Add(($parts -join ' | '))
        }

        $observation = ($segments -join ' || ')
    }

    $uniqueActivityNames = @($activityNames | Select-Object -Unique)
    $uniqueActivityDates = @($activityDates | Select-Object -Unique)

    return [pscustomobject]@{
        grado        = $rowGrade
        estado       = $rowState
        observacion  = $observation
        actividad    = ($uniqueActivityNames -join ' | ')
        entrega      = ($uniqueActivityDates -join ' | ')
    }
}

function Format-TopBar {
    param($Worksheet, [string]$Title, [string]$Subtitle)

    $Worksheet.Range('A1:L1').Merge() | Out-Null
    $Worksheet.Range('A1').Value2 = $Title
    $Worksheet.Range('A1').Font.Bold = $true
    $Worksheet.Range('A1').Font.Size = 16

    $Worksheet.Range('A2:L2').Merge() | Out-Null
    $Worksheet.Range('A2').Value2 = $Subtitle
    $Worksheet.Range('A2').Font.Size = 10
    $Worksheet.Range('A2').Font.Italic = $true
}

function Fill-Dashboard {
    param(
        $Worksheet,
        [object[]]$ExpandedRecords,
        [hashtable]$Seed
    )

    Format-TopBar -Worksheet $Worksheet `
        -Title 'CALENDARIO PRO 2026 - Construido desde el HTML' `
        -Subtitle 'Sistemas Teleinformaticos · I.E. Jhon F. Kennedy · I.E. Santa Barbara · 23 Feb - 27 Nov 2026'

    $headers = @('Grupo','Programadas','Impartidas','Activas','Canceladas','Sin prog.','Recuperadas','Con actividad')
    for ($col = 0; $col -lt $headers.Count; $col++) {
        $Worksheet.Cells.Item(5, $col + 1).Value2 = $headers[$col]
    }
    $Worksheet.Range('A5:H5').Font.Bold = $true
    $Worksheet.Range('A5:H5').Interior.Color = 0xD9EAF7

    $groups = @(
        @{ colegio='I.E. Jhon F. Kennedy'; grado='10A'; label='JFK - 10A' },
        @{ colegio='I.E. Jhon F. Kennedy'; grado='10B'; label='JFK - 10B' },
        @{ colegio='I.E. Santa Bárbara';   grado='10A'; label='SB - 10A'  },
        @{ colegio='I.E. Santa Bárbara';   grado='10B'; label='SB - 10B'  },
        @{ colegio='I.E. Santa Bárbara';   grado='11A'; label='SB - 11A'  },
        @{ colegio='I.E. Santa Bárbara';   grado='11B'; label='SB - 11B'  }
    )

    $row = 6
    foreach ($group in $groups) {
        $records = @(
            $ExpandedRecords | Where-Object {
                $_.tipo -eq 'CLASE' -and
                $_.colegio -eq $group.colegio -and
                (Get-EffectiveState -Record $_ -Seed $Seed).grado -eq $group.grado
            }
        )

        $Worksheet.Cells.Item($row, 1).Value2 = $group.label
        $Worksheet.Cells.Item($row, 2).Value2 = $records.Count
        $Worksheet.Cells.Item($row, 3).Value2 = @($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Impartida' }).Count
        $Worksheet.Cells.Item($row, 4).Value2 = @($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Activa' }).Count
        $Worksheet.Cells.Item($row, 5).Value2 = @($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Cancelada' }).Count
        $Worksheet.Cells.Item($row, 6).Value2 = @($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Sin programación' }).Count
        $Worksheet.Cells.Item($row, 7).Value2 = @($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Recuperada' }).Count
        $Worksheet.Cells.Item($row, 8).Value2 = @($records | Where-Object {
            $state = Get-EffectiveState -Record $_ -Seed $Seed
            $state.act -and -not [string]::IsNullOrWhiteSpace([string]$state.act.nombre)
        }).Count
        $row++
    }

    $Worksheet.Columns('A:H').AutoFit() | Out-Null
}

function Fill-Registro {
    param(
        $Worksheet,
        [object[]]$SourceRecords,
        [hashtable]$Seed,
        [hashtable]$ExpandedByBaseId
    )

    Format-TopBar -Worksheet $Worksheet `
        -Title 'REGISTRO' `
        -Subtitle 'Base construida desde el calendario HTML. Hoja compatible con la sincronizacion del portal.'

    $headers = @('N°','FECHA','MES','INSTITUCION','GRADO','HORARIO','DIA','TIPO','ESTADO','OBSERVACIONES','ACTIVIDAD','ENTREGA')
    for ($col = 0; $col -lt $headers.Count; $col++) {
        $Worksheet.Cells.Item(3, $col + 1).Value2 = $headers[$col]
    }
    $Worksheet.Range('A3:L3').Font.Bold = $true
    $Worksheet.Range('A3:L3').Interior.Color = 0xD9EAF7

    for ($index = 0; $index -lt $SourceRecords.Count; $index++) {
        $source = $SourceRecords[$index]
        $row = $index + 4
        $aggregate = Get-AggregatedSourceRow -SourceRecord $source -ExpandedRows $ExpandedByBaseId[[string]$source.id] -Seed $Seed

        $Worksheet.Cells.Item($row, 1).Value2 = $index + 1
        $Worksheet.Cells.Item($row, 2).Value2 = Get-ExcelDateSerial([string]$source.fecha)
        $Worksheet.Cells.Item($row, 2).NumberFormat = 'dd/mmm/yy'
        $Worksheet.Cells.Item($row, 3).Value2 = [string]$source.mes
        $Worksheet.Cells.Item($row, 4).Value2 = [string]$source.colegio
        $Worksheet.Cells.Item($row, 5).Value2 = [string]$aggregate.grado
        $Worksheet.Cells.Item($row, 6).Value2 = [string]$source.horario
        $Worksheet.Cells.Item($row, 7).Value2 = [string]$source.dia
        $Worksheet.Cells.Item($row, 8).Value2 = [string]$source.tipo
        $Worksheet.Cells.Item($row, 9).Value2 = [string]$aggregate.estado
        $Worksheet.Cells.Item($row, 10).Value2 = [string]$aggregate.observacion
        $Worksheet.Cells.Item($row, 11).Value2 = [string]$aggregate.actividad
        $Worksheet.Cells.Item($row, 12).Value2 = [string]$aggregate.entrega
    }

    $range = $Worksheet.Range('A3:L' + ($SourceRecords.Count + 3))
    $range.Borders.LineStyle = 1
    $range.VerticalAlignment = -4160
    $Worksheet.Columns('A:L').WrapText = $true
    $Worksheet.Columns('A:L').AutoFit() | Out-Null
}

function Get-MonthDayContent {
    param(
        [datetime]$Date,
        [object[]]$ExpandedRecords,
        [hashtable]$Seed
    )

    $iso = $Date.ToString('yyyy-MM-dd')
    $festivos = @(
        '2026-03-23','2026-05-01','2026-05-18','2026-06-08','2026-06-15',
        '2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02','2026-11-16'
    )
    $recesos = @(
        '2026-03-30','2026-03-31','2026-04-01','2026-04-02','2026-04-03','2026-04-04','2026-04-05',
        '2026-06-22','2026-06-23','2026-06-24','2026-06-25','2026-06-26','2026-06-27','2026-06-28',
        '2026-06-29','2026-06-30','2026-07-01','2026-07-02','2026-07-03','2026-07-04','2026-07-05',
        '2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11'
    )

    if ($recesos -contains $iso) {
        return @('RECESO / VACACIONES')
    }

    if ($festivos -contains $iso) {
        return @('FESTIVO')
    }

    $records = @(
        $ExpandedRecords |
            Where-Object { $_.fecha -eq $iso } |
            Sort-Object @{ Expression = { $_.tipo }; Ascending = $true }, @{ Expression = { Get-HorarioSortValue $_.horario }; Ascending = $true }, @{ Expression = { $_.sourceRow }; Ascending = $true }
    )

    if (-not $records.Count) {
        if ($Date.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) {
            return @('No laboral')
        }
        return @()
    }

    $lines = New-Object System.Collections.ArrayList
    foreach ($record in $records) {
        $state = Get-EffectiveState -Record $record -Seed $Seed
        switch ([string]$record.tipo) {
            'SENA' {
                [void]$lines.Add('SEDE SENA')
                continue
            }
            'DESPLAZAMIENTO' {
                [void]$lines.Add('DESPLAZAMIENTO')
                continue
            }
            'REUNIÓN RECTOR' {
                [void]$lines.Add('REUNION CON RECTOR')
                continue
            }
        }

        $abbr = Get-Abbr([string]$record.colegio)
        $grade = [string]$state.grado
        $prefix = switch ([string]$state.estado) {
            'Impartida'        { 'OK ' }
            'Cancelada'        { if (([string]$state.obs).ToLowerInvariant() -match 'desplaz|otanche') { 'DESP ' } else { 'X ' } }
            'Sin programación' { 'SENA ' }
            'Recuperada'       { 'REC ' }
            default            { '' }
        }

        [void]$lines.Add(('{0}[{1} {2}] {3}' -f $prefix, $abbr, $grade, [string]$record.horario).Trim())
    }

    return ,$lines
}

function Fill-MonthSheet {
    param(
        $Worksheet,
        [int]$MonthNumber,
        [object[]]$ExpandedRecords,
        [hashtable]$Seed
    )

    $monthNames = @('', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre')
    Format-TopBar -Worksheet $Worksheet `
        -Title ('CALENDARIO - ' + $monthNames[$MonthNumber].ToUpperInvariant() + ' 2026') `
        -Subtitle 'Vista mensual generada desde el portal HTML'

    $days = @('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO')
    for ($col = 0; $col -lt $days.Count; $col++) {
        $Worksheet.Cells.Item(4, $col + 1).Value2 = $days[$col]
    }
    $Worksheet.Range('A4:G4').Font.Bold = $true
    $Worksheet.Range('A4:G4').Interior.Color = 0xD9EAF7

    $first = Get-Date -Year 2026 -Month $MonthNumber -Day 1
    $startOffset = (7 + ([int]$first.DayOfWeek) - 1) % 7
    $daysInMonth = [DateTime]::DaysInMonth(2026, $MonthNumber)
    $row = 5
    $col = $startOffset + 1

    for ($day = 1; $day -le $daysInMonth; $day++) {
        $date = Get-Date -Year 2026 -Month $MonthNumber -Day $day
        $cell = $Worksheet.Cells.Item($row, $col)
        $content = New-Object System.Collections.ArrayList
        [void]$content.Add([string]$day)
        foreach ($line in (Get-MonthDayContent -Date $date -ExpandedRecords $ExpandedRecords -Seed $Seed)) {
            [void]$content.Add([string]$line)
        }
        $cell.Value2 = ($content -join [Environment]::NewLine)
        $cell.WrapText = $true
        $cell.VerticalAlignment = -4160
        $cell.HorizontalAlignment = -4131
        $cell.Borders.LineStyle = 1

        if ($date.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) {
            $cell.Interior.Color = 0xF3F4F6
        }

        $col++
        if ($col -gt 7) {
            $col = 1
            $row++
        }
    }

    $Worksheet.Columns('A:G').ColumnWidth = 24
    for ($r = 5; $r -le 11; $r++) {
        $Worksheet.Rows.Item($r).RowHeight = 74
    }
}

function Get-ColumnName {
    param([int]$Index)

    $name = ''
    $current = $Index
    while ($current -gt 0) {
        $current--
        $name = [char](65 + ($current % 26)) + $name
        $current = [math]::Floor($current / 26)
    }
    return $name
}

function Escape-XmlText {
    param([AllowNull()][string]$Text)

    if ($null -eq $Text) {
        return ''
    }

    $escaped = [System.Security.SecurityElement]::Escape([string]$Text)
    return ($escaped -replace "(`r`n|`r|`n)", '&#10;')
}

function New-WorksheetXml {
    param([object[]]$Rows)

    $rowXml = New-Object System.Collections.ArrayList
    for ($rowIndex = 0; $rowIndex -lt $Rows.Count; $rowIndex++) {
        $values = @($Rows[$rowIndex])
        $cellXml = New-Object System.Collections.ArrayList
        for ($colIndex = 0; $colIndex -lt $values.Count; $colIndex++) {
            $text = if ($null -eq $values[$colIndex]) { '' } else { [string]$values[$colIndex] }
            if ([string]::IsNullOrEmpty($text)) {
                continue
            }

            $ref = '{0}{1}' -f (Get-ColumnName ($colIndex + 1)), ($rowIndex + 1)
            $escaped = Escape-XmlText $text
            [void]$cellXml.Add("<c r=`"$ref`" t=`"inlineStr`"><is><t xml:space=`"preserve`">$escaped</t></is></c>")
        }

        if ($cellXml.Count -gt 0) {
            [void]$rowXml.Add("<row r=`"$($rowIndex + 1)`">$($cellXml -join '')</row>")
        }
        else {
            [void]$rowXml.Add("<row r=`"$($rowIndex + 1)`"/>")
        }
    }

    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    $($rowXml -join "`n    ")
  </sheetData>
</worksheet>
"@
}

function New-RootRelsXml {
    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@
}

function New-WorkbookXml {
    param([object[]]$Sheets)

    $sheetXml = New-Object System.Collections.ArrayList
    for ($index = 0; $index -lt $Sheets.Count; $index++) {
        $sheet = $Sheets[$index]
        [void]$sheetXml.Add("<sheet name=`"$([string](Escape-XmlText $sheet.Name))`" sheetId=`"$($index + 1)`" r:id=`"rId$($index + 1)`"/>")
    }

    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    $($sheetXml -join "`n    ")
  </sheets>
</workbook>
"@
}

function New-WorkbookRelsXml {
    param([object[]]$Sheets)

    $rels = New-Object System.Collections.ArrayList
    for ($index = 0; $index -lt $Sheets.Count; $index++) {
        [void]$rels.Add("<Relationship Id=`"rId$($index + 1)`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet`" Target=`"worksheets/sheet$($index + 1).xml`"/>")
    }

    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  $($rels -join "`n  ")
</Relationships>
"@
}

function New-ContentTypesXml {
    param([object[]]$Sheets)

    $overrides = New-Object System.Collections.ArrayList
    for ($index = 0; $index -lt $Sheets.Count; $index++) {
        [void]$overrides.Add("<Override PartName=`"/xl/worksheets/sheet$($index + 1).xml`" ContentType=`"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml`"/>")
    }

    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  $($overrides -join "`n  ")
</Types>
"@
}

function New-AppXml {
    param([object[]]$Sheets)

    $sheetNames = New-Object System.Collections.ArrayList
    foreach ($sheet in $Sheets) {
        [void]$sheetNames.Add("<vt:lpstr>$([string](Escape-XmlText $sheet.Name))</vt:lpstr>")
    }

    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>$($Sheets.Count)</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="$($Sheets.Count)" baseType="lpstr">
      $($sheetNames -join "`n      ")
    </vt:vector>
  </TitlesOfParts>
</Properties>
"@
}

function New-CoreXml {
    $now = [datetime]::UtcNow.ToString('s') + 'Z'
    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Calendario Pro 2026 HTML</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$now</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$now</dcterms:modified>
</cp:coreProperties>
"@
}

function Add-ZipTextEntry {
    param(
        $Archive,
        [string]$Path,
        [string]$Content
    )

    $entry = $Archive.CreateEntry($Path, [System.IO.Compression.CompressionLevel]::Optimal)
    $stream = $entry.Open()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Content)
        $stream.Write($bytes, 0, $bytes.Length)
    }
    finally {
        $stream.Dispose()
    }
}

function Build-DashboardRows {
    param(
        [object[]]$ExpandedRecords,
        [hashtable]$Seed
    )

    $rows = New-Object System.Collections.ArrayList
    [void]$rows.Add(@('CALENDARIO PRO 2026 - Construido desde el HTML'))
    [void]$rows.Add(@('Sistemas Teleinformaticos | I.E. Jhon F. Kennedy | I.E. Santa Barbara | 23 Feb - 27 Nov 2026'))
    [void]$rows.Add(@(''))
    [void]$rows.Add(@('Grupo','Programadas','Impartidas','Activas','Canceladas','Sin prog.','Recuperadas','Con actividad'))

    $groups = @(
        @{ abbr='JFK'; grado='10A'; label='JFK - 10A' },
        @{ abbr='JFK'; grado='10B'; label='JFK - 10B' },
        @{ abbr='SB';  grado='10A'; label='SB - 10A'  },
        @{ abbr='SB';  grado='10B'; label='SB - 10B'  },
        @{ abbr='SB';  grado='11A'; label='SB - 11A'  },
        @{ abbr='SB';  grado='11B'; label='SB - 11B'  }
    )

    foreach ($group in $groups) {
        $records = @(
            $ExpandedRecords | Where-Object {
                $_.tipo -eq 'CLASE' -and
                (Get-Abbr ([string]$_.colegio)) -eq $group.abbr -and
                (Get-EffectiveState -Record $_ -Seed $Seed).grado -eq $group.grado
            }
        )

        [void]$rows.Add(@(
            $group.label,
            [string]$records.Count,
            [string]@($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Impartida' }).Count,
            [string]@($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Activa' }).Count,
            [string]@($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Cancelada' }).Count,
            [string]@($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Sin programación' }).Count,
            [string]@($records | Where-Object { (Get-EffectiveState -Record $_ -Seed $Seed).estado -eq 'Recuperada' }).Count,
            [string]@($records | Where-Object {
                $state = Get-EffectiveState -Record $_ -Seed $Seed
                $state.act -and -not [string]::IsNullOrWhiteSpace([string]$state.act.nombre)
            }).Count
        ))
    }

    return ,$rows
}

function Build-RegistroRows {
    param(
        [object[]]$SourceRecords,
        [hashtable]$Seed,
        [hashtable]$ExpandedByBaseId
    )

    $rows = New-Object System.Collections.ArrayList
    [void]$rows.Add(@('REGISTRO'))
    [void]$rows.Add(@('Base construida desde el calendario HTML. Hoja compatible con la sincronizacion del portal.'))
    [void]$rows.Add(@('N°','FECHA','MES','INSTITUCION','GRADO','HORARIO','DIA','TIPO','ESTADO','OBSERVACIONES','ACTIVIDAD','ENTREGA'))

    for ($index = 0; $index -lt $SourceRecords.Count; $index++) {
        $source = $SourceRecords[$index]
        $aggregate = Get-AggregatedSourceRow -SourceRecord $source -ExpandedRows $ExpandedByBaseId[[string]$source.id] -Seed $Seed
        [void]$rows.Add(@(
            [string]($index + 1),
            [string]$source.fecha,
            [string]$source.mes,
            [string]$source.colegio,
            [string]$aggregate.grado,
            [string]$source.horario,
            [string]$source.dia,
            [string]$source.tipo,
            [string]$aggregate.estado,
            [string]$aggregate.observacion,
            [string]$aggregate.actividad,
            [string]$aggregate.entrega
        ))
    }

    return ,$rows
}

function Build-MonthRows {
    param(
        [int]$MonthNumber,
        [object[]]$ExpandedRecords,
        [hashtable]$Seed
    )

    $monthNames = @('', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre')
    $rows = New-Object System.Collections.ArrayList
    [void]$rows.Add(@('CALENDARIO - ' + $monthNames[$MonthNumber].ToUpperInvariant() + ' 2026'))
    [void]$rows.Add(@('Vista mensual generada desde el portal HTML'))
    [void]$rows.Add(@(''))
    [void]$rows.Add(@('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'))

    $first = Get-Date -Year 2026 -Month $MonthNumber -Day 1
    $startOffset = (7 + ([int]$first.DayOfWeek) - 1) % 7
    $daysInMonth = [DateTime]::DaysInMonth(2026, $MonthNumber)
    $currentDay = 1

    for ($week = 0; $week -lt 6; $week++) {
        $weekRow = New-Object System.Collections.ArrayList
        for ($dayIndex = 0; $dayIndex -lt 7; $dayIndex++) {
            $cellIndex = ($week * 7) + $dayIndex
            if ($cellIndex -lt $startOffset -or $currentDay -gt $daysInMonth) {
                [void]$weekRow.Add('')
                continue
            }

            $date = Get-Date -Year 2026 -Month $MonthNumber -Day $currentDay
            $parts = New-Object System.Collections.ArrayList
            [void]$parts.Add([string]$currentDay)
            foreach ($line in (Get-MonthDayContent -Date $date -ExpandedRecords $ExpandedRecords -Seed $Seed)) {
                [void]$parts.Add([string]$line)
            }

            [void]$weekRow.Add(($parts -join "`n"))
            $currentDay++
        }
        [void]$rows.Add(@($weekRow.ToArray()))
    }

    return ,$rows
}

function New-XlsxPackage {
    param(
        [string]$TargetPath,
        [object[]]$Sheets
    )

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    if (Test-Path -LiteralPath $TargetPath) {
        Remove-Item -LiteralPath $TargetPath -Force
    }

    $fileStream = [System.IO.File]::Open($TargetPath, [System.IO.FileMode]::CreateNew)
    try {
        $archive = [System.IO.Compression.ZipArchive]::new($fileStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
        try {
            Add-ZipTextEntry -Archive $archive -Path '[Content_Types].xml' -Content (New-ContentTypesXml -Sheets $Sheets)
            Add-ZipTextEntry -Archive $archive -Path '_rels/.rels' -Content (New-RootRelsXml)
            Add-ZipTextEntry -Archive $archive -Path 'docProps/app.xml' -Content (New-AppXml -Sheets $Sheets)
            Add-ZipTextEntry -Archive $archive -Path 'docProps/core.xml' -Content (New-CoreXml)
            Add-ZipTextEntry -Archive $archive -Path 'xl/workbook.xml' -Content (New-WorkbookXml -Sheets $Sheets)
            Add-ZipTextEntry -Archive $archive -Path 'xl/_rels/workbook.xml.rels' -Content (New-WorkbookRelsXml -Sheets $Sheets)

            for ($index = 0; $index -lt $Sheets.Count; $index++) {
                $sheetPath = 'xl/worksheets/sheet{0}.xml' -f ($index + 1)
                $sheetXml = New-WorksheetXml -Rows $Sheets[$index].Rows
                Add-ZipTextEntry -Archive $archive -Path $sheetPath -Content $sheetXml
            }
        }
        finally {
            $archive.Dispose()
        }
    }
    finally {
        $fileStream.Dispose()
    }
}

$sourceRecords = @(Read-AssignedJson -Path $RecordsPath)
$seed = Convert-ToHashtable (Read-AssignedJson -Path $SeedPath)
$expandedRecords = @(Expand-Records -Records $sourceRecords)

$expandedByBaseId = @{}
foreach ($record in $expandedRecords) {
    if (-not $expandedByBaseId.ContainsKey($record.baseId)) {
        $expandedByBaseId[$record.baseId] = New-Object System.Collections.ArrayList
    }
    [void]$expandedByBaseId[$record.baseId].Add($record)
}

$sheets = @(
    [pscustomobject]@{ Name = 'Dashboard'; Rows = (Build-DashboardRows -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Registro'; Rows = (Build-RegistroRows -SourceRecords $sourceRecords -Seed $seed -ExpandedByBaseId $expandedByBaseId) },
    [pscustomobject]@{ Name = 'Febrero'; Rows = (Build-MonthRows -MonthNumber 2 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Marzo'; Rows = (Build-MonthRows -MonthNumber 3 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Abril'; Rows = (Build-MonthRows -MonthNumber 4 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Mayo'; Rows = (Build-MonthRows -MonthNumber 5 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Junio'; Rows = (Build-MonthRows -MonthNumber 6 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Julio'; Rows = (Build-MonthRows -MonthNumber 7 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Agosto'; Rows = (Build-MonthRows -MonthNumber 8 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Septiembre'; Rows = (Build-MonthRows -MonthNumber 9 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Octubre'; Rows = (Build-MonthRows -MonthNumber 10 -ExpandedRecords $expandedRecords -Seed $seed) },
    [pscustomobject]@{ Name = 'Noviembre'; Rows = (Build-MonthRows -MonthNumber 11 -ExpandedRecords $expandedRecords -Seed $seed) }
)

New-XlsxPackage -TargetPath $OutputPath -Sheets $sheets

Write-Output "Excel creado: $OutputPath"
