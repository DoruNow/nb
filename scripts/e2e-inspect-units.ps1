$ErrorActionPreference = "Stop"
$ver = Invoke-RestMethod http://127.0.0.1:9334/json/version

function Connect([string]$url) {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$url, [Threading.CancellationToken]::None).Wait()
  return @{ Ws = $ws; Id = 0; Buf = New-Object byte[] 2097152 }
}

function Send($s, $method, $params) {
  $s.Id++
  $payload = @{ id = $s.Id; method = $method }
  if ($null -ne $params) { $payload.params = $params }
  $json = $payload | ConvertTo-Json -Compress -Depth 40
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $s.Ws.SendAsync(
    [ArraySegment[byte]]::new($bytes),
    [Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [Threading.CancellationToken]::None
  ).Wait()
  while ($true) {
    $result = $s.Ws.ReceiveAsync(
      [ArraySegment[byte]]::new($s.Buf),
      [Threading.CancellationToken]::None
    ).Result
    $text = [Text.Encoding]::UTF8.GetString($s.Buf, 0, $result.Count)
    $msg = $text | ConvertFrom-Json
    if ($msg.id -eq $s.Id) { return $msg }
  }
}

$browser = Connect $ver.webSocketDebuggerUrl
$created = Send $browser "Target.createTarget" @{ url = "http://127.0.0.1:5173/e2e" }
Start-Sleep -Seconds 2
$pages = Invoke-RestMethod http://127.0.0.1:9334/json/list
$page = $pages | Where-Object { $_.id -eq $created.result.targetId } | Select-Object -First 1
$session = Connect $page.webSocketDebuggerUrl
[void](Send $session "Runtime.enable" $null)
Start-Sleep -Seconds 4

$expr = @'
(async () => {
  const mod = await import("/src/lib/numberblocksSb3.ts");
  const { numberblocksAssets, sceneCubeUnits, splitOfficialAddends } = mod;
  const out = {};
  for (const value of [100, 41, 45, 141, 145]) {
    const parts = splitOfficialAddends(value);
    const scenes = await numberblocksAssets.getNumberblockScene(value);
    out[String(value)] = {
      parts,
      scenes: scenes.map((s, i) => ({
        part: parts[i],
        unit: s.unit,
        bodyW: +s.body.width.toFixed(2),
        bodyH: +s.body.height.toFixed(2),
        cubesW: +sceneCubeUnits(s).wide.toFixed(2),
        cubesH: +sceneCubeUnits(s).tall.toFixed(2),
      })),
    };
  }
  return out;
})()
'@

$eval = Send $session "Runtime.evaluate" @{
  expression = $expr
  awaitPromise = $true
  returnByValue = $true
}
if ($eval.result.exceptionDetails) {
  $eval.result.exceptionDetails | ConvertTo-Json -Depth 8
  exit 1
}
$eval.result.result.value | ConvertTo-Json -Depth 12
