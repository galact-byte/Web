# Windows PowerShell 5.1+：验证 Web ZIP 局域网采集宿主的控制、认证、上传确认和静态资源边界。
[CmdletBinding()]
param(
    [string]$ReleaseRoot
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ReleaseRoot)) { $ReleaseRoot = Split-Path -Parent $PSScriptRoot }
$serverScript = Join-Path $ReleaseRoot 'start-server.ps1'
if (-not (Test-Path -LiteralPath $serverScript -PathType Leaf)) { throw "未找到启动脚本：$serverScript" }

function Assert-That {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "验证失败：$Message" }
}

function Invoke-JsonRequest {
    param([string]$Method, [string]$Uri, [object]$Body)
    $parameters = @{ Method = $Method; Uri = $Uri; UseBasicParsing = $true; ErrorAction = 'Stop' }
    if (([Uri]$Uri).AbsolutePath.StartsWith('/api/control/')) { $parameters.Headers = @{ 'X-Evidence-Control' = '1' } }
    if ($PSBoundParameters.ContainsKey('Body')) {
        $parameters.ContentType = 'application/json; charset=utf-8'
        $parameters.Body = ($Body | ConvertTo-Json -Depth 12 -Compress)
    }
    try {
        $response = Invoke-WebRequest @parameters
        return @{ StatusCode = [int]$response.StatusCode; Body = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null } }
    } catch {
        $webResponse = $_.Exception.Response
        if ($null -eq $webResponse) { throw }
        $content = $_.ErrorDetails.Message
        if ([string]::IsNullOrWhiteSpace($content)) {
            $reader = [System.IO.StreamReader]::new($webResponse.GetResponseStream())
            try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
        return @{ StatusCode = [int]$webResponse.StatusCode; Body = if ($content) { $content | ConvertFrom-Json } else { $null } }
    }
}

$port = Get-Random -Minimum 52100 -Maximum 52900
$logPath = Join-Path ([System.IO.Path]::GetTempPath()) "picture-ocr-web-lan-$port.log"
$process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $serverScript, '-Port', $port, '-NoBrowser') -WorkingDirectory $ReleaseRoot -RedirectStandardOutput $logPath -RedirectStandardError "$logPath.err" -PassThru
$baseUrl = "http://127.0.0.1:$port"
$uploadJob = $null

try {
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    $status = $null
    do {
        Start-Sleep -Milliseconds 200
        try { $status = Invoke-JsonRequest -Method GET -Uri "$baseUrl/api/control/status" } catch { }
    } while ($null -eq $status -and [DateTime]::UtcNow -lt $deadline)
    Assert-That ($null -ne $status -and $status.StatusCode -eq 200) "启动器必须提供 localhost 控制状态 API。日志：$(if (Test-Path $logPath) { Get-Content -Raw $logPath } else { '无' })"
    try { $missingControlHeaderStatus = [int](Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/control/status").StatusCode } catch { $missingControlHeaderStatus = [int]$_.Exception.Response.StatusCode }
    Assert-That ($missingControlHeaderStatus -eq 403) '即使来自 loopback，缺少本机应用标识的跨站控制请求也必须被拒绝。'
    if ($status.Body.addresses.Count -eq 0) {
        $unavailable = Invoke-JsonRequest -Method POST -Uri "$baseUrl/api/control/start" -Body @{ selectedAddress = ''; snapshot = @{ projectId = 'verify-project'; categories = @(); assets = @() } }
        Assert-That ($unavailable.StatusCode -eq 400 -and $unavailable.Body.message -match '未检测到可用私有局域网 IPv4 地址') '无 LAN 环境必须保持本机控制端可用，并明确拒绝启动手机采集会话。'
        Write-Host 'Web ZIP 无 LAN 验证通过：本机工作台可用，手机采集会话明确提示需连接 Wi-Fi 或热点。' -ForegroundColor Green
        return
    }

    $selectedAddress = [string]$status.Body.addresses[0].address
    $invalidSnapshotStart = Invoke-JsonRequest -Method POST -Uri "$baseUrl/api/control/start" -Body @{ selectedAddress = $selectedAddress; snapshot = @{ projectId = 'verify-project'; categories = @(); assets = @() } }
    Assert-That ($invalidSnapshotStart.StatusCode -eq 400 -and $invalidSnapshotStart.Body.message -match '采集快照缺少可用分类或资产') '快照校验失败必须返回明确错误。'
    $statusAfterInvalidStart = Invoke-JsonRequest -Method GET -Uri "$baseUrl/api/control/status"
    Assert-That (-not $statusAfterInvalidStart.Body.running) '快照校验失败不得创建会话或遗留 LAN 监听。'

    $snapshot = @{
        projectId = 'verify-project'; title = 'Web LAN 验证系统'
        categories = @(@{ id = 'cat-1'; name = '验证分类' })
        assets = @(@{ id = 'asset-1'; name = '验证资产'; categoryId = 'cat-1'; items = @(@{ id = 'item-1'; label = '验证检查项'; required = $true; imageCount = 0 }) })
    }
    $started = Invoke-JsonRequest -Method POST -Uri "$baseUrl/api/control/start" -Body @{ snapshot = $snapshot; selectedAddress = $selectedAddress }
    Assert-That ($started.StatusCode -eq 200 -and $started.Body.url -match "^http://$([regex]::Escape($selectedAddress))`:$port/#/lan/") "启动会话必须返回所选 LAN IP 的手机 URL；状态：$($started.StatusCode)，响应：$($started.Body | ConvertTo-Json -Compress)"
    $token = ([uri]$started.Body.url.Replace('/#/lan/', '/lan/')).Segments[-1]
    $lanBaseUrl = "http://$selectedAddress`:$port"

    $static = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/" -ErrorAction Stop
    Assert-That ($static.StatusCode -eq 200 -and $static.Headers['Content-Security-Policy']) '静态首页必须可访问且返回 CSP。'
    $traversal = Invoke-JsonRequest -Method GET -Uri "$baseUrl/%2e%2e/start-server.ps1"
    Assert-That ($traversal.StatusCode -ne 200) '静态服务不得允许目录越界。'
    Assert-That ((Invoke-JsonRequest -Method GET -Uri "$lanBaseUrl/api/session?token=wrong-token").StatusCode -eq 401) '错误 token 必须被拒绝。'
    Assert-That ((Invoke-JsonRequest -Method GET -Uri "$lanBaseUrl/api/session?token=$token").StatusCode -eq 200) '正确 token 必须读取采集快照。'
    Assert-That ((Invoke-JsonRequest -Method GET -Uri "$baseUrl/api/session?token=$token").StatusCode -eq 401) '手机 token API 必须只在会话绑定的私有地址上有效。'
    Assert-That ((Invoke-JsonRequest -Method POST -Uri "$lanBaseUrl/api/upload?token=$token&assetId=missing&itemId=item-1").StatusCode -eq 403) '不在白名单内的资产必须被拒绝。'

    $png = [Convert]::FromBase64String('iVBORw0KGgo=')
    try { $badStatus = [int](Invoke-WebRequest -UseBasicParsing -Method POST -Uri "$lanBaseUrl/api/upload?token=$token&assetId=asset-1&itemId=item-1" -Headers @{ 'Content-Type' = 'text/plain' } -Body 'not-image').StatusCode } catch { $badStatus = [int]$_.Exception.Response.StatusCode }
    Assert-That ($badStatus -eq 415) '非图片上传必须被拒绝。'

    $encodedFileName = [Uri]::EscapeDataString('现场截图.png')
    $accepted = Invoke-WebRequest -UseBasicParsing -Method POST -Uri "$lanBaseUrl/api/upload?token=$token&assetId=asset-1&itemId=item-1" -Headers @{ 'Content-Type' = 'image/png'; 'X-File-Name' = $encodedFileName } -Body $png
    Assert-That ($accepted.StatusCode -eq 202) '图片必须先进入待确认队列，不能在浏览器落盘前报告成功。'
    $pending = Invoke-JsonRequest -Method GET -Uri "$baseUrl/api/control/pending"
    Assert-That ($pending.Body.upload.requestId -and $pending.Body.upload.assetId -eq 'asset-1') '浏览器控制端必须能轮询到待确认图片。'
    Assert-That ($pending.Body.upload.image.fileName -eq '现场截图.png') '手机上传的 URL 编码中文文件名必须先解码再保存。'
    $confirmed = Invoke-JsonRequest -Method POST -Uri "$baseUrl/api/control/confirm" -Body @{ requestId = $pending.Body.upload.requestId; success = $true }
    Assert-That ($confirmed.StatusCode -eq 200) '浏览器 IndexedDB 成功确认必须被接受。'
    Assert-That ((Invoke-JsonRequest -Method GET -Uri "$lanBaseUrl/api/upload-status?token=$token&requestId=$($pending.Body.upload.requestId)").StatusCode -eq 201) '手机只能在浏览器确认后从上传状态接口收到 201。'
    Assert-That ((Invoke-JsonRequest -Method GET -Uri "$baseUrl/api/control/pending").Body.upload -eq $null) '确认后图片必须立即离开待确认队列，不能被重复投递。'

    Assert-That ((Invoke-JsonRequest -Method POST -Uri "$baseUrl/api/control/stop" -Body @{}).StatusCode -eq 200) '控制端必须能停止会话。'
    $sessionClosed = $false
    try { $sessionClosed = (Invoke-JsonRequest -Method GET -Uri "$lanBaseUrl/api/session?token=$token").StatusCode -eq 401 } catch { $sessionClosed = $true }
    Assert-That $sessionClosed '会话停止后 token 必须失效，且 LAN 监听可被关闭。'
    Write-Host 'Web ZIP 局域网采集验证通过：控制端、随机令牌、快照、白名单、静态边界、上传交付确认和关闭失效均符合预期。' -ForegroundColor Green
} finally {
    if ($uploadJob) { Remove-Job $uploadJob -Force -ErrorAction SilentlyContinue }
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    Remove-Item -LiteralPath $logPath, "$logPath.err" -Force -ErrorAction SilentlyContinue
}
