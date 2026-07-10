$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot 'dist'
$indexFile = Join-Path $root 'index.html'
if (-not (Test-Path -LiteralPath $indexFile -PathType Leaf)) {
    Write-Host '[ERROR] dist\index.html was not found. Extract the full release package first.' -ForegroundColor Red
    exit 1
}

function Get-FreePort {
    for ($port = 51730; $port -lt 51830; $port++) {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        try {
            $probe.Start()
            $probe.Stop()
            return $port
        } catch {
            try { $probe.Stop() } catch { }
        }
    }
    throw 'No available local port was found.'
}

function Get-ContentType {
    param([string]$FilePath)

    $extension = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
    if ($extension -eq '.html') { return 'text/html; charset=utf-8' }
    if ($extension -eq '.js' -or $extension -eq '.mjs') { return 'text/javascript; charset=utf-8' }
    if ($extension -eq '.css') { return 'text/css; charset=utf-8' }
    if ($extension -eq '.json') { return 'application/json; charset=utf-8' }
    if ($extension -eq '.svg') { return 'image/svg+xml' }
    if ($extension -eq '.png') { return 'image/png' }
    if ($extension -eq '.jpg' -or $extension -eq '.jpeg') { return 'image/jpeg' }
    if ($extension -eq '.gif') { return 'image/gif' }
    if ($extension -eq '.ico') { return 'image/x-icon' }
    if ($extension -eq '.webp') { return 'image/webp' }
    return 'application/octet-stream'
}

function Get-RequestedFile {
    param([string]$PathValue)

    $relativePath = [System.Uri]::UnescapeDataString($PathValue).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        return $indexFile
    }
    if ($relativePath.Contains('..')) {
        return $null
    }

    $candidatePath = Join-Path -Path $root -ChildPath $relativePath.Replace('/', '\')
    if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
        return $candidatePath
    }
    return $indexFile
}

$port = Get-FreePort
$url = "http://127.0.0.1:$port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)
$listener.IgnoreWriteExceptions = $true

try {
    $listener.Start()
    Write-Host ''
    Write-Host 'Picture OCR started.' -ForegroundColor Green
    Write-Host "URL: $url" -ForegroundColor Cyan
    Write-Host 'Keep this window open while using the app. If the server stops, this window exits too.'
    Write-Host ''

    Start-Process $url

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response
            if ($request.HttpMethod -ne 'GET' -and $request.HttpMethod -ne 'HEAD') {
                $response.StatusCode = 405
                continue
            }

            $filePath = Get-RequestedFile -PathValue $request.Url.AbsolutePath
            if ($null -eq $filePath) {
                $response.StatusCode = 403
                continue
            }

            $response.StatusCode = 200
            $response.ContentType = Get-ContentType -FilePath $filePath
            $response.Headers['Cache-Control'] = 'no-cache'
            if ($request.HttpMethod -eq 'GET') {
                $body = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $body.Length
                $response.OutputStream.Write($body, 0, $body.Length)
            } else {
                $response.ContentLength64 = 0
            }
        } catch {
            Write-Host "[REQUEST ERROR] $($_.Exception.Message)" -ForegroundColor Yellow
            try { $context.Response.StatusCode = 500 } catch { }
        } finally {
            try { $context.Response.Close() } catch { }
        }
    }
} catch {
    Write-Host "[SERVER ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
}
