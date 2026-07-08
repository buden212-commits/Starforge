# Starforge — lokal webbserver (krävs för ES-moduler)
$Port = 8766
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$Mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
}

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://localhost:$Port/")
$Listener.Start()

Write-Host ""
Write-Host "  STARFORGE kors pa http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  Tryck Ctrl+C for att stanga servern" -ForegroundColor DarkGray
Write-Host ""

Start-Process "http://localhost:$Port/"

try {
  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    $Request = $Context.Request
    $Response = $Context.Response

    $Relative = [Uri]::UnescapeDataString($Request.Url.LocalPath).TrimStart("/")
    if ($Relative -eq "" -or $Relative -eq "/") { $Relative = "index.html" }
    $Relative = $Relative -replace "/", [IO.Path]::DirectorySeparatorChar
    $FilePath = Join-Path $Root $Relative

    # Sakerhet: stanna inom projektmappen
    $FullRoot = [IO.Path]::GetFullPath($Root)
    $FullFile = [IO.Path]::GetFullPath($FilePath)
    if (-not $FullFile.StartsWith($FullRoot)) {
      $Response.StatusCode = 403
      $Response.Close()
      continue
    }

    if (Test-Path $FullFile -PathType Leaf) {
      $Bytes = [IO.File]::ReadAllBytes($FullFile)
      $Ext = [IO.Path]::GetExtension($FullFile).ToLower()
      if ($Mime.ContainsKey($Ext)) {
        $Response.ContentType = $Mime[$Ext]
      }
      $Response.ContentLength64 = $Bytes.Length
      $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    } else {
      $Response.StatusCode = 404
      $Msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $Response.OutputStream.Write($Msg, 0, $Msg.Length)
    }

    $Response.Close()
  }
} finally {
  $Listener.Stop()
}
