param(
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = if ($OutputRoot) { $OutputRoot } else { $repoRoot }
$variantsPath = Join-Path $repoRoot "data\generated_page_variants.json"
$templatesRoot = Join-Path $repoRoot "sources\generated"

function ConvertTo-Hashtable {
  param(
    [Parameter(Mandatory = $true)]
    $Value
  )

  if ($null -eq $Value) {
    return $null
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $table = @{}
    foreach ($key in $Value.Keys) {
      $table[[string]$key] = ConvertTo-Hashtable -Value $Value[$key]
    }
    return $table
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($item in $Value) {
      $items += ,(ConvertTo-Hashtable -Value $item)
    }
    return $items
  }

  if ($Value -is [pscustomobject]) {
    $table = @{}
    foreach ($property in $Value.PSObject.Properties) {
      $table[[string]$property.Name] = ConvertTo-Hashtable -Value $property.Value
    }
    return $table
  }

  return $Value
}

function Get-OptionalValue {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Variant,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [string]$Default = ""
  )

  if ($Variant.ContainsKey($Key) -and $null -ne $Variant[$Key]) {
    return [string]$Variant[$Key]
  }

  return [string]$Default
}

function Get-PageFileFromBackLink {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BackLink
  )

  if ($BackLink.Contains("#")) {
    return [string]$BackLink.Split("#")[0]
  }

  return [string]$BackLink
}

function Get-TemplateDefaults {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Variant
  )

  $templateName = [string]$Variant.template
  $backLink = [string]$Variant.backLink

  if ($templateName -eq "redes-ip-quiz.template.html") {
    return @{
      "QUIZ_STORAGE_KEY" = "quiz-redes-33h"
      "QUIZ_BANK_VAR" = "REDES_IP_QUIZ_VARIANTS"
      "QUIZ_PAGE_FILE" = Get-PageFileFromBackLink -BackLink $backLink
    }
  }

  if ($templateName -eq "redes-rap01-quiz.template.html") {
    return @{
      "QUIZ_PAGE_FILE" = Get-PageFileFromBackLink -BackLink $backLink
    }
  }

  return @{}
}

function Get-VariantTokens {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Variant
  )

  $defaults = Get-TemplateDefaults -Variant $Variant
  $pageTitle = [string]$Variant.title
  $pageDescription = Get-OptionalValue -Variant $Variant -Key "description" -Default $pageTitle

  return @{
    "PAGE_TITLE" = $pageTitle
    "PAGE_DESCRIPTION" = $pageDescription
    "QUIZ_GROUP" = [string]$Variant.grupo
    "QUIZ_FICHA" = [string]$Variant.ficha
    "QUIZ_CLOUD_FILE" = Get-OptionalValue -Variant $Variant -Key "cloudFileName"
    "QUIZ_PAGE_FILE" = Get-OptionalValue -Variant $defaults -Key "QUIZ_PAGE_FILE"
    "QUIZ_BACK_LINK" = [string]$Variant.backLink
    "QUIZ_STORAGE_KEY" = Get-OptionalValue -Variant $defaults -Key "QUIZ_STORAGE_KEY"
    "QUIZ_BANK_VAR" = Get-OptionalValue -Variant $defaults -Key "QUIZ_BANK_VAR"
    "DEFAULT_FICHA" = [string]$Variant.ficha
    "DEFAULT_INST" = [string]$Variant.inst
    "DEFAULT_GRUPO" = [string]$Variant.grupo
    "GROUP_LABEL" = [string]$Variant.grupo
    "BACK_LINK" = [string]$Variant.backLink
  }
}

function Render-Template {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TemplateText,
    [Parameter(Mandatory = $true)]
    [hashtable]$Tokens
  )

  $rendered = $TemplateText
  foreach ($entry in $Tokens.GetEnumerator()) {
    $placeholder = "{{" + [string]$entry.Key + "}}"
    $rendered = $rendered.Replace($placeholder, [string]$entry.Value)
  }

  return $rendered
}

$variantsRaw = Get-Content -LiteralPath $variantsPath -Raw
$variants = ConvertTo-Hashtable -Value (ConvertFrom-Json -InputObject $variantsRaw)

foreach ($variantEntry in $variants.GetEnumerator()) {
  $variant = $variantEntry.Value
  $templatePath = Join-Path $templatesRoot ([string]$variant.template)
  $outputPath = Join-Path $targetRoot ([string]$variant.outputFile)
  $outputDir = Split-Path -Parent $outputPath
  $templateText = Get-Content -LiteralPath $templatePath -Raw
  $tokens = Get-VariantTokens -Variant $variant
  $rendered = Render-Template -TemplateText $templateText -Tokens $tokens
  $generated = "<!-- GENERATED FILE: edit sources/generated and data/generated_page_variants.json -->`r`n" + $rendered

  if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  }

  Set-Content -LiteralPath $outputPath -Value $generated -Encoding UTF8
}
