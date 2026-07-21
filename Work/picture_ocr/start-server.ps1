# UTF-8 with BOM. Windows PowerShell 5.1+：Web ZIP 本机控制端和可信局域网临时采集宿主。
[CmdletBinding()]
param([ValidateRange(0, 65535)][int]$Port = 0, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$script:MaxImageBytes = 10MB
$script:MaxPendingUploads = 8
$script:AllowedImageTypes = @('image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp')
$script:StaticCsp = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'none'"
$script:Session = $null; $script:SessionLock = [object]::new()
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'dist')); $indexFile = Join-Path $root 'index.html'
if (-not (Test-Path -LiteralPath $indexFile -PathType Leaf)) { throw '未找到 dist\index.html。请解压完整 Release 压缩包，不要只复制启动脚本。' }

function Get-PrivateLanAddresses {
    $result = [Collections.Generic.List[object]]::new()
    foreach ($adapter in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($adapter.OperationalStatus -ne 'Up' -or $adapter.NetworkInterfaceType -eq 'Loopback') { continue }
        foreach ($entry in $adapter.GetIPProperties().UnicastAddresses) {
            $ip = $entry.Address; if ($ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { continue }; $b = $ip.GetAddressBytes()
            if ($b[0] -eq 10 -or ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31) -or ($b[0] -eq 192 -and $b[1] -eq 168)) { $result.Add([pscustomobject]@{ name = $adapter.Name; address = $ip.ToString() }) }
        }
    }
    return @($result | Sort-Object address -Unique)
}
function Get-FreePort { for ($candidate = 51730; $candidate -lt 51830; $candidate++) { $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidate); try { $probe.Start(); return $candidate } catch { } finally { try { $probe.Stop() } catch { } } }; throw '未找到可用本地端口。请关闭占用 51730-51829 的程序后重试。' }
function ConvertTo-Base64Url { param([byte[]]$Bytes) ([Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')) }
function New-SessionToken { $bytes = [byte[]]::new(32); $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }; ConvertTo-Base64Url $bytes }
function Get-ContentType { param([string]$FilePath) switch ([IO.Path]::GetExtension($FilePath).ToLowerInvariant()) { '.html' {'text/html; charset=utf-8'} '.js' {'text/javascript; charset=utf-8'} '.mjs' {'text/javascript; charset=utf-8'} '.css' {'text/css; charset=utf-8'} '.json' {'application/json; charset=utf-8'} '.svg' {'image/svg+xml'} '.png' {'image/png'} '.jpg' {'image/jpeg'} '.jpeg' {'image/jpeg'} '.gif' {'image/gif'} '.webp' {'image/webp'} '.ico' {'image/x-icon'} '.webmanifest' {'application/manifest+json; charset=utf-8'} default {'application/octet-stream'} } }
function Get-SafeFileName { param([string]$Value) try { $value = [Uri]::UnescapeDataString($Value) } catch { $value = $Value }; $value = ($value -replace '[\\/:*?""<>|\x00-\x1F]', '_').Trim(); if ($value.Length -gt 120) { $value = $value.Substring(0, 120) }; if ([string]::IsNullOrWhiteSpace($value)) { "mobile-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).image" } else { $value } }
function Test-ImageSignature { param([string]$Type, [byte[]]$Bytes) switch ($Type) { 'image/png' {$Bytes.Length -ge 8 -and $Bytes[0] -eq 0x89 -and $Bytes[1] -eq 0x50 -and $Bytes[2] -eq 0x4e -and $Bytes[3] -eq 0x47 -and $Bytes[4] -eq 0x0d -and $Bytes[5] -eq 0x0a -and $Bytes[6] -eq 0x1a -and $Bytes[7] -eq 0x0a} 'image/jpeg' {$Bytes.Length -ge 3 -and $Bytes[0] -eq 0xff -and $Bytes[1] -eq 0xd8 -and $Bytes[2] -eq 0xff} 'image/gif' {$Bytes.Length -ge 6 -and (([Text.Encoding]::ASCII.GetString($Bytes,0,6) -eq 'GIF87a') -or ([Text.Encoding]::ASCII.GetString($Bytes,0,6) -eq 'GIF89a'))} 'image/webp' {$Bytes.Length -ge 12 -and [Text.Encoding]::ASCII.GetString($Bytes,0,4) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($Bytes,8,4) -eq 'WEBP'} 'image/bmp' {$Bytes.Length -ge 2 -and [Text.Encoding]::ASCII.GetString($Bytes,0,2) -eq 'BM'} default {$false} } }
function Stop-LanListener {
    param([string]$Address)
    foreach ($listener in @($script:Listeners | Where-Object { $_.LocalEndpoint.Address.ToString() -eq $Address })) {
        try { $listener.Stop() } finally { [void]$script:Listeners.Remove($listener) }
    }
}
function Get-ActiveSession {
    $expiredAddress = $null
    [Threading.Monitor]::Enter($script:SessionLock)
    try {
        if ($script:Session -and [DateTime]::UtcNow -ge $script:Session.expiresAt) { $expiredAddress = $script:Session.address; $script:Session = $null }
        $session = $script:Session
    } finally { [Threading.Monitor]::Exit($script:SessionLock) }
    if ($expiredAddress) { Stop-LanListener $expiredAddress }
    return $session
}
function Stop-LanSession {
    [Threading.Monitor]::Enter($script:SessionLock)
    try { $address = if ($script:Session) { $script:Session.address } else { $null }; $script:Session = $null } finally { [Threading.Monitor]::Exit($script:SessionLock) }
    if ($address) { Stop-LanListener $address }
}
function Ensure-LanListener {
    param([string]$Address)
    if (@($script:Listeners | ForEach-Object { $_.LocalEndpoint.Address.ToString() }) -contains $Address) { return }
    try {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse($Address), $script:ListenPort)
        $listener.Start()
        $script:Listeners.Add($listener)
    } catch {
        throw "无法监听局域网地址 $Address`:$script:ListenPort。请确认该网络仍已连接，并仅在 Windows 防火墙的专用网络中允许访问。"
    }
}

function Read-ExactBytes { param([Net.Sockets.NetworkStream]$Stream, [int]$Length) $bytes = [byte[]]::new($Length); $offset = 0; while ($offset -lt $Length) { $read = $Stream.Read($bytes, $offset, $Length - $offset); if ($read -le 0) { throw '请求正文不完整。' }; $offset += $read }; $bytes }
function Read-HttpRequest {
    param([Net.Sockets.TcpClient]$Client)
    $stream = $Client.GetStream(); $headerBytes = [Collections.Generic.List[byte]]::new(); $match = 0
    while ($headerBytes.Count -lt 32768) { $next = $stream.ReadByte(); if ($next -lt 0) { return $null }; $headerBytes.Add([byte]$next); $match = if (($match -eq 0 -and $next -eq 13) -or ($match -eq 1 -and $next -eq 10) -or ($match -eq 2 -and $next -eq 13) -or ($match -eq 3 -and $next -eq 10)) { $match + 1 } elseif ($next -eq 13) { 1 } else { 0 }; if ($match -eq 4) { break } }
    if ($match -ne 4) { throw 'HTTP 请求头过大或格式无效。' }; $text = [Text.Encoding]::ASCII.GetString($headerBytes.ToArray()); $lines = $text -split "`r`n"; $parts = $lines[0] -split ' '; if ($parts.Count -lt 2) { throw 'HTTP 请求行无效。' }; $headers = @{}
    foreach ($line in $lines[1..($lines.Count-1)]) { $index = $line.IndexOf(':'); if ($index -gt 0) { $headers[$line.Substring(0,$index).Trim().ToLowerInvariant()] = $line.Substring($index+1).Trim() } }
    $length = if ($headers.ContainsKey('content-length')) { [int]$headers['content-length'] } else { 0 }; if ($length -lt 0 -or $length -gt $script:MaxImageBytes) { throw '图片超过 10MB 限制。' }
    return [pscustomobject]@{ method = $parts[0].ToUpperInvariant(); rawTarget = $parts[1]; headers = $headers; body = $(if ($length -gt 0) { Read-ExactBytes $stream $length } else { [byte[]]::new(0) }); stream = $stream; remote = $Client.Client.RemoteEndPoint; local = $Client.Client.LocalEndPoint }
}
function Send-Response { param($Request, [int]$Status, [string]$ContentType, [byte[]]$Body, [hashtable]$Headers = @{}) $reasons = @{200='OK';201='Created';202='Accepted';400='Bad Request';401='Unauthorized';403='Forbidden';404='Not Found';405='Method Not Allowed';409='Conflict';413='Payload Too Large';415='Unsupported Media Type';429='Too Many Requests';503='Service Unavailable'}; $header = "HTTP/1.1 $Status $($reasons[$Status])`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n"; foreach ($key in $Headers.Keys) { $header += "$key`: $($Headers[$key])`r`n" }; $header += "`r`n"; $headBytes = [Text.Encoding]::ASCII.GetBytes($header); $Request.stream.Write($headBytes,0,$headBytes.Length); if ($Request.method -ne 'HEAD' -and $Body.Length -gt 0) { $Request.stream.Write($Body,0,$Body.Length) } }
function Send-Json { param($Request,[int]$Status,[object]$Value) $body = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 16 -Compress)); Send-Response $Request $Status 'application/json; charset=utf-8' $body @{ 'Cache-Control'='no-store' } }
function Send-Error { param($Request,[int]$Status,[string]$Message) Send-Json $Request $Status @{message=$Message} }
function Get-RequestUri { param($Request) try { [Uri]::new("http://localhost$($Request.rawTarget)") } catch { throw 'URL 无效。' } }
function Test-LoopbackRequest { param($Request) [Net.IPAddress]::IsLoopback($Request.remote.Address) }

function ConvertTo-NormalizedSnapshot {
    param($Value)
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value.projectId) -or $null -eq $Value.categories -or $null -eq $Value.assets) { throw '采集快照无效。' }
    $categories = [Collections.Generic.List[object]]::new(); $categoryIds = [Collections.Generic.HashSet[string]]::new()
    foreach ($category in @($Value.categories)) { if ($category -and -not [string]::IsNullOrWhiteSpace([string]$category.id) -and -not [string]::IsNullOrWhiteSpace([string]$category.name) -and $category.id.Length -le 200 -and $category.name.Length -le 200 -and $categoryIds.Add([string]$category.id)) { $categories.Add([pscustomobject]@{id=[string]$category.id;name=[string]$category.name}) } }
    $assets = [Collections.Generic.List[object]]::new(); $allowed = @{}
    foreach ($asset in @($Value.assets)) {
        if (-not $asset -or -not $categoryIds.Contains([string]$asset.categoryId) -or [string]::IsNullOrWhiteSpace([string]$asset.id) -or [string]::IsNullOrWhiteSpace([string]$asset.name) -or $asset.id.Length -gt 200 -or $asset.name.Length -gt 200) { continue }; $items = [Collections.Generic.List[object]]::new(); $itemIds = [Collections.Generic.HashSet[string]]::new()
        foreach ($item in @($asset.items)) { if ($item -and -not [string]::IsNullOrWhiteSpace([string]$item.id) -and -not [string]::IsNullOrWhiteSpace([string]$item.label) -and $item.id.Length -le 200 -and $item.label.Length -le 300 -and $itemIds.Add([string]$item.id)) { $items.Add([pscustomobject]@{id=[string]$item.id;label=[string]$item.label;required=[bool]$item.required;imageCount=[Math]::Max(0,[int]$item.imageCount)}) } }; $assets.Add([pscustomobject]@{id=[string]$asset.id;name=[string]$asset.name;categoryId=[string]$asset.categoryId;items=@($items)}); $allowed[[string]$asset.id] = $itemIds
    }
    if ($categories.Count -eq 0 -or $assets.Count -eq 0) { throw '采集快照缺少可用分类或资产。' }
    [pscustomobject]@{snapshot=[pscustomobject]@{projectId=([string]$Value.projectId).Substring(0,[Math]::Min(200,([string]$Value.projectId).Length));title=$(if([string]::IsNullOrWhiteSpace([string]$Value.title)){'未命名采集系统'}else{([string]$Value.title).Substring(0,[Math]::Min(200,([string]$Value.title).Length))});categories=@($categories);assets=@($assets)};allowed=$allowed}
}
function Handle-Control { param($Request,$Path)
    if (-not (Test-LoopbackRequest $Request)) { Send-Error $Request 403 '控制接口仅允许本机浏览器访问。'; return }
    if ([string]$Request.headers['x-evidence-control'] -ne '1') { Send-Error $Request 403 '控制接口缺少本机应用标识。'; return }
    if ($Path -eq '/api/control/status' -and $Request.method -eq 'GET') { $session=Get-ActiveSession; Send-Json $Request 200 @{running=[bool]$session;url=$(if($session){$session.url}else{$null});addresses=@(Get-PrivateLanAddresses)}; return }
    if ($Path -eq '/api/control/start' -and $Request.method -eq 'POST') { try { $payload=([Text.Encoding]::UTF8.GetString($Request.body)|ConvertFrom-Json);$addresses=@(Get-PrivateLanAddresses);$selected=[string]$payload.selectedAddress;if($addresses.Count -eq 0){throw '未检测到可用私有局域网 IPv4 地址。请连接同一 Wi-Fi 或启用电脑连接的手机热点后重试。'};if(@($addresses | ForEach-Object { $_.address }) -notcontains $selected){throw '请选择手机实际可访问的 Wi-Fi 或热点地址。'};$normalized=ConvertTo-NormalizedSnapshot $payload.snapshot;Stop-LanSession;Ensure-LanListener $selected;$token=New-SessionToken;$session=[pscustomobject]@{token=$token;address=$selected;snapshot=$normalized.snapshot;allowed=$normalized.allowed;pending=[ordered]@{};completed=[ordered]@{};expiresAt=[DateTime]::UtcNow.AddHours(2);url="http://$selected`:$script:ListenPort/#/lan/$token"};[Threading.Monitor]::Enter($script:SessionLock);try{$script:Session=$session}finally{[Threading.Monitor]::Exit($script:SessionLock)};Send-Json $Request 200 @{running=$true;url=$session.url;addresses=$addresses};return }catch{Send-Error $Request 400 $_.Exception.Message;return} }
    if ($Path -eq '/api/control/update' -and $Request.method -eq 'POST') {
        try {
            $payload = ([Text.Encoding]::UTF8.GetString($Request.body) | ConvertFrom-Json)
            $normalized = ConvertTo-NormalizedSnapshot $payload.snapshot
            $session = Get-ActiveSession
            if (-not $session) { Send-Error $Request 409 '采集会话已结束。'; return }
            $outcome = $null
            [Threading.Monitor]::Enter($script:SessionLock)
            try {
                if (-not $script:Session -or $script:Session.token -ne $session.token) {
                    $outcome = @{ status = 409; message = '采集会话已结束。' }
                } elseif ($normalized.snapshot.projectId -ne $script:Session.snapshot.projectId) {
                    $outcome = @{ status = 409; message = '不能用其他项目更新当前采集会话。' }
                } else {
                    $script:Session.snapshot = $normalized.snapshot
                    $script:Session.allowed = $normalized.allowed
                    $outcome = @{ status = 200 }
                }
            } finally { [Threading.Monitor]::Exit($script:SessionLock) }
            if ($outcome.status -ne 200) { Send-Error $Request $outcome.status $outcome.message; return }
            Send-Json $Request 200 @{running=$true;url=$session.url;addresses=@(Get-PrivateLanAddresses)}
            return
        } catch { Send-Error $Request 400 $_.Exception.Message; return }
    }
    if ($Path -eq '/api/control/stop' -and $Request.method -eq 'POST') { Stop-LanSession;Send-Json $Request 200 @{running=$false;url=$null;addresses=@(Get-PrivateLanAddresses)};return }
    if ($Path -eq '/api/control/pending' -and $Request.method -eq 'GET') { $session=Get-ActiveSession;if(-not $session){Send-Json $Request 200 @{upload=$null};return};[Threading.Monitor]::Enter($script:SessionLock);try{$upload=@($session.pending.Values|Select-Object -First 1)[0];Send-Json $Request 200 @{upload=$upload}}finally{[Threading.Monitor]::Exit($script:SessionLock)};return }
    if ($Path -eq '/api/control/confirm' -and $Request.method -eq 'POST') { try{$payload=([Text.Encoding]::UTF8.GetString($Request.body)|ConvertFrom-Json);$session=Get-ActiveSession;if(-not $session){Send-Error $Request 409 '采集会话已结束。';return};$id=[string]$payload.requestId;[Threading.Monitor]::Enter($script:SessionLock);try{if(-not $session.pending.Contains($id)){Send-Error $Request 404 '待确认图片不存在或已处理。';return};$session.pending.Remove($id);$session.completed[$id]=[pscustomobject]@{success=[bool]$payload.success;message=$(if($payload.success){'图片已写入电脑项目。'}elseif([string]::IsNullOrWhiteSpace([string]$payload.message)){'电脑端未能保存图片。'}else{[string]$payload.message});expiresAt=[DateTime]::UtcNow.AddMinutes(2)}}finally{[Threading.Monitor]::Exit($script:SessionLock)};Send-Json $Request 200 @{message='图片保存结果已确认。'};return}catch{Send-Error $Request 400 $_.Exception.Message;return} }
    Send-Error $Request 405 '不支持的控制接口或请求方法。'
}
function Handle-TokenApi { param($Request,$Uri,$Path)
    $session=Get-ActiveSession;if(-not $session -or $Request.local.Address.ToString() -ne $session.address -or $Uri.Query -notmatch "(?:^|[?&])token=$([regex]::Escape($session.token))(?:&|$)"){Send-Error $Request 401 '采集会话无效或已结束。';return}
    if($Path -eq '/api/session' -and $Request.method -eq 'GET'){Send-Json $Request 200 $session.snapshot;return}
    if($Path -eq '/api/upload' -and $Request.method -eq 'POST'){$asset=[string]$Uri.Query -replace '^.*(?:\?|&)assetId=([^&]*).*$','$1';$item=[string]$Uri.Query -replace '^.*(?:\?|&)itemId=([^&]*).*$','$1';try{$asset=[Uri]::UnescapeDataString($asset);$item=[Uri]::UnescapeDataString($item)}catch{};if(-not $session.allowed.ContainsKey($asset)-or -not $session.allowed[$asset].Contains($item)){Send-Error $Request 403 '目标资产或检查项不属于本次采集会话。';return};$type=(([string]$Request.headers['content-type'] -split ';')[0].Trim().ToLowerInvariant());if($script:AllowedImageTypes -notcontains $type){Send-Error $Request 415 '仅支持 PNG、JPEG、GIF、WebP 或 BMP 图片。';return};if(-not(Test-ImageSignature $type $Request.body)){Send-Error $Request 415 '图片内容与声明类型不一致，上传已拒绝。';return};[Threading.Monitor]::Enter($script:SessionLock);try{if($session.pending.Count -ge $script:MaxPendingUploads){Send-Error $Request 429 '待保存图片过多，请等待电脑端完成当前图片后重试。';return}}finally{[Threading.Monitor]::Exit($script:SessionLock)};$id=ConvertTo-Base64Url([Guid]::NewGuid().ToByteArray());$upload=[pscustomobject]@{requestId=$id;projectId=$session.snapshot.projectId;assetId=$asset;itemId=$item;image=[pscustomobject]@{fileName=(Get-SafeFileName $Request.headers['x-file-name']);data="data:$type;base64,$([Convert]::ToBase64String($Request.body))";mimeType=$type}};[Threading.Monitor]::Enter($script:SessionLock);try{$session.pending[$id]=$upload}finally{[Threading.Monitor]::Exit($script:SessionLock)};Send-Json $Request 202 @{requestId=$id;message='图片已收到，正在等待电脑端保存。'};return}
    if($Path -eq '/api/upload-status' -and $Request.method -eq 'GET'){$id=[string]$Uri.Query -replace '^.*(?:\?|&)requestId=([^&]*).*$','$1';[Threading.Monitor]::Enter($script:SessionLock);try{if($session.pending.Contains($id)){Send-Json $Request 202 @{message='正在等待电脑端保存。'};return};if($session.completed.Contains($id)){$outcome=$session.completed[$id];if([DateTime]::UtcNow -ge $outcome.expiresAt){$session.completed.Remove($id);Send-Error $Request 404 '上传结果已过期。';return};Send-Json $Request $(if($outcome.success){201}else{503}) @{message=$outcome.message};return}}finally{[Threading.Monitor]::Exit($script:SessionLock)};Send-Error $Request 404 '上传请求不存在。';return}
    Send-Error $Request 405 '不支持的采集接口或请求方法。'
}
function Serve-Static { param($Request,$Path)
    if($Request.method -notin @('GET','HEAD')){Send-Error $Request 405 '仅支持读取静态资源。';return};try{$decoded=[Uri]::UnescapeDataString($Path)}catch{Send-Error $Request 400 '无效路径。';return};if($decoded -eq '/'){$file=$indexFile}else{$relative=$decoded.TrimStart('/').Replace('/','\');if($relative.Contains('..')){Send-Error $Request 403 '禁止访问该路径。';return};$file=[IO.Path]::GetFullPath((Join-Path $root $relative));if(-not $file.StartsWith("$root$([IO.Path]::DirectorySeparatorChar)",[StringComparison]::OrdinalIgnoreCase)-or -not(Test-Path -LiteralPath $file -PathType Leaf)){Send-Error $Request 404 '资源不存在。';return}};$headers=@{'Cache-Control'=$(if($file -eq $indexFile){'no-store'}else{'public, max-age=3600'});'Cross-Origin-Resource-Policy'='same-origin';'Content-Security-Policy'=$script:StaticCsp};Send-Response $Request 200 (Get-ContentType $file) ([IO.File]::ReadAllBytes($file)) $headers
}

$addresses=@(Get-PrivateLanAddresses);$script:ListenPort=if($Port -gt 0){$Port}else{Get-FreePort};$script:Listeners=[Collections.Generic.List[Net.Sockets.TcpListener]]::new()
try {
    $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$script:ListenPort);$listener.Start();$script:Listeners.Add($listener)
    $url="http://127.0.0.1:$script:ListenPort/";Write-Host '';Write-Host 'Picture OCR 已启动：Web ZIP 支持手机局域网实时采集。' -ForegroundColor Green;Write-Host "电脑浏览器：$url" -ForegroundColor Cyan;if($addresses.Count -gt 0){Write-Host "可用局域网地址：$(@($addresses | ForEach-Object { $_.address }) -join '、')" -ForegroundColor Cyan}else{Write-Host '当前未检测到私有局域网 IPv4；仍可正常使用电脑端，连接 Wi-Fi 或手机热点后可再启动手机采集。' -ForegroundColor Yellow};Write-Host '请保持此窗口打开；手机采集会话只能从网页中的“手机局域网采集”启动。' -ForegroundColor Yellow;Write-Host '';if(-not $NoBrowser){Start-Process $url}
    while($true){$client=$null;foreach($listener in $script:Listeners){if($listener.Pending()){$client=$listener.AcceptTcpClient();$client.ReceiveTimeout=15000;$client.SendTimeout=15000;break}};if(-not $client){Start-Sleep -Milliseconds 25;continue};try{$request=Read-HttpRequest $client;if($request){$uri=Get-RequestUri $request;$path=$uri.AbsolutePath;if($path.StartsWith('/api/control/')){Handle-Control $request $path}elseif($path.StartsWith('/api/')){Handle-TokenApi $request $uri $path}else{Serve-Static $request $path}}}catch{Write-Host "[REQUEST ERROR] $($_.Exception.Message)" -ForegroundColor Yellow;try{if($request){Send-Error $request 500 '服务器处理请求失败。'}}catch{}}finally{try{$client.Close()}catch{}}}
} catch { Write-Host "[SERVER ERROR] 无法监听本机地址：$($_.Exception.Message)" -ForegroundColor Red;exit 1 } finally { Stop-LanSession;foreach($listener in $script:Listeners){try{$listener.Stop()}catch{}} }
