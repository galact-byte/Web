$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html') -PathType Leaf)) {
    Write-Host 'dist\index.html was not found. Please extract the full Release ZIP package.' -ForegroundColor Red
    exit 1
}

function Get-FreePort {
    param(
        [int]$StartPort = 51730,
        [int]$MaxAttempts = 100
    )

    for ($port = $StartPort; $port -lt ($StartPort + $MaxAttempts); $port++) {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        try {
            $probe.Start()
            $probe.Stop()
            return $port
        } catch {
            try { $probe.Stop() } catch { }
        }
    }

    throw 'No free local port was found. Please close port-consuming software and try again.'
}

function Get-ContentType {
    param([string]$FilePath)

    switch ([System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.js'   { return 'text/javascript; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.svg'  { return 'image/svg+xml' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.gif'  { return 'image/gif' }
        '.ico'  { return 'image/x-icon' }
        default { return 'application/octet-stream' }
    }
}

function Send-Response {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [byte[]]$Body,
        [string]$ContentType = 'text/plain; charset=utf-8'
    )

    $headers = "HTTP/1.1 $StatusCode $StatusText`r`n" +
        "Content-Type: $ContentType`r`n" +
        "Content-Length: $($Body.Length)`r`n" +
        "Cache-Control: no-cache`r`n" +
        "Connection: close`r`n`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

function Send-TextResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [string]$Text
    )

    $body = [System.Text.Encoding]::UTF8.GetBytes($Text)
    Send-Response -Stream $Stream -StatusCode $StatusCode -StatusText $StatusText -Body $body
}

function Resolve-RequestPath {
    param([string]$RequestTarget)

    $target = ($RequestTarget -split '\?')[0]
    if ([string]::IsNullOrWhiteSpace($target) -or $target -eq '/') {
        $target = '/index.html'
    }

    $decoded = [System.Uri]::UnescapeDataString($target).TrimStart('/')
    $relative = $decoded -replace '/', [System.IO.Path]::DirectorySeparatorChar
    $rootFull = [System.IO.Path]::GetFullPath($root)
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))
    $rootPrefix = $rootFull.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

    if (-not ($fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
        return $null
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $fullPath = Join-Path $rootFull 'index.html'
    }

    return $fullPath
}

$port = Get-FreePort
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
$url = "http://127.0.0.1:$port/"

Write-Host ''
Write-Host 'Picture OCR started.' -ForegroundColor Green
Write-Host "URL: $url" -ForegroundColor Cyan
Write-Host 'The browser should open automatically. Keep this window open while using the app.'
Write-Host 'Close this window or press Ctrl+C to stop.'
Write-Host ''

Start-Process $url

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $buffer = New-Object byte[] 8192
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($read -le 0) { continue }

            $requestText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
            $requestLine = ($requestText -split "`r?`n")[0]
            $parts = $requestLine -split ' '
            if ($parts.Length -lt 2) {
                Send-TextResponse -Stream $stream -StatusCode 400 -StatusText 'Bad Request' -Text 'Bad request.'
                continue
            }

            $method = $parts[0]
            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                Send-TextResponse -Stream $stream -StatusCode 405 -StatusText 'Method Not Allowed' -Text 'Only GET and HEAD are allowed.'
                continue
            }

            $filePath = Resolve-RequestPath -RequestTarget $parts[1]
            if ($null -eq $filePath) {
                Send-TextResponse -Stream $stream -StatusCode 403 -StatusText 'Forbidden' -Text 'Forbidden.'
                continue
            }

            if ($method -eq 'HEAD') {
                $body = [byte[]]::new(0)
            } else {
                $body = [System.IO.File]::ReadAllBytes($filePath)
            }
            Send-Response -Stream $stream -StatusCode 200 -StatusText 'OK' -Body $body -ContentType (Get-ContentType -FilePath $filePath)
        } catch {
            try {
                Send-TextResponse -Stream $stream -StatusCode 500 -StatusText 'Internal Server Error' -Text "Server error: $($_.Exception.Message)"
            } catch { }
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
